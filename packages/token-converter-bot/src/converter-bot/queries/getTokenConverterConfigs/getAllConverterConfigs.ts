import subgraphClient from "../../../subgraph-client";
import formatTokenConverterConfigs from "./formatTokenConverterConfigs";

const readTokenConverterConfigs = async () => {
  const {
    data: { tokenConverters },
  } = await subgraphClient.getTokenConverters();
  const tokenConverterConfigs = formatTokenConverterConfigs(tokenConverters);
  return tokenConverterConfigs;
};

export default readTokenConverterConfigs;
