import { Currency, CurrencyAmount, Token, TradeType } from "@pancakeswap/sdk";
import { Fraction } from "@pancakeswap/sdk";
import { BaseRoute, Pool, QuoteProvider, SmartRouter, SmartRouterTrade, V3Pool } from "@pancakeswap/smart-router/evm";
import { Client as UrqlClient, createClient } from "urql/core";
import { Address, Hex, encodePacked, erc20Abi, parseAbi } from "viem";
import config from "../config";
import { coreVTokenAbi, protocolShareReserveAbi, tokenConverterAbi, vBnbAdminAbi, tokenConverterOperatorAbi } from "../config/abis/generated";
import addresses from "../config/addresses";
import type { SUPPORTED_CHAINS } from "../config/chains";
import { chains } from "../config/chains";
import readTokenConvertersTokenBalances, { BalanceResult } from "./queries/read/readTokenConvertersTokenBalances";
import publicClient from "../config/clients/publicClient";
import walletClient from "../config/clients/walletClient";
import type { PoolAddressArray } from "./types";
import logger from "./logger";
import { TokenConverterConfig } from "./queries/read/readTokenConverterConfigs/formatTokenConverterConfigs";

const REVERT_IF_NOT_MINED_AFTER = 60n; // seconds
const MAX_HOPS = 5;

const getOutputCurrency = (pool: V3Pool, inputToken: Token): Token => {
  const { token0, token1 } = pool;
  return token0.equals(inputToken) ? token1 : token0;
};

export class TokenConverter {
  private chainName: SUPPORTED_CHAINS;
  private operator: { address: Address; abi: typeof tokenConverterOperatorAbi };
  private addresses: typeof addresses;
  private _walletClient?: typeof walletClient;
  private _publicClient?: typeof publicClient;
  private v3SubgraphClient: UrqlClient;
  private quoteProvider: QuoteProvider;
  private tokens: Map<Address, Currency>;

  constructor(chainName: SUPPORTED_CHAINS) {
    this.chainName = chainName;
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
  }

  get publicClient() {
    return (this._publicClient ||= publicClient);
  }

  get walletClient() {
    return (this._walletClient ||= walletClient);
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

  async getBestTrade(
    swapFrom: Address,
    swapTo: Address,
    amount: bigint,
  ): Promise<SmartRouterTrade<TradeType.EXACT_OUTPUT>> {
    const swapFromToken = await this.getToken(swapFrom);
    const swapToToken = await this.getToken(swapTo);
    const candidatePools = await SmartRouter.getV3CandidatePools({
      onChainProvider: () => this.publicClient,
      subgraphProvider: () => this.v3SubgraphClient,
      currencyA: swapFromToken,
      currencyB: swapToToken,
    });
    let trade;
    try {
      trade = await SmartRouter.getBestTrade(
        CurrencyAmount.fromRawAmount(swapToToken, amount),
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
      logger.error(`Error getting best trade - ${(e as Error).message} swapFrom  - ${swapFrom} swapTo - ${swapTo}`);
    }

    if (!trade) {
      throw new Error("No trade found");
    }

    return trade as SmartRouterTrade<TradeType.EXACT_OUTPUT>;
  }

  encodeExactOutputPath(route: BaseRoute): Hex {
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
    const allMarkets = allPools.reduce((acc, curr) => {
      acc.concat(curr[1]);
      return acc;
    }, [] as Address[]);

    // Accrue Interest in all markets
    await Promise.allSettled(
      allMarkets.map(async market => {
        await walletClient.writeContract({
          address: market,
          abi: coreVTokenAbi,
          functionName: "accrueInterest",
        });
      }),
    );
  };

  /**
 * Checks total reserves and available cash and then uses the vBNB admin
 * to send the reserves ProtocolShare Reserve to be distributed
 */
  async reduceReserves() {
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
      await walletClient.writeContract({
        address: addresses.VBNBAdmin as Address,
        abi: vBnbAdminAbi,
        functionName: "reduceReserves",
        args: [totalReserves < cash ? totalReserves : cash],
      });
    } else {
      logger.error("Unable to reduce reservers vBNB Admin is out of cash.");
    }
  };

  async checkForTrades(allPools: PoolAddressArray[], tokenConverterConfigs: TokenConverterConfig[]) {
    const results = await readTokenConvertersTokenBalances(allPools, tokenConverterConfigs);
    const trades = results.filter(v => v.assetOut.balance > 0);
    return trades;
  };

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
      await walletClient.writeContract({
        address: addresses.ProtocolShareReserve as Address,
        abi: protocolShareReserveAbi,
        functionName: "releaseFunds",
        args,
      });
    }
  };

  async arbitrage(
    converterAddress: Address,
    trade: SmartRouterTrade<TradeType.EXACT_OUTPUT>,
    amount: bigint,
    expectedMinIncome: bigint,
  ) {
    const beneficiary = this.walletClient.account.address;
    const chain = chains[this.chainName];
    const slippage = expectedMinIncome / 200n;

    let minIncome = expectedMinIncome - slippage;

    const block = await this.publicClient.getBlock();

    const convertTransaction = {
      ...this.operator,
      chain,
      functionName: "convert" as const,
      args: [
        {
          beneficiary,
          tokenToReceiveFromConverter: trade.inputAmount.currency.address,
          amount: amount,
          minIncome,
          tokenToSendToConverter: trade.outputAmount.currency.address,
          converter: converterAddress,
          path: this.encodeExactOutputPath(trade.routes[0]),
          deadline: block.timestamp + REVERT_IF_NOT_MINED_AFTER,
        },
      ] as const,
    };

    try {
      if (expectedMinIncome < 0n) {
        minIncome = slippage + expectedMinIncome;
        await this.walletClient.writeContract({
          address: trade.inputAmount.currency.address,
          chain,
          abi: parseAbi(["function approve(address,uint256)"]),
          functionName: "approve",
          args: [this.operator.address, -minIncome],
        });
      }

      const gasEstimation = await this.publicClient.estimateContractGas({
        account: this.walletClient.account,
        ...convertTransaction,
      });
      const trx = await this.walletClient.writeContract({ ...convertTransaction, gas: (gasEstimation * 110n) / 100n });
      logger.info(`Successful swap ${trx}`);
    } catch (e) {
      // @ts-expect-error
      delete convertTransaction.abi;
      logger.error("Conversion failed", {
        ...convertTransaction,
        stack: (e as Error).stack,
        message: (e as Error).message,
      });
    }
  }

  async executeTrade(t: BalanceResult) {

    const { result: updatedAmountIn } = await publicClient.simulateContract({
      address: t.tokenConverter as Address,
      abi: tokenConverterAbi,
      functionName: "getUpdatedAmountIn",
      args: [t.assetOut.balance, t.assetIn.address, t.assetOut.address],
    });

    const trade = await this.getBestTrade(t.assetOut.address, t.assetIn.address, updatedAmountIn[1]);

    const minIncome = BigInt(
      new Fraction(updatedAmountIn[0], 1).subtract(trade.inputAmount).toFixed(0, { groupSeparator: "" }),
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

      hasIncome = balanceOf >= (minIncome * -1n);
    }

    if (hasIncome) {
      await this.arbitrage(t.tokenConverter, trade, updatedAmountIn[0], minIncome);
    } else {
      logger.error(
        `Unable to run conversion because income was negative and wallet doesn't have a positive balance {minIncome: ${minIncome}, asset: ${t.assetOut.address}}`,
      );
    }
  };
}

export default TokenConverter;
