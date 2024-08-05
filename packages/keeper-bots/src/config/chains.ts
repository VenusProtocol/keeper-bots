import { bsc, bscTestnet, mainnet as ethereum, sepolia } from "viem/chains";

import { HasAddressFor } from "./addresses";

export const chains = {
  bscmainnet: bsc,
  bsctestnet: bscTestnet,
  sepolia,
  ethereum,
} as const;

export type SUPPORTED_CHAINS = HasAddressFor<"TokenConverterOperator">;
