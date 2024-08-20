import { Fraction } from "@pancakeswap/sdk";
import { IRoute } from "@uniswap/router-sdk";
import { ChainId, Currency, CurrencyAmount, Percent, Token, TradeType } from "@uniswap/sdk-core";
import { AlphaRouter, SwapOptionsSwapRouter02, SwapType } from "@uniswap/smart-order-router";
import { Pool, Route } from "@uniswap/v3-sdk";
import { ethers } from "ethers";
import JSBI from "jsbi";
import { Address, Hex, encodePacked, erc20Abi } from "viem";

import getConfig from "../config";
import type { SUPPORTED_CHAINS } from "../config/chains";
import { chains } from "../config/chains";
import { ConverterBotMessage } from "../converter-bot/types";
import { LiquidationBotMessage } from "../liquidation-bot/types";
import { TradeRoute } from "../types";
import SwapProvider from "./swap-provider";

const config = getConfig();

class UniswapProvider extends SwapProvider {
  private chainName: SUPPORTED_CHAINS;
  private tokens: Map<Address, Token>;

  constructor({ subscriber }: { subscriber?: (msg: ConverterBotMessage | LiquidationBotMessage) => void }) {
    super({ subscriber });
    this.tokens = new Map();
    this.chainName = config.network.name;
    this.liquidityProviderId = 0;
  }

  /**
   * Helper function got retrieving and caching a Uniswap sdk Token
   * @param address Address of the token to fetch
   * @error Throws if token can't be fetched
   *
   */
  async getToken(address: Address): Promise<Token> {
    if (this.tokens.has(address)) {
      return this.tokens.get(address) as Token;
    }
    const [{ result: decimals }, { result: symbol }] = await this.publicClient.multicall({
      contracts: [
        {
          address,
          abi: erc20Abi,
          functionName: "decimals",
        },
        {
          address,
          abi: erc20Abi,
          functionName: "symbol",
        },
      ],
    });

    if (decimals && symbol) {
      const token = new Token(chains[this.chainName].id, address, decimals, symbol);
      this.tokens.set(address, token);
      return token;
    }
    throw new Error(`Unable to fetch token details for ${address}`);
  }

  async getBestTrade(
    // tokenConverter: Address,
    swapFrom: Address,
    swapTo: Address,
    amount: bigint,
  ): Promise<TradeRoute> {
    const swapFromToken = await this.getToken(swapFrom);
    const swapToToken = await this.getToken(swapTo);

    const provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
    const router = new AlphaRouter({
      chainId: config.network.id as ChainId,
      provider,
    });
    const options: SwapOptionsSwapRouter02 = {
      recipient: this.walletClient.account.address,
      slippageTolerance: new Percent(50, 10_000),
      deadline: Math.floor(Date.now() / 1000 + 1800),
      type: SwapType.SWAP_ROUTER_02,
    };
    let error;
    let trade;
    try {
      const response = await router.route(
        CurrencyAmount.fromRawAmount(swapToToken, JSBI.BigInt(amount.toString())),
        swapFromToken,
        TradeType.EXACT_OUTPUT,
        options,
      );

      if (response) {
        const inputCurrency = response.trade.swaps[0].inputAmount;
        const outputCurrency = response.trade.swaps[response.trade.swaps.length - 1].outputAmount;

        trade = {
          inputToken: {
            amount: new Fraction(
              BigInt(inputCurrency.numerator.toString()),
              BigInt(inputCurrency.denominator.toString()),
            ),
            address: (inputCurrency?.currency as Token).address as Address,
          },
          outputToken: {
            amount: new Fraction(
              BigInt(outputCurrency.numerator.toString()),
              BigInt(outputCurrency.denominator.toString()),
            ),
            address: (outputCurrency?.currency as Token).address as Address,
          },
          path: this.encodeExactInputPath(
            response.trade.routes[0] as IRoute<Currency, Currency, Pool> & Route<Currency, Currency>,
          ),
        };
      }
    } catch (e) {
      error = `Error getting best trade - ${(e as Error).message} toToken ${swapToToken.address} fromToken ${
        swapFromToken.address
      } amount ${JSBI.BigInt(amount.toString())}`;
      throw new Error(error);
    }

    if (!trade) {
      throw new Error("No trade found");
    }

    return trade;
  }

  /**
   * Formats the swap exact input swap path
   * @param route Uniswap SDK Route
   * @returns Encoded path
   */
  encodeExactInputPath(route: IRoute<Currency, Currency, Pool> & Route<Currency, Currency>): Hex {
    const firstInputToken = route.input as Token;

    const { path, types } = route.pools.reduce(
      (
        // eslint-disable-next-line @typescript-eslint/no-shadow
        { inputToken, path, types }: { inputToken: Token; path: (string | number)[]; types: string[] },
        pool_: Pool,
        index: number,
      ): { inputToken: Token; path: (string | number)[]; types: string[] } => {
        if (!("fee" in pool_)) {
          throw new Error("Undefined fee");
        }
        const pool = pool_;
        const outputToken = this.getOutputCurrency(pool, inputToken);
        if (index === 0) {
          return {
            inputToken: outputToken,
            types: ["address", "uint24", "address"],
            path: [inputToken.address, pool.fee, outputToken.address],
          };
        }
        return {
          inputToken: outputToken,
          types: [...types, "uint24", "address"],
          path: [...path, pool.fee, outputToken.address],
        };
      },
      { inputToken: firstInputToken, path: [], types: [] },
    );

    return encodePacked(types.reverse(), path.reverse());
  }
}

export default UniswapProvider;
