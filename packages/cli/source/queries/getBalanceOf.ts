import {
	Address,
	erc20Abi,
} from 'viem';
import publicClient from './publicClient.js'

const useBalanceOf = async ({
	tokenAddress,
	contractAddress,
	blockNumber,
}: {
	tokenAddress: Address;
	contractAddress: Address;
	blockNumber?: string;
}) => {
	const resp = publicClient.readContract({
		address: tokenAddress,
		abi: erc20Abi,
		functionName: 'balanceOf',
		args: [contractAddress],
		blockNumber: blockNumber ? BigInt(blockNumber) : undefined,
	});
	return resp;
};

export default useBalanceOf;
