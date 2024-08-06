import { createPublicClient, http } from "viem";

import getConfig from "..";
import { chains } from "../chains";

const getPublicClient = () => {
  const config = getConfig();
  const chainName = config.network.name;
  return createPublicClient({
    chain: chains[chainName],
    transport: http(config.rpcUrl),
  });
};

export default getPublicClient;
