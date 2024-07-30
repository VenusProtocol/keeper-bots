import { Address } from "viem";

export type MarketAddresses = { underlyingAddress: Address; vTokenAddress: Address };
export type PoolAddressArray = [Address, MarketAddresses[]];
