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
  const corePoolSubgraphClient = new SubgraphClient(getConfig().corePoolSubgraphUrl);
  const { data: { markets: isolatedVTokens = [] } = { isolatedVTokens: [] } } =
    await isolatedPoolSubgraphClient.getIsolatedVTokensFromUnderlying(underlyingAddress);
  const { data: { markets: coreVTokens = [] } = { coreVTokens: [] } } =
    await corePoolSubgraphClient.getCoreVTokensFromUnderlying(underlyingAddress);

  return { coreVTokens, isolatedVTokens };
};

export default getVTokensFromUnderlying;
