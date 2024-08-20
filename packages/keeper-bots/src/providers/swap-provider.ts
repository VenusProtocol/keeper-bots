import { Token } from "@uniswap/sdk-core";
import { Pool } from "@uniswap/v3-sdk";
import { Address } from "viem";

import getPublicClient from "../config/clients/publicClient";
import getWalletClient from "../config/clients/walletClient";
import { ConverterBotMessage } from "../converter-bot/types";
import { LiquidationBotMessage } from "../liquidation-bot/types";
import { DefaultMessage, TradeRoute } from "../types";

class SwapProvider {
  protected subscriber: undefined | ((msg: ConverterBotMessage | LiquidationBotMessage) => void);
  public publicClient: ReturnType<typeof getPublicClient>;
  public walletClient: ReturnType<typeof getWalletClient>;

  // @ts-expect-error defined in inheriting classes
  liquidityProviderId: number;

  constructor({ subscriber }: { subscriber?: (msg: ConverterBotMessage | LiquidationBotMessage) => void }) {
    this.subscriber = subscriber;
    this.publicClient = getPublicClient();
    this.walletClient = getWalletClient();
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
      this.subscriber({ type, trx, error, context, blockNumber } as ConverterBotMessage | LiquidationBotMessage);
    }
  }

  async getBestTrade(
    // eslint-disable-next-line
    // tokenConverter: Address,
    // eslint-disable-next-line
    swapFrom: Address,
    // eslint-disable-next-line
    swapTo: Address,
    // eslint-disable-next-line
    amount: bigint,
  ): Promise<TradeRoute> {
    throw new Error("Not Implemented Error");
  }
}

export default SwapProvider;
