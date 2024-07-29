import { createWalletClient, http } from "viem";
import { PrivateKeyAccount, privateKeyToAccount } from "viem/accounts";

import getConfig from "../";
import { chains } from "../chains";

const readPrivateKeyFromEnv = (chainName: string): PrivateKeyAccount => {
  const key = process.env[`PRIVATE_KEY_${chainName}`];
  if (key?.startsWith("0x")) {
    return privateKeyToAccount(key as `0x${string}`);
  }
  throw new Error(`Invalid private key for ${chainName}. Please specify PRIVATE_KEY_${chainName} env variable.`);
};

const getWalletClient = () => {
  const config = getConfig();
  const chainName = config.network.name;
  return createWalletClient({
    chain: chains[chainName],
    transport: http(config.rpcUrl),
    account: readPrivateKeyFromEnv(chainName),
  });
};

export default getWalletClient;
