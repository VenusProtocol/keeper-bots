import { Currency, CurrencyAmount, Fraction, Percent, Token, TradeType } from "@pancakeswap/sdk";
import { BaseRoute, Pool, QuoteProvider, SmartRouter, SmartRouterTrade, V3Pool } from "@pancakeswap/smart-router/evm";
import { Client as UrqlClient, createClient } from "urql/core";
import {
  Address,
  BaseError,
  ContractFunctionRevertedError,
  Hex,
  HttpTransport,
  PublicClient,
  encodePacked,
  erc20Abi,
  formatUnits,
  parseAbi,
} from "viem";

import config from "../config";
import {
  coreVTokenAbi,
  protocolShareReserveAbi,
  tokenConverterAbi,
  tokenConverterOperatorAbi,
  vBnbAdminAbi,
  venusLensAbi,
} from "../config/abis/generated";
import addresses from "../config/addresses";
import type { SUPPORTED_CHAINS } from "../config/chains";
import { chains } from "../config/chains";
import publicClient from "../config/clients/publicClient";
import walletClient from "../config/clients/walletClient";
import logger from "./logger";
import { TokenConverterConfig } from "./queries/read/readTokenConverterConfigs/formatTokenConverterConfigs";
import readTokenConvertersTokenBalances, { BalanceResult } from "./queries/read/readTokenConvertersTokenBalances";
import type { PoolAddressArray } from "./types";

const REVERT_IF_NOT_MINED_AFTER = 60n; // seconds
const MAX_HOPS = 5;

const getOutputCurrency = (pool: V3Pool, inputToken: Token): Token => {
  const { token0, token1 } = pool;
  return token0.equals(inputToken) ? token1 : token0;
};

export interface ArbitrageMessage {
  action: "Arbitrage";
  trx: string | undefined;
  error: string | undefined;
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

interface GetBestTradeMessage {
  action: "GetBestTrade";
  trx: string | undefined;
  error: string | undefined;
  context: {
    converter: string;
    tradeAmount: { amountIn: bigint | undefined; amountOut: bigint | undefined };
    tokenToReceiveFromConverter: string;
    tokenToSendToConverter: string;
  };
}

interface ExecuteTradeMessage {
  action: "ExecuteTrade";
  trx: string | undefined;
  error: string | undefined;
  context: {
    converter: string;
    tokenToReceiveFromConverter: string;
    tokenToSendToConverter: string;
    amount: bigint;
    minIncome: bigint;
  };
}

export interface AccrueInterestMessage {
  action: "AccrueInterest";
  trx: string | undefined;
  error: string | string[] | undefined;
  context: undefined;
}

export type Message =
  | {
      action: "ReduceReserves" | "ReleaseFunds";
      trx: string | undefined;
      error: string | undefined;
      context: undefined;
    }
  | {
      action: "PotentialTrades";
      trx: undefined;
      error: string | undefined;
      context: { trades: BalanceResult[] };
    }
  | AccrueInterestMessage
  | ArbitrageMessage
  | GetBestTradeMessage
  | ExecuteTradeMessage;

export class TokenConverter {
  private chainName: SUPPORTED_CHAINS;
  private operator: { address: Address; abi: typeof tokenConverterOperatorAbi };
  private addresses: typeof addresses;
  private _walletClient?: typeof walletClient;
  private _publicClient?: typeof publicClient;
  private v3SubgraphClient: UrqlClient;
  private quoteProvider: QuoteProvider;
  private tokens: Map<Address, Currency>;
  private subscriber: undefined | ((msg: Message) => void);
  private simulate: boolean;
  private verbose: boolean;

  constructor({
    subscriber,
    simulate,
    verbose = false,
  }: {
    subscriber?: (msg: Message) => void;
    simulate: boolean;
    verbose: boolean;
  }) {
    this.chainName = config.network;
    this.subscriber = subscriber;
    this.addresses = addresses;
    this.operator = {
      address: addresses.TokenConverterOperator,
      abi: tokenConverterOperatorAbi,
    };
    this.v3SubgraphClient = createClient({
      url: config.pancakeSwapSubgraphUrl,
      requestPolicy: "network-only",
    });
    this.quoteProvider = SmartRouter.createQuoteProvider({ onChainProvider: () => this.publicClient });
    this.tokens = new Map();
    this.simulate = simulate;
    this.verbose = verbose;
  }

  get publicClient(): PublicClient<HttpTransport, typeof chains[SUPPORTED_CHAINS]> {
    return (this._publicClient ||= publicClient);
  }

