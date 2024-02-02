const subgraphUrlByNetwork = {
  bsctestnet: "https://api.thegraph.com/subgraphs/name/pancakeswap/exchange-v3-chapel",
  bscmainnet: "https://api.thegraph.com/subgraphs/name/pancakeswap/exchange-v3-bsc"
}

const config = {
  subgraphUrl: subgraphUrlByNetwork[process.env.NETWORK]
}

export default config
