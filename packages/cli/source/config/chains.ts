import { bsc, bscTestnet, mainnet as ethereum, sepolia } from "viem/chains";

export const chains = {
  bscmainnet: bsc,
  bsctestnet: bscTestnet,
  ethereum,
  sepolia,
} as const;

export type SUPPORTED_CHAINS = keyof typeof chains;
