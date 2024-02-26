import { useEffect, useState, useReducer } from 'react';
import { Box, Text, useApp } from 'ink';
import zod from 'zod';
import { Address, getAddress } from 'viem';
import { TokenConverter, BalanceResult, readCoreMarkets, readIsolatedMarkets, Message, ArbitrageMessage, ExecuteTradeMessage } from '@venusprotocol/token-converter-bot';
import { stringifyBigInt, getConverterConfigs, getConverterConfigId } from '../utils/index.js';

interface Trade {
	balance?: BalanceResult,
	args?: Partial<ArbitrageMessage['context'] & ExecuteTradeMessage['context']>
	trx?: string
	error?: string
	tradeAmount?: { amountIn: bigint | undefined, amountOut: bigint | undefined }
	blockNumber?: string
	pancakeSwapTrade?: {
		inputToken: { amount: string, token: string },
		outputToken: { amount: string, token: string },
	}
}

const address = zod.custom<Address>((val) => {
	try {
		getAddress(val as string)
		return true
	} catch (e) {
		return val === undefined
	}
});

export const options = zod.object({
	converter: address.transform((val) => val.toLowerCase() as Address).describe('TokenConverter').optional(),
	assetOut: address.transform((val) => val.toLowerCase() as Address).describe('Asset Out').optional(),
	assetIn: address.transform((val) => val.toLowerCase() as Address).describe('Asset In').optional(),
	simulate: zod.boolean().default(false).describe('Simulate transactions').optional(),
	verbose: zod.boolean().default(false).describe('Verbose logging').optional(),
	releaseFunds: zod.boolean().default(false).describe('Release funds').optional()
})

interface Props {
	options: zod.infer<typeof options>;
};

interface State {
	accruedInterest: { done: boolean, error?: string }
	reducedReserves: { done: boolean }
	releasedFunds: { done: boolean }
	trades: Record<string, Trade>,
	estimatedBlockNumber?: string
}

const defaultState = {
	accruedInterest: { done: false, },
	reducedReserves: { done: false },
	releasedFunds: { done: false },
	trades: {},
}

const reducer = (state: State, action: Message): State => {
	switch (action.type) {
		case 'AccrueInterest': {
			let error
			if (Array.isArray(action.error)) {
				error = action.error.join(',')
			} else {
				error = action.error
			}
			return {
				...state,
				accruedInterest: { done: true, error }
			}
		}
		case 'ReduceReserves': {
			return {
				...state,
				reducedReserves: { done: true }
			}
		}
		case 'ReleaseFunds': {
			return {
				...state,
				releasedFunds: { done: true }
			}
		}
		case 'PotentialTrades': {
			const newTrades: Record<string, Trade> = {}
			action.context.trades.forEach((trade) => {
				const id = getConverterConfigId({ converter: trade.tokenConverter, tokenToReceiveFromConverter: trade.assetOut.address, tokenToSendToConverter: trade.assetIn.address })
				newTrades[id] = { balance: trade }
			})
			return {
				...state,
				trades: newTrades,
				estimatedBlockNumber: action.blockNumber?.toString()
			}
		}

		case 'GetBestTrade': {
			const id = getConverterConfigId(action.context)
			return {
				...state,
				trades: { ...state.trades, [id]: { ...state.trades[id], tradeAmount: action.context.tradeAmount, error: action.error, pancakeSwapTrade: action.context.pancakeSwapTrade } },
			}
		}
		case 'ExecuteTrade': {
			const id = getConverterConfigId(action.context)
			return {
				...state,
				trades: { ...state.trades, [id]: { ...state.trades[id], error: action.error, args: { amount: action.context.amount, minIncome: action.context.minIncome } } }
			}
		}
		case 'Arbitrage': {
			const id = getConverterConfigId(action.context)
			return {
				...state,
				trades: { ...state.trades, [id]: { ...state.trades[id], args: action.context, trx: action.trx, error: action.error, blockNumber: action.blockNumber?.toString() } }
			}
		}
	}
	return state
}

