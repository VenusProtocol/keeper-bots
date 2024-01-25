import bscmainnetGovernance from "@venusprotocol/governance-contracts/deployments/bscmainnet_addresses.json";
import bsctestnetGovernance from "@venusprotocol/governance-contracts/deployments/bsctestnet_addresses.json";
import bscmainnetProtocolReserve from "@venusprotocol/protocol-reserve/deployments/bscmainnet_addresses.json";
import bsctestnetProtocolReserve from "@venusprotocol/protocol-reserve/deployments/bsctestnet_addresses.json";
import bscmainnetCore from "@venusprotocol/venus-protocol/deployments/bscmainnet_addresses.json";
import bsctestnetCore from "@venusprotocol/venus-protocol/deployments/bsctestnet_addresses.json";

export const addresses = {
  bscmainnet: {
    ...bscmainnetCore.addresses,
    ...bscmainnetProtocolReserve.addresses,
    ...bscmainnetGovernance.addresses,
    BUSD: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56",
    USDT: "0x55d398326f99059fF775485246999027B3197955",
    USDC: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
    WBNB: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
    PancakeSwapRouter: "0x13f4EA83D0bd40E75C8222255bc855a974568Dd4",
  },
  bsctestnet: {
    ...bsctestnetCore.addresses,
    ...bsctestnetProtocolReserve.addresses,
    ...bsctestnetGovernance.addresses,
    PancakeSwapRouter: "0x1b81D678ffb9C0263b24A97847620C99d213eB14",
    xvsHolder: "0x2Ce1d0ffD7E869D9DF33e28552b12DdDed326706",
    usdtHolder: "0x2Ce1d0ffD7E869D9DF33e28552b12DdDed326706",

    TokenConverterOperator: "0x9222F8b71603318d5EEbBf0074c2Da07fEbbB9eb",
  },
} as const;

type Addresses = typeof addresses;

export type HasAddressFor<ContractName extends string> = {
  [ChainT in keyof Addresses]: Addresses[ChainT] extends Record<ContractName, any> ? ChainT : never;
}[keyof Addresses];
