import { Message } from '@venusprotocol/token-converter-bot';

interface State {
  releasedFunds: string[]
}

export const defaultState = {
  releasedFunds: []
};

export const reducer = (
  state: State,
  action: Message,
): State => {

  switch (action.type) {
    case 'ReleaseFunds': {
      state.releasedFunds = [...state.releasedFunds, (action.trx || action.error) as string]
      break;
    }
  }
  return state
};