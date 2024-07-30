import { Address } from "viem";

import getConfig from "../../../config";
import SubgraphClient from "../../../subgraph-client";

const readTokenConverterConfigsByConverter = async (converterAddresses: Address) => {
  const subgraphClient = new SubgraphClient(getConfig().protocolReserveSubgraphUrl);
  const { data: { tokenConverterConfigs = [] } = {} } = await subgraphClient.getTokenConverterConfigsByTokenConverter(
    converterAddresses,
  );

  return tokenConverterConfigs;
};

export default readTokenConverterConfigsByConverter;
