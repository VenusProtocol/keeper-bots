import "dotenv/config";

import { Address, decodeFunctionResult, encodeFunctionData, erc20Abi, parseAbi } from "viem";

import { protocolShareReserveAbi } from "../../config/abis/generated";
import getAddresses from "../../config/addresses";
import publicClient from "../../config/clients/publicClient";
import { MULTICALL_ABI, MULTICALL_ADDRESS } from "../constants";
import getCoreMarkets from "./getCoreMarkets";
import getIsolatedMarkets from "./getIsolatedMarkets";
import { TokenConverterConfigs } from "./getTokenConverterConfigs";
import getVTokensFromUnderlying from "./getVTokensFromUnderlying";

export interface BalanceResult {
  tokenConverter: Address;
  assetIn: {
    address: Address;
    symbol?: string | null;
    decimals: number;
  };
  assetOut: { address: Address; balance: bigint; symbol?: string | null; decimals: number };
  assetOutVTokens: {
    core: `0x${string}` | undefined;
    isolated: [`0x${string}`, `0x${string}`][] | undefined;
  };
  accountBalanceAssetOut: bigint;
}

const formatResults = async (
  results: bigint[],
  tokenConverterConfigs: TokenConverterConfigs,
): Promise<BalanceResult[]> => {
  const chunkSize = 2;
  const balances: BalanceResult[] = [];

  for (let i = 0; i < results.length; i += chunkSize) {
    const index = (i + chunkSize) / chunkSize - 1;
    const tokenConverter = tokenConverterConfigs[index].tokenConverter.id as Address;
    const assetIn = tokenConverterConfigs[index].tokenIn;
    const assetOut = tokenConverterConfigs[index].tokenOut;

    const curr = results.slice(i, i + chunkSize);

    const { coreVTokens, isolatedVTokens } = await getVTokensFromUnderlying(assetOut.address);
    const balance = {
      assetOutVTokens: {
        core: coreVTokens[0]?.id as Address,
        isolated: isolatedVTokens.map(v => [v.pool.id, v.id] as [Address, Address]),
      },
      tokenConverter,
      assetIn,
      assetOut: { ...assetOut, balance: BigInt(curr[0].toString()) },
      accountBalanceAssetOut: BigInt(curr[1].toString()),
    };

    balances.push(balance);
  }
  return balances;
};

const reduceConfigsToComptrollerAndTokens = async (tokenConfigs: TokenConverterConfigs) => {
  const corePoolMarkets = await getCoreMarkets();
  const isolatedPoolsMarkets = await getIsolatedMarkets();
  const allPools = [...corePoolMarkets, ...isolatedPoolsMarkets];
  const pools = tokenConfigs.reduce((acc, curr) => {
    for (const [comptroller, tokens] of allPools) {
      if (tokens.findIndex(t => t.underlyingAddress === curr.tokenOut.address) && acc[comptroller]) {
        acc[comptroller].push(curr.tokenOut.address);
      } else {
        acc[comptroller] = [curr.tokenOut.address];
      }
    }
    return acc;
  }, {} as Record<string, string[]>);
  return pools;
};

const encodeBalanceOfData = (args: readonly [`0x${string}`]) =>
  encodeFunctionData({
    abi: erc20Abi,
    functionName: "balanceOf",
    args,
  });

const encodeReleaseFundsData = (args: readonly [`0x${string}`, readonly `0x${string}`[]]) =>
  encodeFunctionData({
    abi: protocolShareReserveAbi,
    functionName: "releaseFunds",
    args,
  });

const decodeBalanceOfData = (data: `0x${string}`) =>
  decodeFunctionResult({
    abi: erc20Abi,
    functionName: "balanceOf",
    data,
  });

export const getTokenConvertersTokenBalances = async (
  tokenConverterConfigs: TokenConverterConfigs,
  walletAddress: Address,
  releaseFunds?: boolean,
): Promise<{ results: BalanceResult[]; blockNumber: bigint }> => {
  const addresses = getAddresses();
  const pools = await reduceConfigsToComptrollerAndTokens(tokenConverterConfigs);
  let releaseFundsCalls: { target: string; allowFailure: boolean; callData: string }[] = [];
  if (releaseFunds) {
    releaseFundsCalls = Object.entries(pools).map(node => ({
      target: addresses.ProtocolShareReserve,
      allowFailure: true, // We allow failure for all calls.
      callData: encodeReleaseFundsData(node as [`0x${string}`, readonly `0x${string}`[]]),
    }));
  }

  const blockNumber = await publicClient.getBlockNumber();

  const { result } = await publicClient.simulateContract({
    address: MULTICALL_ADDRESS,
    abi: parseAbi(MULTICALL_ABI),
    functionName: "aggregate3",
    args: [
      [
        ...releaseFundsCalls,
        ...tokenConverterConfigs.reduce((acc, curr) => {
          acc = acc.concat([
            {
              target: curr.tokenOut.address,
              callData: encodeBalanceOfData([curr.tokenConverter.id as Address]),
              allowFailure: false,
            },
            {
              target: curr.tokenOut.address,
              callData: encodeBalanceOfData([walletAddress]),
              allowFailure: false,
            },
          ]);
          //
          return acc;
        }, [] as unknown as readonly { target: `0x${string}`; callData: `0x${string}`; allowFailure: boolean }[]),
      ],
    ] as [readonly { target: `0x${string}`; callData: `0x${string}`; allowFailure: boolean }[]],
    blockNumber: blockNumber ? BigInt(blockNumber) : undefined,
  });

  const results = result.map(({ returnData }: { success: boolean; returnData: string }) =>
    decodeBalanceOfData(returnData as `0x${string}`),
  );
  const formattedResults = await formatResults(results, tokenConverterConfigs);

  return { results: formattedResults, blockNumber };
};

export default getTokenConvertersTokenBalances;
