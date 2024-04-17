import { Address } from "viem";

import { poolLensAbi } from "../../config/abis/generated";
import addresses from "../../config/addresses";
import publicClient from "../../config/clients/publicClient";
import type { PoolAddressArray } from "../types";

export const getIsolatedMarkets = async (): Promise<PoolAddressArray[]> => {
  const markets = await publicClient.readContract({
    address: addresses.PoolLens as Address,
    abi: poolLensAbi,
    functionName: "getAllPools",
    args: [addresses.PoolRegistry as Address],
  });
  return markets.map((pool): [Address, Address[]] => [pool.comptroller, pool.vTokens.map(vToken => vToken.vToken)]);
};

export default getIsolatedMarkets;
