import { Address } from "viem";

import subgraphClient from "../../../subgraph-client";
import { TokenConvertersQuery } from "../../../subgraph-client/.graphclient";

export interface TokenConverterConfig {
  baseAsset: Address;
  tokenConverter: Address;
  tokenAddressOut: Address;
  tokenAddressIn: Address;
}

const formatTokenConverterConfigs = (data: TokenConvertersQuery["tokenConverters"]) => {
  const configs = data.reduce((acc, curr) => {
    const results = curr.configs.map(c => ({
      baseAsset: curr.baseAsset as Address,
      tokenConverter: curr.id as Address,
      tokenAddressOut: c.tokenAddressOut as Address,
      tokenAddressIn: c.tokenAddressIn as Address,
    }));
    acc.concat(results)
    return acc;
  }, [] as TokenConverterConfig[]);
  return configs;
};

const readTokenConverterConfigs = async () => {
  const {
    data: { tokenConverters },
  } = await subgraphClient.getTokenConverters();
  const tokenConverterConfigs = formatTokenConverterConfigs(tokenConverters);
  return tokenConverterConfigs;
};

export default readTokenConverterConfigs;
