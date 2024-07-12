import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  Comptroller__factory,
  VTokenInterface__factory,
  WhitePaperInterestRateModel__factory,
} from "@venusprotocol/isolated-pools/dist/typechain";
import { expect } from "chai";
import { concat, hexlify, parseEther, parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";

import { IERC20__factory, LiquidationOperator, LiquidationOperator__factory } from "../typechain";
import ADDRESSES from "./config/addresses";
import { LiquidityProviders } from "./constants";
import { connect, deploy, forking, getBlockTimestamp, initUser } from "./framework";

interface LiquidationOperatorFixture {
  operator: LiquidationOperator;
}

const makePath = (parts: string[]) => hexlify(concat(parts));

const deployZeroRateModel = async () => {
  // Since it's a zero rate model, any value for blocks per year should work
  const blocksPerYear = 123456;
  return deploy(WhitePaperInterestRateModel__factory, 0, 0, false, blocksPerYear);
};

forking({ bscmainnet: 36612930 } as const, network => {
  const addresses = ADDRESSES[network];

  describe("LiquidationOperator", () => {
    const comptroller = connect(Comptroller__factory, addresses.Comptroller_DeFi);
    const bsw = connect(IERC20__factory, addresses.BSW);
    const usdt = connect(IERC20__factory, addresses.USDT);
    const vBSW = connect(VTokenInterface__factory, addresses.VToken_vBSW_DeFi);
    const vUSDT = connect(VTokenInterface__factory, addresses.VToken_vUSDT_DeFi);
    const borrowerAddress = {
      bscmainnet: "0x07533963Da0494A48a763C82359DC131a79011f0",
    }[network];
    let operator: LiquidationOperator;
    let root: SignerWithAddress;
    let beneficiary: SignerWithAddress;

    const liquidationOperatorFixture = async (): Promise<LiquidationOperatorFixture> => {
      const zeroRateModel = await deployZeroRateModel();
      const timelock = await initUser(addresses.NormalTimelock, parseEther("1"));
      const borrower = await initUser(borrowerAddress, parseEther("1"));
      // Set zero rate models for USDT and BSW so that we could compute the exact amounts in tests
      await vBSW.connect(timelock).setInterestRateModel(zeroRateModel.address);
      await vUSDT.connect(timelock).setInterestRateModel(zeroRateModel.address);
      // Borrow USDT for in-kind liquidations
      await vUSDT.connect(borrower).borrow(parseUnits("1", 18));
      // Set min liquidatable collateral to zero so that we don't have to batch-liquidate
      await comptroller.connect(timelock).setMinLiquidatableCollateral(0);
      // Set USDT CF and liquidation threshold to some low value so that the borrower is underwater
      await comptroller
        .connect(timelock)
        .setCollateralFactor(vUSDT.address, parseUnits("0.3", 18), parseUnits("0.3", 18));
      const operator = await deploy(LiquidationOperator__factory, addresses.UniswapRouter, addresses.PancakeSwapRouter);
      return { operator };
    };

    beforeEach(async () => {
      [root, beneficiary] = await ethers.getSigners();
      ({ operator } = await loadFixture(liquidationOperatorFixture));
    });

    describe("Cross-liquidation via LiquidationOperator", () => {
      const repayAmount = parseUnits("20", 18);
      const path = {
        bscmainnet: makePath([addresses.BSW, "0x0009c4", addresses.USDT]),
      }[network];
      let now: number;

      const makeCommonParams = () => ({
        liquidityProvider: LiquidityProviders["PancakeSwap"],
        beneficiary: beneficiary.address,
        vTokenBorrowed: vBSW.address,
        borrower: borrowerAddress,
        repayAmount,
        vTokenCollateral: vUSDT.address,
        path,
      });

      beforeEach(async () => {
        now = await getBlockTimestamp();
      });

      it("fails if deadline has passed", async () => {
        const tooEarly = now;
        const tx = operator.connect(root).liquidate(makeCommonParams(), tooEarly);
        await expect(tx).to.be.revertedWithCustomError(operator, "DeadlinePassed").withArgs(anyValue, tooEarly);
      });

      it("fails if path start != borrowed token", async () => {
        const wrongPath = makePath([addresses.WBNB, "0x0009c4", addresses.USDT]);
        const tx = operator.connect(root).liquidate({ ...makeCommonParams(), path: wrongPath }, now + 6000);
        await expect(tx)
          .to.be.revertedWithCustomError(operator, "InvalidSwapStart")
          .withArgs(addresses.BSW, addresses.WBNB);
      });

      it("fails if path end != collateral token", async () => {
        const wrongPath = makePath([addresses.BSW, "0x0009c4", addresses.WBNB]);
        const tx = operator.connect(root).liquidate({ ...makeCommonParams(), path: wrongPath }, now + 6000);
        await expect(tx)
          .to.be.revertedWithCustomError(operator, "InvalidSwapEnd")
          .withArgs(addresses.USDT, addresses.WBNB);
      });

      it("repays exactly the specified amount", async () => {
        const borrowBalanceBefore = await vBSW.callStatic.borrowBalanceCurrent(borrowerAddress);
        await operator.connect(root).liquidate(makeCommonParams(), now + 6000);
        const borrowBalanceAfter = await vBSW.callStatic.borrowBalanceCurrent(borrowerAddress);
        expect(borrowBalanceBefore.sub(borrowBalanceAfter)).to.equal(repayAmount);
      });

      it("sends the income to beneficiary", async () => {
        const expectedIncome = parseUnits("0.114571299089827869", 18);
        const beneficiaryBalanceBefore = await usdt.balanceOf(beneficiary.address);
        await operator.connect(root).liquidate(makeCommonParams(), now + 6000);
        const beneficiaryBalanceAfter = await usdt.balanceOf(beneficiary.address);
        expect(beneficiaryBalanceAfter.sub(beneficiaryBalanceBefore)).to.equal(expectedIncome);
      });

      it("leaves no money in the operator contract", async () => {
        await operator.connect(root).liquidate(makeCommonParams(), now + 6000);
        expect(await usdt.balanceOf(operator.address)).to.equal(0);
        expect(await bsw.balanceOf(operator.address)).to.equal(0);
      });
    });

    describe("In-kind liquidation via LiquidationOperator", () => {
      const repayAmount = parseUnits("0.5", 18);
      const path = {
        // we use the same pool for simplicity, but now we need USDT to go
        // first in the path
        bscmainnet: makePath([addresses.USDT, "0x0009c4", addresses.BSW]),
      }[network];
      let now: number;

      const makeCommonParams = () => ({
        liquidityProvider: LiquidityProviders["PancakeSwap"],
        beneficiary: beneficiary.address,
        vTokenBorrowed: vUSDT.address,
        borrower: borrowerAddress,
        repayAmount,
        vTokenCollateral: vUSDT.address,
        path,
      });

      beforeEach(async () => {
        now = await getBlockTimestamp();
      });

      it("fails if path start != token being liquidated", async () => {
        const wrongPath = makePath([addresses.WBNB, "0x0009c4", addresses.BSW]);
        const tx = operator.connect(root).liquidate({ ...makeCommonParams(), path: wrongPath }, now + 6000);
        await expect(tx)
          .to.be.revertedWithCustomError(operator, "InvalidSwapStart")
          .withArgs(addresses.USDT, addresses.WBNB);
      });

      it("repays exactly the specified amount", async () => {
        const borrowBalanceBefore = await vUSDT.callStatic.borrowBalanceCurrent(borrowerAddress);
        await operator.connect(root).liquidate(makeCommonParams(), now + 6000);
        const borrowBalanceAfter = await vUSDT.callStatic.borrowBalanceCurrent(borrowerAddress);
        expect(borrowBalanceBefore.sub(borrowBalanceAfter)).to.equal(repayAmount);
      });

      it("sends the income to beneficiary", async () => {
        // The liquidation incentive is 0.5 USDT * 5% = 0.025 USDT,
        // PCS fee is 0.5 USDT * 0.25% = 0.00125 USDT, so without
        // precision loss the income would be 0.025 - 0.00125 = 0.02375 USDT
        const expectedIncome = parseUnits("0.023749996041292986", 18);
        const beneficiaryBalanceBefore = await usdt.balanceOf(beneficiary.address);
        await operator.connect(root).liquidate(makeCommonParams(), now + 6000);
        const beneficiaryBalanceAfter = await usdt.balanceOf(beneficiary.address);
        expect(beneficiaryBalanceAfter.sub(beneficiaryBalanceBefore)).to.equal(expectedIncome);
      });

      it("leaves no money in the operator contract", async () => {
        await operator.connect(root).liquidate(makeCommonParams(), now + 6000);
        expect(await usdt.balanceOf(operator.address)).to.equal(0);
      });
    });
  });
});
