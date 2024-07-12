export const LiquidityProviders = {
  Uniswap: 0,
  PancakeSwap: 1,
} as const;

export type LiquidityProviderName = keyof typeof LiquidityProviders;
export type LiquidityProviderId = typeof LiquidityProviders[LiquidityProviderName];
