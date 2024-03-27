import { HttpTransport, PublicClient, createPublicClient, http } from "viem";

import config from "../config";
import { chains } from "../config/chains";
import type { SUPPORTED_CHAINS } from "../config/chains";

export const getPublicClient = (): PublicClient<HttpTransport, typeof chains[SUPPORTED_CHAINS]> => {
  const chainName = config.network;
  return createPublicClient({
    chain: chains[chainName],
    transport: http(config.rpcUrl),
  });
};

const client: PublicClient<HttpTransport, typeof chains[SUPPORTED_CHAINS]> = getPublicClient();

export default client;
