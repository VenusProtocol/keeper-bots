import { ConverterBotMessage } from "@venusprotocol/keeper-bots";

interface State {
  releasedFunds: {
    trx: string | undefined;
    error: string | string[] | undefined;
    context: [`0x${string}`, readonly `0x${string}`[]];
  }[];
}

export const defaultState = {
  releasedFunds: [],
};

export const reducer = (state: State, action: ConverterBotMessage): State => {
  switch (action.type) {
    case "ReleaseFunds": {
      const releasedFunds = [...state.releasedFunds];
      releasedFunds.push({
        trx: action.trx,
        error: action.error,
        context: action.context,
      });
      return {
        ...state,
        releasedFunds,
      };
    }
  }
  return state;
};
