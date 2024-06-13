import { Address } from "viem";

import { TokenConvertersQuery } from "../../../subgraph-client/.graphclient";
import { default as getAllConverterConfigs } from "./getAllConverterConfigs";
import { default as getConverterConfigByAssetIn } from "./getConverterConfigByAssetIn";
import { default as getConverterConfigByAssetInAndAssetOut } from "./getConverterConfigByAssetInAndAssetOut";
import { default as getConverterConfigByAssetInAndAssetOutAndConverter } from "./getConverterConfigByAssetInAndAssetOutAndConverter";
import { default as getConverterConfigByAssetOut } from "./getConverterConfigByAssetOut";
import { default as getConverterConfigsByConverter } from "./getConverterConfigsByConverter";

type TokenConverterConfigs = TokenConvertersQuery["tokenConverterConfigs"];

const getConverterConfigs = async ({
  assetOut,
  assetIn,
  converter,
}: {
  assetOut?: Address;
  assetIn?: Address;
  converter?: Address;
}): Promise<TokenConverterConfigs> => {
  if (assetOut && assetIn && converter) {
    return await getConverterConfigByAssetInAndAssetOutAndConverter(assetIn, assetOut, converter);
  } else if (assetOut && assetIn) {
    return await getConverterConfigByAssetInAndAssetOut(assetIn, assetOut);
  } else if (assetOut) {
    return await getConverterConfigByAssetOut(assetOut);
  } else if (assetIn) {
    return await getConverterConfigByAssetIn(assetIn);
  } else if (converter) {
    return await getConverterConfigsByConverter(converter);
  }

  return await getAllConverterConfigs();
};

export default getConverterConfigs;

export {
  getAllConverterConfigs,
  getConverterConfigsByConverter,
  getConverterConfigByAssetOut,
  getConverterConfigByAssetIn,
  getConverterConfigByAssetInAndAssetOut,
  TokenConverterConfigs,
};
