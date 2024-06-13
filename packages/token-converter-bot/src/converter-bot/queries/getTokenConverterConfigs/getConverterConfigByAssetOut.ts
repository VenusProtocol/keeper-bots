import { Address } from "viem";

import getConfig from "../../../config";
import SubgraphClient from "../../../subgraph-client";

const readTokenConverterConfigs = async (assetOut: Address) => {
  const subgraphClient = new SubgraphClient(getConfig().subgraphUrl);
  const {
    data: { tokenConverterConfigs },
  } = await subgraphClient.getTokenConverterByAssetOut(assetOut);

  return tokenConverterConfigs;
};

export default readTokenConverterConfigs;
