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
    curr.configs.forEach(c => {
      if (c.access === "ALL" || c.access === "ONLY_FOR_USERS") {
        acc.push({
          baseAsset: curr.baseAsset as Address,
          tokenConverter: curr.id as Address,
          tokenAddressOut: c.tokenAddressOut as Address,
          tokenAddressIn: c.tokenAddressIn as Address,
        });
      }
    });
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
