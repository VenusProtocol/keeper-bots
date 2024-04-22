const SmartRouter = {
  APISchema: jest.fn(),
  PancakeMulticallProvider: jest.fn(),
  Transformer: jest.fn(),
  buildBaseRoute: jest.fn(),
  createCommonTokenPriceProvider: jest.fn(),
  createGetV2CandidatePools: jest.fn(),
  createGetV3CandidatePools: jest.fn(),
  createGetV3CandidatePoolsWithFallbacks: jest.fn(),
  createHybridPoolProvider: jest.fn(),
  createOffChainQuoteProvider: jest.fn(),
  createPoolProvider: jest.fn(),
  createPoolQuoteGetter: jest.fn(),
  createQuoteProvider: jest.fn(),
  createStaticPoolProvider: jest.fn(),
  createV2PoolsProviderByCommonTokenPrices: jest.fn(),
  encodeMixedRouteToPath: jest.fn(),
  getAllV3PoolsFromSubgraph: jest.fn(),
  getBestTrade: jest.fn(),
  getCandidatePools: jest.fn(),
  getCheckAgainstBaseTokens: jest.fn(),
  getCommonTokenPrices: jest.fn(),
  getCommonTokenPricesByLlma: jest.fn(),
  getCommonTokenPricesBySubgraph: jest.fn(),
  getCommonTokenPricesByWalletApi: jest.fn(),
  getExecutionPrice: jest.fn(),
  getMidPrice: jest.fn(),
  getOutputOfPools: jest.fn(),
  getPairCombinations: jest.fn(),
  getPoolAddress: jest.fn(),
  getPriceImpact: jest.fn(),
  getStableCandidatePools: jest.fn(),
  getStablePoolsOnChain: jest.fn(),
  getTokenUsdPricesBySubgraph: jest.fn(),
  getV2CandidatePools: jest.fn(),
  getV2PoolSubgraph: jest.fn(),
  getV2PoolsOnChain: jest.fn(),
  getV2PoolsWithTvlByCommonTokenPrices: jest.fn(),
  getV3CandidatePools: jest.fn(),
  getV3PoolSubgraph: jest.fn(),
  getV3PoolsWithTvlFromOnChain: jest.fn(),
  getV3PoolsWithTvlFromOnChainFallback: jest.fn(),
  getV3PoolsWithTvlFromOnChainStaticFallback: jest.fn(),
  getV3PoolsWithoutTicksOnChain: jest.fn(),
  involvesCurrency: jest.fn(),
  isStablePool: jest.fn(),
  isV2Pool: jest.fn(),
  isV3Pool: jest.fn(),
  log: jest.fn(),
  logger: jest.fn(),
  maximumAmountIn: jest.fn(),
  metric: jest.fn(),
  minimumAmountOut: jest.fn(),
  partitionMixedRouteByProtocol: jest.fn(),
  v2PoolSubgraphSelection: jest.fn(),
  v2PoolTvlSelector: jest.fn(),
  v3PoolSubgraphSelection: jest.fn(),
  v3PoolTvlSelector: jest.fn(),
  v3PoolsOnChainProviderFactory: jest.fn(),
};
export { SmartRouter };