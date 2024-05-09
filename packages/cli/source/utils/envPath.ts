import path from "path";
import os from "os";

const configDir = process.env.VENUS_ENV_PATH || os.homedir();
const envPath = ".venus/.env";

export default path.resolve(configDir, envPath);
