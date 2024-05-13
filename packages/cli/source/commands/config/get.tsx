import { useEffect, useState } from "react";
import { option } from "pastel";
import { Text } from "ink";
import { useStderr, useApp } from "ink";
import zod from "zod";
import getEnvValue from "../../utils/getEnvValue.js";

export const args = zod.tuple([
  zod.string().describe(
    option({
      description: "env var name",
    }),
  ),
]);

interface Options {
  args: zod.infer<typeof args>;
}

export default function Get({ args }: Options) {
  const { write } = useStderr();
  const { exit } = useApp();
  const [value, setValue] = useState<string | null | undefined>();
  const arg = args[0] as string;

  useEffect(() => {
    try {
      setValue(getEnvValue(arg));
    } catch (e) {
      write((e as Error).message);
      exit();
    }
  }, []);

  return (
    value && (
      <Text>
        {arg}: {value}
      </Text>
    )
  );
}
