const safelyGetEnvVar = <T extends keyof typeof process.env>(key: T) => {
  const envVar = process.env[key];
  if (envVar === undefined) {
    throw new Error(`${key} not defined in environment variables`);
  }
  return envVar;
};

export const pancakeSwapSubgraphUrlByNetwork = {
  bsctestnet: "https://api.thegraph.com/subgraphs/name/pancakeswap/exchange-v3-chapel",
  bscmainnet: "https://api.thegraph.com/subgraphs/name/pancakeswap/exchange-v3-bsc",
};

export const subgraphUrlByNetwork = {
  bsctestnet:
    "https://api.thegraph.com/subgraphs/name/venusprotocol/venus-protocol-reserve-chapel?source=venusprotocol-keeper-bots",
  bscmainnet: `https://gateway-arbitrum.network.thegraph.com/api/${safelyGetEnvVar(
    "THE_GRAPH_STUDIO_API_KEY",
  )}/subgraphs/id/2ZCWgaBc8KoWW8kh7MRzf9KPdr7NTZ5cda9bxpFDk4wG`,
};

const getConfig = () => {
  const network = safelyGetEnvVar("NETWORK");
  return {
    subgraphUrl: subgraphUrlByNetwork[network],
    pancakeSwapSubgraphUrl: pancakeSwapSubgraphUrlByNetwork[network],
    network,
    rpcUrl: safelyGetEnvVar(`RPC_${network}`),
  };
};

export default getConfig;
