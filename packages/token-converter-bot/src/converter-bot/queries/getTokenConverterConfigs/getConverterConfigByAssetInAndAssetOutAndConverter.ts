import { Address } from "viem";

import getConfig from "../../../config";
import SubgraphClient from "../../../subgraph-client";

const getTokenConverterByAssetInAndAssetOutAndConverter = async (
  assetIn: Address,
  assetOut: Address,
  tokenConverter: Address,
) => {
  const subgraphClient = new SubgraphClient(getConfig().protocolReserveSubgraphUrl);
  const {
    data: { tokenConverterConfigs },
  } = await subgraphClient.getTokenConverterByAssetInAndAssetOutAndConverter(assetIn, assetOut, tokenConverter);

  return tokenConverterConfigs;
};

export default getTokenConverterByAssetInAndAssetOutAndConverter;
