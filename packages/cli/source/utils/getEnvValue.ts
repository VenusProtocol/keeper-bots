import fs from "fs";
import os from "os";
import envPath from "./envPath.js";

export const readEnvVars = () => {
  try {
    return fs.readFileSync(envPath, "utf-8").split(os.EOL);
  } catch (error) {
    const e = error as Error & { code?: string };
    if (e.code == "ENOENT") {
      throw new Error(`${(e as NodeJS.ErrnoException).path} does not exist`);
    }
    throw error;
  }
};

const getEnvValue = (key: string) => {
  // find the line that contains the key (exact match)
  const matchedLine = readEnvVars().find(line => line.split("=")[0] === key);
  // split the line (delimiter is '=') and return the item at index 2
  return matchedLine !== undefined ? matchedLine.split("=")[1] : null;
};

export default getEnvValue;
