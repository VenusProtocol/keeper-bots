import "dotenv/config";

import { BigNumber } from "bignumber.js";
import { Contract, providers, utils } from "ethers";
import { Address, erc20Abi } from "viem";

import config from "../../config";
import { protocolShareReserveAbi } from "../../config/abis/generated";
import addresses, { underlyingByComptroller, underlyingToVTokens } from "../../config/addresses";
import publicClient from "../../config/clients/publicClient";
import { MULTICALL_ABI, MULTICALL_ADDRESS } from "../constants";
import { TokenConverterConfig } from "./getTokenConverterConfigs/formatTokenConverterConfigs";

const provider = new providers.JsonRpcProvider(config.rpcUrl);
const multicall = new Contract(MULTICALL_ADDRESS, MULTICALL_ABI, provider);
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

const formatResults = (results: BigNumber[], tokenConverterConfigs: TokenConverterConfig[]): BalanceResult[] => {
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
      callData: protocolShareReserveInterface.encodeFunctionData("releaseFunds", node),
    }));
  }

  const blockNumber = await publicClient.getBlockNumber();

  const erc20Interface = new utils.Interface(erc20Abi);
  const protocolShareReserveInterface = new utils.Interface(protocolShareReserveAbi);

  const resolverResults = await multicall.callStatic.aggregate3([
    ...releaseFundsCalls,
    ...tokenConverterConfigs.reduce((acc, curr) => {
      acc = acc.concat([
        {
          target: curr.tokenAddressOut,
          callData: erc20Interface.encodeFunctionData("balanceOf", [curr.tokenConverter]),
        },
        {
          target: curr.tokenAddressOut,
          callData: erc20Interface.encodeFunctionData("balanceOf", [walletAddress]),
        },
      ]);
      return acc;
    }, [] as { target: string; callData: string }[]),
  ]);
  // Decode the responses.
  const results = resolverResults.map(({ success, returnData }: { success: boolean; returnData: string }) => {
    if (success && returnData != "0x") {
      return erc20Interface.decodeFunctionResult("balanceOf", returnData)[0];
    }
  });

  const formattedResults = formatResults(results, tokenConverterConfigs);
  return { results: formattedResults, blockNumber };
};

export default getTokenConvertersTokenBalances;
