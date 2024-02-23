import { Address } from "viem";

import subgraphClient from "../../../../subgraph-client";
import formatTokenConverterConfigs from "./formatTokenConverterConfigs";

const readTokenConverterConfigs = async (assetIn: Address, assetOut: Address) => {
  const {
    data: { tokenConverters },
  } = await subgraphClient.getTokenConverterByAssetInAndAssetOut(assetIn, assetOut);

  const tokenConverterConfigs = formatTokenConverterConfigs(tokenConverters);
  return tokenConverterConfigs;
};

export default readTokenConverterConfigs;
