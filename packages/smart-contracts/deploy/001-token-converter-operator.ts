import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();
  const PancakeSwapRouterAddresses = {
    ethereum: "0x13f4EA83D0bd40E75C8222255bc855a974568Dd4",
    sepolia: ethers.constants.AddressZero,
    bscmainnet: "0x13f4EA83D0bd40E75C8222255bc855a974568Dd4",
    bsctestnet: "0x1b81D678ffb9C0263b24A97847620C99d213eB14",
    // See https://github.com/pancakeswap/pancake-v3-contracts for deploying SwapRouterv3 to enable hardhat deployment
    hardhat: "",
  };
  const UniswapRouterAddresses = {
    ethereum: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
    sepolia: "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E",
    bscmainnet: "0xB971eF87ede563556b2ED4b1C0b0019111Dd85d2",
    bsctestnet: ethers.constants.AddressZero,
    // See https://github.com/pancakeswap/pancake-v3-contracts for deploying SwapRouterv3 to enable hardhat deployment
    hardhat: "",
  };
  const pcsRouter = PancakeSwapRouterAddresses[hre.network.name as keyof typeof PancakeSwapRouterAddresses];
  const uniswapRouter = UniswapRouterAddresses[hre.network.name as keyof typeof UniswapRouterAddresses];
  await deploy("TokenConverterOperator", {
    from: deployer,
    args: [uniswapRouter, pcsRouter],
    log: true,
    autoMine: true,
  });
};

func.tags = ["TokenConverterOperator"];
func.skip = async hre => !["ethereum", "sepolia", "bscmainnet", "bsctestnet"].includes(hre.network.name);

export default func;
