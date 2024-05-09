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
  bscmainnet:
    "https://api.thegraph.com/subgraphs/name/venusprotocol/venus-protocol-reserve?source=venusprotocol-keeper-bots",
};

const getConfig = () => {
  const network = safelyGetEnvVar("NETWORK");
  return {
    subgraphUrl: subgraphUrlByNetwork[network],
    pancakeSwapSubgraphUrl: pancakeSwapSubgraphUrlByNetwork[network],
    telegramBotToken: safelyGetEnvVar("TELEGRAM_BOT_TOKEN"),
    telegramChatId: +safelyGetEnvVar("TELEGRAM_CHAT_ID"),
    network,
    rpcUrl: safelyGetEnvVar(`RPC_${network}`),
  };
};

export default getConfig;
