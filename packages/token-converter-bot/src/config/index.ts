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
  ethereum: "",
  sepolia: "",
};

export const protocolReserveSubgraphUrlByNetwork = {
  bsctestnet: `https://gateway-testnet-arbitrum.network.thegraph.com/api/${process.env.THE_GRAPH_STUDIO_API_KEY}/subgraphs/id/56kKcG5fTJfmCncsvq9n2quExvFUfSEds3Lpk5dkWkgE`,
  bscmainnet: `https://gateway-arbitrum.network.thegraph.com/api/${process.env.THE_GRAPH_STUDIO_API_KEY}/subgraphs/id/2ZCWgaBc8KoWW8kh7MRzf9KPdr7NTZ5cda9bxpFDk4wG`,
  ethereum: "",
  sepolia: "",
};

export const isolatedPoolsSubgraphUrlByNetwork = {
  bsctestnet: `https://gateway-testnet-arbitrum.network.thegraph.com/api/${process.env.THE_GRAPH_STUDIO_API_KEY}/subgraphs/id/mkXvkAme9PyDnSrLkajVHKVX7eG2HHATcYPE1qGF7gc`,
  bscmainnet: `https://gateway-arbitrum.network.thegraph.com/api/${process.env.THE_GRAPH_STUDIO_API_KEY}/subgraphs/id/H2a3D64RV4NNxyJqx9jVFQRBpQRzD6zNZjLDotgdCrTC`,
  ethereum: `https://gateway-arbitrum.network.thegraph.com/api/${process.env.THE_GRAPH_STUDIO_API_KEY}/subgraphs/id/Htf6Hh1qgkvxQxqbcv4Jp5AatsaiY5dNLVcySkpCaxQ8`,
  sepolia: `https://gateway-testnet-arbitrum.network.thegraph.com/api/${process.env.THE_GRAPH_STUDIO_API_KEY}/subgraphs/id/6YURB3bABVUNusgjtY7fNMkELGmKm9aaWirMQ9UZeDFj`,
};

export const corePoolSubgraphUrlByNetwork = {
  bsctestnet: `https://gateway-testnet-arbitrum.network.thegraph.com/api/${process.env.THE_GRAPH_STUDIO_API_KEY}/subgraphs/id/AK258nTjNqNk8dKZwmPFiuxWX3yNfV7rYztXpegCmZ6A`,
  bscmainnet: `https://gateway-arbitrum.network.thegraph.com/api/${process.env.THE_GRAPH_STUDIO_API_KEY}/subgraphs/id/7h65Zf3pXXPmf8g8yZjjj2bqYiypVxems5d8riLK1DyR`,
  ethereum: "",
  sepolia: "",
};

const getConfig = () => {
  const network = safelyGetEnvVar("NETWORK");
  return {
    isolatedPoolsSubgraphUrl: isolatedPoolsSubgraphUrlByNetwork[network],
    corePoolSubgraphUrl: corePoolSubgraphUrlByNetwork[network],
    protocolReserveSubgraphUrl: protocolReserveSubgraphUrlByNetwork[network],
    pancakeSwapSubgraphUrl: pancakeSwapSubgraphUrlByNetwork[network],
    network,
    rpcUrl: safelyGetEnvVar(`RPC_${network}`),
  };
};

export default getConfig;
