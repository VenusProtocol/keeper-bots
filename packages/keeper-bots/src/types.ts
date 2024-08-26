import { Fraction } from "@pancakeswap/sdk";
import { Address } from "viem";

export interface DefaultMessage {
  type: unknown;
  trx?: string;
  error?: string | string[];
  blockNumber?: bigint;
  context?: unknown;
}

export interface TradeRoute {
  inputToken: {
    amount: Fraction;
    address: Address;
  };
  outputToken: {
    amount: Fraction;
    address: Address;
  };
  path: Address;
}
