import { readEnvVars } from "./getEnvValue.js";
import envPath from "./envPath.js";
import fs from "fs";
import os from "os";

const setEnvValue = (key: string, value: string) => {
  const envVars = readEnvVars();
  envVars[key] = value;
  const envVarArray = Object.entries(envVars).reduce((acc, [k, v]) => {
    acc.push(`${k}="${v}"`);
    return acc;
  }, [] as string[]);
  // Add a last empty line
  envVarArray.push("");
  fs.writeFileSync(envPath, envVarArray.join(os.EOL));
};

export default setEnvValue;
