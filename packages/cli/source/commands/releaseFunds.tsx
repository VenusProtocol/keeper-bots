import { Box, Text, useApp } from "ink";
import { Address, erc20Abi } from "viem";
import { option } from "pastel";
import { useEffect, useReducer } from "react";
import zod from "zod";
import {
  TokenConverter,
  MarketAddresses,
  getCoreMarkets,
  getIsolatedMarkets,
  getAddresses,
  PancakeSwapProvider,
  UniswapProvider
} from "@venusprotocol/token-converter-bot";
import usePublicClient from "../queries/usePublicClient.js";
import { Options, BorderBox } from "../components/index.js";
import { reducer, defaultState } from "../state/releaseFunds.js";
import FullScreenBox from "../components/fullScreenBox.js";
import getEnvValue from "../utils/getEnvValue.js";

export const options = zod.object({
  simulate: zod
    .boolean()
    .default(false)
    .describe(
      option({
        description: "Simulate transactions",
        alias: "s",
      }),
    )
    .optional(),
  verbose: zod
    .boolean()
    .default(false)
    .describe(
      option({
        description: "Verbose logging",
        alias: "v",
      }),
    )
    .optional(),
  accrueInterest: zod
    .boolean()
    .default(false)
    .describe(
      option({
        description: "Accrue Interest",
        alias: "a",
      }),
    )
    .optional(),
  reduceReserves: zod
    .boolean()
    .default(true)
    .describe(
      option({
        description: "Reduce BNB Reserves",
        alias: "r",
      }),
    )
    .optional(),
  debug: zod
    .boolean()
    .describe(
      option({
        description: "Add debug logging",
        alias: "d",
      }),
    )
    .default(false)
    .optional(),
});

interface Props {
  options: zod.infer<typeof options>;
}

const reduceToTokensWithBalances = async (
  publicClient: ReturnType<typeof usePublicClient>,
  tokenConverter: TokenConverter,
  markets: MarketAddresses[],
) => {
  const addresses = getAddresses();

  const tokenSet = new Set(markets.map(m => m.underlyingAddress));

  const tokenSetArray = Array.from(tokenSet);
  const response = await publicClient.multicall({
    contracts: [
      ...tokenSetArray.map(v => {
        return {
          address: v as Address,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [addresses.ProtocolShareReserve],
        };
      }),
    ],
  });
  for (const [idx, result] of response.entries()) {
    const token = tokenSetArray[idx]! as Address;
    const vToken = markets.find(m => m.underlyingAddress === token);
    if (result.result) {
      const { underlyingUsdValue } = await tokenConverter.getUsdValue(
        vToken?.underlyingAddress!,
        vToken?.vTokenAddress!,
        result.result as bigint,
      );

      if (+underlyingUsdValue < 100) {
        tokenSet.delete(token);
      }
    } else {
      tokenSet.delete(token);
    }
  }

  return tokenSet;
};

/**
 *
 * Command to release funds
 */
function ReleaseFunds({ options = {} }: Props) {
  const { accrueInterest, reduceReserves, debug, simulate } = options;

  const [{ releasedFunds }, dispatch] = useReducer(reducer, defaultState);

  const { exit } = useApp();
  const publicClient = usePublicClient();

  useEffect(() => {
    const network = getEnvValue('NETWORK')
    const releaseFunds = async () => {
      const tokenConverter = new TokenConverter({
        subscriber: dispatch,
        simulate: !!simulate,
        verbose: false,
        swapProvider: network?.includes('bsc') ? new PancakeSwapProvider({ subscriber: dispatch, verbose: false }) : new UniswapProvider({ subscriber: dispatch, verbose: false })
      });
      const corePoolMarkets = await getCoreMarkets();
      const isolatedPoolsMarkets = await getIsolatedMarkets();
      const allPools = [...corePoolMarkets, ...isolatedPoolsMarkets];
      const allMarkets = allPools.reduce((acc, curr) => {
        return acc.concat(curr[1]);
      }, [] as { underlyingAddress: Address; vTokenAddress: Address }[]);
      if (accrueInterest) {
        await tokenConverter.accrueInterest(allMarkets);
      }
      if (reduceReserves) {
        await tokenConverter.reduceReserves();
      }
      // Query for funds that are available to be released
      const tokensWithBalances = await reduceToTokensWithBalances(publicClient, tokenConverter, allMarkets);

      const withBalances = allPools.reduce((acc, curr) => {
        const tokensWithBalance = curr[1].filter(t => tokensWithBalances.has(t.underlyingAddress));
        if (tokensWithBalance.length) {
          acc[curr[0]] = tokensWithBalance.map(t => t.vTokenAddress);
        }
        return acc;
      }, {} as Record<Address, readonly Address[]>);
      //
      await tokenConverter.releaseFunds(withBalances);
    };
    releaseFunds().finally(exit);
  }, []);

  return (
    <FullScreenBox flexDirection="column">
      <Box flexDirection="column" borderStyle="round" borderColor="#3396FF">
        <BorderBox marginBottom={1} flexDirection="row" borderBottom borderStyle="round" borderColor="#3396FF">
          <Box marginRight={1}>
            <Text bold>Release Funds</Text>
          </Box>
          {debug && <Options options={options} />}
        </BorderBox>
        <Box flexDirection="row">
          <Text color="green">{releasedFunds.length}</Text>
          <Box marginRight={1} />
          <Text>Release Funds</Text>
        </Box>
        <Box marginRight={1} flexDirection="column" flexGrow={1}>
          {releasedFunds.map((t, idx) => (
            <Box key={idx}>
              {t.trx && <Text color="green">{t.trx}</Text>}
              {t.error && <Text color="red">{t.error}</Text>}
              <Text>{JSON.stringify(t.context)}</Text>
            </Box>
          ))}
        </Box>
      </Box>
    </FullScreenBox>
  );
}

export default ReleaseFunds;
