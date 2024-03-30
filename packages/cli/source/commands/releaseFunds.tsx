import { Box, Text } from "ink";
import { Address, erc20Abi } from "viem";
import { option } from "pastel";
import { useEffect, useReducer } from "react";
import zod from "zod";
import {
  TokenConverter,
  readCoreMarkets,
  readIsolatedMarkets,
  underlyingToVTokens,
  underlyingByComptroller,
  addresses,
} from "@venusprotocol/token-converter-bot";
import publicClient from "../queries/publicClient.js";
import { Options, BorderBox } from "../components/index.js";
import { reducer, defaultState } from "../state/releaseFunds.js";
import FullScreenBox from "../components/fullScreenBox.js";

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
    .default(false)
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
  tokenConverter: TokenConverter,
  underlyingByComptroller: Record<Address, readonly Address[]>,
) => {
  const underlyingByComptrollerEntries = Object.entries(underlyingByComptroller);

  const tokenSet = new Set([...Object.values(underlyingByComptroller)].flat());

  const withBalances: Record<Address, readonly Address[]> = {};
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
    const vToken = underlyingToVTokens[token];
    if (result.result) {
      const { underlyingUsdValue } = await tokenConverter.getUsdValue(
        token,
        vToken!.core || vToken!.isolated![0]![1],
        result.result as bigint,
      );
      if (+underlyingUsdValue < 100) {
        tokenSet.delete(token);
      }
    } else {
      tokenSet.delete(token);
    }

    for (const [comptroller] of underlyingByComptrollerEntries) {
      const haveBalance = underlyingByComptroller[comptroller as Address]!.filter(t => tokenSet.has(t));
      if (haveBalance.length > 0) {
        withBalances[comptroller as Address] = haveBalance;
      }
    }
  }

  return withBalances;
};

/**
 *
 * Command to release funds
 */
function ReleaseFunds({ options = {} }: Props) {
  const { accrueInterest, reduceReserves, debug, simulate } = options;
  const [{ releasedFunds }, dispatch] = useReducer(reducer, defaultState);
  useEffect(() => {
    const releaseFunds = async () => {
      const tokenConverter = new TokenConverter({
        subscriber: dispatch,
        simulate: !!simulate,
        verbose: false,
      });
      if (accrueInterest) {
        const corePoolMarkets = await readCoreMarkets();
        const isolatedPoolsMarkets = await readIsolatedMarkets();
        const allPools = [...corePoolMarkets, ...isolatedPoolsMarkets];
        await tokenConverter.accrueInterest(allPools);
      }
      if (reduceReserves) {
        await tokenConverter.reduceReserves();
      }
      // Query for funds that are available to be released
      const withBalances = await reduceToTokensWithBalances(tokenConverter, underlyingByComptroller);
      await tokenConverter.releaseFunds(withBalances);
    };
    releaseFunds();
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
