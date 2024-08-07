import { useEffect, useState, useReducer } from "react";
import { option } from "pastel";
import { Box, Spacer, Text, useApp, useStderr } from "ink";
import zod from "zod";
import { parseUnits } from "viem";
import { TokenConverter, PancakeSwapProvider, UniswapProvider } from "@venusprotocol/token-converter-bot";
import { stringifyBigInt, getConverterConfigId } from "../utils/index.js";
import { Options, Title, BorderBox } from "../components/index.js";
import { reducer, defaultState } from "../state/convert.js";
import getEnvValue from "../utils/getEnvValue.js";
import FullScreenBox from "../components/fullScreenBox.js";
import { addressValidation } from "../utils/validation.js";

export const options = zod.object({
  converter: addressValidation
    .describe(
      option({
        description: "Token converter address",
        alias: "c",
      }),
    )
    .optional(),
  profitable: zod
    .boolean()
    .describe(
      option({
        description: "Require trade be profitable",
        alias: "p",
      }),
    )
    .optional()
    .default(true),
  assetIn: addressValidation
    .describe(
      option({
        description: "Asset In address",
        alias: "in",
      }),
    )
    .optional(),
  assetOut: addressValidation
    .describe(
      option({
        description: "Asset Out address",
        alias: "out",
      }),
    )
    .optional(),
  simulate: zod
    .boolean()
    .describe(
      option({
        description: "Simulate transactions",
        alias: "s",
      }),
    )
    .optional()
    .default(false),
  debug: zod
    .boolean()
    .describe(
      option({
        description: "Add debug logging",
        alias: "d",
      }),
    )
    .optional()
    .default(false),
  releaseFunds: zod
    .boolean()
    .describe(
      option({
        description: "Release funds",
        alias: "rf",
      }),
    )
    .optional()
    .default(false),
  minTradeUsd: zod
    .number()
    .describe(
      option({
        description: "Minimum value of tokens to try and convert",
        alias: "min",
      }),
    )
    .optional()
    .default(500),
  maxTradeUsd: zod
    .number()
    .describe(
      option({
        description: "Maximum value of tokens to try and convert",
        alias: "max",
      }),
    )
    .optional()
    .default(5000),
  loop: zod
    .boolean()
    .describe(
      option({
        description: "Continuously query and execute trades",
        alias: "l",
      }),
    )
    .optional()
    .default(false),
  minIncomeBp: zod
    .number()
    .describe(
      option({
        description: "Min income in basis points as percentage of amount",
        alias: "bp",
      }),
    )
    .optional()
    .default(30),
});

interface Props {
  options: zod.infer<typeof options>;
}

/**
 * Command to search for and execute token conversions based on parameters
 */
