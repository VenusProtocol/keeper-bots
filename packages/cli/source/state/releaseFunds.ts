import { Message } from '@venusprotocol/token-converter-bot';

interface State {
	releasedFunds: { trx: string | undefined, error: string | undefined, context: [`0x${string}`, readonly `0x${string}`[]] }[];
}

export const defaultState = {
	releasedFunds: [],
};

export const reducer = (state: State, action: Message): State => {
	switch (action.type) {
		case 'ReleaseFunds': {
			state.releasedFunds.push({ trx: action.trx, error: action.error, context: action.context })
			return state
		}
	}
	return state;
};
