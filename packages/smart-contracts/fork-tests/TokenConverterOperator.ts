import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { SingleTokenConverter__factory } from "@venusprotocol/protocol-reserve/dist/typechain/factories/SingleTokenConverter__factory";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { concat, hexlify, parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";

import { IERC20__factory, TokenConverterOperator, TokenConverterOperator__factory } from "../typechain";
import ADDRESSES from "./config/addresses";
import { LiquidityProviderName, LiquidityProviders } from "./constants";
import { connect, deploy, faucet, forking, getBlockTimestamp, initUser } from "./framework";

interface TokenConverterOperatorFixture {
  operator: TokenConverterOperator;
}

const makePath = (parts: string[]) => hexlify(concat(parts));

const negate = (value: BigNumber) => BigNumber.from(0).sub(value);

forking({ bsctestnet: 37472590, bscmainnet: 40380000 } as const, network => {
  const addresses = ADDRESSES[network];

  describe("TokenConverterOperator", () => {
    const xvs = connect(IERC20__factory, addresses.XVS);
    const usdt = connect(IERC20__factory, addresses.USDT);
    const converter = connect(SingleTokenConverter__factory, addresses.XVSVaultConverter);
    const usdtDecimals = {
      bsctestnet: 6,
      bscmainnet: 18,
    }[network];
    let operator: TokenConverterOperator;
    let root: SignerWithAddress;
    let beneficiary: SignerWithAddress;

    const liquidityProviders = {
      bsctestnet: ["PancakeSwap"],
      bscmainnet: ["PancakeSwap", "Uniswap"],
    } as const;

    const tokenConverterOperatorFixture = async (): Promise<TokenConverterOperatorFixture> => {
      const [root] = await ethers.getSigners();
      await faucet(xvs, addresses.xvsHolder, root, parseUnits("10000", 18));
      await faucet(usdt, addresses.usdtHolder, root, parseUnits("10000", usdtDecimals));
      const operator = await deploy(
        TokenConverterOperator__factory,
        addresses.UniswapRouter,
        addresses.PancakeSwapRouter,
      );
      return { operator };
    };

    beforeEach(async () => {
      [root, beneficiary] = await ethers.getSigners();
      ({ operator } = await loadFixture(tokenConverterOperatorFixture));
    });

    describe("arbitraging via SingleTokenConverter", () => {
      const usdtToReceive = parseUnits("100", usdtDecimals);
      const minIncome = parseUnits("-5", usdtDecimals);
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
      let now: number;

      const makeCommonParams = (liquidityProvider: LiquidityProviderName) => ({
        liquidityProvider: LiquidityProviders[liquidityProvider],
        tokenToReceiveFromConverter: addresses.USDT,
        beneficiary: beneficiary.address,
        amount: usdtToReceive,
        minIncome: minIncome,
        tokenToSendToConverter: addresses.XVS,
        converter: addresses.XVSVaultConverter,
        path: getPath(liquidityProvider),
        deadline: now + 6000,
      });

      beforeEach(async () => {
        now = await getBlockTimestamp();
        const timelock = await initUser(addresses.NormalTimelock);
        await converter
          .connect(timelock)
          .setConversionConfigs(addresses.XVS, [addresses.USDT], [{ incentive: 0, conversionAccess: 1 }]);
        await usdt.connect(root).transfer(converter.address, usdtToReceive);
        await converter.connect(root).updateAssetsState(addresses.Unitroller, addresses.USDT);
        await usdt.connect(root).approve(operator.address, negate(minIncome));
      });

      for (const liquidityProvider of liquidityProviders[network]) {
        describe(`converts via ${liquidityProvider}`, () => {
          it("fails if deadline has passed", async () => {
            const tooEarly = now;
            const tx = operator.connect(root).convert({ ...makeCommonParams(liquidityProvider), deadline: tooEarly });
            await expect(tx).to.be.revertedWithCustomError(operator, "DeadlinePassed").withArgs(anyValue, tooEarly);
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

          it("leaves no money in the operator contract", async () => {
            await operator.connect(root).convert(makeCommonParams(liquidityProvider));
            expect(await usdt.balanceOf(operator.address)).to.equal(0);
            expect(await xvs.balanceOf(operator.address)).to.equal(0);
          });
        });
      }
    });
  });
});
