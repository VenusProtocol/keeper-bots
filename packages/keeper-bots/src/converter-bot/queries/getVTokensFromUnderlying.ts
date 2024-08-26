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
  const config = getConfig();
  const isolatedPoolSubgraphClient = new SubgraphClient(config.isolatedPoolsSubgraphUrl);
  const { data: { markets: isolatedVTokens = [] } = { isolatedVTokens: [] } } =
    await isolatedPoolSubgraphClient.getIsolatedVTokensFromUnderlying(underlyingAddress);
  const corePoolSubgraphUrl = config.corePoolSubgraphUrl;
  let coreVTokens: CoreVTokensFromUnderlyingQuery["markets"] = [];
  if (corePoolSubgraphUrl) {
    const corePoolSubgraphClient = new SubgraphClient(corePoolSubgraphUrl);
    const { data: { markets } = { markets: [] } } = await corePoolSubgraphClient.getCoreVTokensFromUnderlying(
      underlyingAddress,
    );
    coreVTokens = markets;
  }

  return { coreVTokens, isolatedVTokens };
};

export default getVTokensFromUnderlying;
