import { SUPPORTED_CHAINS } from "./chains";

const subgraphUrlByNetwork = {
  bsctestnet: "https://api.thegraph.com/subgraphs/name/pancakeswap/exchange-v3-chapel",
  bscmainnet: "https://api.thegraph.com/subgraphs/name/pancakeswap/exchange-v3-bsc",
};

const safelyGetEnvVar = <T = string>(key: keyof typeof process.env) => {
  const envVar = process.env[key];
  if (envVar !== undefined) {
    return envVar as T;
  }
  throw new Error(`${key} not defined in environment variables`);
};

const config = {
  subgraphUrl: subgraphUrlByNetwork[safelyGetEnvVar<SUPPORTED_CHAINS>("NETWORK")],
  telegramBotToken: safelyGetEnvVar("TELEGRAM_BOT_TOKEN"),
  telegramChatId: +safelyGetEnvVar("TELEGRAM_CHAT_ID"),
};

export default config;
