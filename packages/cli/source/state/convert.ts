import { Address } from "viem";
import {
  ConverterBotMessage,
  GetBestTradeMessage,
  ArbitrageMessage,
  PotentialConversionsMessage,
} from "@venusprotocol/keeper-bots";

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
    minIncomeLimit: bigint;
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
  completed: (TradeSuccess | TradeError)[];
  messages: Array<PotentialConversionsMessage | GetBestTradeMessage | ArbitrageMessage | ExecuteTradeMessage>;
}

export const defaultState = {
  trades: {},
  completed: [],
  messages: [],
};

export const reducer = (state: State, action: ConverterBotMessage | ExecuteTradeMessage): State => {
  switch (action.type) {
    case "PotentialConversions":
    case "GetBestTrade":
    case "ExecuteTrade": {
      return {
        ...state,
        messages: [action, ...state.messages.slice(0, 4)],
      };
    }
    case "Arbitrage": {
      const prevState = { ...state };
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
