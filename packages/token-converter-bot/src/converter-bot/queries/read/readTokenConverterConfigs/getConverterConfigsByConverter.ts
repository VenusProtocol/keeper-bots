import { Address } from "viem";

import subgraphClient from "../../../../subgraph-client";
import formatTokenConverterConfigs from "./formatTokenConverterConfigs";

const readTokenConverterConfigsByConverter = async (configAddress: Address[]) => {
  const {
    data: { tokenConverters },
  } = await subgraphClient.getTokenConverter(configAddress);
  const tokenConverterConfigs = formatTokenConverterConfigs(tokenConverters);
  return tokenConverterConfigs;
};

export default readTokenConverterConfigsByConverter;