  get walletClient() {
    return (this._walletClient ||= walletClient);
  }

  private sendMessage({
    action,
    trx = undefined,
    error = undefined,
    context = undefined,
  }: Partial<Message> & Pick<Message, "action">) {
    if (this.subscriber) {
      this.subscriber({ action, trx, error, context } as Message);
    }

    if (this.verbose) {
      if (error) {
        logger.error(Array.isArray(error) ? error.join(",") : error, context);
      } else {
        logger.info(`${action} - ${trx}`, context);
      }
    }
  }

  getToken = async (address: Address): Promise<Currency> => {
    if (this.tokens.has(address)) {
      return this.tokens.get(address) as Currency;
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
  };

  async sanityCheck() {
    const expected = this.addresses.PancakeSwapRouter;
    const actual = await this.publicClient.readContract({
      ...this.operator,
      functionName: "SWAP_ROUTER",
    });
    if (expected !== actual) {
      throw new Error(`Expected swap router to be at ${expected} but found at ${actual}`);
    }
  }

  getPriceImpact(trade: SmartRouterTrade<TradeType.EXACT_OUTPUT>) {
    let spotOutputAmount = CurrencyAmount.fromRawAmount(trade.outputAmount.currency.wrapped, 0);
    for (const route of trade.routes) {
      const { inputAmount } = route;
      const midPrice = SmartRouter.getMidPrice(route);
      spotOutputAmount = spotOutputAmount.add(midPrice.quote(inputAmount.wrapped));
    }
    const priceImpact = spotOutputAmount.subtract(trade.outputAmount.wrapped).divide(spotOutputAmount);
    return new Percent(priceImpact.numerator, priceImpact.denominator);
  }

  /**
   * Create a trade that will provide required amount in for exact output
   * @param tokenConverter Token converter to use
   * @param swapFrom Token we want to receive to the converter
   * @param swapTo Token we want to send to the converter
   * @param amount The amount we will receive from the converter of swapFrom
   * @returns [SmartRouterTrade, [amount transferred out of converter, amount transferred In]]
   */
  async getBestTrade(
    tokenConverter: Address,
    swapFrom: Address,
    swapTo: Address,
    amount: bigint,
  ): Promise<[SmartRouterTrade<TradeType.EXACT_OUTPUT>, readonly [bigint, bigint]]> {
    const swapFromToken = await this.getToken(swapFrom);
    const swapToToken = await this.getToken(swapTo);

    // [amount transferred out of converter, amount transferred In]
    const { result: updatedAmountIn } = await publicClient.simulateContract({
      address: tokenConverter,
      abi: tokenConverterAbi,
      functionName: "getUpdatedAmountIn",
      args: [amount, swapTo, swapFrom],
    });

    const candidatePools = await SmartRouter.getV3CandidatePools({
      onChainProvider: () => this.publicClient,
      subgraphProvider: () => this.v3SubgraphClient,
      currencyA: swapFromToken,
      currencyB: swapToToken,
    });
    let trade;
    let error;
    try {
      trade = await SmartRouter.getBestTrade(
        CurrencyAmount.fromRawAmount(swapToToken, updatedAmountIn[1]),
        swapFromToken,
        TradeType.EXACT_OUTPUT,
        {
          gasPriceWei: () => this.publicClient.getGasPrice(),
          maxHops: MAX_HOPS,
          maxSplits: 0,
          poolProvider: SmartRouter.createStaticPoolProvider(candidatePools),
          quoteProvider: this.quoteProvider,
          quoterOptimization: true,
        },
      );
    } catch (e) {
      error = `Error getting best trade - ${(e as Error).message}`;
    }

    if (!trade) {
      error = "No trade found";
    }
    if (error) {
      throw new Error(error);
    }

    if (this.getPriceImpact(trade).greaterThan(new Percent(50n, 100n))) {
      return this.getBestTrade(tokenConverter, swapFrom, swapTo, (updatedAmountIn[0] * 75n) / 100n);
    }
    return [trade as SmartRouterTrade<TradeType.EXACT_OUTPUT>, updatedAmountIn];
  }

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
        const outputToken = getOutputCurrency(pool, inputToken);
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

  async accrueInterest(allPools: PoolAddressArray[]) {
    let error: string | string[];
    try {
      const allMarkets = allPools.reduce((acc, curr) => {
        acc.concat(curr[1]);
        return acc;
      }, [] as Address[]);

      // Accrue Interest in all markets
      const results = await Promise.allSettled(
        allMarkets.map(async market => {
          if (this.simulate) {
            await publicClient.simulateContract({
              account: walletClient.account.address,
              address: market,
              abi: coreVTokenAbi,
              functionName: "accrueInterest",
            });
          } else {
            await walletClient.writeContract({
              address: market,
              abi: coreVTokenAbi,
              functionName: "accrueInterest",
            });
          }
        }),
      );

      error = results.reduce((acc, curr) => {
        if (curr.status === "rejected") {
          acc.push(curr.reason);
        }
        return acc;
      }, [] as string[]);
    } catch (e) {
      error = (e as Error).message;
    }
    this.sendMessage({ action: "AccrueInterest", error });
  }

  /**
   * Checks total reserves and available cash and then uses the vBNB admin
   * to send the reserves ProtocolShare Reserve to be distributed
   */
  async reduceReserves() {
    let error;
    let trx;
    try {
      const totalReserves = await publicClient.readContract({
        address: addresses.vBNB as Address,
        abi: coreVTokenAbi,
        functionName: "totalReserves",
      });

      const cash = await publicClient.readContract({
        address: addresses.vBNB as Address,
        abi: coreVTokenAbi,
        functionName: "getCash",
      });

      if (cash > 0) {
        if (this.simulate) {
          await publicClient.simulateContract({
            account: walletClient.account.address,
            address: addresses.VBNBAdmin as Address,
            abi: vBnbAdminAbi,
            functionName: "reduceReserves",
            args: [totalReserves < cash ? totalReserves : cash],
          });
        } else {
          trx = await walletClient.writeContract({
            address: addresses.VBNBAdmin as Address,
            abi: vBnbAdminAbi,
            functionName: "reduceReserves",
            args: [totalReserves < cash ? totalReserves : cash],
          });
        }
      }
    } catch (e) {
      error = (e as Error).message;
    }
    this.sendMessage({ action: "ReduceReserves", error, trx });
  }

  async checkForTrades(allPools: PoolAddressArray[], tokenConverterConfigs: TokenConverterConfig[]) {
    const results = await readTokenConvertersTokenBalances(allPools, tokenConverterConfigs, false);
    const trades = results.filter(v => v.assetOut.balance > 0);
    this.sendMessage({ action: "PotentialTrades", context: { trades } });
    return trades;
  }

  async releaseFunds(trades: BalanceResult[]) {
    const releaseFundsArgs = trades.reduce((acc, curr) => {
      const { core, isolated } = curr.assetOutVTokens;
      if (core) {
        acc[addresses.Unitroller as Address] = [core];
      }
      if (isolated) {
        isolated.forEach(i => {
          acc[i[0]] = acc[i[0]] ? [...acc[i[0]], i[1]] : [i[1]];
        });
      }
      return acc;
    }, {} as Record<Address, Address[]>);

    for (const args of Object.entries(releaseFundsArgs)) {
      let trx;
      let error;
      try {
        if (this.simulate) {
          await publicClient.simulateContract({
            account: walletClient.account.address,
            address: addresses.ProtocolShareReserve as Address,
            abi: protocolShareReserveAbi,
            functionName: "releaseFunds",
            args: args as [`0x${string}`, readonly `0x${string}`[]],
          });
        } else {
          trx = await walletClient.writeContract({
            address: addresses.ProtocolShareReserve as Address,
            abi: protocolShareReserveAbi,
            functionName: "releaseFunds",
            args,
          });
        }
      } catch (e) {
        error = (e as Error).message;
      }
      this.sendMessage({ action: "ReleaseFunds", trx, error });
  }

  async getUsdValue(underlyingAddress: Address, vTokenAddress: Address, value: bigint) {
    const result = await publicClient.multicall({
      contracts: [
        {
          address: underlyingAddress,
          abi: erc20Abi,
          functionName: "decimals",
          args: [],
        },
        {
          address: addresses.VenusLens as Address,
          abi: venusLensAbi,
          functionName: "vTokenUnderlyingPrice",
          args: [vTokenAddress],
        },
      ],
    });
    const [{ result: underlyingDecimals = 0 }, { result: { underlyingPrice } = { underlyingPrice: undefined } }] =
      result;
    let underlyingUsdValue = "0";
    if (underlyingPrice && underlyingDecimals) {
      underlyingUsdValue = formatUnits(value * underlyingPrice, 36);
    }
    return {
      underlyingPriceUsd: formatUnits(underlyingPrice || 0n, 36 - underlyingDecimals) || "0",
      underlyingUsdValue,
      underlyingDecimals,
    };
  }

  /**
   *
   * @param converterAddress Address of converter to use
   * @param trade Swap trade which starts with token to receive and ends with token to deposit
   * @param amount Amount of token to receive from converter
   * @param expectedMinIncome Profitability or cost of conversion in token to receive
   */
  async arbitrage(
    converterAddress: Address,
    trade: SmartRouterTrade<TradeType.EXACT_OUTPUT>,
    amount: bigint,
    minIncome: bigint,
  ) {
    const beneficiary = this.walletClient.account.address;
    const chain = chains[this.chainName];

    const block = await this.publicClient.getBlock();
    const convertTransaction = {
      ...this.operator,
      chain,
      functionName: "convert" as const,
      args: [
        {
          beneficiary,
          tokenToReceiveFromConverter: trade.inputAmount.currency.address as Address,
          amount,
          minIncome,
          tokenToSendToConverter: trade.outputAmount.currency.address as Address,
          converter: converterAddress,
          path: this.encodeExactInputPath(trade.routes[0]),
          deadline: block.timestamp + REVERT_IF_NOT_MINED_AFTER,
        },
      ] as const,
    };
    let trx;
    let error;
    try {
      if (minIncome < 0n) {
        if (this.simulate) {
          await this.publicClient.simulateContract({
            address: trade.inputAmount.currency.address,
            chain,
            abi: parseAbi(["function approve(address,uint256)"]),
            functionName: "approve",
            args: [this.operator.address, -minIncome],
          });
        } else {
          await this.walletClient.writeContract({
            address: trade.inputAmount.currency.address,
            chain,
            abi: parseAbi(["function approve(address,uint256)"]),
            functionName: "approve",
            args: [this.operator.address, -minIncome],
          });
        }
      }

      const gasEstimation = await this.publicClient.estimateContractGas({
        account: this.walletClient.account,
        ...convertTransaction,
      });

      if (this.simulate) {
        await this.publicClient.simulateContract({
          account: this.walletClient.account.address,
          ...convertTransaction,
          gas: (gasEstimation * 110n) / 100n,
        });
        trx = "success";
      } else {
        trx = await this.walletClient.writeContract({ ...convertTransaction, gas: (gasEstimation * 120n) / 100n });
      }
    } catch (e) {
      if (e instanceof BaseError) {
        const revertError = e.walk(err => err instanceof ContractFunctionRevertedError);
        if (revertError instanceof ContractFunctionRevertedError) {
          // writeContract || simulateContract shapes
          error = revertError.reason || revertError.shortMessage;
        }
      } else {
        error = (e as Error).message;
      }
    }
    this.sendMessage({ action: "Arbitrage", error, trx, context: convertTransaction.args[0] });
  }

  async executeTrade(t: BalanceResult) {
    let error;
    let trade;
    let tradeAmount;
    try {
      [trade, tradeAmount] = await this.getBestTrade(
        t.tokenConverter,
        t.assetOut.address,
        t.assetIn.address,
        t.assetOut.balance,
      );
    } catch (e) {
      error = e as Error;
    } finally {
      this.sendMessage({
        action: "GetBestTrade",
        error: error?.message,
        context: {
          tradeAmount: { amountOut: tradeAmount && tradeAmount[0], amountIn: tradeAmount && tradeAmount[1] },
          converter: t.tokenConverter,
          tokenToReceiveFromConverter: t.assetOut.address,
          tokenToSendToConverter: t.assetIn.address,
        },
      });
    }

    if (trade && tradeAmount) {
      // the difference between the token you get from TokenConverter and the token you pay to PCS
      const minIncome = BigInt(
        new Fraction(tradeAmount[0], 1).subtract(trade.inputAmount).toFixed(0, { groupSeparator: "" }),
      );

      let hasIncome = true;
      if (minIncome < 0) {
        // Check that we have the income to transfer
        const balanceOf = await publicClient.readContract({
          address: t.assetOut.address,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [walletClient.account.address],
        });

        hasIncome = balanceOf >= minIncome * -1n;
      }

      const amount = tradeAmount[0];
      if (hasIncome) {
        await this.arbitrage(t.tokenConverter, trade, amount, minIncome);
      } else {
        error = `Unable to run conversion because income was negative and wallet doesn't have a positive balance {minIncome: ${minIncome}, asset: ${t.assetOut.address}}`;
        this.sendMessage({
          action: "ExecuteTrade",
          error,
          context: {
            converter: t.tokenConverter,
            tokenToReceiveFromConverter: t.assetOut.address,
            tokenToSendToConverter: t.assetIn.address,
            amount,
            minIncome,
          },
        });
      }
    }
  }
}

export default TokenConverter;
