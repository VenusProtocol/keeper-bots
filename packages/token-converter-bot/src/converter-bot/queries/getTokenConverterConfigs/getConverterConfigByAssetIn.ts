import { Address } from "viem";

import subgraphClient from "../../../subgraph-client";
import formatTokenConverterConfigs from "./formatTokenConverterConfigs";

const readTokenConverterConfigs = async (assetIn: Address) => {
  const {
    data: { tokenConverters },
  } = await subgraphClient.getTokenConverterByAssetIn(assetIn);

  const tokenConverterConfigs = formatTokenConverterConfigs(tokenConverters);
  return tokenConverterConfigs;
};

export default readTokenConverterConfigs;
