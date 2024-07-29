import bscmainnetGovernance from "@venusprotocol/governance-contracts/deployments/bscmainnet_addresses.json";
import bsctestnetGovernance from "@venusprotocol/governance-contracts/deployments/bsctestnet_addresses.json";
import bscmainnetIsolated from "@venusprotocol/isolated-pools/deployments/bscmainnet_addresses.json";
import bsctestnetIsolated from "@venusprotocol/isolated-pools/deployments/bsctestnet_addresses.json";
import ethereumIsolated from "@venusprotocol/isolated-pools/deployments/ethereum_addresses.json";
import sepoliaIsolated from "@venusprotocol/isolated-pools/deployments/sepolia_addresses.json";
import bscmainnetTokenConverterBot from "@venusprotocol/keeper-bot-contracts/deployments/bscmainnet_addresses.json";
import bsctestnetTokenConverterBot from "@venusprotocol/keeper-bot-contracts/deployments/bsctestnet_addresses.json";
// import ethereumTokenConverterBot from "@venusprotocol/keeper-bot-contracts/deployments/ethereum_addresses.json";
// import sepoliaTokenConverterBot from "@venusprotocol/keeper-bot-contracts/deployments/sepolia_addresses.json";
import bscmainnetProtocolReserve from "@venusprotocol/protocol-reserve/deployments/bscmainnet_addresses.json";
import bsctestnetProtocolReserve from "@venusprotocol/protocol-reserve/deployments/bsctestnet_addresses.json";
import ethereumProtocolReserve from "@venusprotocol/protocol-reserve/deployments/ethereum_addresses.json";
import sepoliaProtocolReserve from "@venusprotocol/protocol-reserve/deployments/sepolia_addresses.json";
import bscmainnetCore from "@venusprotocol/venus-protocol/deployments/bscmainnet_addresses.json";
import bsctestnetCore from "@venusprotocol/venus-protocol/deployments/bsctestnet_addresses.json";
import { Address } from "viem";

import getConfig from ".";

