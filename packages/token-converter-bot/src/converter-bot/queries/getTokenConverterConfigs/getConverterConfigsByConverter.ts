import { Address } from "viem";

import subgraphClient from "../../../subgraph-client";
import formatTokenConverterConfigs from "./formatTokenConverterConfigs";

const readTokenConverterConfigsByConverter = async (configAddresses: Address[]) => {
  const {
    data: { tokenConverters },
  } = await subgraphClient.getTokenConverter(configAddresses);
  const tokenConverterConfigs = formatTokenConverterConfigs(tokenConverters);
  return tokenConverterConfigs;
};

export default readTokenConverterConfigsByConverter;
