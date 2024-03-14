import {Box, Text} from 'ink';
import {useEffect, useReducer} from 'react';
import zod from 'zod';
import {
	TokenConverter,
	readCoreMarkets,
	readIsolatedMarkets
} from '@venusprotocol/token-converter-bot';
import {underlyingByComptroller} from '../constants/index.js';
import {reducer, defaultState} from '../state/releaseFunds.js';
import FullScreenBox from '../components/fullScreenBox.js';

export const options = zod.object({
	simulate: zod
		.boolean()
		.default(false)
		.describe('Simulate transactions')
		.optional(),
	verbose: zod.boolean().default(false).describe('Verbose logging').optional(),
});

interface Props {
	options: zod.infer<typeof options>;
}

function ReleaseFunds({options = {}}: Props) {
	const [{releasedFunds}, dispatch] = useReducer(reducer, defaultState);
	useEffect(() => {
		const releaseFunds = async () => {
			const tokenConverter = new TokenConverter({
				subscriber: dispatch,
				simulate: !!options.simulate,
				verbose: false,
			});
			const corePoolMarkets = await readCoreMarkets();
			const isolatedPoolsMarkets = await readIsolatedMarkets();
			const allPools = [...corePoolMarkets, ...isolatedPoolsMarkets];
			await tokenConverter.accrueInterest(allPools);
			await tokenConverter.reduceReserves();
			await tokenConverter.releaseFunds(underlyingByComptroller);
		};
		releaseFunds();
	}, []);
	return (
		<FullScreenBox flexDirection="column">
			<Box flexDirection="column" borderStyle="round" borderColor="#3396FF">
				<Box
					marginBottom={1}
					flexDirection="row"
					borderTop={false}
					borderLeft={false}
					borderRight={false}
					borderStyle="round"
					borderColor="#3396FF"
				>
					<Box marginRight={1}>
						<Text bold>Release Funds</Text>
					</Box>
					<Box flexDirection="column" borderColor="#3396FF">
						<Box flexDirection="row">
							<Text bold color="white">
								Options
							</Text>
						</Box>
						<Box flexDirection="column">
							<Box marginRight={1}>
								<Text bold>Simulate - {(!!options.simulate).toString()}</Text>
							</Box>
							<Box marginRight={1}>
								<Text bold>Verbose - {(!!options.verbose).toString()}</Text>
							</Box>
						</Box>
					</Box>
				</Box>
				<Box flexDirection="row">
					<Text color="green">{releasedFunds.length ? '✔' : ' '}</Text>
					<Box marginRight={1} />
					<Text>Release Funds</Text>
					<Box marginRight={1} flexDirection="column">
						{releasedFunds.map((t, idx) => (
							<Text key={idx}>{t}</Text>
						))}
					</Box>
				</Box>
			</Box>
		</FullScreenBox>
	);
}

export default ReleaseFunds;
