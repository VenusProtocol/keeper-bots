import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { formatUnits, parseEther, parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { SignerWithAddress } from "hardhat-deploy-ethers/signers";

import {
  IERC20,
  IERC20__factory,
  IVBep20,
  MoveDebtDelegate,
  MoveDebtOperator,
  MoveDebtOperator__factory,
} from "../../typechain";
import { forking, initMainnetUser } from "./utils";

interface MoveDebtOperatorFixture {
  moveDebtOperator: MoveDebtOperator;
  usdt: IERC20;
  btc: IERC20;
}

forking({ bscmainnet: 34841800 } as const, addresses => {
  const SHORTFALL_BORROWER = "0xEF044206Db68E40520BfA82D45419d498b4bc7Bf";
  const MOVE_DEBT_DELEGATE = "0x89621C48EeC04A85AfadFD37d32077e65aFe2226";

  const executeVip225 = async () => {
    const timelock = await initMainnetUser(addresses.NormalTimelock, parseEther("1"));
    const proxyAdminAbi = ["function upgrade(address proxy, address newImplementation) external"];

    const proxyAdmin = await ethers.getContractAt(proxyAdminAbi, "0x1BB765b741A5f3C2A338369DAb539385534E3343");
    const moveDebtDelegate = await ethers.getContractAt("MoveDebtDelegate", MOVE_DEBT_DELEGATE);

    await proxyAdmin.connect(timelock).upgrade(MOVE_DEBT_DELEGATE, "0x8439932C45e646FcC1009690417A65BF48f68Ce7");
    await moveDebtDelegate.connect(timelock).setBorrowAllowed(addresses.vBTC, true);
    await moveDebtDelegate.connect(timelock).setRepaymentAllowed(addresses.vBTC, SHORTFALL_BORROWER, true);
  };

  const moveDebtOperatorFixture = async (): Promise<MoveDebtOperatorFixture> => {
    const USDT_HOLDER = "0x8894E0a0c962CB723c1976a4421c95949bE2D4E3";
    const BTC_HOLDER = "0xF977814e90dA44bFA03b6295A0616a897441aceC";
    const [admin] = await ethers.getSigners();

    await executeVip225();

    const usdt = IERC20__factory.connect(addresses.USDT, admin);
    const btc = IERC20__factory.connect(addresses.BTCB, admin);

    const usdtHolder = await initMainnetUser(USDT_HOLDER, parseEther("1"));
    await usdt.connect(usdtHolder).transfer(admin.address, parseUnits("1000", 18));

    const btcHolder = await initMainnetUser(BTC_HOLDER, parseEther("1"));
    await btc.connect(btcHolder).transfer(admin.address, parseUnits("100", 18));

    const moveDebtOperatorFactory = await ethers.getContractFactory<MoveDebtOperator__factory>("MoveDebtOperator");
    const moveDebtOperator = await moveDebtOperatorFactory.deploy(
      addresses.PancakeSwapRouter,
      addresses.MoveDebtDelegate,
    );
    return { moveDebtOperator, usdt, btc };
  };

  describe("MoveDebtOperator", () => {
    const BNB_EXPLOITER = "0x489A8756C18C0b8B24EC2a2b9FF3D4d447F79BEc";

    let admin: SignerWithAddress;
    let btc: IERC20;
    let usdt: IERC20;
    let vBTC: IVBep20;
    let moveDebtOperator: MoveDebtOperator;
    let moveDebtDelegate: MoveDebtDelegate;

    beforeEach(async () => {
      [admin] = await ethers.getSigners();
      ({ moveDebtOperator, btc, usdt } = await loadFixture(moveDebtOperatorFixture));
      moveDebtDelegate = await ethers.getContractAt("MoveDebtDelegate", addresses.MoveDebtDelegate);
      vBTC = await ethers.getContractAt("IVBep20", addresses.vBTC);
    });

    it("should work with a single-hop path from BTC to USDT", async () => {
      const path = ethers.utils.hexlify(ethers.utils.concat([addresses.BTCB, "0x0001f4", addresses.USDT]));
      await usdt.connect(admin).approve(moveDebtOperator.address, parseUnits("1000", 18));
      const repayAmount = parseUnits("0.001", 18);
      const maxUsdtToSpend = parseUnits("1000", 18);
      const tx = await moveDebtOperator
        .connect(admin)
        .moveDebt(addresses.vBTC, SHORTFALL_BORROWER, repayAmount, addresses.vUSDT, maxUsdtToSpend, path);
      await expect(tx)
        .to.emit(moveDebtDelegate, "DebtMoved")
        .withArgs(
          SHORTFALL_BORROWER,
          addresses.vBTC,
          repayAmount,
          BNB_EXPLOITER,
          addresses.vUSDT,
          parseUnits("42.582032813125250100", 18),
        );
      await expect(tx).to.emit(btc, "Transfer").withArgs(moveDebtDelegate.address, addresses.vBTC, repayAmount);
    });

    it("should work with in-kind debt moves with flash-loan", async () => {
      const path = ethers.utils.hexlify(ethers.utils.concat([addresses.BTCB, "0x0001f4", addresses.USDT]));
      await btc.connect(admin).approve(moveDebtOperator.address, parseUnits("0.1", 18));
      const repayAmount = parseUnits("1", 18);
      const maxBtcToSpend = parseUnits("0.1", 18);
      const tx = await moveDebtOperator
        .connect(admin)
        .moveDebt(addresses.vBTC, SHORTFALL_BORROWER, repayAmount, addresses.vBTC, maxBtcToSpend, path);
      await expect(tx)
        .to.emit(moveDebtDelegate, "DebtMoved")
        .withArgs(
          SHORTFALL_BORROWER,
          addresses.vBTC,
          repayAmount,
          BNB_EXPLOITER,
          addresses.vBTC,
          parseUnits("1.0", 18),
        );
      await expect(tx).to.emit(btc, "Transfer").withArgs(moveDebtDelegate.address, addresses.vBTC, repayAmount);
    });

    //
    // TODO: Make these compatible with VIP-225 version of MoveDebtDelegate
    //
    /*it("should repay all debts of a list of borrowers", async () => {
      const path = ethers.utils.hexlify(ethers.utils.concat([addresses.BUSD, "0x000064", addresses.USDT]));
      const borrowers = [
        "0x6b69d62616633d71d36cf253021ae717db2e09c7",
        "0xc870b1b5a7787ef5877190fe10851fdceb402d47",
        "0xca925c8900f6f27e89b9bebc4987a655cb43911f",
        "0xdc9af4213dee2321c0461a59e761f76e4677fdb9",
        "0xdf99f63bc8f1ce2fd7aa0c0140a0340f91fb4680",
        "0xac0c96c50bb4080bcb920a7c84dc23f0decddbd6",
        "0xd3a5eb04d919d17b846d81b9875c652720b7be97",
        "0xd53f6bae74603aaf74145e8150d11dbdb6fc805d",
        "0xc4050213225baf4e2e9fb53f877caa727f05faf5",
        "0x60f2563424db41fbfe308f46034f155f1c1e5d29",
        "0x1e803cf10460bcd7235a87527105d1e2a3c6319b",
        "0xf51c2e6a7e838923f30367b3d2f6d22db85a83b5",
        "0x37e1e4b215c2a1d026444899b90f0bf29ef12576",
        "0x3b052f0a3cfe703b63ac6fe688bbf16a67ecf738",
        "0xcbc090c20d32b4415edacfc70665d4101cd940f6",
        "0xccb5c516c5c3dddf1e46db9b3c399b0f5e542251",
        "0xe9caddbc9f620098171c67385f5237b829a55db6",
        "0x981e41c791f9cf5b5b0470df0637b95a5b4e00a2",
        "0x8915cf710645794dad5eaee96b3e56675bf62651",
        "0x0794e8235fbdfaf2061a6721ade61126d8493b35",
        "0x7d6936e3dbeb9ff00e9d77ecc40eb59bf96c82b3",
        "0xe7404e8c8c5607aea3ddfc6820c143bd21e750a1",
        "0x82ec5d22cff969aa01afa7d082891b2cf5714769",
        "0xabb3ed61b1928dc0a57839d6c8a38446762bdbfe",
        "0x0e8c66bbfec32aa3fab86bba641f4f20fe457ca9",
        "0xc7d785ffb0b5f92beb21382d44539048a5b5df62",
        "0xd4e982b86590428588934fbd5510a61342ef7214",
        "0x7261c1a6a47e596dfcf0e2f21140217acc5eded8",
        "0xe33fca60a281431d82ac9ad55e37be9b587ead63",
        "0xb75a7d3049654242617015dcedf2c49e1ca7ea65",
        "0x88511937ddb0c65cf2b925200e185f590a43a267",
        "0xdf38cd49bb821a3984277a252b4ecdda4ab7631c",
        "0x614146018042d47dcde01a9400a8d14343047b67",
        "0xd071f60ea1e2d4855cf34a6022372c33d046e34b",
        "0x6dc3353dc6ba9d0cdc97af9d7eb5a4475ded4a3f",
        "0x53d4bc5ccb0fa8ce8b853eb90086df93d1217026",
        "0x58ceb7d9abbe3039e4aec356446f7c59aadae376",
        "0x9edb330cac62e21f616d113754c7f7451179b5b2",
        "0x22d1eca04a0ab99ebb57b9feeed45dee3df4e444",
        "0x1956b3aae9c3e583584143d566612e7e721de141",
        "0x0db95671310f0ba4cc0f29106593f8090037027a",
        "0x00e1dfbb710d0d854f0d6736170b874b3690d0d7",
        "0x4d390a71b61bdbee803960a00961de839d7c09d0",
        "0xa139f8b283199b61efbe9c934c3a74656ed82618",
        "0x8764c54e16304a26cd9356635431ce9a709d634c",
        "0x6bc65848bfa839005c65d4d49989fcca9925f4ce",
        "0x19132c5d648e0706bda8afa9e8ef3c57e86f50a9",
        "0xe2a6d1c95672211a7d86fe394cc7eb1969e6258d",
        "0x604c235ec0ab0b303090449a70550bab044e6be3",
        "0xce1f6f19faec15e0806c8ad6378a3e9a7f74994e",
      ].map(ethers.utils.getAddress);
      await usdt.connect(admin).approve(moveDebtOperator.address, parseUnits("100", 18));
      const maxUsdtToSpend = parseUnits("30", 18);
      const tx = await moveDebtOperator.connect(admin).moveAllDebts(borrowers, addresses.vUSDT, maxUsdtToSpend, path);
      for (const borrower of borrowers) {
        await expect(tx)
          .to.emit(moveDebtDelegate, "DebtMoved")
          .withArgs(borrower, addresses.vBUSD, anyValue, BNB_EXPLOITER, addresses.vUSDT, anyValue);
        expect(await vBUSD.callStatic.borrowBalanceCurrent(borrower)).to.equal(0);
      }
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
    });*/
  });
});
