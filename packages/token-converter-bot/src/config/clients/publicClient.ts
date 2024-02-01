import { HttpTransport, PublicClient, createPublicClient, http } from "viem";

import { chains } from "../chains";
import type { SUPPORTED_CHAINS } from "../chains";

export const getPublicClient = (): PublicClient<HttpTransport, typeof chains[SUPPORTED_CHAINS]> => {
  const chainName = process.env.FORKED_NETWORK as SUPPORTED_CHAINS;
  return createPublicClient({
    chain: chains[chainName],
    transport: http(process.env[`LIVE_NETWORK_${chainName}`]),
  });
};

export default getPublicClient();
