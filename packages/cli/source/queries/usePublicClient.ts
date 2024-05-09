import { HttpTransport, PublicClient, createPublicClient, http } from "viem";

import useSafelyGetEnvVar from "../hooks/useSafelyGetEnvVar.js";
import { chains } from "../config/chains.js";
import type { SUPPORTED_CHAINS } from "../config/chains.js";

export const usePublicClient = (): PublicClient<HttpTransport, (typeof chains)[SUPPORTED_CHAINS]> => {
  const network = useSafelyGetEnvVar("NETWORK" as const)!;
  return createPublicClient({
    chain: chains[network],
    transport: http(process.env[`RPC_${network}` as const]),
  });
};

export default usePublicClient;