const addressesConfig = {
  ethereum: {
    PoolLens: ethereumIsolated.addresses.PoolLens as Address,
    ConverterNetwork: ethereumProtocolReserve.addresses.ConverterNetwork as Address,
    USDCPrimeConverter: ethereumProtocolReserve.addresses.USDCPrimeConverter as Address,
    USDTPrimeConverter: ethereumProtocolReserve.addresses.USDTPrimeConverter as Address,
    XVSVaultConverter: ethereumProtocolReserve.addresses.XVSVaultConverter as Address,
    WBTCPrimeConverter: ethereumProtocolReserve.addresses.WBTCPrimeConverter as Address,
    WETHPrimeConverter: ethereumProtocolReserve.addresses.WETHPrimeConverter as Address,
    ProtocolShareReserve: ethereumProtocolReserve.addresses.ProtocolShareReserve as Address,
    PoolRegistry: ethereumIsolated.addresses.PoolRegistry as Address,
    TokenConverterOperator: "0x6eF49b4e0772Fe78128F981d42D54172b55eCF9F" as Address,
    Unitroller: undefined,
    VBNBAdmin: undefined,
    vBNB: undefined,
    VenusLens: undefined,
  },
  sepolia: {
    PoolLens: sepoliaIsolated.addresses.PoolLens as Address,
    ConverterNetwork: sepoliaProtocolReserve.addresses.ConverterNetwork as Address,
    USDCPrimeConverter: sepoliaProtocolReserve.addresses.USDCPrimeConverter as Address,
    USDTPrimeConverter: sepoliaProtocolReserve.addresses.USDTPrimeConverter as Address,
    XVSVaultConverter: sepoliaProtocolReserve.addresses.XVSVaultConverter as Address,
    WBTCPrimeConverter: sepoliaProtocolReserve.addresses.WBTCPrimeConverter as Address,
    WETHPrimeConverter: sepoliaProtocolReserve.addresses.WETHPrimeConverter as Address,
    ProtocolShareReserve: sepoliaProtocolReserve.addresses.ProtocolShareReserve as Address,
    PoolRegistry: sepoliaIsolated.addresses.PoolRegistry as Address,
    TokenConverterOperator: "0xD5c00F011F95E36631F3a99cc94274888E76755C" as Address,
    Unitroller: undefined,
    VBNBAdmin: undefined,
    vBNB: undefined,
    VenusLens: undefined,
  },
  bscmainnet: {
    ...(bscmainnetCore.addresses as Record<keyof typeof bscmainnetCore.addresses, Address>),
    ...(bscmainnetProtocolReserve.addresses as Record<keyof typeof bscmainnetProtocolReserve.addresses, Address>),
    ...(bscmainnetGovernance.addresses as Record<keyof typeof bscmainnetGovernance.addresses, Address>),
    ...(bscmainnetIsolated.addresses as Record<keyof typeof bscmainnetIsolated.addresses, Address>),
    BUSD: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56" as const,
    USDT: "0x55d398326f99059fF775485246999027B3197955" as const,
    USDC: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d" as const,
    WBNB: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c" as const,
    PancakeSwapRouter: "0x13f4EA83D0bd40E75C8222255bc855a974568Dd4" as const,

    BTCBPrimeConverter: bscmainnetProtocolReserve.addresses.BTCBPrimeConverter as Address,
    ConverterNetwork: bscmainnetProtocolReserve.addresses.ConverterNetwork as Address,
    ETHPrimeConverter: bscmainnetProtocolReserve.addresses.ETHPrimeConverter as Address,
    RiskFundConverter: bscmainnetProtocolReserve.addresses.RiskFundConverter as Address,
    USDCPrimeConverter: bscmainnetProtocolReserve.addresses.USDCPrimeConverter as Address,
    USDTPrimeConverter: bscmainnetProtocolReserve.addresses.USDTPrimeConverter as Address,
    XVSVaultConverter: bscmainnetProtocolReserve.addresses.XVSVaultConverter as Address,
    TokenConverterOperator: bscmainnetTokenConverterBot.addresses.TokenConverterOperator as Address,
  },
  bsctestnet: {
    ...(bsctestnetCore.addresses as Record<keyof typeof bsctestnetCore.addresses, Address>),
    ...(bsctestnetProtocolReserve.addresses as Record<keyof typeof bsctestnetProtocolReserve.addresses, Address>),
    ...(bsctestnetGovernance.addresses as Record<keyof typeof bsctestnetGovernance.addresses, Address>),
    ...(bsctestnetIsolated.addresses as Record<keyof typeof bsctestnetIsolated.addresses, Address>),
    PancakeSwapRouter: "0x1b81D678ffb9C0263b24A97847620C99d213eB14" as const,

    BTCBPrimeConverter: bsctestnetProtocolReserve.addresses.BTCBPrimeConverter as Address,
    ConverterNetwork: bsctestnetProtocolReserve.addresses.ConverterNetwork as Address,
    ETHPrimeConverter: bsctestnetProtocolReserve.addresses.ETHPrimeConverter as Address,
    RiskFundConverter: bsctestnetProtocolReserve.addresses.RiskFundConverter as Address,
    USDCPrimeConverter: bsctestnetProtocolReserve.addresses.USDCPrimeConverter as Address,
    USDTPrimeConverter: bsctestnetProtocolReserve.addresses.USDTPrimeConverter as Address,
    XVSVaultConverter: bsctestnetProtocolReserve.addresses.XVSVaultConverter as Address,

    TokenConverterOperator: bsctestnetTokenConverterBot.addresses.TokenConverterOperator as Address,
  },
} as const;

const getAddresses = () => {
  const { network } = getConfig();
  return addressesConfig[network.name];
};

type Addresses = typeof addressesConfig;

export type HasAddressFor<ContractName extends string> = {
  [ChainT in keyof Addresses]: Addresses[ChainT] extends Record<ContractName, string> ? ChainT : never;
}[keyof Addresses];

export default getAddresses;
