import { HttpTransport, PublicClient, WalletClient, createPublicClient, createWalletClient, http } from "viem";
import { PrivateKeyAccount, privateKeyToAccount } from "viem/accounts";

import { chains } from "./chains";

export const getPublicClient = <ChainT extends keyof typeof chains>(
  chainName: ChainT,
): PublicClient<HttpTransport, typeof chains[ChainT]> => {
  return createPublicClient({
    chain: chains[chainName],
    transport: http(process.env[`LIVE_NETWORK_${chainName}`]),
  });
};

const readPrivateKeyFromEnv = (chainName: string): PrivateKeyAccount => {
  const key = process.env[`PRIVATE_KEY_${chainName}`];
  if (key?.startsWith("0x")) {
    return privateKeyToAccount(key as `0x${string}`);
  }
  throw new Error(`Invalid private key for ${chainName}. Please specify PRIVATE_KEY_${chainName} env variable.`);
};

export const getWalletClient = <ChainT extends keyof typeof chains>(
  chainName: ChainT,
): WalletClient<HttpTransport, typeof chains[ChainT], PrivateKeyAccount> => {
  return createWalletClient({
    chain: chains[chainName],
    transport: http(process.env[`LIVE_NETWORK_${chainName}`]),
    account: readPrivateKeyFromEnv(chainName),
  });
};
