import { Address } from "viem";

import getConfig from "../../../config";
import SubgraphClient from "../../../subgraph-client";

const getTokenConverterConfigsByAssetInAndAssetOutAndConverter = async (
  assetIn: Address,
  assetOut: Address,
  tokenConverter: Address,
) => {
  const subgraphClient = new SubgraphClient(getConfig().protocolReserveSubgraphUrl);
  const { data: { tokenConverterConfigs = [] } = {} } =
    await subgraphClient.getTokenConverterConfigsByAssetInAndAssetOutAndConverter(assetIn, assetOut, tokenConverter);

  return tokenConverterConfigs;
};

export default getTokenConverterConfigsByAssetInAndAssetOutAndConverter;
