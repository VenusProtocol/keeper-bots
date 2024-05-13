import fs from "fs";
import dotenv from "dotenv";
import envPath from "./envPath.js";

export const readEnvVars = () => {
  try {
    return dotenv.parse(fs.readFileSync(envPath, "utf-8"));
  } catch (error) {
    const e = error as Error & { code?: string };
    if (e.code == "ENOENT") {
      throw new Error(`${(e as NodeJS.ErrnoException).path} does not exist`);
    }
    throw error;
  }
};

const getEnvValue = (key: string) => {
  return readEnvVars()[key];
};

export default getEnvValue;
