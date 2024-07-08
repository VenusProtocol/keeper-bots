import { Currency, CurrencyAmount, Fraction, Percent, Token, TradeType } from "@pancakeswap/sdk";
import { BaseRoute, Pool, QuoteProvider, SmartRouter, SmartRouterTrade, V3Pool } from "@pancakeswap/smart-router/evm";
import { Client as UrqlClient, createClient } from "urql/core";
import { Address, BaseError, ContractFunctionRevertedError, Hex, encodePacked, erc20Abi, formatUnits } from "viem";

import getConfig from "../config";
import {
  coreVTokenAbi,
  protocolShareReserveAbi,
  tokenConverterAbi,
  tokenConverterOperatorAbi,
  vBnbAdminAbi,
  venusLensAbi,
} from "../config/abis/generated";
import getAddresses from "../config/addresses";
import type { SUPPORTED_CHAINS } from "../config/chains";
import { chains } from "../config/chains";
import getPublicClient from "../config/clients/publicClient";
import getWalletClient from "../config/clients/walletClient";
import logger from "./logger";
import getConverterConfigs from "./queries/getTokenConverterConfigs";
import readTokenConvertersTokenBalances, { BalanceResult } from "./queries/getTokenConvertersTokenBalances";

const REVERT_IF_NOT_MINED_AFTER = 60n; // seconds
const MAX_HOPS = 5;

