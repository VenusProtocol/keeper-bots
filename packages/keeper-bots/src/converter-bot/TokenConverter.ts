import { Fraction } from "@pancakeswap/sdk";
import { Address, BaseError, ContractFunctionRevertedError, erc20Abi, formatUnits } from "viem";

import getConfig from "../config";
import {
  coreVTokenAbi,
  poolLensAbi,
  protocolShareReserveAbi,
  tokenConverterOperatorAbi,
  vBnbAdminAbi,
  venusLensAbi,
} from "../config/abis/generated";
import getAddresses from "../config/addresses";
import type { SUPPORTED_CHAINS } from "../config/chains";
import getPublicClient from "../config/clients/publicClient";
import getWalletClient from "../config/clients/walletClient";
import logger from "./logger";
import { SwapProvider } from "./providers";
import getConverterConfigs from "./queries/getTokenConverterConfigs";
import getTokenConvertersTokenBalances, { BalanceResult } from "./queries/getTokenConvertersTokenBalances";
import { GetBestTradeMessage, MarketAddresses, Message, TradeRoute } from "./types";

const config = getConfig();

const REVERT_IF_NOT_MINED_AFTER = 60n; // seconds

export class TokenConverter {
  private chainName: SUPPORTED_CHAINS;
  private addresses: ReturnType<typeof getAddresses>;
  private operator: { address: Address; abi: typeof tokenConverterOperatorAbi };
  private subscriber: undefined | ((msg: Message) => void);
  private simulate: boolean;
  private verbose: boolean;
  private swapProvider: SwapProvider;
  public publicClient: ReturnType<typeof getPublicClient>;
  public walletClient: ReturnType<typeof getWalletClient>;

  constructor({
    subscriber,
    swapProvider,
    simulate,
    verbose = false,
  }: {
    subscriber?: (msg: Message) => void;
    swapProvider: SwapProvider;
    simulate: boolean;
    verbose: boolean;
  }) {
    this.addresses = getAddresses();
    this.swapProvider = swapProvider;
    this.chainName = config.network.name;
    this.subscriber = subscriber;
    this.operator = {
      address: this.addresses.TokenConverterOperator,
      abi: tokenConverterOperatorAbi,
    };
    this.publicClient = getPublicClient();
    this.walletClient = getWalletClient();
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
   * Create a trade that will provide required amount in for exact output
   * @param tokenConverter Token converter to use
   * @param swapFrom Token we want to receive from the converter
   * @param swapTo Token we want to send to the converter
   * @param amount The amount we will receive from the converter of swapFrom
   * @returns [SmartRouterTrade, [amount transferred out of converter, amount transferred in]]
   */
  async getBestTrade(
    tokenConverter: Address,
    swapFrom: Address,
    swapTo: Address,
    amount: bigint,
  ): Promise<[TradeRoute, readonly [bigint, bigint]]> {
    return this.swapProvider.getBestTrade(tokenConverter, swapFrom, swapTo, amount);
  }

  /**
   * Accrues interest on all passed markets
   * @param allPools Tuple of [comprollerAddress, MarketAddresses[]]
   */
  async accrueInterest(markets: MarketAddresses[]) {
    let error: string | string[];
    try {
      // Accrue Interest in all markets
      const results = await Promise.allSettled(
        markets.map(async market => {
          if (this.simulate) {
            await this.publicClient.simulateContract({
              account: this.walletClient.account.address,
              address: market.vTokenAddress,
              abi: coreVTokenAbi,
              functionName: "accrueInterest",
            });
          } else {
            await this.walletClient.writeContract({
              address: market.vTokenAddress,
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
    if (this.addresses.vBNB && this.addresses.VBNBAdmin) {
      try {
        const totalReserves = await this.publicClient.readContract({
          address: this.addresses.vBNB,
          abi: coreVTokenAbi,
          functionName: "totalReserves",
        });

        const cash = await this.publicClient.readContract({
          address: this.addresses.vBNB,
          abi: coreVTokenAbi,
          functionName: "getCash",
        });

        if (cash > 0) {
          if (this.simulate) {
            await this.publicClient.simulateContract({
              account: this.walletClient.account.address,
              address: this.addresses.VBNBAdmin,
              abi: vBnbAdminAbi,
              functionName: "reduceReserves",
              args: [totalReserves < cash ? totalReserves : cash],
            });
          } else {
            trx = await this.walletClient.writeContract({
              address: this.addresses.VBNBAdmin,
              abi: vBnbAdminAbi,
              functionName: "reduceReserves",
              args: [totalReserves < cash ? totalReserves : cash],
            });
          }
        }
      } catch (e) {
        error = (e as Error).message;
      }
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
    const { results, blockNumber } = await getTokenConvertersTokenBalances(
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
      if (core && this.addresses.Unitroller) {
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
          address: (this.chainName === "bscmainnet" || this.chainName === "bsctestnet"
            ? this.addresses.VenusLens
            : this.addresses.PoolLens) as Address,
          abi: this.chainName === "bscmainnet" || this.chainName === "bsctestnet" ? venusLensAbi : poolLensAbi,
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
    const allowance = await this.publicClient.readContract({
      address: token,
      abi: erc20Abi,
      functionName: "allowance",
      args: [owner, spender],
    });

    if (allowance < amount) {
      const trx = await this.walletClient.writeContract({
        address: token,
        abi: erc20Abi,
        functionName: "approve",
        args: [this.operator.address, amount],
      });
      const confirmations = {
        bscmainnet: 4,
        bsctestnet: 4,
        ethereum: 12,
        sepolia: 12,
      };
      await this.publicClient.waitForTransactionReceipt({ hash: trx, confirmations: confirmations[this.chainName] });
    }
  }

  /**
   *
   * @param converterAddress Address of converter to use
   * @param trade Swap trade which starts with token to receive and ends with token to deposit
   * @param amount Amount of token to receive from converter
   * @param expectedMinIncome Profitability or cost of conversion in token to receive
   */
  async arbitrage(converterAddress: Address, trade: TradeRoute, amount: bigint, minIncome: bigint) {
    const beneficiary = this.walletClient.account.address;

    const block = await this.publicClient.getBlock();
    const convertTransaction = {
      ...this.operator,
      functionName: "convert" as const,
      args: [
        {
          liquidityProvider: this.swapProvider.liquidityProviderId,
          beneficiary,
          tokenToReceiveFromConverter: trade.inputToken.address as Address,
          amount,
          minIncome,
          tokenToSendToConverter: trade.outputToken.address as Address,
          converter: converterAddress,
          path: trade.path,
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
          trade.inputToken.address,
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
      let tradeContext: Pick<GetBestTradeMessage["context"], "tradeAmount" | "swap"> = {};
      if (trade && tradeAmount) {
        tradeContext = {
          tradeAmount: { amountOut: tradeAmount && tradeAmount[0], amountIn: tradeAmount && tradeAmount[1] },
          swap: {
            inputToken: {
              amount: trade.inputToken.amount.toFixed(0),
              token: trade.inputToken.address,
            },
            outputToken: {
              amount: trade.outputToken.amount.toFixed(0),
              token: trade.outputToken.address,
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
      // the difference between the token you get from TokenConverter and the token you pay to the MM
      const minIncome = new Fraction(tradeAmount[0], 1).subtract(trade.inputToken.amount);
      return {
        trade,
        amount: tradeAmount[0],
        minIncome: BigInt(minIncome.toFixed(0, { groupSeparator: "" })),
      };
    }
  }
}

export default TokenConverter;
