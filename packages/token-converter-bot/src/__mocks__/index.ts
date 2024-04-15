import { CurrencyAmount, Percent, Token } from "@pancakeswap/sdk";

export const mockRoute = {
  percent: 100,
  type: 1,
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

export const mockTrade = {
  routes: [mockRoute],
  inputAmount: CurrencyAmount.fromRawAmount(
    new Token(56, "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c", 18, "WBNB"),
    8904975230019520420n,
  ),
  outputAmount: CurrencyAmount.fromRawAmount(
    new Token(56, "0xcf6bb5389c92bdda8a3747ddb454cb7a64626c63", 18, "XVS"),
    517926942058379677423n,
  ),
};
