import { Address } from "viem";

import { coreComptrollerAbi } from "../../config/abis/generated";
import getAddresses from "../../config/addresses";
import getPublicClient from "../../config/clients/publicClient";
import type { PoolAddressArray } from "../types";

export const getCoreMarkets = async (): Promise<PoolAddressArray[]> => {
  const addresses = getAddresses();
  const publicClient = getPublicClient();
  const markets = await publicClient.readContract({
    address: addresses.Unitroller as Address,
    abi: coreComptrollerAbi,
    functionName: "getAllMarkets",
  });
  return [[addresses.Unitroller as Address, markets]];
};

export default getCoreMarkets;
