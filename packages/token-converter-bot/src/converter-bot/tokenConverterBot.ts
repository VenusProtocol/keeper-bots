import { Currency, CurrencyAmount, Token, TradeType } from "@pancakeswap/sdk";
import { BaseRoute, Pool, QuoteProvider, SmartRouter, SmartRouterTrade, V3Pool } from "@pancakeswap/smart-router/evm";
import { Client as UrqlClient, createClient } from "urql/core";
import { Address, parseAbi } from "viem";
import { Hex, encodePacked } from "viem";

import { tokenConverterOperatorAbi } from "../config/abis/generated";
import addresses from "../config/addresses";
import type { SUPPORTED_CHAINS } from "../config/chains";
import { chains } from "../config/chains";
import { getPublicClient, getWalletClient } from "../config/clients";
import { Path } from "./path";

const REVERT_IF_NOT_MINED_AFTER = 60n; // seconds

export const NETWORK_IDS: Record<SUPPORTED_CHAINS, number> = {
  bsctestnet: 97,
  bscmainnet: 56,
};

export const getOutputCurrency = (pool: V3Pool, inputToken: Token): Currency => {
  const { token0, token1 } = pool;
  return token0.equals(inputToken) ? token1 : token0;
};

export class TokenConverterBot {
  private chainName: SUPPORTED_CHAINS;
  private operator: { address: Address; abi: typeof tokenConverterOperatorAbi };
  private addresses: typeof addresses;
  private _walletClient?: ReturnType<typeof getWalletClient>;
  private _publicClient?: ReturnType<typeof getPublicClient>;
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
      url: "https://api.thegraph.com/subgraphs/name/pancakeswap/exchange-v3-bsc",
      requestPolicy: "network-only",
    });
    this.quoteProvider = SmartRouter.createQuoteProvider({ onChainProvider: () => this.publicClient });
    this.tokens = new Map();
  }

  get publicClient() {
    return (this._publicClient ||= getPublicClient(this.chainName));
  }

  get walletClient() {
    return (this._walletClient ||= getWalletClient(this.chainName));
  }

  getToken = async (address: Address): Promise<Currency> => {
    if (this.tokens.has(address)) {
      return this.tokens.get(address) as Currency;
    }
    const [{ result: decimals }, { result: symbol }] = await this.publicClient.multicall({
      contracts: [
        {
          address,
          abi: parseAbi(["function decimals() external pure returns (uint8)"]),
          functionName: "decimals",
        },
        {
          address,
          abi: parseAbi(["function symbol() external pure returns (string memory)"]),
          functionName: "symbol",
        },
      ],
    });
    if (decimals && symbol) {
      const token = new Token(NETWORK_IDS[this.chainName], address, decimals, symbol);
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

    const trade = await SmartRouter.getBestTrade(
      CurrencyAmount.fromRawAmount(swapToToken, amount),
      swapFromToken,
      TradeType.EXACT_OUTPUT,
      {
        gasPriceWei: () => this.publicClient.getGasPrice(),
        maxHops: 1,

        maxSplits: 0,
        poolProvider: SmartRouter.createStaticPoolProvider(candidatePools),
        quoteProvider: this.quoteProvider,
        quoterOptimization: true,
      },
    );

    if (!trade) {
      throw new Error("No trade found");
    }

    return trade as SmartRouterTrade<TradeType.EXACT_OUTPUT>;
  }

  encodeExactOutputPath(route: BaseRoute): Hex {
    const firstInputToken: Token = route.input.wrapped;

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
        const outputToken = getOutputCurrency(pool, inputToken).wrapped;
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

  async arbitrage(converterAddress: Address, path: Path, amount: bigint, minIncome: bigint) {
    const beneficiary = this.walletClient.account.address;
    const chain = chains[this.chainName];

    const block = await this.publicClient.getBlock();

    if (minIncome < 0n) {
      await this.walletClient.writeContract({
        address: path.end,
        chain,
        abi: parseAbi(["function approve(address,uint256)"]),
        functionName: "approve",
        args: [this.operator.address, -minIncome], // + amount
      });
    }
    try {
      await this.walletClient.writeContract({
        ...this.operator,
        chain,
        functionName: "convert",
        args: [
          {
            beneficiary,
            tokenToReceiveFromConverter: path.end,
            amount,
            minIncome,
            tokenToSendToConverter: path.start,
            converter: converterAddress,
            path: path.hex,
            deadline: block.timestamp + REVERT_IF_NOT_MINED_AFTER,
          },
        ],
      });
    } catch (e) {
      console.error("Conversion failed", {
        converterAddress,
        assetIn: path.start,
        assetOut: path.end,
        amount,
        minIncome,
      });
    }
  }
}

export default TokenConverterBot;
