import { Address } from "viem";

import { ilVTokenAbi, poolLensAbi } from "../../config/abis/generated";
import getAddresses from "../../config/addresses";
import publicClient from "../../config/clients/publicClient";
import type { PoolAddressArray } from "../types";

export const getIsolatedMarkets = async (): Promise<PoolAddressArray[]> => {
  const addresses = getAddresses();
  const pools = await publicClient.readContract({
    address: addresses.PoolLens as Address,
    abi: poolLensAbi,
    functionName: "getAllPools",
    args: [addresses.PoolRegistry as Address],
  });

  const underlyingAddressesByPool = await Promise.all(
    // @ts-expect-error not infinte
    pools.map(async p => {
      return await publicClient.multicall({
        contracts: p.vTokens.map(m => ({
          address: m.vToken,
          abi: ilVTokenAbi,
          functionName: "underlying",
          args: [],
        })),
      });
    }),
  );

  return pools.map((pool, poolIdx) => [
    pool.comptroller,
    pool.vTokens.map((vToken, vTokenIdx) => ({
      vTokenAddress: vToken.vToken,
      underlyingAddress: underlyingAddressesByPool[poolIdx][vTokenIdx].result as unknown as Address,
    })),
  ]);
};

export default getIsolatedMarkets;
