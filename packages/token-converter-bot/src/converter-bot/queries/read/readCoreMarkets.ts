import { Address } from "viem";

import { coreComptrollerAbi } from "../../../config/abis/generated";
import addresses from "../../../config/addresses";
import publicClient from "../../../config/clients/publicClient";
import type { Pool } from "../../types";

const readCoreMarkets = async (): Promise<Pool[]> => {
  const markets = await publicClient.readContract({
    address: addresses.Unitroller as Address,
    abi: coreComptrollerAbi,
    functionName: "getAllMarkets",
  });
  return [[addresses.Unitroller as Address, markets]];
};

export default readCoreMarkets;
