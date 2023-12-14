import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { parseEther, parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { SignerWithAddress } from "hardhat-deploy-ethers/signers";

import {
  IERC20,
  IERC20__factory,
  MoveDebtDelegate,
  MoveDebtOperator,
  MoveDebtOperator__factory,
} from "../../typechain";
import { forking, initMainnetUser } from "./utils";

interface MoveDebtOperatorFixture {
  moveDebtOperator: MoveDebtOperator;
  usdt: IERC20;
  busd: IERC20;
}

forking({ bscmainnet: 34341800 } as const, addresses => {
  const executeVip215 = async () => {
    const timelock = await initMainnetUser(addresses.NormalTimelock, parseEther("1"));
    const comptrollerAbi = [
      "function _setPendingImplementation(address) external",
      "function _become(address) external",
      "function setDelegateForBNBHacker(address) external",
      "function comptrollerImplementation() external view returns (address)",
      "function approvedDelegates(address, address) external view returns (bool)",
    ];

    const comptroller = await ethers.getContractAt(comptrollerAbi, "0xfD36E2c2a6789Db23113685031d7F16329158384");
    const intermediateImpl = await ethers.getContractAt(comptrollerAbi, "0xAE37464537fDa217258Bb2Cd70e4f8ffC7E95790");
    const currentImpl = await ethers.getContractAt(comptrollerAbi, "0xD93bFED40466c9A9c3E7381ab335a08807318a1b");

    await comptroller.connect(timelock)._setPendingImplementation("0xAE37464537fDa217258Bb2Cd70e4f8ffC7E95790");
    await intermediateImpl.connect(timelock)._become("0xfD36E2c2a6789Db23113685031d7F16329158384");
    await comptroller.connect(timelock).setDelegateForBNBHacker("0x89621C48EeC04A85AfadFD37d32077e65aFe2226");
    await comptroller.connect(timelock)._setPendingImplementation("0xD93bFED40466c9A9c3E7381ab335a08807318a1b");
    await currentImpl.connect(timelock)._become("0xfD36E2c2a6789Db23113685031d7F16329158384");
  };

  const moveDebtOperatorFixture = async (): Promise<MoveDebtOperatorFixture> => {
    const USDT_HOLDER = "0x8894E0a0c962CB723c1976a4421c95949bE2D4E3";
    const [admin] = await ethers.getSigners();

    await executeVip215();

    const usdt = IERC20__factory.connect(addresses.USDT, admin);
    const busd = IERC20__factory.connect(addresses.BUSD, admin);

    const usdtHolder = await initMainnetUser(USDT_HOLDER, parseEther("1"));
    await usdt.connect(usdtHolder).transfer(admin.address, parseUnits("1000", 18));

    const moveDebtOperatorFactory = await ethers.getContractFactory<MoveDebtOperator__factory>("MoveDebtOperator");
    const moveDebtOperator = await moveDebtOperatorFactory.deploy(
      addresses.PancakeSwapRouter,
      addresses.MoveDebtDelegate,
    );
    return { moveDebtOperator, usdt, busd };
  };

  describe("MoveDebtOperator", () => {
    const BUSD_BORROWER = "0x1F6D66bA924EBF554883Cf84d482394013eD294B";
    const BNB_EXPLOITER = "0x489A8756C18C0b8B24EC2a2b9FF3D4d447F79BEc";

    let admin: SignerWithAddress;
    let busd: IERC20;
    let usdt: IERC20;
    let moveDebtOperator: MoveDebtOperator;
    let moveDebtDelegate: MoveDebtDelegate;

    beforeEach(async () => {
      [admin] = await ethers.getSigners();
      ({ moveDebtOperator, busd, usdt } = await loadFixture(moveDebtOperatorFixture));
      moveDebtDelegate = await ethers.getContractAt("MoveDebtDelegate", addresses.MoveDebtDelegate);
    });

    it("should work with a single-hop path from BUSD to USDT", async () => {
      const path = ethers.utils.hexlify(ethers.utils.concat([addresses.BUSD, "0x000064", addresses.USDT]));
      await usdt.connect(admin).approve(moveDebtOperator.address, parseUnits("100", 18));
      const repayAmount = parseUnits("30000", 18);
      const maxUsdtToSpend = parseUnits("30", 18);
      const tx = await moveDebtOperator
        .connect(admin)
        .moveDebt(BUSD_BORROWER, repayAmount, addresses.vUSDT, maxUsdtToSpend, path);
      await expect(tx)
        .to.emit(moveDebtDelegate, "DebtMoved")
        .withArgs(
          BUSD_BORROWER,
          addresses.vBUSD,
          repayAmount,
          BNB_EXPLOITER,
          addresses.vUSDT,
          parseUnits("30020.438638269452250292", 18),
        );
      await expect(tx).to.emit(busd, "Transfer").withArgs(moveDebtDelegate.address, addresses.vBUSD, repayAmount);
    });

    it("should work with a multi-hop path from BUSD to USDT", async () => {
      const path = ethers.utils.hexlify(
        ethers.utils.concat([addresses.BUSD, "0x0001f4", addresses.WBNB, "0x0001f4", addresses.USDT]),
      );
      await usdt.connect(admin).approve(moveDebtOperator.address, parseUnits("300", 18));
      const repayAmount = parseUnits("30000", 18);
      const maxUsdtToSpend = parseUnits("300", 18);
      const tx = await moveDebtOperator
        .connect(admin)
        .moveDebt(BUSD_BORROWER, repayAmount, addresses.vUSDT, maxUsdtToSpend, path);
      await expect(tx)
        .to.emit(moveDebtDelegate, "DebtMoved")
        .withArgs(
          BUSD_BORROWER,
          addresses.vBUSD,
          repayAmount,
          BNB_EXPLOITER,
          addresses.vUSDT,
          parseUnits("30020.438638269452250292", 18),
        );
      await expect(tx).to.emit(busd, "Transfer").withArgs(moveDebtDelegate.address, addresses.vBUSD, repayAmount);
    });
  });
});
