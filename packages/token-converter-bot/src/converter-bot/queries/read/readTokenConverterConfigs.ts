import { Address } from "viem";

import subgraphClient from "../../../../subgraph-client";
import { TokenConvertersQuery } from "../../../../subgraph-client/.graphclient";

const formatTokenConverterConfigs = (data: TokenConvertersQuery["tokenConverters"]) =>
  data.reduce((acc, curr) => {
    curr.configs.forEach(c => {
      if (c.access === "ALL" || c.access === "ONLY_FOR_USERS") {
        acc[curr.baseAsset] ||= {};
        acc[curr.baseAsset][c.tokenAddressOut] ||= [];
        acc[curr.baseAsset][c.tokenAddressOut].push(curr.id as Address);
      }
    });
    return acc;
  }, {} as Record<Address, Record<Address, Address[]>>);

const readTokenConverterConfigs = async () => {
  const {
    data: { tokenConverters },
  } = await subgraphClient.getTokenConverters();
  const tokenConverterConfigs = formatTokenConverterConfigs(tokenConverters);
  return tokenConverterConfigs;
};

export default readTokenConverterConfigs;
