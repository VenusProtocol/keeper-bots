import "dotenv/config";

import config from "../config";
import TokenConverter from "./TokenConverter";
import logger from "./logger";
import readCoreMarkets from "./queries/read/readCoreMarkets";
import readIsolatedMarkets from "./queries/read/readIsolatedMarkets";
import getAllConverterConfigs from "./queries/read/readTokenConverterConfigs/getAllConverterConfigs";

const network = config.network;

const main = async () => {
  const tokenConverter = new TokenConverter(network);
  const corePoolMarkets = await readCoreMarkets();
  const isolatedPoolsMarkets = await readIsolatedMarkets();
  const allPools = [...corePoolMarkets, ...isolatedPoolsMarkets];
  await tokenConverter.accrueInterest(allPools);
  await tokenConverter.reduceReserves();

  const tokenConverterConfigs = await getAllConverterConfigs();

  const trades = await tokenConverter.checkForTrades(allPools, tokenConverterConfigs);

  await tokenConverter.releaseFunds(trades);

  for (const t of trades) {
    try {
      await tokenConverter.executeTrade(t);
    } catch (e) {
      logger.error(`Trade execution failed - ${(e as Error).message}`);
    }
  }
};

export default main();
