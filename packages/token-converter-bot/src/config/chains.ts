import { bsc, bscTestnet } from "viem/chains";

import { HasAddressFor, SupportedConverters } from "./addresses";

export const chains = {
  bscmainnet: bsc,
  bsctestnet: bscTestnet,
} as const;

export type SUPPORTED_CHAINS = HasAddressFor<"TokenConverterOperator" | SupportedConverters>;
