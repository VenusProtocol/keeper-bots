import { CurrencyAmount, Fraction, Percent, Token } from "@pancakeswap/sdk";
import { RouteV3 } from "@uniswap/router-sdk";
import { Token as UniswapToken } from "@uniswap/sdk-core";
import { FeeAmount, Pool, Route as V3RouteSDK } from "@uniswap/v3-sdk";
import JSBI from "jsbi";

export const mockRoute = {
  percent: 100,
  type: 1,
  routes: [
    {
      inputAmount: CurrencyAmount.fromRawAmount(
        new Token(56, "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c", 18, "WBNB"),
        8904975230019520420n,
      ),
      outputAmount: CurrencyAmount.fromRawAmount(
        new Token(56, "0xcf6bb5389c92bdda8a3747ddb454cb7a64626c63", 18, "XVS"),
        517926942058379677423n,
      ),
      pools: [
        {
          type: 1,
          token0: new Token(56, "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c", 18, "WBNB"),
          token1: new Token(56, "0xcf6bb5389c92bdda8a3747ddb454cb7a64626c63", 18, "XVS"),
          reserve0: {
            numerator: 196707513482778533105n,
            denominator: 1n,
            currency: [{}],
            decimalScale: 1000000000000000000n,
          },
          reserve1: {
            numerator: 38378530507439812381746n,
            denominator: 1n,
            currency: [{}],
            decimalScale: 1000000000000000000n,
          },
          fee: 2500,
          liquidity: 23923437684954802969848n,
          sqrtRatioX96: 605838237820621558078872916472n,
          tick: 40687,
          address: "0x77d5b2560e4B84b3fC58875Cb0133F39560e8AE3",
          token0ProtocolFee: new Percent(3200n, 10000n),
          token1ProtocolFee: new Percent(3200n, 10000n),
        },
      ],
    },
  ],
  path: [
    {
      chainId: 56,
      decimals: 18,
      symbol: "WBNB",
      name: undefined,
      isNative: false,
      isToken: true,
      address: "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
      projectLink: undefined,
    },
    {
      chainId: 56,
      decimals: 18,
      symbol: "XVS",
      name: undefined,
      isNative: false,
      isToken: true,
      address: "0xcf6bb5389c92bdda8a3747ddb454cb7a64626c63",
      projectLink: undefined,
    },
  ],
  inputAmount: CurrencyAmount.fromRawAmount(
    new Token(56, "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c", 18, "WBNB"),
    8904975230019520420n,
  ),
  outputAmount: CurrencyAmount.fromRawAmount(
    new Token(56, "0xcf6bb5389c92bdda8a3747ddb454cb7a64626c63", 18, "XVS"),
    517926942058379677423n,
  ),
};

const uniswapPool = new Pool(
  new Token(56, "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c", 18, "WBNB"),
  new Token(56, "0xcf6bb5389c92bdda8a3747ddb454cb7a64626c63", 18, "XVS"),
  FeeAmount.LOW,
  JSBI.BigInt("605838237820621558078872916472"),
  JSBI.BigInt("23923437684954802969848"),
  40687,
);
export const mockUniswapRoute = {
  percent: 100,
  type: 1,
  trade: {
    routes: [
      new RouteV3(
        new V3RouteSDK(
          [uniswapPool],
          new Token(56, "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c", 18, "WBNB"),
          new Token(56, "0xcf6bb5389c92bdda8a3747ddb454cb7a64626c63", 18, "XVS"),
        ),
      ),
    ],
  },
  inputAmount: CurrencyAmount.fromRawAmount(
    new Token(56, "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c", 18, "WBNB"),
    8904975230019520420n,
  ),
  outputAmount: CurrencyAmount.fromRawAmount(
    new Token(56, "0xcf6bb5389c92bdda8a3747ddb454cb7a64626c63", 18, "XVS"),
    517926942058379677423n,
  ),
};

export const mockTrade = {
  path: "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c000cf6bb5389c92bdda8a3747ddb454cb7a64626c63" as const,
  inputToken: {
    address: "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c" as const,
    amount: new Fraction(8904975230019520420n, 1),
  },
  outputToken: {
    address: "0xcf6bb5389c92bdda8a3747ddb454cb7a64626c63" as const,
    amount: new Fraction(517926942058379677423n, 1),
  },
};

export const mockRouteUniswap = {
  _midPrice: null,
  pools: [
    new Pool(
      new UniswapToken(1, "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", 6, "USDC"),
      new UniswapToken(1, "0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E", 18, "crvUSD"),
      3000,
      "79367695979270458987153511763807851",
      "9818043140636773",
      276359,
    ),
  ],
  tokenPath: [
    new UniswapToken(1, "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", 6, "USDC"),
    new UniswapToken(1, "0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E", 18, "crvUSD"),
  ],
  input: new UniswapToken(1, "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", 6, "USDC"),
  output: new UniswapToken(1, "0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E", 18, "crvUSD"),
  protocol: "V3",
  path: [
    new UniswapToken(1, "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", 6, "USDC"),
    new UniswapToken(1, "0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E", 18, "crvUSD"),
  ],
};

export default class SubgraphClient {
  getTokenConverterConfigs = async () => ({ data: { tokenConverterConfigs: [] } });

  getTokenConverterConfigsByTokenConverter = async () => ({ data: { tokenConverterConfigs: [] } });

  getTokenConverterConfigsByAssetOut = async () => ({ data: { tokenConverterConfigs: [] } });

  getTokenConverterConfigsByAssetIn = async () => ({ data: { tokenConverterConfigs: [] } });

  getTokenConverterConfigsByAssetInAndAssetOut = async () => ({ data: { tokenConverterConfigs: [] } });

  getTokenConverterConfigsByAssetInAndAssetOutAndConverter = async () => ({ data: { tokenConverterConfigs: [] } });
}
