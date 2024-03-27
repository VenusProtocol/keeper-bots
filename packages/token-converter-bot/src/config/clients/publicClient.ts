import { HttpTransport, PublicClient, createPublicClient, http } from "viem";

import config from "..";
import { chains } from "../chains";
import type { SUPPORTED_CHAINS } from "../chains";

export const getPublicClient = (): PublicClient<HttpTransport, typeof chains[SUPPORTED_CHAINS]> => {
  const chainName = config.network;
  return createPublicClient({
    chain: chains[chainName],
    transport: http(config.rpcUrl),
  });
};

const client: PublicClient<HttpTransport, typeof chains[SUPPORTED_CHAINS]> = getPublicClient();

export default client;
