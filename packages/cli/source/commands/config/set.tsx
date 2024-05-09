import { useEffect, useState } from "react";
import { Text } from "ink";
import { useStderr, useApp } from "ink";
import { option } from "pastel";
import zod from "zod";
import setEnvValue from "../../utils/setEnvValue.js";

export const args = zod.tuple([
  zod.string().describe(
    option({
      description: "env var name",
    }),
  ),
  zod.string().describe(
    option({
      description: "env var value",
    }),
  ),
]);

type Props = {
  args: zod.infer<typeof args>;
};

export default function Set({ args }: Props) {
  const { write } = useStderr();
  const { exit } = useApp();
  const [updated, setUpdated] = useState(false);
  const name = args[0];
  const value = args[1];
  useEffect(() => {
    try {
      setEnvValue(name, value);
      setUpdated(true);
    } catch (e) {
      write((e as Error).message);
      exit();
    }
  }, []);
  return updated && <Text>Updated {name}</Text>;
}
