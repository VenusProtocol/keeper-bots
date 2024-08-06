require('dotenv').config({ path: '~.venus/.env' });

module.exports = {
  sources: [
    {
      name: 'venus-protocol-reserve',
      handler: {
        graphql: {
          endpoint: `https://gateway-arbitrum.network.thegraph.com/api/${process.env.THE_GRAPH_STUDIO_API_KEY}/subgraphs/id/bnwTFv6yd4FojhPFf5Hw4pzb8GwW25Du12yrnpD6erw`,
        }
      }
    },
    {
      name: 'venus-core-pool',
      handler: {
        graphql: {
          endpoint: `https://gateway-arbitrum.network.thegraph.com/api/${process.env.THE_GRAPH_STUDIO_API_KEY}/subgraphs/id/7h65Zf3pXXPmf8g8yZjjj2bqYiypVxems5d8riLK1DyR`,
        }
      }
    },
    {
      name: 'venus-isolated-pools',
      handler: {
        graphql: {
          endpoint: `https://gateway-arbitrum.network.thegraph.com/api/${process.env.THE_GRAPH_STUDIO_API_KEY}/subgraphs/id/H2a3D64RV4NNxyJqx9jVFQRBpQRzD6zNZjLDotgdCrTC`,
        }
      }
    },
    {
      name: 'venus-isolated-pools-ethereum',
      handler: {
        graphql: {
          endpoint: `https://gateway-arbitrum.network.thegraph.com/api/${process.env.THE_GRAPH_STUDIO_API_KEY}/subgraphs/id/Htf6Hh1qgkvxQxqbcv4Jp5AatsaiY5dNLVcySkpCaxQ8`,
        }
      }
    }
  ],
  documents: ["./queries/*.graphql"]
}