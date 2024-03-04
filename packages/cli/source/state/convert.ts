import {Address} from 'viem';
import {
	Message,
	GetBestTradeMessage,
	ArbitrageMessage,
	PotentialTradesMessage,
} from '@venusprotocol/token-converter-bot';

interface ExecuteTradeMessage {
	type: 'ExecuteTrade';
	error?: string | undefined;
	context: {
		converter: string;
		tokenToReceiveFromConverter: Address;
		tokenToSendToConverter: Address;
		amount: bigint;
		minIncome: bigint;
	};
}

interface TradeSuccess {
	trx: string;
	args: Partial<ArbitrageMessage['context'] & ExecuteTradeMessage['context']>;
}

interface TradeError {
	error: string;
	args: Partial<ArbitrageMessage['context'] & ExecuteTradeMessage['context']>;
}

interface State {
	accruedInterest: {done: boolean; error?: string};
	reducedReserves: {done: boolean};
	releasedFunds: {done: boolean};
	completed: (TradeSuccess | TradeError)[];
	messages: Array<
		| PotentialTradesMessage
		| GetBestTradeMessage
		| ArbitrageMessage
		| ExecuteTradeMessage
	>;
}

export const defaultState = {
	accruedInterest: {done: false},
	reducedReserves: {done: false},
	releasedFunds: {done: false},
	trades: {},
	completed: [],
	messages: [],
};

export const reducer = (
	state: State,
	action: Message | ArbitrageMessage | ExecuteTradeMessage,
): State => {
	switch (action.type) {
		case 'AccrueInterest': {
			let error;
			if (Array.isArray(action.error)) {
				error = action.error.join(',');
			} else {
				error = action.error;
			}
			return {
				...state,
				accruedInterest: {done: true, error},
			};
		}
		case 'ReduceReserves': {
			return {
				...state,
				reducedReserves: {done: true},
			};
		}
		case 'ReleaseFunds': {
			return {
				...state,
				releasedFunds: {done: true},
			};
		}
		case 'PotentialTrades': {
			return {
				...state,
				messages: [...state.messages.slice(0, 4), action],
			};
		}

		case 'GetBestTrade': {
			return {
				...state,
				messages: [...state.messages.slice(0, 4), action],
			};
		}

		case 'ExecuteTrade': {
			return {
				...state,
				messages: [...state.messages.slice(0, 4), action],
			};
		}
		case 'Arbitrage': {
			let prevState = state;
			if (action.trx) {
				prevState.completed.push({trx: action.trx, args: action.context});
			} else if (action.error) {
				prevState.completed.push({error: action.error, args: action.context});
			}

			return {
				...prevState,
				messages: [...state.messages.slice(0, 6), action],
			};
		}
	}
	return state;
};
