import { Address } from "viem";

import getConfig from "../../../config";
import SubgraphClient from "../../../subgraph-client";
import formatTokenConverterConfigs from "./formatTokenConverterConfigs";

const readTokenConverterConfigsByConverter = async (configAddresses: Address[]) => {
  const subgraphClient = new SubgraphClient(getConfig().subgraphUrl);
  const {
    data: { tokenConverters },
  } = await subgraphClient.getTokenConverter(configAddresses);
  const tokenConverterConfigs = formatTokenConverterConfigs(tokenConverters);
  return tokenConverterConfigs;
};

export default readTokenConverterConfigsByConverter;
