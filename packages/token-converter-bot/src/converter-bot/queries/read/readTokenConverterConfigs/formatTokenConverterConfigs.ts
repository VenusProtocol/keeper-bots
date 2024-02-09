import { Address } from "viem";

import { TokenConvertersQuery } from "../../../../subgraph-client/.graphclient";

export interface TokenConverterConfig {
  baseAsset: Address;
  tokenConverter: Address;
  tokenAddressOut: Address;
  tokenAddressIn: Address;
}

const formatTokenConverterConfigs = (data: TokenConvertersQuery["tokenConverters"]) => {
  const configs = data.reduce((acc, curr) => {
    const formatted = curr.configs.map(c => ({
      baseAsset: curr.baseAsset as Address,
      tokenConverter: curr.id as Address,
      tokenAddressOut: c.tokenAddressOut as Address,
      tokenAddressIn: c.tokenAddressIn as Address,
    }));
    acc = acc.concat(formatted);
    return acc;
  }, [] as TokenConverterConfig[]);
  return configs;
};

export default formatTokenConverterConfigs;
