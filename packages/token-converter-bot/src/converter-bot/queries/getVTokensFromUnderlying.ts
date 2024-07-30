import { Address } from "viem";

import getConfig from "../../config";
import SubgraphClient from "../../subgraph-client";
import { CoreVTokensFromUnderlyingQuery, IsolatedVTokensFromUnderlyingQuery } from "../../subgraph-client/.graphclient";

const getVTokensFromUnderlying = async (
  underlyingAddress: Address,
): Promise<{
  coreVTokens: CoreVTokensFromUnderlyingQuery["markets"];
  isolatedVTokens: IsolatedVTokensFromUnderlyingQuery["markets"];
}> => {
  const isolatedPoolSubgraphClient = new SubgraphClient(getConfig().isolatedPoolsSubgraphUrl);
  const corePoolSubgraphClient = new SubgraphClient(getConfig().isolatedPoolsSubgraphUrl);
  const { data: { markets: isolatedVTokens = [] } = { isolatedVTokens: [] } } =
    await corePoolSubgraphClient.getIsolatedVTokensFromUnderlying(underlyingAddress);
  const { data: { markets: coreVTokens = [] } = { coreVTokens: [] } } =
    await isolatedPoolSubgraphClient.getCoreVTokensFromUnderlying(underlyingAddress);

  return { coreVTokens, isolatedVTokens };
};

export default getVTokensFromUnderlying;