export default function Convert({ options }: Props) {
	const { exit } = useApp()
	const [{ accruedInterest, reducedReserves, releasedFunds, trades, estimatedBlockNumber }, dispatch] = useReducer(reducer, defaultState);
	const [error, setError] = useState('')

	useEffect(() => {
		const convert = async () => {
			const tokenConverter = new TokenConverter({ subscriber: dispatch, simulate: !!options.simulate, verbose: false });
			const corePoolMarkets = await readCoreMarkets();
			const isolatedPoolsMarkets = await readIsolatedMarkets();
			const allPools = [...corePoolMarkets, ...isolatedPoolsMarkets];

			await tokenConverter.accrueInterest(allPools);

			await tokenConverter.reduceReserves();

			const tokenConverterConfigs = await getConverterConfigs(options);
			const potentialTrades = await tokenConverter.checkForTrades(allPools, tokenConverterConfigs);

			await tokenConverter.releaseFunds(potentialTrades);

			await Promise.all(potentialTrades.map((t) => tokenConverter.executeTrade(t)))
		}
		convert().catch((e) => {
			setError(e.message)
			exit()
		}).finally(() => {
			exit()
		})
	}, [])

	return (
		<Box flexDirection="column" borderStyle="round" borderColor="#3396FF">
			<Box marginBottom={1} flexDirection='row' borderTop={false} borderLeft={false} borderRight={false} borderStyle="round" borderColor="#3396FF">
				<Box marginRight={1}>
					<Text bold>Token Conversions</Text>
				</Box>
			</Box>
			<Box flexDirection="row" marginLeft={1} justifyContent='space-between'>
				<Box flexDirection="column">
					<Box flexDirection="row">
						<Text bold color="white">Release Fund Steps</Text>
					</Box>
					<Box flexDirection="row" marginRight={2}>
						<Text color="green">{accruedInterest.done ? '✔' : ' '}</Text>
						<Box marginRight={1} />
						<Text color="white">Accrue Interest</Text>
						<Box marginRight={1} />
						{accruedInterest.error && <Text color="red">{accruedInterest.error}</Text>}
					</Box>
					<Box flexDirection="row" marginRight={2}>
						<Text color="green">{reducedReserves ? '✔' : ' '}</Text>
						<Box marginRight={1} />
						<Text>Reduce Reserves</Text>
					</Box>
					<Box flexDirection="row">
						<Text color="green">{releasedFunds ? '✔' : ' '}</Text>
						<Box marginRight={1} />
						<Text >Release Funds</Text>
					</Box>
				</Box>
				<Box flexDirection="column" borderColor="#3396FF">
					<Box flexDirection="row">
						<Text bold color="white">Options</Text>
					</Box>
					<Box flexDirection="column">
						<Box marginRight={1}>
							<Text bold>Simulate - {(!!options.simulate).toString()}</Text>
						</Box>
						<Box marginRight={1}>
							<Text bold>Verbose - {(!!options.verbose).toString()}</Text>
						</Box>
						<Box marginRight={1}>
							<Text bold>Release Funds - {(!!options.releaseFunds).toString()}</Text>
						</Box>
					</Box>
				</Box>
			</Box>
			{Object.entries(trades).length > 0 &&
				<Box flexDirection='column' marginTop={1}>
					<Text bold backgroundColor="#3396FF">Conversions</Text>
					{estimatedBlockNumber && <Box>
						<Text bold>Estimated Block Number</Text>
						<Text>{estimatedBlockNumber.toString()}</Text>
					</Box>}
					{Object.entries(trades).map(([id, trade]: any) => {
						return (
							<Box key={id} flexDirection="row" flexGrow={1} borderStyle="doubleSingle" borderColor="#3396FF">
								<Box flexDirection="column" marginTop={1} marginLeft={1} flexGrow={1} minWidth={60}>
									<Box flexGrow={1}>
										<Text bold>Token Converter </Text>
										<Text>{trade.balance?.tokenConverter}</Text>
									</Box>
									<Box flexGrow={1}>
										<Text bold>Asset In </Text>
										<Box flexDirection='column'>
											<Text>{trade.balance?.assetIn.address}</Text>
											<Text>{trade.tradeAmount?.amountIn?.toString()}</Text>
										</Box>
									</Box>
									<Box flexGrow={1}>
										<Text bold>Asset Out </Text>
										<Box flexDirection='column'>
											<Text>{trade.balance?.assetOut.address}</Text>
											<Text>{trade.tradeAmount?.amountOut?.toString()}</Text>
										</Box>
									</Box>
									{trade.blockNumber && <Box flexGrow={1}>
										<Text bold>Block Number </Text>
										<Box flexDirection='column'>
											<Text>{trade.blockNumber}</Text>
										</Box>
									</Box>}
									{(trade.trx || trade.error) && <Box flexGrow={1}>
										<Text bold>Transaction </Text>
										<Text color={trade.trx ? 'green' : 'red'}>{trade.trx || trade.error}</Text>
									</Box>}
								</Box>
								<Box flexDirection="column" flexGrow={1}>
									{trade.args && <Box borderTop borderStyle="classic" borderColor="#3396FF">
										<Text>{JSON.stringify(trade.args || ' ', stringifyBigInt)}</Text>
									</Box>}
									{trade.pancakeSwapTrade && <Box borderTop borderStyle="classic" borderColor="#3396FF">
										<Text>{JSON.stringify(trade.pancakeSwapTrade || ' ', stringifyBigInt)}</Text>
									</Box>}
								</Box>
							</Box>
						)
					})}
				</Box>}
			{error ? <Text color="red">Error - {error}</Text> : null}
		</Box>
	);
}


