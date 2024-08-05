import { Address } from "viem";

import { BalanceResult } from "./queries/getTokenConvertersTokenBalances";

export type MarketAddresses = { underlyingAddress: Address; vTokenAddress: Address };
export type PoolAddressArray = [Address, MarketAddresses[]];

export interface DefaultMessage {
  trx: string | undefined;
  error: string | undefined;
  blockNumber?: bigint | undefined;
  context?: unknown;
}

export interface ReduceReservesMessage extends DefaultMessage {
  type: "ReduceReserves";
}

export interface ReleaseFundsMessage extends DefaultMessage {
  type: "ReleaseFunds";
  context: [Address, readonly Address[]];
}

export interface ArbitrageMessage extends DefaultMessage {
  type: "Arbitrage";
  context: {
    beneficiary: Address;
    tokenToReceiveFromConverter: Address;
    amount: bigint;
    minIncome: bigint;
    tokenToSendToConverter: Address;
    converter: string;
    path: Address;
    deadline: bigint;
  };
}

export interface GetBestTradeMessage extends DefaultMessage {
  type: "GetBestTrade";
  context: {
    converter: string;
    tradeAmount?: { amountIn: bigint | undefined; amountOut: bigint | undefined };
    swap?: {
      inputToken: { amount: string; token: string };
      outputToken: { amount: string; token: string };
    };
    tokenToReceiveFromConverter: string;
    tokenToSendToConverter: string;
    priceImpact?: string;
  };
}

export interface PotentialConversionsMessage extends DefaultMessage {
  type: "PotentialConversions";
  trx: undefined;
  context: { conversions: BalanceResult[] };
}

export interface AccrueInterestMessage {
  type: "AccrueInterest";
  trx: string | undefined;
  error: string | string[] | undefined;
  blockNumber?: bigint | undefined;
  context: undefined;
}

export type Message =
  | ReduceReservesMessage
  | ReleaseFundsMessage
  | PotentialConversionsMessage
  | AccrueInterestMessage
  | ArbitrageMessage
  | GetBestTradeMessage;

export interface TradeRoute {
  inputToken: {
    amount: bigint;
    address: Address;
  };
  outputToken: {
    amount: bigint;
    address: Address;
  };
  path: Address;
}
