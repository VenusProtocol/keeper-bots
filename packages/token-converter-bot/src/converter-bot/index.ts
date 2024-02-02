import "dotenv/config";

import { Address } from "viem";

import { coreVTokenAbi, protocolShareReserveAbi, tokenConverterAbi, vBnbAdminAbi } from "../config/abis/generated";
import addresses, { underlyingToVTokens } from "../config/addresses";
import { SUPPORTED_CHAINS } from "../config/chains";
import publicClient from "../config/clients/publicClient";
import walletClient from "../config/clients/walletClient";
import TokenConverter from "./TokenConverter";
import readCoreMarkets from "./queries/read/readCoreMarkets";
import readIsolatedMarkets from "./queries/read/readIsolatedMarkets";
import readTokenConverterConfigs from "./queries/read/readTokenConverterConfigs";
import readTokenConvertersTokenBalances, { BalanceResult } from "./queries/read/readTokenConvertersTokenBalances";
import type { Pool } from "./types";

const network = process.env.NETWORK as SUPPORTED_CHAINS;

const isFulfilled = <T>(input: PromiseSettledResult<T>): input is PromiseFulfilledResult<T> =>
  input.status === "fulfilled";

const checkForTrades = async (values: PromiseSettledResult<BalanceResult[]>[]) => {
  const trades = values.reduce((acc, curr) => {
    if (isFulfilled(curr)) {
      acc = acc.concat(curr.value.filter(v => v.assetOut.balance > 0));
    }
    return acc;
  }, [] as BalanceResult[]);

  return trades;
};

const executeTrade = async (t: BalanceResult) => {
  const tokenConverter = new TokenConverter(network);

  const vTokens = underlyingToVTokens[t.assetOut.address];

  if (vTokens.core) {
    await walletClient.writeContract({
      address: addresses.ProtocolShareReserve as Address,
      abi: protocolShareReserveAbi,
      functionName: "releaseFunds",
      args: [addresses.Unitroller as Address, [vTokens.core]],
    });
  }

  if (vTokens.isolated) {
    for (const vToken of vTokens.isolated) {
      await walletClient.writeContract({
        address: addresses.ProtocolShareReserve as Address,
        abi: protocolShareReserveAbi,
        functionName: "releaseFunds",
        args: [vToken[0], [vToken[1]]],
      });
    }
  }

  const { result: amountIn } = await publicClient.simulateContract({
    address: t.tokenConverter as Address,
    abi: tokenConverterAbi,
    functionName: "getUpdatedAmountIn",
    args: [t.assetOut.balance, t.assetIn.address, t.assetOut.address],
  });

  const trade = await tokenConverter.getBestTrade(t.assetIn.address, t.assetOut.address, amountIn[1]);

  const minIncome = t.assetOut.balance - trade.inputAmount.numerator;

  await tokenConverter.arbitrage(t.tokenConverter, trade, amountIn[1], minIncome);
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
    console.error("Unable to reduce reservers vBNB Admin is out of cash.");
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

  const results = await Promise.allSettled(
    Object.keys(tokenConverterConfigs).map(async tokenIn => {
      const results = await Promise.allSettled(
        Object.keys(tokenConverterConfigs[tokenIn as Address]).map(async tokenOut => {
          const result = await readTokenConvertersTokenBalances(
            allPools,
            tokenIn as Address,
            tokenOut as Address,
            tokenConverterConfigs[tokenIn as Address][tokenOut as Address],
          );
          return result;
        }),
      );
      return results;
    }),
  );

  for (const r of results) {
    if (isFulfilled<PromiseSettledResult<BalanceResult[]>[]>(r)) {
      const trades = await checkForTrades(r.value);
      for (const t of trades) {
        await executeTrade(t);
      }
    }
  }
};

export default main();
