import { Address } from "viem";

import subgraphClient from "../../../subgraph-client";
import formatTokenConverterConfigs from "./formatTokenConverterConfigs";

const readTokenConverterConfigs = async (assetOut: Address) => {
  const {
    data: { tokenConverters },
  } = await subgraphClient.getTokenConverterByAssetOut(assetOut);

  const tokenConverterConfigs = formatTokenConverterConfigs(tokenConverters);
  return tokenConverterConfigs;
};

export default readTokenConverterConfigs;
