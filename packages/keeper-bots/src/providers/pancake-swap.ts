import { CurrencyAmount, Percent, Token, TradeType } from "@pancakeswap/sdk";
import { BaseRoute, Pool, QuoteProvider, SmartRouter, V3Pool } from "@pancakeswap/smart-router/evm";
import { Client as UrqlClient, createClient } from "urql/core";
import { Address, Hex, encodePacked, erc20Abi } from "viem";

import getConfig from "../config";
import type { SUPPORTED_CHAINS } from "../config/chains";
import { chains } from "../config/chains";
import { ConverterBotMessage } from "../converter-bot/types";
import { TradeRoute } from "../types";
import SwapProvider from "./swap-provider";

const config = getConfig();

class PancakeSwapProvider extends SwapProvider {
  private chainName: SUPPORTED_CHAINS;
  private v3PancakeSubgraphClient: UrqlClient | undefined;
  private tokens: Map<Address, Token>;
  private quoteProvider: QuoteProvider;
  private _candidatePools: {
    expirationTimestamp: Date;
    data: ReturnType<typeof SmartRouter.getV3CandidatePools>;
  };

  constructor({ subscriber }: { subscriber?: (msg: ConverterBotMessage) => void }) {
    super({ subscriber });
    this.v3PancakeSubgraphClient = config.swapSubgraphUrl
      ? createClient({
          url: config.swapSubgraphUrl,
          requestPolicy: "network-only",
        })
      : undefined;

    this.quoteProvider = SmartRouter.createQuoteProvider({ onChainProvider: () => this.publicClient });
    this.tokens = new Map();
    this.chainName = config.network.name;
    this.liquidityProviderId = 1;
    this._candidatePools = {
      expirationTimestamp: new Date(),
      data: [],
    };
  }

  /**
   * Helper function got retrieving and caching a PancakeSwap sdk Token
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

  /**
   * Querying candidate pools can be a heavy operation so we cache it for 15 minutes
   * @param swapFromToken
   * @param swapToToken
   */
  getCandidatePools = async (swapFromToken: Token, swapToToken: Token, fixedPairs: boolean) => {
    const now = new Date();
    if (!this._candidatePools.data.length || this._candidatePools.expirationTimestamp < now) {
      const candidatePools = await SmartRouter.getV3CandidatePools({
        onChainProvider: () => this.publicClient,
        subgraphProvider: () => this.v3PancakeSubgraphClient,
        currencyA: swapFromToken,
        currencyB: swapToToken,
        pairs: fixedPairs
          ? [
              [swapFromToken, swapToToken],
              [swapToToken, swapFromToken],
            ]
          : undefined,
      });

      now.setMinutes(15 + new Date().getMinutes());
      this._candidatePools.data = candidatePools;
      this._candidatePools.expirationTimestamp = now;

      return candidatePools;
    }

    return this._candidatePools.data;
  };

  async getBestTrade(
    swapFrom: Address,
    swapTo: Address,
    amount: bigint,
    fixedPairs: boolean = false,
  ): Promise<[TradeRoute, Percent | null]> {
    const swapFromToken = await this.getToken(swapFrom);
    const swapToToken = await this.getToken(swapTo);

    let trade;
    let error;
    let priceImpact;

    try {
      const candidatePools = await this.getCandidatePools(swapFromToken, swapToToken, fixedPairs);

      const response = await SmartRouter.getBestTrade(
        CurrencyAmount.fromRawAmount(swapToToken, amount),
        swapFromToken,
        TradeType.EXACT_OUTPUT,
        {
          gasPriceWei: () => this.publicClient.getGasPrice(),
          maxHops: 5,
          maxSplits: 0,
          poolProvider: SmartRouter.createStaticPoolProvider(candidatePools),
          quoteProvider: this.quoteProvider,
          quoterOptimization: true,
        },
      );

      priceImpact = SmartRouter.getPriceImpact(response);

      if (response) {
        trade = {
          inputToken: {
            amount: response.inputAmount,
            address: response.inputAmount.currency.address,
          },
          outputToken: {
            amount: response.outputAmount,
            address: response.outputAmount.currency.address,
          },
          path: this.encodeExactInputPath(response.routes[0]),
        };
      }
    } catch (e) {
      const message = (e as Error).message;
      error = `Error getting best trade - ${message}`;
      // If we can't find a valid swap invalidate pool cache
      if (message === "Cannot find a valid swap route") {
        this._candidatePools.data = [];
        this._candidatePools.expirationTimestamp = new Date();
      }
      throw new Error(error);
    }

    if (!trade) {
      throw new Error("No trade found");
    }

    return [trade, priceImpact];
  }

  /**
   * Formats the swap exact input swap path
   * @param route SmartRouter Route
   * @returns Encoded path
   */
  encodeExactInputPath(route: BaseRoute): Hex {
    const firstInputToken: Token = route.inputAmount.currency;

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
        const pool = pool_ as V3Pool;
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

export default PancakeSwapProvider;
