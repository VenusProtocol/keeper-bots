import {
	Address,
	HttpTransport,
	PublicClient,
	createPublicClient,
	http,
	erc20Abi,
} from 'viem';

import config from '../config/index.js';
import {chains} from '../config/chains.js';
import type {SUPPORTED_CHAINS} from '../config/chains.js';

export const getPublicClient = (): PublicClient<
	HttpTransport,
	(typeof chains)[SUPPORTED_CHAINS]
> => {
	const chainName = config.network;
	return createPublicClient({
		chain: chains[chainName],
		transport: http(process.env[`LIVE_NETWORK_${chainName}`]),
	});
};

const client: PublicClient<HttpTransport, (typeof chains)[SUPPORTED_CHAINS]> =
	getPublicClient();

const useBalanceOf = async ({
	tokenAddress,
	contractAddress,
	blockNumber,
}: {
	tokenAddress: Address;
	contractAddress: Address;
	blockNumber?: string;
}) => {
	const resp = client.readContract({
		address: tokenAddress,
		abi: erc20Abi,
		functionName: 'balanceOf',
		args: [contractAddress],
		blockNumber: blockNumber ? BigInt(blockNumber) : undefined,
	});
	return resp;
};

export default useBalanceOf;
