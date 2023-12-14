import { impersonateAccount, setBalance } from "@nomicfoundation/hardhat-network-helpers";
import { NumberLike } from "@nomicfoundation/hardhat-network-helpers/dist/src/types";
import { ethers } from "hardhat";
import hre from "hardhat";

import { ADDRESSES } from "./constants";

export type Network = keyof typeof ADDRESSES;
export type ForkConfig<N extends Network> = { [T in N]: number };
export type Addresses<N extends Network> = typeof ADDRESSES[N];

export const resetFork = async (network: Network, blockNumber: number) => {
  await hre.network.provider.request({
    method: "hardhat_reset",
    params: [
      {
        forking: {
          jsonRpcUrl: process.env[`ARCHIVE_NODE_${network}`],
          blockNumber,
        },
      },
    ],
  });
};

export const forking = <N extends Network>(config: ForkConfig<N>, fn: (addresses: Addresses<N>) => void) => {
  if (!process.env.FORK || process.env.FORK === "false") {
    return;
  }
  const config_ = Object.entries(config) as [N, number][];
  config_.forEach(([network, blockNumber]) => {
    describe(`Forking ${network} at block #${blockNumber}`, () => {
      before(async () => {
        await resetFork(network, blockNumber);
      });
      fn(ADDRESSES[network]);
    });
  });
};

export const initMainnetUser = async (user: string, balance?: NumberLike) => {
  await impersonateAccount(user);
  if (balance !== undefined) {
    await setBalance(user, balance);
  }
  return ethers.getSigner(user);
};
