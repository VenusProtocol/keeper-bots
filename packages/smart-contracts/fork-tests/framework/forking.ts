import hre from "hardhat";

type SupportedNetwork = "bsctestnet" | "bscmainnet" | "sepolia";
type ForkConfig<N extends SupportedNetwork> = { [T in N]: number };

export const resetFork = async (network: SupportedNetwork, blockNumber: number): Promise<void> => {
  await hre.network.provider.request({
    method: "hardhat_reset",
    params: [
      {
        forking: {
          jsonRpcUrl: process.env[`ARCHIVE_NODE_${String(network)}`],
          blockNumber,
        },
      },
    ],
  });
};

export const forking = <N extends SupportedNetwork>(config: ForkConfig<N>, fn: (network: N) => void) => {
  if (!process.env.FORK || process.env.FORK === "false") {
    return;
  }
  const config_ = Object.entries(config) as [N, number][];
  config_.forEach(([network, blockNumber]) => {
    describe(`Forking ${String(network)} at block #${blockNumber}`, () => {
      before(async () => {
        await resetFork(network, blockNumber);
      });
      fn(network);
    });
  });
};
