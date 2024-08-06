import { Address } from "viem";

import getConfig from "../../../config";
import SubgraphClient from "../../../subgraph-client";

const readTokenConverterConfigs = async (assetIn: Address, assetOut: Address) => {
  const subgraphClient = new SubgraphClient(getConfig().protocolReserveSubgraphUrl);
  const { data: { tokenConverterConfigs = [] } = {} } =
    await subgraphClient.getTokenConverterConfigsByAssetInAndAssetOut(assetIn, assetOut);

  return tokenConverterConfigs;
};

export default readTokenConverterConfigs;
