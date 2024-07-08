import { Address } from "viem";

import getConfig from "../../../config";
import SubgraphClient from "../../../subgraph-client";

const readTokenConverterConfigs = async (assetIn: Address) => {
  const subgraphClient = new SubgraphClient(getConfig().protocolReserveSubgraphUrl);
  const {
    data: { tokenConverterConfigs },
  } = await subgraphClient.getTokenConverterByAssetIn(assetIn);

  return tokenConverterConfigs;
};

export default readTokenConverterConfigs;
