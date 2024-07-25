import { useEffect, useState } from "react";
import { Box, Text, useApp } from "ink";
import { TokenConverterConfigs, getAllConverterConfigs } from "@venusprotocol/token-converter-bot";

/**
 * Helper command to list available conversion pairs
 */
export default function ConversionPairs() {
  const [configs, setConfigs] = useState<TokenConverterConfigs>([]);

  const { exit } = useApp();

  useEffect(() => {
    (async () => {
      const configs = await getAllConverterConfigs();
      setConfigs(configs);
    })().finally(exit);
  }, []);

  return (
    <Box flexDirection="column">
      {configs.map(c => (
        <Box key={c.id} flexDirection="row">
          <Text>Token Converter: {c.tokenConverter.id} </Text>
          <Text>Token In: {c.tokenAddressIn} </Text>
          <Text>Token Out: {c.tokenAddressOut}</Text>
        </Box>
      ))}
    </Box>
  );
}