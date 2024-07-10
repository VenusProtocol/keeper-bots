import { Address } from "viem";

import getConfig from "../../../config";
import SubgraphClient from "../../../subgraph-client";

const readTokenConverterConfigsByConverter = async (configAddresses: Address) => {
  const subgraphClient = new SubgraphClient(getConfig().protocolReserveSubgraphUrl);
  const {
    data: { tokenConverterConfigs },
  } = await subgraphClient.getTokenConverter(configAddresses);

  return tokenConverterConfigs;
};

export default readTokenConverterConfigsByConverter;
