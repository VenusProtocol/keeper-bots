import { readEnvVars } from "./getEnvValue.js";
import envPath from "./envPath.js";
import fs from "fs";
import os from "os";

const setEnvValue = (key: string, value: string) => {
  const envVars = readEnvVars();
  const targetLine = envVars.find(line => line.split("=")[0] === key);
  if (targetLine !== undefined) {
    // update existing line
    const targetLineIndex = envVars.indexOf(targetLine);
    // replace the key/value with the new value
    envVars.splice(targetLineIndex, 1, `${key}="${value}"`);
  } else {
    // create new key value
    envVars.push(`${key}="${value}"`);
  }
  // write everything back to the file system
  fs.writeFileSync(envPath, envVars.join(os.EOL));
};

export default setEnvValue;
