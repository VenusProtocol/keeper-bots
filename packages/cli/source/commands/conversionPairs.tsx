import { option } from "pastel";
import zod from "zod";
import { useEffect, useState } from "react";
import { Box, Text, useApp } from "ink";
import {
  BalanceResult,
  getAllConverterConfigs,
  getConverterConfigsByConverter,
  getTokenConvertersTokenBalances,
} from "@venusprotocol/keeper-bots";
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
});

interface Props {
  options: zod.infer<typeof options>;
}

/**
 * Helper command to list available conversion pairs
 */
export default function ConversionPairs({ options }: Props) {
  const { converter } = options;
  const [configs, setConfigs] = useState<BalanceResult[]>([]);

  const { exit } = useApp();

  useEffect(() => {
    (async () => {
      let configs = [];
      if (converter) {
        configs = await getConverterConfigsByConverter(converter);
      } else {
        configs = await getAllConverterConfigs();
      }
      const { results } = await getTokenConvertersTokenBalances(
        configs,
        "0x0000000000000000000000000000000000000000",
        false,
      );

      setConfigs(results);
    })().finally(exit);
  }, []);

  return (
    <Box flexDirection="column">
      {configs.map(c => (
        <Box key={`${c.tokenConverter}-${c.assetIn.address}-${c.assetOut.address}`} flexDirection="row">
          <Text>Token Converter: {c.tokenConverter} </Text>
          <Text>
            Token In: {c.assetIn.symbol} {c.assetIn.address}{" "}
          </Text>
          <Text>
            Token Out: {c.assetOut.symbol} {c.assetOut.address} (Balance {c.assetOut.balance.toString()})
          </Text>
        </Box>
      ))}
    </Box>
  );
}
