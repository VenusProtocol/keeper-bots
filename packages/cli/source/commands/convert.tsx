import { useEffect, useState, useReducer } from 'react';
import { Box, Text } from 'ink';
import zod from 'zod';
import { Address, getAddress, parseUnits } from 'viem';
import {
	TokenConverter,
} from '@venusprotocol/token-converter-bot';
import {
	stringifyBigInt,
	getConverterConfigs,
	getConverterConfigId,
} from '../utils/index.js';
import {
	Options,
	Title,
	StaticElements,
	BorderBox,
} from '../components/index.js';
import { reducer, defaultState } from '../state/convert.js';

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
	converter: address.describe('TokenConverter').optional(),
	profitable: zod
		.boolean()
		.describe('Require trade be profitable')
		.optional()
		.default(true),
	assetOut: address.describe('Asset Out').optional(),
	assetIn: address.describe('Asset In').optional(),
	simulate: zod
		.boolean()
		.describe('Simulate transactions')
		.optional()
		.default(false),
	debug: zod.boolean().describe('Add debug logging').optional().default(false),
	minTradeUsd: zod
		.number()
		.describe('Minimum value of tokens to try and convert')
		.optional()
		.default(500),
	maxTradeUsd: zod
		.number()
		.describe('Maximum value of tokens to try and convert')
		.optional()
		.default(5000),
	loop: zod.boolean().describe('Loop').optional().default(false),
});

interface Props {
	options: zod.infer<typeof options>;
}

