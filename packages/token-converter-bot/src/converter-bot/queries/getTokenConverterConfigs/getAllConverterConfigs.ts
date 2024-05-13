import getConfig from "../../../config";
import SubgraphClient from "../../../subgraph-client";
import formatTokenConverterConfigs from "./formatTokenConverterConfigs";

const readTokenConverterConfigs = async () => {
  const subgraphClient = new SubgraphClient(getConfig().subgraphUrl);
  const {
    data: { tokenConverters },
  } = await subgraphClient.getTokenConverters();
  const tokenConverterConfigs = formatTokenConverterConfigs(tokenConverters);
  return tokenConverterConfigs;
};

export default readTokenConverterConfigs;
