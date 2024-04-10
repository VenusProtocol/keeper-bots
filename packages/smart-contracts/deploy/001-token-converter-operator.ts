import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();
  const PancakeSwapRouterAddresses = {
    mainnet: "0x13f4EA83D0bd40E75C8222255bc855a974568Dd4",
    testnet: "0x1b81D678ffb9C0263b24A97847620C99d213eB14",
    // See https://github.com/pancakeswap/pancake-v3-contracts for deploying SwapRouterv3 to enable hardhat deployment
    hardhat: "",
  };
  await deploy("TokenConverterOperator", {
    from: deployer,
    args: [PancakeSwapRouterAddresses[hre.network.name as keyof typeof PancakeSwapRouterAddresses]],
    log: true,
    autoMine: true,
  });
};

func.tags = ["TokenConverterOperator"];
func.skip = async hre => !["bscmainnet", "bsctestnet"].includes(hre.network.name);

export default func;
