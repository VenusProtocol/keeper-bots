import 'dotenv/config';
import { useEffect, useState } from 'react';
import { option } from 'pastel';
import { Text } from 'ink';
import zod from 'zod';
import { Address, getAddress } from 'viem';
import getBalanceOf from '../queries/getBalanceOf.js';

const address = zod
	.custom<Address>(val => {
		try {
			getAddress(val as string);
			return true;
		} catch (e) {
			return val === undefined;
		}
	})
	.transform(val => val.toLowerCase() as Address);

export const options = zod.object({
	tokenAddress: address.describe(
		option({
			description: 'Token Address',
			alias: 't',
		}),
	),
	contractAddress: address.describe(
		option({
			description: 'Contract Address',
			alias: 'c',
		}),
	),
	blockNumber: zod
		.string()
		.describe(
			option({
				description: 'Block Number',
				alias: 'bn',
			}),
		)
		.optional(),
});

interface Props {
	options: zod.infer<typeof options>;
}

export default function BalanceOf({ options }: Props) {
	const { tokenAddress, contractAddress, blockNumber } = options;
	const [balance, setBalance] = useState<bigint>();
	useEffect(() => {
		(async () => {
			const result = await getBalanceOf({ tokenAddress, contractAddress, blockNumber });
			setBalance(result);
		})();
	}, []);

	return (
		<Text>
			{contractAddress} has {balance?.toString()} of {tokenAddress}
		</Text>
	);
}
