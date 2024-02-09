import { Address } from "viem";

import { coreComptrollerAbi } from "../../../config/abis/generated";
import addresses from "../../../config/addresses";
import publicClient from "../../../config/clients/publicClient";
import type { PoolAddressArray } from "../../types";

export const readCoreMarkets = async (): Promise<PoolAddressArray[]> => {
  const markets = await publicClient.readContract({
    address: addresses.Unitroller as Address,
    abi: coreComptrollerAbi,
    functionName: "getAllMarkets",
  });
  return [[addresses.Unitroller as Address, markets]];
};

export default readCoreMarkets;
