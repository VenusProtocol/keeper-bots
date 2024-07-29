import { Address } from "viem";
import { Pool } from '@uniswap/v3-sdk';
import { Token } from '@uniswap/sdk-core';
import getPublicClient from "../../config/clients/publicClient";
import getWalletClient from "../../config/clients/walletClient";
import { Message, TradeRoute } from "../types";
import logger from "../logger";


class SwapProvider {
  private subscriber: undefined | ((msg: Message) => void);
  private verbose: boolean;
  public publicClient: ReturnType<typeof getPublicClient>;
  public walletClient: ReturnType<typeof getWalletClient>;

  // @ts-ignore
  liquidityProviderId: number;

  constructor({ subscriber, verbose }: {
    subscriber?: (msg: Message) => void,
    verbose?: boolean
  }) {
    this.subscriber = subscriber;
    this.verbose = !!verbose;
    this.publicClient = getPublicClient();
    this.walletClient = getWalletClient();
  }

  getOutputCurrency = <P = Pool, T = Token>(pool: P, inputToken: T): T => {
    // @ts-ignore
    const { token0, token1 } = pool;
    return token0.equals(inputToken) ? token1 : token0;
  };

  /**
 * Function to post message to subscriber
 * @param Message
 *
 */
  sendMessage({
    type,
    trx = undefined,
    error = undefined,
    context = undefined,
    blockNumber = undefined,
  }: Partial<Message> & Pick<Message, "type">) {
    if (this.subscriber) {
      this.subscriber({ type, trx, error, context, blockNumber } as Message);
    }

    if (this.verbose) {
      if (error) {
        logger.error(Array.isArray(error) ? error.join(",") : error, context);
      } else {
        logger.info(`${type} - ${trx}`, context);
      }
    }
  }

  async getBestTrade(tokenConverter: Address, swapFrom: Address, swapTo: Address, amount: bigint): Promise<[TradeRoute, readonly [bigint, bigint]]> {
    throw new Error('Not Implemented Error');
  }
}

export default SwapProvider
