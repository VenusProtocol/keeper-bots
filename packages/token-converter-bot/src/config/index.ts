import { SUPPORTED_CHAINS } from "./chains";

const safelyGetEnvVar = <T = string>(key: keyof typeof process.env) => {
  const envVar = process.env[key];
  if (envVar !== undefined) {
    return envVar as T;
  }
  throw new Error(`${key} not defined in environment variables`);
};

const pancakeSwapSubgraphUrlByNetwork = {
  bsctestnet: "https://api.thegraph.com/subgraphs/name/pancakeswap/exchange-v3-chapel",
  bscmainnet: "https://api.thegraph.com/subgraphs/name/pancakeswap/exchange-v3-bsc",
};

const subgraphUrlByNetwork = {
  bsctestnet: "https://api.thegraph.com/subgraphs/name/venusprotocol/venus-protocol-reserve-chapel",
  bscmainnet: "https://api.thegraph.com/subgraphs/name/venusprotocol/venus-protocol-reserve",
};

const config = {
  subgraphUrl: subgraphUrlByNetwork[safelyGetEnvVar<SUPPORTED_CHAINS>("NETWORK")],
  pancakeSwapSubgraphUrl: pancakeSwapSubgraphUrlByNetwork[safelyGetEnvVar<SUPPORTED_CHAINS>("NETWORK")],
  telegramBotToken: safelyGetEnvVar("TELEGRAM_BOT_TOKEN"),
  telegramChatId: +safelyGetEnvVar("TELEGRAM_CHAT_ID"),
  network: safelyGetEnvVar("NETWORK") as SUPPORTED_CHAINS,
};

export default config;