export default function Convert({ options }: Props) {
	const {
		minTradeUsd,
		maxTradeUsd,
		simulate,
		assetIn,
		assetOut,
		converter,
		profitable,
		loop,
		debug,
	} = options;

	const [
		{ completed, messages },
		dispatch,
	] = useReducer(reducer, defaultState);
	const [error, setError] = useState('');
	const [_tradeUsdValues, setTradeUsdValues] = useState<
		Record<string, { underlyingPriceUsd: string; underlyingUsdValue: string }>
	>({});

	useEffect(() => {
		const convert = async () => {
			do {
				const tokenConverter = new TokenConverter({
					subscriber: dispatch,
					simulate: !!simulate,
					verbose: debug,
				});

				const tokenConverterConfigs = await getConverterConfigs({
					assetIn,
					assetOut,
					converter,
				});

				const potentialTrades = await tokenConverter.checkForTrades(
					tokenConverterConfigs,
				);
				if (potentialTrades.length === 0) {
					setError('No Potential Trades Found');
				}

				await Promise.allSettled(
					potentialTrades.map(async t => {
						let amountOut = t.assetOut.balance;
						const vTokenAddress =
							t.assetOutVTokens.core ||
							((t.assetOutVTokens.isolated &&
								t.assetOutVTokens.isolated[0] &&
								t.assetOutVTokens.isolated[0][1]) as Address);
						const {underlyingPriceUsd, underlyingUsdValue, underlyingDecimals} =
							await tokenConverter.getUsdValue(
								t.assetOut.address,
								vTokenAddress,
								amountOut,
							);

						setTradeUsdValues(prevState => ({
							...prevState,
							[getConverterConfigId({
								converter: t.tokenConverter,
								tokenToReceiveFromConverter: t.assetOut.address,
								tokenToSendToConverter: t.assetIn,
							})]: {underlyingPriceUsd, underlyingUsdValue},
						}));

						if (+underlyingUsdValue > minTradeUsd) {
							if (+underlyingUsdValue > maxTradeUsd) {
								amountOut = parseUnits(
									(maxTradeUsd / +underlyingPriceUsd.toString()).toString(),
									underlyingDecimals,
								);
							}
							const arbitrageArgs = await tokenConverter.prepareTrade(
								t.tokenConverter,
								t.assetOut.address,
								t.assetIn,
								amountOut,
							);
							const {trade, amount, minIncome} = arbitrageArgs || {
								trade: undefined,
								amount: 0n,
								minIncome: 0n,
							};

							const maxMinIncome = ((amount * 1003n) / 1000n - amount) * -1n;
							if (t.accountBalanceAssetOut < minIncome * -1n) {
								dispatch({
									type: 'ExecuteTrade',
									error: 'Insufficient wallet balance to pay min income',
									context: {
										converter: t.tokenConverter,
										tokenToReceiveFromConverter: t.assetOut.address,
										tokenToSendToConverter: t.assetIn,
										amount,
										minIncome,
									},
								});
							} else if (minIncome < maxMinIncome) {
								dispatch({
									type: 'ExecuteTrade',
									error: 'Min income too high',
									context: {
										converter: t.tokenConverter,
										tokenToReceiveFromConverter: t.assetOut.address,
										tokenToSendToConverter: t.assetIn,
										amount,
										minIncome,
									},
								});
							} else if (
								trade &&
								((profitable && minIncome > 0n) || !profitable)
							) {
								dispatch({
									type: 'ExecuteTrade',
									context: {
										converter: t.tokenConverter,
										tokenToReceiveFromConverter: t.assetOut.address,
										tokenToSendToConverter: t.assetIn,
										amount,
										minIncome,
									},
								});
								await tokenConverter.arbitrage(
									t.tokenConverter,
									trade,
									amount,
									minIncome,
								);
							}
						}
					}),
				);
			} while (loop);
		};

		convert().catch(e => {
			setError(e.message);
		});
	}, []);

	return (
		<>
			<StaticElements>
				<Title />
				{debug && <Options options={options} />}
			</StaticElements>
			<Box flexDirection="column" flexGrow={1}>
				<Text bold backgroundColor="#3396FF">
					Conversions
				</Text>
				{completed.map((result, idx) => {
					if ('trx' in result) {
						return (
							<Box key={idx} flexDirection="row">
								<Text color="green">{result.trx as string}</Text>
								{result.args && (
									<Box borderTop borderStyle="classic" borderColor="#3396FF">
										<Text>
											{JSON.stringify(result.args || ' ', stringifyBigInt)}
										</Text>
									</Box>
								)}
							</Box>
						);
					}
					if ('error' in result) {
						return (
							<Box key={idx} flexDirection="row">
								<Text color="red">{result.error as string}</Text>
								{result.args && (
									<Box borderTop borderStyle="classic" borderColor="#3396FF">
										<Text>
											{JSON.stringify(result.args || ' ', stringifyBigInt)}
										</Text>
									</Box>
								)}
							</Box>
						);
					}
					return null;
				})}
				<Text bold>Logs</Text>
				{messages.map((msg, idx) => {
					const id =
						msg.type === 'PotentialTrades'
							? idx
							: getConverterConfigId(msg.context);
					return (
						<BorderBox
							key={`${id}-${idx}`}
							flexDirection="row"
							borderStyle="doubleSingle"
							borderColor="#3396FF"
							borderTop
						>
							<Box
								flexGrow={1}
								flexDirection="column"
								minWidth={60}
								marginRight={1}
								marginLeft={1}
							>
								{msg.type === 'PotentialTrades' ? (
									<Text>
										{JSON.stringify(msg.context.trades || ' ', stringifyBigInt)}
									</Text>
								) : (
									<>
										<Box flexGrow={1}>
											<Text bold>Token Converter </Text>
											<Text>{msg.context.converter}</Text>
										</Box>
										<Box flexGrow={1}>
											<Text bold>Asset In </Text>
											<Box flexDirection="column">
												<Text>{msg.context.tokenToSendToConverter}</Text>
											</Box>
										</Box>
										<Box flexGrow={1}>
											<Text bold>Asset Out </Text>
											<Box flexDirection="column">
												<Text>{msg.context.tokenToReceiveFromConverter}</Text>
											</Box>
										</Box>
									</>
								)}
							</Box>
							<Box
								flexGrow={1}
								flexDirection="column"
								marginLeft={1}
								marginRight={1}
								minWidth={60}
							>
								<Text>{msg.type}</Text>
								{'blockNumber' in msg && msg.blockNumber !== undefined && (
									<Text bold>Block Number {msg.blockNumber?.toString()}</Text>
								)}
								{'pancakeSwapTrade' in msg.context && (
									<Text>
										{JSON.stringify(
											msg.context.pancakeSwapTrade || ' ',
											stringifyBigInt,
										)}
									</Text>
								)}
								{(msg.type === 'Arbitrage' || msg.type === 'ExecuteTrade') && (
									<Text>
										{JSON.stringify(msg.context || ' ', stringifyBigInt)}
									</Text>
								)}
								{'error' in msg && msg.error && (
									<>
										<Text color="red">{msg.error}</Text>
										<Text color="red">
											{JSON.stringify(msg.context || ' ', stringifyBigInt)}
										</Text>
									</>
								)}
							</Box>
						</BorderBox>
					);
				})}
			</Box>
			{error ? <Text color="red">Error - {error}</Text> : null}
		</>
	);
}
