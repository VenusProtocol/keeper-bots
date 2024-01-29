import * as dotenv from "dotenv";
import { Abi, Address, parseUnits } from "viem";

import subgraphClient from "../../subgraph-client";
import {
  coreComptrollerAbi,
  coreVTokenAbi,
  protocolShareReserveAbi,
  tokenConverterAbi,
  vBnbAbi,
  vBnbAdminAbi,
} from "../config/abis/generated";
import addresses, { underlyingToVTokens } from "../config/addresses";
import { SUPPORTED_CHAINS } from "../config/chains";
import { getPublicClient, getWalletClient } from "../config/clients";
import formatTokenConverterConfigs from "./formatTokenConverterConfigs";
import { parsePath } from "./path";
import TokenConverterBot from "./tokenConverterBot";

dotenv.config();

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
        // @ts-ignore
        abi: protocolShareReserveAbi,
        // @ts-ignore
        functionName: "releaseFunds",
        // @ts-ignore
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

// @todo
const checkForTrade = async (values: any[]) => {
  const trades = values.filter(v => {
    return v.value.assetOut.balance > 0;
  });
  return trades;
};

// @todo
const executeTrade = async (t: any) => {
  // @todo
  const bot = new TokenConverterBot("bsctestnet");
  // @ts-ignore
  const vTokens = underlyingToVTokens[t.assetOut.address];
  // @ts-ignore
  if (vTokens.core) {
    await wallet.writeContract({
      address: addresses.ProtocolShareReserve as Address,
      // @ts-ignore
      abi: protocolShareReserveAbi,
      // @ts-ignore
      functionName: "releaseFunds",
      // @ts-ignore
      args: [addresses.Unitroller, [vTokens.core]],
    });
  }
  if (vTokens.isolated) {
    await wallet.writeContract({
      address: addresses.ProtocolShareReserve as Address,
      // @ts-ignore
      abi: protocolShareReserveAbi,
      // @ts-ignore
      functionName: "releaseFunds",
      // @ts-ignore
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

  await bot.arbitrage(
    t.tokenConverter,
    parsePath([t.assetIn.address as Address, 500n, t.assetOut.address as Address]),
    amountIn[1],
    parseUnits("-0.1", 18), // @todo
  );
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
    abi: vBnbAbi,
    functionName: "totalReserves",
  });

  const cash = await client.readContract({
    address: addresses.vBNB as Address,
    abi: vBnbAbi,
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
    console.error("Unable to reduce reservers vBnb Admin is out of cash");
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
