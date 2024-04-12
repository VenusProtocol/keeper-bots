import { Address } from "viem";

import { TokenConverterConfig } from "./formatTokenConverterConfigs";
import { default as getAllConverterConfigs } from "./getAllConverterConfigs";
import { default as getConverterConfigByAssetIn } from "./getConverterConfigByAssetIn";
import { default as getConverterConfigByAssetInAndAssetOut } from "./getConverterConfigByAssetInAndAssetOut";
import { default as getConverterConfigByAssetOut } from "./getConverterConfigByAssetOut";
import { default as getConverterConfigsByConverter } from "./getConverterConfigsByConverter";

const getConverterConfigs = async ({
  assetOut,
  assetIn,
  converters,
}: {
  assetOut?: Address;
  assetIn?: Address;
  converters?: Address[];
}): Promise<TokenConverterConfig[]> => {
  if (assetOut && assetIn) {
    return await getConverterConfigByAssetInAndAssetOut(assetIn, assetOut);
  } else if (assetOut) {
    return await getConverterConfigByAssetOut(assetOut);
  } else if (assetIn) {
    return await getConverterConfigByAssetIn(assetIn);
  } else if (converters) {
    return await getConverterConfigsByConverter(converters);
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
  TokenConverterConfig,
};
