import { HttpTransport, WalletClient, createWalletClient, http } from "viem";
import { PrivateKeyAccount, privateKeyToAccount } from "viem/accounts";

import config from "../";
import { chains } from "../chains";
import type { SUPPORTED_CHAINS } from "../chains";

const readPrivateKeyFromEnv = (chainName: string): PrivateKeyAccount => {
  const key = process.env[`PRIVATE_KEY_${chainName}`];
  if (key?.startsWith("0x")) {
    return privateKeyToAccount(key as `0x${string}`);
  }
  throw new Error(`Invalid private key for ${chainName}. Please specify PRIVATE_KEY_${chainName} env variable.`);
};

export const getWalletClient = (): WalletClient<HttpTransport, typeof chains[SUPPORTED_CHAINS], PrivateKeyAccount> => {
  const chainName = config.network;
  return createWalletClient({
    chain: chains[chainName],
    transport: http(config.rpcUrl),
    account: readPrivateKeyFromEnv(chainName),
  });
};

export default getWalletClient();