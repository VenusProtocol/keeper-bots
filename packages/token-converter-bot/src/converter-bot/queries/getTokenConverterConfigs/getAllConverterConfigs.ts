import getConfig from "../../../config";
import SubgraphClient from "../../../subgraph-client";

const readTokenConverterConfigs = async () => {
  const subgraphClient = new SubgraphClient(getConfig().protocolReserveSubgraphUrl);
  const {
    data: { tokenConverterConfigs },
  } = await subgraphClient.getTokenConverters();
  return tokenConverterConfigs;
};

export default readTokenConverterConfigs;
