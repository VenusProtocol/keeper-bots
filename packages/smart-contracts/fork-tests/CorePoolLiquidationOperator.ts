import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  DiamondConsolidated__factory,
  VAIController__factory,
  VBNB__factory,
  VBep20Delegate__factory,
  WhitePaperInterestRateModel__factory,
} from "@venusprotocol/venus-protocol/dist/typechain";
import { expect } from "chai";
import { concat, hexlify, parseEther, parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";

import { CorePoolLiquidationOperator, CorePoolLiquidationOperator__factory, IERC20__factory } from "../typechain";
import ADDRESSES from "./config/addresses";
import { LiquidityProviders } from "./constants";
import { connect, deploy, forking, getBlockTimestamp, initUser } from "./framework";

interface LiquidationOperatorFixture {
  operator: CorePoolLiquidationOperator;
}

const makePath = (parts: string[]) => hexlify(concat(parts));

const deployZeroRateModel = async () => {
  return deploy(WhitePaperInterestRateModel__factory, 0, 0);
};

forking({ bscmainnet: 42584000 } as const, network => {
  const addresses = ADDRESSES[network];

  describe("CorePoolLiquidationOperator", () => {
    const USDT_SUPPLY = parseUnits("500", 18);
    const BNB_SUPPLY = parseEther("1");
    const BNB_BORROW = parseEther("1");
    const VAI_BORROW = parseUnits("50", 18);
    const comptroller = connect(DiamondConsolidated__factory, addresses.Unitroller);
    const vai = connect(IERC20__factory, addresses.VAI);
    const usdt = connect(IERC20__factory, addresses.USDT);
    const wbnb = connect(IERC20__factory, addresses.WBNB);
    const vBNB = connect(VBNB__factory, addresses.vBNB);
    const vUSDT = connect(VBep20Delegate__factory, addresses.vUSDT);
    const vaiController = connect(VAIController__factory, addresses.VaiUnitroller);
    let operator: CorePoolLiquidationOperator;
    let root: SignerWithAddress;
    let borrower: SignerWithAddress;
    let beneficiary: SignerWithAddress;

    const liquidationOperatorFixture = async (): Promise<LiquidationOperatorFixture> => {
      const zeroRateModel = await deployZeroRateModel();
      const timelock = await initUser(addresses.NormalTimelock, parseEther("1"));
      const [, , borrower] = await ethers.getSigners();
      const treasury = await initUser(addresses.VTreasury, parseEther("1"));
      await vBNB.connect(timelock)._setInterestRateModel(zeroRateModel.address);
      await vUSDT.connect(timelock)._setInterestRateModel(zeroRateModel.address);
      await usdt.connect(treasury).transfer(borrower.address, USDT_SUPPLY);
      await usdt.connect(borrower).approve(vUSDT.address, USDT_SUPPLY);
      await vUSDT.connect(borrower).mint(USDT_SUPPLY);
      await comptroller.connect(borrower).enterMarkets([vUSDT.address, vBNB.address]);
      await vBNB.connect(borrower).mint({ value: BNB_SUPPLY });
      await vBNB.connect(borrower).borrow(BNB_BORROW);
      await vaiController.connect(timelock).toggleOnlyPrimeHolderMint();
      await vaiController.connect(borrower).mintVAI(VAI_BORROW);
      await comptroller.connect(timelock)._setCollateralFactor(vUSDT.address, parseUnits("0", 18));
      await vaiController.connect(timelock).setBaseRate(0);
      await vaiController.connect(timelock).setFloatRate(0);
      const operator = await deploy(
        CorePoolLiquidationOperator__factory,
        addresses.UniswapRouter,
        addresses.PancakeSwapRouter,
        addresses.Liquidator,
      );
      return { operator };
    };

    beforeEach(async () => {
      [root, beneficiary, borrower] = await ethers.getSigners();
      ({ operator } = await loadFixture(liquidationOperatorFixture));
    });

    describe("Cross-liquidation", () => {
      const repayAmount = parseEther("0.5");
      const path = {
        bscmainnet: makePath([addresses.WBNB, "0x0009c4", addresses.USDT]),
      }[network];
      let now: number;

      const makeCommonParams = () => ({
        liquidityProvider: LiquidityProviders["PancakeSwap"],
        beneficiary: beneficiary.address,
        vTokenBorrowed: vBNB.address,
        borrower: borrower.address,
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
        const wrongPath = makePath([addresses.VAI, "0x0009c4", addresses.USDT]);
        const tx = operator.connect(root).liquidate({ ...makeCommonParams(), path: wrongPath }, now + 6000);
        await expect(tx)
          .to.be.revertedWithCustomError(operator, "InvalidSwapStart")
          .withArgs(addresses.WBNB, addresses.VAI);
      });

      it("fails if path end != collateral token", async () => {
        const wrongPath = makePath([addresses.WBNB, "0x0009c4", addresses.VAI]);
        const tx = operator.connect(root).liquidate({ ...makeCommonParams(), path: wrongPath }, now + 6000);
        await expect(tx)
          .to.be.revertedWithCustomError(operator, "InvalidSwapEnd")
          .withArgs(addresses.USDT, addresses.VAI);
      });

      it("repays exactly the specified amount, up to rounding errors", async () => {
        const borrowBalanceBefore = await vBNB.callStatic.borrowBalanceCurrent(borrower.address);
        await operator.connect(root).liquidate(makeCommonParams(), now + 6000);
        const borrowBalanceAfter = await vBNB.callStatic.borrowBalanceCurrent(borrower.address);
        expect(borrowBalanceBefore.sub(borrowBalanceAfter)).to.be.closeTo(repayAmount, parseUnits("1", 10));
      });

      it("sends the income to beneficiary", async () => {
        const expectedIncome = parseUnits("12.263641821560471737", 18);
        const beneficiaryBalanceBefore = await usdt.balanceOf(beneficiary.address);
        await operator.connect(root).liquidate(makeCommonParams(), now + 6000);
        const beneficiaryBalanceAfter = await usdt.balanceOf(beneficiary.address);
        expect(beneficiaryBalanceAfter.sub(beneficiaryBalanceBefore)).to.equal(expectedIncome);
      });

      it("leaves no money in the operator contract", async () => {
        await operator.connect(root).liquidate(makeCommonParams(), now + 6000);
        expect(await usdt.balanceOf(operator.address)).to.equal(0);
        expect(await wbnb.balanceOf(operator.address)).to.equal(0);
        expect(await ethers.provider.getBalance(operator.address)).to.equal(0);
      });
    });

    describe("VAI liquidation", () => {
      const repayAmount = parseUnits("25", 18);
      const path = {
        bscmainnet: makePath([addresses.VAI, "0x000064", addresses.USDT, "0x0009c4", addresses.WBNB]),
      }[network];
      let now: number;

      const makeCommonParams = () => ({
        liquidityProvider: LiquidityProviders["PancakeSwap"],
        beneficiary: beneficiary.address,
        vTokenBorrowed: vaiController.address,
        borrower: borrower.address,
        repayAmount,
        vTokenCollateral: vBNB.address,
        path,
      });

      beforeEach(async () => {
        now = await getBlockTimestamp();
      });

      it("repays exactly the specified amount", async () => {
        const borrowBalanceBefore = await vaiController.callStatic.getVAIRepayAmount(borrower.address);
        await operator.connect(root).liquidate(makeCommonParams(), now + 6000);
        const borrowBalanceAfter = await vaiController.callStatic.getVAIRepayAmount(borrower.address);
        expect(borrowBalanceBefore.sub(borrowBalanceAfter)).to.equal(repayAmount);
      });

      it("sends the income to beneficiary", async () => {
        const expectedIncome = parseUnits("0.001900435932176771", 18);
        const beneficiaryBalanceBefore = await wbnb.balanceOf(beneficiary.address);
        await operator.connect(root).liquidate(makeCommonParams(), now + 6000);
        const beneficiaryBalanceAfter = await wbnb.balanceOf(beneficiary.address);
        expect(beneficiaryBalanceAfter.sub(beneficiaryBalanceBefore)).to.equal(expectedIncome);
      });

      it("leaves no money in the operator contract", async () => {
        await operator.connect(root).liquidate(makeCommonParams(), now + 6000);
        expect(await vai.balanceOf(operator.address)).to.equal(0);
        expect(await wbnb.balanceOf(operator.address)).to.equal(0);
        expect(await ethers.provider.getBalance(operator.address)).to.equal(0);
      });
    });

    describe("In-kind liquidation", () => {
      const repayAmount = parseUnits("0.5", 18);
      const path = {
        bscmainnet: makePath([addresses.WBNB, "0x0009c4", addresses.USDT]),
      }[network];
      let now: number;

      const makeCommonParams = () => ({
        liquidityProvider: LiquidityProviders["PancakeSwap"],
        beneficiary: beneficiary.address,
        vTokenBorrowed: vBNB.address,
        borrower: borrower.address,
        repayAmount,
        vTokenCollateral: vBNB.address,
        path,
      });

      beforeEach(async () => {
        now = await getBlockTimestamp();
      });

      it("fails if path start != token being liquidated", async () => {
        const wrongPath = makePath([addresses.USDT, "0x0009c4", addresses.WBNB]);
        const tx = operator.connect(root).liquidate({ ...makeCommonParams(), path: wrongPath }, now + 6000);
        await expect(tx)
          .to.be.revertedWithCustomError(operator, "InvalidSwapStart")
          .withArgs(addresses.WBNB, addresses.USDT);
      });

      it("repays exactly the specified amount, up to rounding errors", async () => {
        const borrowBalanceBefore = await vBNB.callStatic.borrowBalanceCurrent(borrower.address);
        await operator.connect(root).liquidate(makeCommonParams(), now + 6000);
        const borrowBalanceAfter = await vBNB.callStatic.borrowBalanceCurrent(borrower.address);
        expect(borrowBalanceBefore.sub(borrowBalanceAfter)).to.be.closeTo(repayAmount, parseUnits("1", 10));
      });

      it("sends the income to beneficiary", async () => {
        const expectedIncome = parseUnits("0.02375", 18);
        const beneficiaryBalanceBefore = await wbnb.balanceOf(beneficiary.address);
        await operator.connect(root).liquidate(makeCommonParams(), now + 6000);
        const beneficiaryBalanceAfter = await wbnb.balanceOf(beneficiary.address);
        expect(beneficiaryBalanceAfter.sub(beneficiaryBalanceBefore)).to.be.closeTo(expectedIncome, parseUnits("1", 9));
      });

      it("leaves no money in the operator contract", async () => {
        await operator.connect(root).liquidate(makeCommonParams(), now + 6000);
        expect(await wbnb.balanceOf(operator.address)).to.equal(0);
        expect(await ethers.provider.getBalance(operator.address)).to.equal(0);
      });
    });
  });
});
