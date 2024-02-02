import { HttpTransport, WalletClient, createWalletClient, http } from "viem";
import { PrivateKeyAccount, privateKeyToAccount } from "viem/accounts";

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
  const chainName = process.env.NETWORK as SUPPORTED_CHAINS;
  return createWalletClient({
    chain: chains[chainName],
    transport: http(process.env[`LIVE_NETWORK_${chainName}`]),
    account: readPrivateKeyFromEnv(chainName),
  });
};

export default getWalletClient();
