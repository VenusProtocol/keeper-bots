import { Address } from "viem";

import getConfig from "../../config";
import { coreComptrollerAbi, vBep20InterfaceAbi } from "../../config/abis/generated";
import getAddresses from "../../config/addresses";
import getPublicClient from "../../config/clients/publicClient";
import type { PoolAddressArray } from "../types";

export const getCoreMarkets = async (): Promise<PoolAddressArray[]> => {
  const config = getConfig();
  if (config.network === "bscmainnet" || config.network === "bsctestnet") {
    const addresses = getAddresses();
    const publicClient = getPublicClient();
    const markets = await publicClient.readContract({
      address: addresses.Unitroller as Address,
      abi: coreComptrollerAbi,
      functionName: "getAllMarkets",
    });

    const underlyingAddresses = await publicClient.multicall({
      contracts: markets.map(m => ({
        address: m,
        abi: vBep20InterfaceAbi,
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
