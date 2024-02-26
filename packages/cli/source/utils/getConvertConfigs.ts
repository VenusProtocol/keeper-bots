import { Address } from 'viem';
import { TokenConverterConfig, getAllConverterConfigs, getConverterConfigByAssetOut, getConverterConfigsByConverter, getConverterConfigByAssetIn, getConverterConfigByAssetInAndAssetOut } from '@venusprotocol/token-converter-bot';

const getConverterConfigs = async ({ assetOut, assetIn, converter }: { assetOut?: Address, assetIn?: Address, converter?: Address }): Promise<TokenConverterConfig[]> => {
  if (assetOut && assetIn) {
    return await getConverterConfigByAssetInAndAssetOut(assetIn, assetOut)
  } else if (assetOut) {
    return await getConverterConfigByAssetOut(assetOut)
  } else if (assetIn) {
    return await getConverterConfigByAssetIn(assetIn)
  } else if (converter) {
    return await getConverterConfigsByConverter(converter)
  }

  return await getAllConverterConfigs();
}

export default getConverterConfigs;