const getOutputCurrency = (pool: V3Pool, inputToken: Token): Token => {
  const { token0, token1 } = pool;
  return token0.equals(inputToken) ? token1 : token0;
};

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
    pancakeSwapTrade?: {
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

export class TokenConverter {
  private chainName: SUPPORTED_CHAINS;
  private addresses: ReturnType<typeof getAddresses>;
  private operator: { address: Address; abi: typeof tokenConverterOperatorAbi };
  private v3SubgraphClient: UrqlClient;
  private quoteProvider: QuoteProvider;
  private tokens: Map<Address, Currency>;
  private subscriber: undefined | ((msg: Message) => void);
  private simulate: boolean;
  private verbose: boolean;
  public publicClient: ReturnType<typeof getPublicClient>;
  public walletClient: ReturnType<typeof getWalletClient>;

  constructor({
    subscriber,
    simulate,
    verbose = false,
  }: {
    subscriber?: (msg: Message) => void;
    simulate: boolean;
    verbose: boolean;
  }) {
    const config = getConfig();
    this.addresses = getAddresses();
    this.chainName = config.network;
    this.subscriber = subscriber;
    this.operator = {
      address: this.addresses.TokenConverterOperator,
      abi: tokenConverterOperatorAbi,
    };
    this.v3SubgraphClient = createClient({
      url: config.pancakeSwapSubgraphUrl,
      requestPolicy: "network-only",
    });
    this.publicClient = getPublicClient();
    this.walletClient = getWalletClient();
    this.quoteProvider = SmartRouter.createQuoteProvider({ onChainProvider: () => this.publicClient });
    this.tokens = new Map();
    this.simulate = simulate;
    this.verbose = verbose;
  }

  /**
   * Function to post message to subscriber
   * @param Message
   *
   */
  private sendMessage({
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

  /**
   * Helper function got retrieving and caching a PancackeSwap sdk Token
   * @param address Address of the token to fetch
   * @error Throws if token can't be fetched
   *
   */
  private getToken = async (address: Address): Promise<Currency> => {
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

  /**
   * Create a trade that will provide required amount in for exact output
   * @param tokenConverter Token converter to use
   * @param swapFrom Token we want to receive to the converter
   * @param swapTo Token we want to send to the converter
   * @param amount The amount we will receive from the converter of swapFrom
   * @returns [SmartRouterTrade, [amount transferred out of converter, amount transferred in]]
   */
  async getBestTrade(
    tokenConverter: Address,
    swapFrom: Address,
    swapTo: Address,
    amount: bigint,
  ): Promise<[SmartRouterTrade<TradeType.EXACT_OUTPUT>, readonly [bigint, bigint]]> {
    const swapFromToken = await this.getToken(swapFrom);
    const swapToToken = await this.getToken(swapTo);

    // [amount transferred out of converter, amount transferred in]
    const { result: updatedAmountIn } = await this.publicClient.simulateContract({
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
      throw new Error(error);
    }

    if (!trade) {
      throw new Error("No trade found");
    }

    const priceImpact = SmartRouter.getPriceImpact(trade);

    if (priceImpact.greaterThan(new Percent(5n, 1000n))) {
      this.sendMessage({
        type: "GetBestTrade",
        error: "High price impact",
        context: {
          converter: tokenConverter,
          tokenToReceiveFromConverter: swapFrom,
          tokenToSendToConverter: swapTo,
          priceImpact: priceImpact.toFixed(),
        },
      });
      return this.getBestTrade(tokenConverter, swapFrom, swapTo, (updatedAmountIn[0] * 75n) / 100n);
    }
    return [trade as SmartRouterTrade<TradeType.EXACT_OUTPUT>, updatedAmountIn];
  }
  /**
   * Formats the swap exact input swap path
   * @param route PancakeSwap SmartRouter Route
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

  /**
   * Accrues interest on all passed markets
   * @param allPools Tuple of [comprollerAddress, MarketAddress[]]
   */
  async accrueInterest(markets: Address[]) {
    let error: string | string[];
    try {
      // Accrue Interest in all markets
      const results = await Promise.allSettled(
        markets.map(async market => {
          if (this.simulate) {
            await this.publicClient.simulateContract({
              account: this.walletClient.account.address,
              address: market,
              abi: coreVTokenAbi,
              functionName: "accrueInterest",
            });
          } else {
            await this.walletClient.writeContract({
              address: market,
              abi: coreVTokenAbi,
              functionName: "accrueInterest",
            });
          }
        }),
      );

      error = results.reduce((acc, curr) => {
        if (curr.status === "rejected") {
          acc.push(curr.reason.message);
        }
        return acc;
      }, [] as string[]);
    } catch (e) {
      error = (e as Error).message;
    }
    this.sendMessage({ type: "AccrueInterest", error });
  }

  /**
   * Checks total reserves and available cash and then uses the vBNB admin
   * to send the reserves ProtocolShare Reserve to be distributed
   */
  async reduceReserves() {
    let error;
    let trx;
    try {
      const totalReserves = await this.publicClient.readContract({
        address: this.addresses.vBNB as Address,
        abi: coreVTokenAbi,
        functionName: "totalReserves",
      });

      const cash = await this.publicClient.readContract({
        address: this.addresses.vBNB as Address,
        abi: coreVTokenAbi,
        functionName: "getCash",
      });

      if (cash > 0) {
        if (this.simulate) {
          await this.publicClient.simulateContract({
            account: this.walletClient.account.address,
            address: this.addresses.VBNBAdmin as Address,
            abi: vBnbAdminAbi,
            functionName: "reduceReserves",
            args: [totalReserves < cash ? totalReserves : cash],
          });
        } else {
          trx = await this.walletClient.writeContract({
            address: this.addresses.VBNBAdmin as Address,
            abi: vBnbAdminAbi,
            functionName: "reduceReserves",
            args: [totalReserves < cash ? totalReserves : cash],
          });
        }
      }
    } catch (e) {
      error = (e as Error).message;
    }
    this.sendMessage({ type: "ReduceReserves", error, trx });
  }

  /**
   * Queries Protocol Reserve subgraph for query configs that fit the parameters.
   * If `releaseFunds` is true, it will include funds that can be released in the returned balances
   * @param { assetIn?: Address, assetOut?: Address, converters?: Address[], releaseFunds: boolean }
   * @returns BalanceResult[] Array of converter asset balances
   */
  async queryConversions({
    assetIn,
    assetOut,
    converter,
    releaseFunds,
  }: {
    assetIn?: Address;
    assetOut?: Address;
    converter?: Address;
    releaseFunds: boolean;
  }) {
    const tokenConverterConfigs = await getConverterConfigs({
      assetIn,
      assetOut,
      converter,
    });
    const { results, blockNumber } = await readTokenConvertersTokenBalances(
      tokenConverterConfigs,
      this.walletClient.account.address,
      releaseFunds,
    );
    const conversions = results.filter(v => v.assetOut.balance > 0);
    this.sendMessage({ type: "PotentialConversions", context: { conversions }, blockNumber });
    return conversions;
  }

  /**
   * Takes an map or comptroller to assets and releases funds for those markets
   * @param pools Object with address of comptroller as key and an array of underlying assets addresses for the value
   */
  async releaseFunds(pools: Record<Address, readonly Address[]>) {
    for (const args of Object.entries(pools)) {
      let trx;
      let error;
      try {
        if (this.simulate) {
          await this.publicClient.simulateContract({
            account: this.walletClient.account.address,
            address: this.addresses.ProtocolShareReserve as Address,
            abi: protocolShareReserveAbi,
            functionName: "releaseFunds",
            args: args as [Address, readonly Address[]],
          });
        } else {
          trx = await this.walletClient.writeContract({
            address: this.addresses.ProtocolShareReserve,
            abi: protocolShareReserveAbi,
            functionName: "releaseFunds",
            args: args as [Address, readonly Address[]],
          });
        }
      } catch (e) {
        error = (e as Error).message;
      }
      this.sendMessage({
        type: "ReleaseFunds",
        trx,
        error,
        context: args as [Address, readonly Address[]],
      });
    }
  }

  /**
   * Takes an array of potential conversions (BalanceResult[]) and releases funds for those potential conversions
   * @param conversions Array of BalanceResults
   */
  async releaseFundsForConversions(conversions: BalanceResult[]) {
    const releaseFundsArgs = conversions.reduce((acc, curr) => {
      const { core, isolated } = curr.assetOutVTokens;
      if (core) {
        acc[this.addresses.Unitroller as Address] = acc[this.addresses.Unitroller as Address]
          ? [...acc[this.addresses.Unitroller as Address], curr.assetOut.address]
          : [curr.assetOut.address];
      }
      if (isolated) {
        isolated.forEach(i => {
          acc[i[0]] = acc[i[0]] ? [...acc[i[0]], curr.assetOut.address] : [curr.assetOut.address];
        });
      }
      return acc;
    }, {} as Record<Address, Address[]>);

    await this.releaseFunds(releaseFundsArgs);
  }

  /**
   * Helper function to query the Venus oracle usd value data for an asset and amount
   * @param underlyingAddress Asset address
   * @param vTokenAddress vToken market address for the asset
   * @param value Amount of asset
   * @returns {underlyingPriceUsd: string, underlyingUsdValue: string, underlyingDecimals: number}
   */
  async getUsdValue(underlyingAddress: Address, vTokenAddress: Address, value: bigint) {
    const result = await this.publicClient.multicall({
      contracts: [
        {
          address: underlyingAddress,
          abi: erc20Abi,
          functionName: "decimals",
          args: [],
        },
        {
          address: this.addresses.VenusLens as Address,
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
   * Helper method to check and if not allowed request allowance
   * @param token Token that will be spent
   * @param owner Owner of the token
   * @param spender Contract that would like to spend the token
   * @param amount Amount to check/ request if an allowance has been granted
   */
  async checkAndRequestAllowance(token: Address, owner: Address, spender: Address, amount: bigint) {
    const approvalAmount = await this.publicClient.readContract({
      address: token,
      abi: erc20Abi,
      functionName: "allowance",
      args: [owner, spender],
    });

    if (approvalAmount < amount) {
      const trx = await this.walletClient.writeContract({
        address: token,
        abi: erc20Abi,
        functionName: "approve",
        args: [this.operator.address, amount],
      });
      await this.publicClient.waitForTransactionReceipt({ hash: trx, confirmations: 4 });
    }
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

    const block = await this.publicClient.getBlock();
    const convertTransaction = {
      ...this.operator,
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
    let blockNumber;

    let simulation = "simulation: ";
    try {
      if (minIncome < 0n && !this.simulate) {
        await this.checkAndRequestAllowance(
          trade.inputAmount.currency.address,
          this.walletClient.account.address,
          this.addresses.TokenConverterOperator,
          -minIncome,
        );
      }

      blockNumber = await this.publicClient.getBlockNumber();
      const gasEstimation = await this.publicClient.estimateContractGas({
        account: this.walletClient.account,
        ...convertTransaction,
      });

      if (!this.simulate) {
        simulation = "Execution: ";
        trx = await this.walletClient.writeContract({ ...convertTransaction, gas: gasEstimation });
        ({ blockNumber } = await this.publicClient.waitForTransactionReceipt({ hash: trx, confirmations: 4 }));
      }
    } catch (e) {
      if (e instanceof BaseError) {
        const revertError = e.walk(err => err instanceof ContractFunctionRevertedError);
        if (revertError instanceof ContractFunctionRevertedError) {
          // writeContract || simulateContract shapes
          error = `${simulation}${revertError.reason || revertError.shortMessage}`;
        }
      } else {
        error = `${simulation}${(e as Error).message}`;
      }
    }

    this.sendMessage({ type: "Arbitrage", error, trx, context: convertTransaction.args[0], blockNumber });
  }

  /**
   * Prepares conversion arguments based on token converter, pair, and amount to receive
   * @param tokenConverter Address of the token converter to interact with
   * @param assetOut Address of the asset to receive from the token converter
   * @param assetIn Address of the asset to sent to the token converter
   * @param amountOut Amount of asset out to receive from the token converter
   * @returns {trade: SmartRouterTrade, amount: bigint, minIncome: bigint }
   */
  async prepareConversion(tokenConverter: Address, assetOut: Address, assetIn: Address, amountOut: bigint) {
    let error;
    let trade;
    let tradeAmount;
    try {
      [trade, tradeAmount] = await this.getBestTrade(tokenConverter, assetOut, assetIn, amountOut);
    } catch (e) {
      error = (e as Error).message;
    } finally {
      let tradeContext: Pick<GetBestTradeMessage["context"], "tradeAmount" | "pancakeSwapTrade"> = {};
      if (trade && tradeAmount) {
        tradeContext = {
          tradeAmount: { amountOut: tradeAmount && tradeAmount[0], amountIn: tradeAmount && tradeAmount[1] },
          pancakeSwapTrade: {
            inputToken: {
              amount: trade.inputAmount.toFixed(trade.inputAmount.currency.decimals, { groupSeparator: "" }),
              token: trade.inputAmount.currency.address,
            },
            outputToken: {
              amount: trade.outputAmount.toFixed(trade.outputAmount.currency.decimals, { groupSeparator: "" }),
              token: trade.outputAmount.currency.address,
            },
          },
        };
      }

      this.sendMessage({
        type: "GetBestTrade",
        error,
        context: {
          ...tradeContext,
          converter: tokenConverter,
          tokenToReceiveFromConverter: assetOut,
          tokenToSendToConverter: assetIn,
        },
      });
    }

    if (trade && tradeAmount) {
      // the difference between the token you get from TokenConverter and the token you pay to PCS
      const minIncome = BigInt(
        new Fraction(tradeAmount[0], 1).subtract(trade.inputAmount).toFixed(0, { groupSeparator: "" }),
      );
      return {
        trade,
        amount: tradeAmount[0],
        minIncome,
      };
    }
  }
}

export default TokenConverter;
