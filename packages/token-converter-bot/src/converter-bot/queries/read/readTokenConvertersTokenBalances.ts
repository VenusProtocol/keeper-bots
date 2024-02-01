import "dotenv/config";

import { Abi, Address } from "viem";

import { coreVTokenAbi, protocolShareReserveAbi } from "../../../config/abis/generated";
import addresses from "../../../config/addresses";
import publicClient from "../../../config/clients/publicClient";

export interface BalanceResult {
  tokenConverter: Address;
  assetIn: { address: Address; balance: bigint };
  assetOut: { address: Address; balance: bigint };
}

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
): BalanceResult[] => {
  const chunkSize = 2;
  const balances: BalanceResult[] = [];
  for (let i = 0; i < results.length; i += chunkSize) {
    const index = (i + chunkSize) / chunkSize - 1;
    const tokenConverter = tokenConverters[index];

    const curr = results.slice(i, i + chunkSize);

    balances.push({
      tokenConverter,
      assetIn: { address: assetIn, balance: curr[0].result as bigint },
      assetOut: { address: assetOut, balance: curr[1].result as bigint },
    });
  }
  return balances;
};

const readTokenConvertersTokenBalances = async (
  pools: [Address, readonly Address[]][],
  assetIn: Address,
  assetOut: Address,
  tokenConverters: Address[],
): Promise<BalanceResult[]> => {
  const releaseFundsCalls = pools.map(pool => ({
    address: addresses.ProtocolShareReserve as Address,
    abi: protocolShareReserveAbi,
    functionName: "releaseFunds",
    args: pool,
  }));
  const results = await publicClient.multicall({
    contracts: [
      ...releaseFundsCalls,
      ...tokenConverters.reduce((acc, curr) => {
        acc = acc.concat([
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
        ]);
        return acc;
      }, [] as { address: Address; abi: Abi; functionName: string; args?: readonly unknown[] | undefined }[]),
    ],
  });

  // Release funds will be empty
  results.splice(0, releaseFundsCalls.length);
  const formattedResults = formatResults(results, assetIn, assetOut, tokenConverters);
  return formattedResults;
};

export default readTokenConvertersTokenBalances;
