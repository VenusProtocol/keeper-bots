import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { PERMIT2_ADDRESS, SignatureTransfer, TokenPermissions } from "@uniswap/permit2-sdk";
import { SingleTokenConverter__factory } from "@venusprotocol/protocol-reserve/dist/typechain/factories/SingleTokenConverter__factory";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { concat, hexlify, parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";

import {
  BatchTokenConverterOperator,
  BatchTokenConverterOperator__factory,
  IERC20__factory,
  ISignatureTransfer__factory,
} from "../typechain";
import ADDRESSES from "./config/addresses";
import { LiquidityProviderName, LiquidityProviders } from "./constants";
import { connect, deploy, faucet, forking, getBlockTimestamp, initUser } from "./framework";

interface TokenConverterOperatorFixture {
  operator: BatchTokenConverterOperator;
}

const makePath = (parts: string[]) => hexlify(concat(parts));

const negate = (value: BigNumber) => BigNumber.from(0).sub(value);

forking({ bsctestnet: 37472590, bscmainnet: 40380000 } as const, network => {
  const addresses = ADDRESSES[network];

  describe("TokenConverterOperator", () => {
    const xvs = connect(IERC20__factory, addresses.XVS);
    const usdt = connect(IERC20__factory, addresses.USDT);
    const converter = connect(SingleTokenConverter__factory, addresses.XVSVaultConverter);
    const permit2 = connect(ISignatureTransfer__factory, PERMIT2_ADDRESS);
    const usdtDecimals = {
      bsctestnet: 6,
      bscmainnet: 18,
    }[network];
    const usdtToReceive = parseUnits("100", usdtDecimals);
    const minIncome = parseUnits("-5", usdtDecimals);
    const sponsorAmount = negate(minIncome);
    const getPath = (liquidityProvider: LiquidityProviderName) => {
      const path = {
        bsctestnet: {
          ["PancakeSwap"]: makePath([addresses.XVS, "0x0001f4", addresses.USDT]),
        },
        bscmainnet: {
          ["Uniswap"]: makePath([addresses.XVS, "0x0001f4", addresses.WBNB, "0x000064", addresses.USDT]),
          ["PancakeSwap"]: makePath([addresses.XVS, "0x0009c4", addresses.WBNB, "0x000064", addresses.USDT]),
        },
      }[network][liquidityProvider];
      if (path === undefined) {
        throw new Error("Unsupported liquidity provider / network combination");
      }
      return path;
    };

    let operator: BatchTokenConverterOperator;
    let root: SignerWithAddress;
    let beneficiary: SignerWithAddress;
    let now: number;
    let deadline: number;
    let chainId: number;

    const liquidityProviders = {
      bsctestnet: ["PancakeSwap"],
      bscmainnet: ["PancakeSwap", "Uniswap"],
    } as const;

    const tokenConverterOperatorFixture = async (): Promise<TokenConverterOperatorFixture> => {
      const [root] = await ethers.getSigners();
      await faucet(xvs, addresses.xvsHolder, root, parseUnits("10000", 18));
      await faucet(usdt, addresses.usdtHolder, root, parseUnits("10000", usdtDecimals));
      await usdt.connect(root).approve(permit2.address, ethers.constants.MaxUint256);
      const operator = await deploy(
        BatchTokenConverterOperator__factory,
        addresses.UniswapRouter,
        addresses.PancakeSwapRouter,
        PERMIT2_ADDRESS,
      );
      return { operator };
    };

    beforeEach(async () => {
      [root, beneficiary] = await ethers.getSigners();
      ({ operator } = await loadFixture(tokenConverterOperatorFixture));

      now = await getBlockTimestamp();
      deadline = now + 6000;
      chainId = (await ethers.provider.getNetwork()).chainId;
      const timelock = await initUser(addresses.NormalTimelock);
      await converter
        .connect(timelock)
        .setConversionConfigs(addresses.XVS, [addresses.USDT], [{ incentive: 0, conversionAccess: 1 }]);
      await usdt.connect(root).transfer(converter.address, usdtToReceive);
      await converter.connect(root).updateAssetsState(addresses.Unitroller, addresses.USDT);
    });

    const makeCommonParams = (liquidityProvider: LiquidityProviderName) => ({
      liquidityProvider: LiquidityProviders[liquidityProvider],
      tokenToReceiveFromConverter: addresses.USDT,
      beneficiary: beneficiary.address,
      amount: usdtToReceive,
      minIncome: minIncome,
      tokenToSendToConverter: addresses.XVS,
      converter: addresses.XVSVaultConverter,
      path: getPath(liquidityProvider),
    });

    const makePermit = async (permitted: TokenPermissions[], nonce: number) => {
      const permit = {
        permitted,
        spender: operator.address,
        nonce,
        deadline,
      };
      const { domain, types, values } = SignatureTransfer.getPermitData(permit, PERMIT2_ADDRESS, chainId);
      const signature = await root._signTypedData(domain, types, values);
      return { permit, signature };
    };

    describe("individual calls", () => {
      describe("checkDeadline", () => {
        it("succeeds if deadline is in the future", async () => {
          await operator.checkDeadline(deadline);
        });

        it("succeeds if deadline is in the past", async () => {
          await expect(operator.checkDeadline(now))
            .to.be.revertedWithCustomError(operator, "DeadlinePassed")
            .withArgs(anyValue, now);
        });
      });

      describe("sponsorWithPermit", () => {
        it("can be sponsored by permit", async () => {
          const { permit, signature } = await makePermit([{ token: usdt.address, amount: sponsorAmount }], 1);
          const tx = await operator.connect(root).sponsorWithPermit(permit, signature);
          await expect(tx).to.changeTokenBalances(usdt, [root, operator], [negate(sponsorAmount), sponsorAmount]);
        });
      });

      for (const liquidityProvider of liquidityProviders[network]) {
        describe(`converts via ${liquidityProvider}`, () => {
          beforeEach(async () => {
            await usdt.connect(root).transfer(operator.address, sponsorAmount);
          });

          it("fails if path start != token to send to converter", async () => {
            const wrongPath = makePath([addresses.USDT, "0x0001f4", addresses.XVS]);
            const tx = operator.connect(root).convert({ ...makeCommonParams(liquidityProvider), path: wrongPath });
            await expect(tx)
              .to.be.revertedWithCustomError(operator, "InvalidSwapStart")
              .withArgs(addresses.XVS, addresses.USDT);
          });

          it("fails if path end != token to receive from converter", async () => {
            const wrongPath = makePath([addresses.XVS, "0x0009c4", addresses.WBNB]);
            const tx = operator.connect(root).convert({ ...makeCommonParams(liquidityProvider), path: wrongPath });
            await expect(tx)
              .to.be.revertedWithCustomError(operator, "InvalidSwapEnd")
              .withArgs(addresses.USDT, addresses.WBNB);
          });

          it("transfers USDT from the token converter", async () => {
            const tx = await operator.connect(root).convert(makeCommonParams(liquidityProvider));
            await expect(tx).to.emit(usdt, "Transfer").withArgs(converter.address, operator.address, usdtToReceive);
          });

          it("transfers XVS to the token converter", async () => {
            const tx = await operator.connect(root).convert(makeCommonParams(liquidityProvider));
            await expect(tx).to.emit(xvs, "Transfer").withArgs(operator.address, anyValue, anyValue);
          });

          it("keeps USDT in the operator contract", async () => {
            await operator.connect(root).convert(makeCommonParams(liquidityProvider));
            expect(await usdt.balanceOf(operator.address)).to.be.gt(0);
          });
        });
      }
    });

    describe("batch calls", () => {
      const delegateToSelf = (
        callData: string,
        { allowFailure }: { allowFailure: boolean } = { allowFailure: false },
      ) => ({
        target: ethers.constants.AddressZero,
        allowFailure,
        callData,
      });

      it("reverts if the call was requested to succeed but it didn't", async () => {
        const tooEarly = now;
        const tx = operator
          .connect(root)
          .batch([delegateToSelf(operator.interface.encodeFunctionData("checkDeadline", [tooEarly]))]);
        await expect(tx).to.be.revertedWithCustomError(operator, "CallFailed").withArgs(0, anyValue);
      });

      it("returns error result if one of the call fails but errors are allowed", async () => {
        const tooEarly = now;
        const result = await operator.connect(root).callStatic.batch([
          delegateToSelf(operator.interface.encodeFunctionData("checkDeadline", [deadline]), { allowFailure: true }), // ok
          delegateToSelf(operator.interface.encodeFunctionData("checkDeadline", [tooEarly]), { allowFailure: true }), // fails
        ]);
        expect(result).to.have.lengthOf(2);
        expect(result[0].success).to.be.true;
        expect(result[0].returnData).to.equal("0x");
        expect(result[1].success).to.be.false;
        const errorResult = operator.interface.decodeErrorResult("DeadlinePassed", result[1].returnData);
        expect(errorResult.deadline).to.equal(tooEarly);
      });

      for (const liquidityProvider of liquidityProviders[network]) {
        describe(`converts via ${liquidityProvider}`, () => {
          it("executes the full conversion in a batch fashion", async () => {
            const { permit, signature } = await makePermit([{ token: usdt.address, amount: sponsorAmount }], 1);
            await operator
              .connect(root)
              .batch([
                delegateToSelf(operator.interface.encodeFunctionData("checkDeadline", [deadline])),
                delegateToSelf(operator.interface.encodeFunctionData("sponsorWithPermit", [permit, signature])),
                delegateToSelf(operator.interface.encodeFunctionData("convert", [makeCommonParams(liquidityProvider)])),
                delegateToSelf(operator.interface.encodeFunctionData("claimAllTo", [usdt.address, root.address])),
              ]);
          });

          it("returns success for each call", async () => {
            const { permit, signature } = await makePermit([{ token: usdt.address, amount: sponsorAmount }], 1);
            const results = await operator
              .connect(root)
              .callStatic.batch([
                delegateToSelf(operator.interface.encodeFunctionData("checkDeadline", [deadline])),
                delegateToSelf(operator.interface.encodeFunctionData("sponsorWithPermit", [permit, signature])),
                delegateToSelf(operator.interface.encodeFunctionData("convert", [makeCommonParams(liquidityProvider)])),
                delegateToSelf(operator.interface.encodeFunctionData("claimAllTo", [usdt.address, root.address])),
              ]);
            expect(results).to.have.lengthOf(4);
            results.forEach(result => {
              expect(result.success).to.be.true;
              expect(result.returnData).to.equal("0x");
            });
          });
        });
      }
    });
  });
});
