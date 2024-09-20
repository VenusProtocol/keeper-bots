import { Address } from "viem";

import getConfig from "../../config";
import { coreComptrollerAbi, coreVTokenAbi } from "../../config/abis/generated";
import getAddresses from "../../config/addresses";
import publicClient from "../../config/clients/publicClient";
import type { PoolAddressArray } from "../types";

export const getCoreMarkets = async (): Promise<PoolAddressArray[]> => {
  const config = getConfig();
  if (config.network.name === "bscmainnet" || config.network.name === "bsctestnet") {
    const addresses = getAddresses();
    const markets = await publicClient.readContract({
      address: addresses.Unitroller as Address,
      abi: coreComptrollerAbi,
      functionName: "getAllMarkets",
    });

    const underlyingAddresses = await publicClient.multicall({
      contracts: markets.map(m => ({
        address: m,
        abi: coreVTokenAbi,
        functionName: "underlying",
        args: [],
      })),
    });

    const marketsWithUnderlying = markets.map((m, idx) => {
      return { underlyingAddress: underlyingAddresses[idx].result as unknown as Address, vTokenAddress: m };
    });

    return [[addresses.Unitroller as Address, marketsWithUnderlying]];
  }
  return [];
};

export default getCoreMarkets;
