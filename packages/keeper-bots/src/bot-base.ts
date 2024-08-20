import getConfig from "./config";
import type { SUPPORTED_CHAINS } from "./config/chains";
import getPublicClient from "./config/clients/publicClient";
import getWalletClient from "./config/clients/walletClient";
import { ConverterBotMessage } from "./converter-bot/types";
import { SwapProvider } from "./providers";

const config = getConfig();

class BotBase {
  protected chainName: SUPPORTED_CHAINS;
  protected subscriber: undefined | ((msg: ConverterBotMessage) => void);
  protected simulate: boolean;
  protected swapProvider: SwapProvider;
  public publicClient: ReturnType<typeof getPublicClient>;
  public walletClient: ReturnType<typeof getWalletClient>;

  constructor({
    subscriber,
    swapProvider,
    simulate,
  }: {
    subscriber?: (msg: ConverterBotMessage) => void;
    swapProvider: typeof SwapProvider;
    simulate: boolean;
  }) {
    this.subscriber = subscriber;
    this.swapProvider = new swapProvider({ subscriber });
    this.publicClient = getPublicClient();
    this.walletClient = getWalletClient();
    this.simulate = simulate;
    this.chainName = config.network.name;
  }
  protected sendMessage({
    type,
    trx = undefined,
    error = undefined,
    context = undefined,
    blockNumber = undefined,
  }: Partial<ConverterBotMessage>) {
    if (this.subscriber) {
      this.subscriber({ type, trx, error, context, blockNumber } as ConverterBotMessage);
    }
  }
}

export default BotBase;
