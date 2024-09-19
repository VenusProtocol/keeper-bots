import { Percent } from "@pancakeswap/sdk";
import { Token } from "@uniswap/sdk-core";
import { Pool } from "@uniswap/v3-sdk";
import { Address } from "viem";

import publicClient from "../config/clients/publicClient";
import walletClient from "../config/clients/walletClient";
import { ConverterBotMessage } from "../converter-bot/types";
import { DefaultMessage, TradeRoute } from "../types";

class SwapProvider {
  protected subscriber: undefined | ((msg: ConverterBotMessage) => void);
  public publicClient: typeof publicClient;
  public walletClient: typeof walletClient;

  // @ts-expect-error defined in inheriting classes
  liquidityProviderId: number;

  constructor({ subscriber }: { subscriber?: (msg: ConverterBotMessage) => void }) {
    this.subscriber = subscriber;
    this.publicClient = publicClient;
    this.walletClient = walletClient;
  }

  getOutputCurrency = <P = Pool, T = Token>(pool: P, inputToken: T): T => {
    // @ts-expect-error library types don't match
    const { token0, token1 } = pool;
    return token0.equals(inputToken) ? token1 : token0;
  };

  /**
   * Function to post message to subscriber
   * @param ConverterBotMessage
   *
   */
  sendMessage({
    type,
    trx = undefined,
    error = undefined,
    context = undefined,
    blockNumber = undefined,
  }: Partial<DefaultMessage> & Pick<DefaultMessage, "type">) {
    if (this.subscriber) {
      this.subscriber({ type, trx, error, context, blockNumber } as ConverterBotMessage);
    }
  }

  async getBestTrade(
    // eslint-disable-next-line
    swapFrom: Address,
    // eslint-disable-next-line
    swapTo: Address,
    // eslint-disable-next-line
    amount: bigint,
    // eslint-disable-next-line
    fixedPairs?: boolean,
  ): Promise<[TradeRoute, Percent | null]> {
    throw new Error("Not Implemented Error");
  }
}

export default SwapProvider;
