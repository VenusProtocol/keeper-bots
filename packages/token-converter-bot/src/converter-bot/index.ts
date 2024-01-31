import "dotenv/config";

import { Abi, Address } from "viem";

import subgraphClient from "../../subgraph-client";
import {
  coreComptrollerAbi,
  coreVTokenAbi,
  protocolShareReserveAbi,
  tokenConverterAbi,
  vBnbAdminAbi,
} from "../config/abis/generated";
import addresses, { underlyingToVTokens } from "../config/addresses";
import { SUPPORTED_CHAINS } from "../config/chains";
import { getPublicClient, getWalletClient } from "../config/clients";
import TokenConverterBot from "./TokenConverterBot";
import formatTokenConverterConfigs from "./formatTokenConverterConfigs";
import { parsePath } from "./path";

interface BalanceResult {
  tokenConverter: Address;
  assetIn: { address: Address; balance: bigint };
  assetOut: { address: Address; balance: bigint };
}

const network = process.env.FORKED_NETWORK as SUPPORTED_CHAINS;

const client = getPublicClient(network);
const wallet = getWalletClient(network);

const getCoreMarkets = async () => {
  const markets = await client.readContract({
    address: addresses.Unitroller as Address,
    abi: coreComptrollerAbi,
    functionName: "getAllMarkets",
  });
  return markets;
};

const formatResults = (
  results: (
    | {
        error: Error;
        result?: undefined;
        status: "failure";
      }
    | {
        error?: undefined;
        result: unknown;
        status: "success";
      }
  )[],
  assetIn: Address,
  assetOut: Address,
  tokenConverters: Address[],
) => {
  const chunkSize = 2;
  for (let i = 0; i < results.length; i += chunkSize) {
    const index = (i + chunkSize) / chunkSize - 1;
    const tokenConverter = tokenConverters[index];

    const curr = results.slice(i, i + chunkSize);

    return {
      tokenConverter,
      assetIn: { address: assetIn, balance: curr[0].result as bigint },
      assetOut: { address: assetOut, balance: curr[1].result as bigint },
    };
  }
};

const getBalances = async (assetIn: Address, assetOut: Address, tokenConverters: Address[]) => {
  const corePoolMarkets = await getCoreMarkets();
  const results = await client.multicall({
    contracts: [
      {
        address: addresses.ProtocolShareReserve as Address,
        abi: protocolShareReserveAbi,
        functionName: "releaseFunds",
        args: [addresses.Unitroller, corePoolMarkets],
      },
      ...tokenConverters.reduce((acc, curr) => {
        acc = acc.concat(
          {
            address: assetIn as Address,
            abi: coreVTokenAbi,
            functionName: "balanceOf",
            args: [curr],
          },
          {
            address: assetOut as Address,
            abi: coreVTokenAbi,
            functionName: "balanceOf",
            args: [curr],
          },
        );
        return acc;
      }, [] as { address: Address; abi: Abi; functionName: string; args?: readonly unknown[] | undefined }[]),
    ],
  });
  // Release funds will be empty
  results.shift();
  const formattedResults = formatResults(results, assetIn, assetOut, tokenConverters);
  return formattedResults;
};

const checkForTrade = async (values: { value: BalanceResult }[]) => {
  const trades = values.filter(v => {
    return v.value.assetOut.balance > 0;
  });
  return trades;
};

const executeTrade = async (t: BalanceResult) => {
  const bot = new TokenConverterBot(network);

  const vTokens = underlyingToVTokens[t.assetOut.address];

  if (vTokens.core) {
    await wallet.writeContract({
      address: addresses.ProtocolShareReserve as Address,
      abi: protocolShareReserveAbi,
      functionName: "releaseFunds",
      args: [addresses.Unitroller, [vTokens.core]],
    });
  }

  if (vTokens.isolated) {
    await wallet.writeContract({
      address: addresses.ProtocolShareReserve as Address,
      abi: protocolShareReserveAbi,
      functionName: "releaseFunds",
      args: [vTokens.isolated[0], [vTokens.isolated[1]]],
    });
  }

  const { result: amountIn } = await client.simulateContract({
    address: t.tokenConverter as Address,
    abi: tokenConverterAbi,
    functionName: "getUpdatedAmountIn",
    args: [t.assetOut.balance, t.assetIn.address, t.assetOut.address],
  });

  await bot.sanityCheck();

  const trade = await bot.getBestTrade(t.assetIn.address, t.assetOut.address, amountIn[1]);

  const fee = BigInt(trade.routes[0].pools[0].fee);
  const flashPayment = trade.inputAmount.numerator * (fee / 100000n + 1n);
  const minIncome = t.assetOut.balance - flashPayment;
  const path = parsePath([t.assetIn.address, fee, t.assetOut.address]);
  await bot.arbitrage(t.tokenConverter, path, amountIn[1], minIncome);
};

const main = async () => {
  const {
    data: { tokenConverters },
  } = await subgraphClient.getTokenConverters();
  const corePoolMarkets = await getCoreMarkets();
  await Promise.allSettled(
    corePoolMarkets.map(async market => {
      await wallet.writeContract({
        address: market,
        abi: coreVTokenAbi,
        functionName: "accrueInterest",
      });
    }),
  );

  const totalReserves = await client.readContract({
    address: addresses.vBNB as Address,
    abi: coreVTokenAbi,
    functionName: "totalReserves",
  });

  const cash = await client.readContract({
    address: addresses.vBNB as Address,
    abi: coreVTokenAbi,
    functionName: "getCash",
  });

  if (cash > 0) {
    await wallet.writeContract({
      address: addresses.VBNBAdmin as Address,
      abi: vBnbAdminAbi,
      functionName: "reduceReserves",
      args: [totalReserves < cash ? totalReserves : cash],
    });
  } else {
    console.error("Unable to reduce reservers vBNB Admin is out of cash.");
  }

  const tokenConverterConfigs = formatTokenConverterConfigs(tokenConverters);
  const results = await Promise.allSettled(
    Object.keys(tokenConverterConfigs).map(async tokenIn => {
      const results = await Promise.allSettled(
        Object.keys(tokenConverterConfigs[tokenIn as Address]).map(async tokenOut => {
          const result = await getBalances(
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
    // @ts-ignore
    const trades = await checkForTrade(r?.value);
    for (const t of trades) {
      await executeTrade(t.value);
    }
  }
};

main().catch(error => {
  console.error(error);
  process.exit(1);
});
