import { Address, parseAbi } from "viem";

import TokenConverterOperator from "../config/abis/TokenConverterOperator";
import addresses from "../config/addresses";
import type { SUPPORTED_CHAINS } from "../config/chains";
import { chains } from "../config/chains";
import { getPublicClient, getWalletClient } from "../config/clients";
import { Path } from "./path";

type SupportedConverters =
  | "BTCBPrimeConverter"
  | "ETHPrimeConverter"
  | "RiskFundConverter"
  | "USDCPrimeConverter"
  | "USDTPrimeConverter"
  | "XVSVaultConverter";

const REVERT_IF_NOT_MINED_AFTER = 60n; // seconds

class Bot {
  private chainName: SUPPORTED_CHAINS;
  private operator: { address: Address; abi: typeof TokenConverterOperator };
  private addresses: typeof addresses;
  private _walletClient?: ReturnType<typeof getWalletClient>;
  private _publicClient?: ReturnType<typeof getPublicClient>;

  constructor(chainName: SUPPORTED_CHAINS) {
    this.chainName = chainName;
    this.addresses = addresses[chainName];
    this.operator = {
      address: addresses.TokenConverterOperator,
      abi: TokenConverterOperator,
    };
  }

  get publicClient() {
    return (this._publicClient ||= getPublicClient(this.chainName));
  }

  get walletClient() {
    return (this._walletClient ||= getWalletClient(this.chainName));
  }

  async sanityCheck() {
    const expected = this.addresses.PancakeSwapRouter;
    const actual = await this.publicClient.readContract({
      ...this.operator,
      functionName: "SWAP_ROUTER",
    });
    if (expected !== actual) {
      throw new Error(`Expected swap router to be at ${expected} but found at ${actual}`);
    }
  }

  async arbitrage(converter: SupportedConverters, path: Path, amount: bigint, minIncome: bigint) {
    const converterAddress = this.addresses[converter];
    const beneficiary = this.walletClient.account.address;
    const chain = chains[this.chainName];

    if (minIncome < 0n) {
      await this.walletClient.writeContract({
        address: path.end,
        chain,
        abi: parseAbi(["function approve(address,uint256)"]),
        functionName: "approve",
        args: [this.operator.address, -minIncome],
      });
    }

    const block = await this.publicClient.getBlock();
    await this.walletClient.writeContract({
      ...this.operator,
      chain,
      functionName: "convert",
      args: [
        {
          beneficiary,
          tokenToReceiveFromConverter: path.end,
          amount,
          minIncome,
          tokenToSendToConverter: path.start,
          converter: converterAddress,
          path: path.hex,
          deadline: block.timestamp + REVERT_IF_NOT_MINED_AFTER,
        },
      ],
    });
  }
}

export default Bot;
