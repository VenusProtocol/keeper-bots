import { Box, Text } from "ink";
import BorderBox from "./borderBox.js";

const toTitleCase = (str: string) => {
  return (
    str
      .replace(/([A-Z])/g, " $1")
      .charAt(0)
      .toUpperCase() + str.slice(1)
  );
};
const Options = ({ options }: { options: Record<string, any> }) => (
  <BorderBox all flexDirection="column" borderStyle="classic">
    <BorderBox borderBottom borderStyle="classic">
      <Text bold color="white">
        Options
      </Text>
    </BorderBox>
    <Box flexDirection="column">
      {Object.entries(options).map(([key, value]) => (
        <Box marginRight={1} key={key}>
          <Text bold>
            {toTitleCase(key)} - {value.toString()}
          </Text>
        </Box>
      ))}
    </Box>
  </BorderBox>
);

export default Options;
