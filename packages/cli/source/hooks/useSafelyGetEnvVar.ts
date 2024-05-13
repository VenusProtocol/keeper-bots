import { useStderr, useApp } from "ink";

const useSafelyGetEnvVar = <T extends keyof typeof process.env>(key: T) => {
  const { write } = useStderr();
  const { exit } = useApp();
  const envVar = process.env[key] as (typeof process.env)[T] | undefined;
  if (envVar === undefined) {
    write(`${key} not defined in environment variables`);
    exit();
  }
  return envVar;
};

export default useSafelyGetEnvVar;
