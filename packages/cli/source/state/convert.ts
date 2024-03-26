import { Address } from "viem";
import {
	Message,
	GetBestTradeMessage,
	ArbitrageMessage,
	PotentialTradesMessage,
} from "@venusprotocol/token-converter-bot";

interface ExecuteTradeMessage {
	type: "ExecuteTrade";
	error?: string | undefined;
	context: {
		converter: string;
		tokenToReceiveFromConverter: Address;
		tokenToSendToConverter: Address;
		amount: bigint;
		minIncome: bigint;
		percentage: number;
		maxMinIncome: bigint;
	};
}

interface TradeSuccess {
	trx: string;
	args: Partial<ArbitrageMessage["context"] & ExecuteTradeMessage["context"]>;
}

interface TradeError {
	error: string;
	args: Partial<ArbitrageMessage["context"] & ExecuteTradeMessage["context"]>;
}

interface State {
	releasedFunds: { done: boolean };
	completed: (TradeSuccess | TradeError)[];
	messages: Array<PotentialTradesMessage | GetBestTradeMessage | ArbitrageMessage | ExecuteTradeMessage>;
}

export const defaultState = {
	releasedFunds: { done: false },
	trades: {},
	completed: [],
	messages: [],
};

export const reducer = (state: State, action: Message | ExecuteTradeMessage): State => {
	switch (action.type) {
		case "PotentialTrades":
		case "GetBestTrade":
		case "ExecuteTrade": {
			return {
				...state,
				messages: [action, ...state.messages.slice(0, 4)],
			};
		}
		case "Arbitrage": {
			let prevState = state;
			if (action.trx) {
				prevState.completed.push({ trx: action.trx, args: action.context });
			} else if (action.error) {
				prevState.completed.push({ error: action.error, args: action.context });
			}

			return {
				...prevState,
				messages: [action, ...state.messages.slice(0, 4)],
			};
		}
	}
	return state;
};
