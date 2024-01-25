import { bsc, bscTestnet } from "viem/chains";

export const chains = {
  bscmainnet: bsc,
  bsctestnet: bscTestnet,
} as const;

export type SUPPORTED_CHAINS = keyof typeof chains;