export default function Convert({ options }: Props) {
  const {
    minTradeUsd,
    maxTradeUsd,
    simulate,
    releaseFunds,
    assetIn,
    assetOut,
    converter,
    profitable,
    loop,
    debug,
    minIncomeBp,
  } = options;

  const { exit } = useApp();
  const { write: writeStdErr } = useStderr();

  const [{ completed, messages, releasedFunds }, dispatch] = useReducer(reducer, defaultState);
  const [error, setError] = useState("");

  useEffect(() => {
    const network = getEnvValue("NETWORK");
    const convert = async () => {
      const tokenConverter = new TokenConverter({
        subscriber: dispatch,
        simulate: !!simulate,
        verbose: debug,
        swapProvider: network?.includes("bsc")
          ? new PancakeSwapProvider({ subscriber: dispatch })
          : new UniswapProvider({ subscriber: dispatch }),
      });

      do {
        const potentialConversions = await tokenConverter.queryConversions({
          assetIn,
          assetOut,
          converter,
          releaseFunds: !!releaseFunds,
        });

        if (potentialConversions.length === 0) {
          setError("No Potential Trades Found");
        }
        if (releaseFunds) {
          // @todo check if we need to release funds or if there are already enough funds to make our trade
          await tokenConverter.releaseFundsForConversions(potentialConversions);
        }
        await Promise.allSettled(
          potentialConversions.map(async (t: any) => {
            let amountOut = t.assetOut.balance;
            const vTokenAddress = t.assetOutVTokens.core || t.assetOutVTokens.isolated[1];
            const { underlyingPriceUsd, underlyingUsdValue, underlyingDecimals } = await tokenConverter.getUsdValue(
              t.assetOut.address,
              vTokenAddress,
              amountOut,
            );

            if (+underlyingUsdValue > minTradeUsd) {
              if (+underlyingUsdValue > maxTradeUsd) {
                amountOut = parseUnits((maxTradeUsd / +underlyingPriceUsd.toString()).toString(), underlyingDecimals);
              }

              const arbitrageArgs = await tokenConverter.prepareConversion(
                t.tokenConverter,
                t.assetOut.address,
                t.assetIn,
                amountOut,
              );

              const { trade, amount, minIncome } = arbitrageArgs || {
                trade: undefined,
                amount: 0n,
                minIncome: 0n,
              };

              const maxMinIncome = ((amount * BigInt(10000 + minIncomeBp)) / 10000n - amount) * -1n;

              if (trade && ((profitable && minIncome > 0n) || !profitable)) {
                dispatch({
                  type: "ExecuteTrade",
                  context: {
                    converter: t.tokenConverter,
                    tokenToReceiveFromConverter: t.assetOut.address,
                    tokenToSendToConverter: t.assetIn,
                    amount,
                    minIncome,
                    percentage: Number((minIncome * 10000000n) / amount) / 10000000,
                    maxMinIncome,
                  },
                });

                await tokenConverter.arbitrage(t.tokenConverter, trade, amount, minIncome);
              } else if (t.accountBalanceAssetOut < minIncome * -1n) {
                dispatch({
                  type: "ExecuteTrade",
                  error: "Insufficient wallet balance to pay min income",
                  context: {
                    converter: t.tokenConverter.id,
                    tokenToReceiveFromConverter: t.assetOut.address,
                    tokenToSendToConverter: t.assetIn,
                    amount,
                    minIncome,
                    percentage: Number((minIncome * 10000000n) / amount) / 10000000,
                    maxMinIncome,
                  },
                });
              } else if (minIncome < 1 && minIncome * -1n > maxMinIncome * -1n) {
                dispatch({
                  type: "ExecuteTrade",
                  error: "Min income too high",
                  context: {
                    converter: t.tokenConverter.id,
                    tokenToReceiveFromConverter: t.assetOut.address,
                    tokenToSendToConverter: t.assetIn,
                    amount,
                    minIncome,
                    percentage: Number((minIncome * 10000000n) / amount) / 10000000,
                    maxMinIncome,
                  },
                });
              }
            }
          }),
        );
      } while (loop);
    };
    if (converter || assetIn || assetOut) {
      convert()
        .catch(e => {
          setError(e.message);
        })
        .finally(() => exit());
    } else {
      exit();
    }
  }, []);

  if (!converter && !assetIn && !assetOut) {
    writeStdErr("converter, asset-in or asset-out must be present");
    return null;
  }

  return (
    <FullScreenBox flexDirection="column">
      <Title />
      {debug && <Options options={options} />}
      {releaseFunds && (
        <Box flexDirection="column" borderStyle="round" borderColor="#3396FF">
          <Box flexDirection="row" marginLeft={1} justifyContent="space-between">
            <Box flexDirection="column">
              <Box flexDirection="row">
                <Text bold color="white">
                  Release Funds Steps
                </Text>
              </Box>
              <Box flexDirection="row">
                <Text color="green">{releasedFunds.done ? "✔" : " "}</Text>
                <Box marginRight={1} />
                <Text>Release Funds</Text>
              </Box>
            </Box>
          </Box>
        </Box>
      )}
      <Box flexDirection="column" flexGrow={1}>
        <Text bold backgroundColor="#3396FF">
          Conversions
        </Text>
        {completed.map((result, idx) => {
          if ("trx" in result) {
            return (
              <BorderBox borderBottom borderStyle="bold" key={idx} flexDirection="column">
                <Text color="green">Trx: {result.trx as string}</Text>
                {result.args && (
                  <BorderBox borderTop borderStyle="classic" borderColor="#3396FF">
                    <Text>{JSON.stringify(result.args || " ", stringifyBigInt)}</Text>
                  </BorderBox>
                )}
                <Spacer />
              </BorderBox>
            );
          }
          if ("error" in result) {
            return (
              <BorderBox borderStyle="bold" borderBottom key={idx} flexDirection="column">
                <Text color="red">Error: {result.error as string}</Text>
                {result.args && (
                  <BorderBox borderTop borderStyle="classic" borderColor="#3396FF">
                    <Text>{JSON.stringify(result.args || " ", stringifyBigInt)}</Text>
                  </BorderBox>
                )}
              </BorderBox>
            );
          }
          return null;
        })}
        <Spacer />
        <Text bold>Logs</Text>
        {messages.map((msg, idx) => {
          const id = msg.type === "PotentialConversions" ? idx : getConverterConfigId(msg.context);
          return (
            <BorderBox
              key={`${id}-${idx}`}
              flexDirection="row"
              borderStyle="doubleSingle"
              borderColor="#3396FF"
              borderTop
            >
              <Box flexGrow={1} flexDirection="column" marginLeft={1} marginRight={1} minWidth={60}>
                <Text bold>{msg.type}</Text>
                {"blockNumber" in msg && msg.blockNumber !== undefined && (
                  <Text bold>Block Number {msg.blockNumber?.toString()}</Text>
                )}
                {"error" in msg && msg.error && (
                  <>
                    <Text color="red">{msg.error}</Text>
                  </>
                )}
                {"pancakeSwapTrade" in msg.context && (
                  <Text>{JSON.stringify(msg.context.pancakeSwapTrade || " ", stringifyBigInt)}</Text>
                )}
                {(msg.type === "Arbitrage" || msg.type === "ExecuteTrade") && (
                  <Text>{JSON.stringify(msg.context || " ", stringifyBigInt)}</Text>
                )}
                {msg.type === "PotentialConversions" ? (
                  <Box flexGrow={1} flexDirection="column" minWidth={60} marginRight={1} marginLeft={1}>
                    <Text>
                      {msg.context.conversions.length} {msg.context.conversions.length > 1 ? "Trades" : "Trade"} found
                    </Text>
                  </Box>
                ) : null}
              </Box>
            </BorderBox>
          );
        })}
      </Box>
      {error ? <Text color="red">Error - {error}</Text> : null}
    </FullScreenBox>
  );
}
