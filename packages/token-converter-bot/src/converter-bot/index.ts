import "dotenv/config";

import { Fraction } from "@pancakeswap/sdk";
import { Address } from "viem";

import config from "../config";
import { coreVTokenAbi, protocolShareReserveAbi, tokenConverterAbi, vBnbAdminAbi } from "../config/abis/generated";
import addresses from "../config/addresses";
import publicClient from "../config/clients/publicClient";
import walletClient from "../config/clients/walletClient";
import TokenConverter from "./TokenConverter";
import logger from "./logger";
import readCoreMarkets from "./queries/read/readCoreMarkets";
import readIsolatedMarkets from "./queries/read/readIsolatedMarkets";
import readTokenConverterConfigs from "./queries/read/readTokenConverterConfigs";
import readTokenConvertersTokenBalances, { BalanceResult } from "./queries/read/readTokenConvertersTokenBalances";
import type { Pool } from "./types";

const network = config.network;

const checkForTrades = (values: BalanceResult[]) => {
  const trades = values.filter(v => v.assetOut.balance > 0);
  return trades;
};

const releaseFunds = async (trades: BalanceResult[]) => {
  const releaseFundsArgs = trades.reduce((acc, curr) => {
    const { core, isolated } = curr.assetOutVTokens;
    if (core) {
      acc[addresses.Unitroller as Address] = [core];
    }
    if (isolated) {
      isolated.forEach(i => {
        acc[i[0]] = acc[i[0]] ? [...acc[i[0]], i[1]] : [i[1]];
      });
    }
    return acc;
  }, {} as Record<Address, Address[]>);

  for (const args of Object.entries(releaseFundsArgs)) {
    await walletClient.writeContract({
      address: addresses.ProtocolShareReserve as Address,
      abi: protocolShareReserveAbi,
      functionName: "releaseFunds",
      args,
    });
  }
};

const executeTrade = async (t: BalanceResult) => {
  const tokenConverter = new TokenConverter(network);

  const { result: updatedAmountIn } = await publicClient.simulateContract({
    address: t.tokenConverter as Address,
    abi: tokenConverterAbi,
    functionName: "getUpdatedAmountIn",
    args: [t.assetOut.balance, t.assetIn.address, t.assetOut.address],
  });

  const trade = await tokenConverter.getBestTrade(t.assetOut.address, t.assetIn.address, updatedAmountIn[1]);

  const minIncome = BigInt(
    new Fraction(updatedAmountIn[0], 1).subtract(trade.inputAmount).toFixed(0, { groupSeparator: "" }),
  );

  await tokenConverter.arbitrage(t.tokenConverter, trade, updatedAmountIn[0], minIncome);
};

/**
 * Checks total reserves and available cash and then uses the vBNB admin
 * to send the reserves ProtocolShare Reserve to be distributed
 */
const reduceReserves = async () => {
  const totalReserves = await publicClient.readContract({
    address: addresses.vBNB as Address,
    abi: coreVTokenAbi,
    functionName: "totalReserves",
  });

  const cash = await publicClient.readContract({
    address: addresses.vBNB as Address,
    abi: coreVTokenAbi,
    functionName: "getCash",
  });

  if (cash > 0) {
    await walletClient.writeContract({
      address: addresses.VBNBAdmin as Address,
      abi: vBnbAdminAbi,
      functionName: "reduceReserves",
      args: [totalReserves < cash ? totalReserves : cash],
    });
  } else {
    logger.error("Unable to reduce reservers vBNB Admin is out of cash.");
  }
};

const accrueInterest = async (allPools: Pool[]) => {
  const allMarkets = allPools.reduce((acc, curr) => {
    acc.concat(curr[1]);
    return acc;
  }, [] as Address[]);

  // Accrue Interest in all markets
  await Promise.allSettled(
    allMarkets.map(async market => {
      await walletClient.writeContract({
        address: market,
        abi: coreVTokenAbi,
        functionName: "accrueInterest",
      });
    }),
  );
};

const main = async () => {
  const tokenConverterConfigs = await readTokenConverterConfigs();

  const corePoolMarkets = await readCoreMarkets();
  const isolatedPoolsMarkets = await readIsolatedMarkets();
  const allPools = [...corePoolMarkets, ...isolatedPoolsMarkets];

  await accrueInterest(allPools);
  await reduceReserves();

  const results = await readTokenConvertersTokenBalances(allPools, tokenConverterConfigs);

  const trades = checkForTrades(results);

  await releaseFunds(trades);

  for (const t of trades) {
    await executeTrade(t);
  }
};

export default main();
