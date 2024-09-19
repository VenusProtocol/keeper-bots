import { useEffect, useState, useReducer } from "react";
import { option } from "pastel";
import { Box, Spacer, Text, useApp, useStderr } from "ink";
import zod from "zod";
import { parseUnits, formatUnits } from "viem";
import { TokenConverter, PancakeSwapProvider, UniswapProvider } from "@venusprotocol/keeper-bots";
import { stringifyBigInt, getConverterConfigId } from "../utils/index.js";
import { Options, Title, BorderBox } from "../components/index.js";
import { reducer, defaultState } from "../state/convert.js";
import getEnvValue from "../utils/getEnvValue.js";
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
  fixedPairs: zod
    .boolean()
    .describe(
      option({
        description: "Use fixed pairs to query available pools",
        alias: "f",
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
    .default(3),
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
    assetIn,
    assetOut,
    converter,
    profitable,
    loop,
    debug,
    minIncomeBp,
    fixedPairs,
  } = options;

  const { exit } = useApp();
  const { write: writeStdErr } = useStderr();

  const [{ completed, messages }, dispatch] = useReducer(reducer, defaultState);
  const [error, setError] = useState("");

  useEffect(() => {
    const network = getEnvValue("NETWORK");
    const tokenConverter = new TokenConverter({
      subscriber: dispatch,
      simulate: !!simulate,
      swapProvider: network?.includes("bsc") ? PancakeSwapProvider : UniswapProvider,
    });

    const convert = async () => {
      const potentialConversions = await tokenConverter.queryConversions({
        assetIn,
        assetOut,
        converter,
        releaseFunds: false,
      });

      if (potentialConversions.length === 0) {
        setError("No Potential Trades Found");
      }

      do {
        for (const t of potentialConversions) {
          let amountOut = t.assetOut.balance;

          const vTokenAddress = t.assetOutVTokens.core || t.assetOutVTokens.isolated![0]![1];
          const { assetOutPriceUsd, assetOutUsdValue, assetOutDecimals } = await tokenConverter.getUsdValue(
            t.assetOut.address,
            vTokenAddress,
            amountOut,
          );

          if (+assetOutUsdValue > minTradeUsd) {
            if (+assetOutUsdValue > maxTradeUsd) {
              amountOut = parseUnits((maxTradeUsd / +assetOutPriceUsd.toString()).toString(), assetOutDecimals);
            }

            const arbitrageArgs = await tokenConverter.prepareConversion(
              t.tokenConverter,
              t.assetOut.address,
              t.assetIn.address,
              amountOut,
              fixedPairs,
            );

            const { trade, amount, minIncome } = arbitrageArgs || {
              trade: undefined,
              amount: 0n,
              minIncome: 0n,
            };

            const minIncomeLimit = BigInt(Number(amount) * minIncomeBp) / 10000n;
            const minIncomeUsdValue = +formatUnits(minIncome, assetOutDecimals) * +assetOutPriceUsd;

            const context = {
              converter: t.tokenConverter,
              tokenToReceiveFromConverter: t.assetOut.address,
              tokenToSendToConverter: t.assetIn.address,
              amount,
              minIncome,
              percentage: Number(minIncome) && Number(amount) && Number((minIncome * 10000000n) / amount) / 10000000,
              minIncomeLimit,
            };
            if (profitable && minIncome < 0) {
              dispatch({
                error: "Conversion is not profitable",
                type: "ExecuteTrade",
                context,
              });
            } else if (minIncome < 1 && minIncome * -1n > minIncomeLimit) {
              dispatch({
                type: "ExecuteTrade",
                error: "Min income too high",
                context,
              });
            } else if (profitable && +minIncomeUsdValue < 1) {
              dispatch({
                type: "ExecuteTrade",
                error: "Min income too low",
                context,
              });
            } else if (t.accountBalanceAssetOut < minIncome * -1n && !profitable) {
              dispatch({
                error: "Insufficient wallet balance to pay min income",
                type: "ExecuteTrade",
                context,
              });
            } else if (trade) {
              await tokenConverter.arbitrage(t.tokenConverter, trade, amount, minIncome);
            }
          } else {
            dispatch({
              error: `Swap amount too low (${assetOutUsdValue} USD)`,
              type: "GetBestTrade",
              context: {
                converter: t.tokenConverter,
                tokenToReceiveFromConverter: t.assetOut.address,
                tokenToSendToConverter: t.assetIn.address,
              },
            });
          }
        }
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
    <Box flexDirection="column">
      <Title />
      {debug && <Options options={options} />}
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
        {debug && (
          <Box flexDirection="column">
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
                          {msg.context.conversions.length} {msg.context.conversions.length > 1 ? "Trades" : "Trade"}{" "}
                          found
                        </Text>
                      </Box>
                    ) : null}
                  </Box>
                </BorderBox>
              );
            })}
          </Box>
        )}
      </Box>
      {error ? <Text color="red">Error - {error}</Text> : null}
    </Box>
  );
}
