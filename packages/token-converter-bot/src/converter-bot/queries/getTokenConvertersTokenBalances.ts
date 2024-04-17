import "dotenv/config";

import { Address, decodeFunctionResult, encodeFunctionData, erc20Abi, parseAbi } from "viem";

import { protocolShareReserveAbi } from "../../config/abis/generated";
import addresses, { underlyingByComptroller, underlyingToVTokens } from "../../config/addresses";
import publicClient from "../../config/clients/publicClient";
import { MULTICALL_ABI, MULTICALL_ADDRESS } from "../constants";
import { TokenConverterConfig } from "./getTokenConverterConfigs/formatTokenConverterConfigs";

export interface BalanceResult {
  tokenConverter: Address;
  assetIn: Address;
  assetOut: { address: Address; balance: bigint };
  assetOutVTokens: {
    core: `0x${string}` | undefined;
    isolated: [`0x${string}`, `0x${string}`][] | undefined;
  };
  accountBalanceAssetOut: bigint;
}

const formatResults = (results: bigint[], tokenConverterConfigs: TokenConverterConfig[]): BalanceResult[] => {
  const chunkSize = 2;
  const balances: BalanceResult[] = [];

  for (let i = 0; i < results.length; i += chunkSize) {
    const index = (i + chunkSize) / chunkSize - 1;
    const tokenConverter = tokenConverterConfigs[index].tokenConverter;
    const assetIn = tokenConverterConfigs[index].tokenAddressIn;
    const assetOut = tokenConverterConfigs[index].tokenAddressOut;

    const curr = results.slice(i, i + chunkSize);

    const vToken = underlyingToVTokens[assetOut];
    const balance = {
      assetOutVTokens: vToken,
      tokenConverter,
      assetIn,
      assetOut: { address: assetOut, balance: BigInt(curr[0].toString()) },
      accountBalanceAssetOut: BigInt(curr[1].toString()),
    };

    balances.push(balance);
  }
  return balances;
};

const reduceConfigsToComptrollerAndTokens = (tokenConfigs: TokenConverterConfig[]) => {
  const underlyingByComptrollerEntries = Object.entries(underlyingByComptroller);
  const pools = tokenConfigs.reduce((acc, curr) => {
    for (const [comptroller, tokens] of underlyingByComptrollerEntries) {
      if (tokens.includes(curr.tokenAddressOut) && acc[comptroller]) {
        acc[comptroller].push(curr.tokenAddressOut);
      } else {
        acc[comptroller] = [curr.tokenAddressOut];
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
  tokenConverterConfigs: TokenConverterConfig[],
  walletAddress: Address,
  releaseFunds?: boolean,
): Promise<{ results: BalanceResult[]; blockNumber: bigint }> => {
  const pools = reduceConfigsToComptrollerAndTokens(tokenConverterConfigs);
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
              target: curr.tokenAddressOut,
              callData: encodeBalanceOfData([curr.tokenConverter]),
              allowFailure: false,
            },
            {
              target: curr.tokenAddressOut,
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
  const formattedResults = formatResults(results, tokenConverterConfigs);

  return { results: formattedResults, blockNumber };
};

export default getTokenConvertersTokenBalances;
