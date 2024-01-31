import bscmainnetGovernance from "@venusprotocol/governance-contracts/deployments/bscmainnet_addresses.json";
import bsctestnetGovernance from "@venusprotocol/governance-contracts/deployments/bsctestnet_addresses.json";
import bscmainnetIsolated from "@venusprotocol/isolated-pools/deployments/bscmainnet_addresses.json";
import bsctestnetIsolated from "@venusprotocol/isolated-pools/deployments/bsctestnet_addresses.json";
import bscmainnetProtocolReserve from "@venusprotocol/protocol-reserve/deployments/bscmainnet_addresses.json";
import bsctestnetProtocolReserve from "@venusprotocol/protocol-reserve/deployments/bsctestnet_addresses.json";
import bscmainnetCore from "@venusprotocol/venus-protocol/deployments/bscmainnet_addresses.json";
import bsctestnetCore from "@venusprotocol/venus-protocol/deployments/bsctestnet_addresses.json";
import { Address } from "viem";

import { SUPPORTED_CHAINS } from "./chains";

const addresses = {
  bscmainnet: {
    ...bscmainnetCore.addresses,
    ...bscmainnetProtocolReserve.addresses,
    ...bscmainnetGovernance.addresses,
    ...bscmainnetIsolated.addresses,
    BUSD: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56",
    USDT: "0x55d398326f99059fF775485246999027B3197955",
    USDC: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
    WBNB: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
    PancakeSwapRouter: "0x13f4EA83D0bd40E75C8222255bc855a974568Dd4",

    BTCBPrimeConverter: bscmainnetProtocolReserve.addresses.BTCBPrimeConverter,
    ConverterNetwork: bscmainnetProtocolReserve.addresses.ConverterNetwork,
    ETHPrimeConverter: bscmainnetProtocolReserve.addresses.ETHPrimeConverter,
    RiskFundConverter: bscmainnetProtocolReserve.addresses.RiskFundConverter,
    USDCPrimeConverter: bscmainnetProtocolReserve.addresses.USDCPrimeConverter,
    USDTPrimeConverter: bscmainnetProtocolReserve.addresses.USDTPrimeConverter,
    XVSVaultConverter: bscmainnetProtocolReserve.addresses.XVSVaultConverter,
    TokenConverterOperator: "0x",
  },
  bsctestnet: {
    ...bsctestnetCore.addresses,
    ...bsctestnetProtocolReserve.addresses,
    ...bsctestnetGovernance.addresses,
    ...bsctestnetIsolated.addresses,
    PancakeSwapRouter: "0x1b81D678ffb9C0263b24A97847620C99d213eB14",
    xvsHolder: "0x2Ce1d0ffD7E869D9DF33e28552b12DdDed326706",
    usdtHolder: "0x2Ce1d0ffD7E869D9DF33e28552b12DdDed326706",

    BTCBPrimeConverter: bsctestnetProtocolReserve.addresses.BTCBPrimeConverter,
    ConverterNetwork: bsctestnetProtocolReserve.addresses.ConverterNetwork,
    ETHPrimeConverter: bsctestnetProtocolReserve.addresses.ETHPrimeConverter,
    RiskFundConverter: bsctestnetProtocolReserve.addresses.RiskFundConverter,
    USDCPrimeConverter: bsctestnetProtocolReserve.addresses.USDCPrimeConverter,
    USDTPrimeConverter: bsctestnetProtocolReserve.addresses.USDTPrimeConverter,
    XVSVaultConverter: bsctestnetProtocolReserve.addresses.XVSVaultConverter,

    TokenConverterOperator: "0x9222F8b71603318d5EEbBf0074c2Da07fEbbB9eb",
  },
} as const;

type Addresses = typeof addresses;

export type HasAddressFor<ContractName extends string> = {
  [ChainT in keyof Addresses]: Addresses[ChainT] extends Record<ContractName, string> ? ChainT : never;
}[keyof Addresses];

export type SupportedConverters =
  | "BTCBPrimeConverter"
  | "ETHPrimeConverter"
  | "RiskFundConverter"
  | "USDCPrimeConverter"
  | "USDTPrimeConverter"
  | "XVSVaultConverter";

const network = process.env.FORKED_NETWORK as SUPPORTED_CHAINS;

export const underlyingToVTokens: Record<
  Address,
  { core: Address | undefined; isolated: Array<[Address, Address]> | undefined }
> = {
  bsctestnet: {
    // usdc
    ["0x16227d60f7a0e586c66b005219dfc887d13c9531" as const]: {
      core: "0xD5C4C2e2facBEB59D0216D0595d63FcDc6F9A1a7" as const,
      isolated: undefined,
    },
    // ankrBNB
    ["0x167f1f9ef531b3576201aa3146b13c57dbeda514" as const]: {
      core: "0xe507B30C41E9e375BCe05197c1e09fc9ee40c0f6" as const,
      isolated: undefined,
    },
    // trx old
    ["0x19e7215abf8b2716ee807c9f4b83af0e7f92653f" as const]: {
      core: "0x369Fea97f6fB7510755DCA389088d9E2e2819278" as const,
      isolated: undefined,
    },
    // stkBNB
    ["0x2999c176ebf66ecda3a646e70ceb5ff4d5fcfb8c" as const]: {
      core: undefined,
      isolated: [
        ["0x596B11acAACF03217287939f88d63b51d3771704" as const, "0x75aa42c832a8911B77219DbeBABBB40040d16987" as const],
      ] as [Address, Address][],
    },
    // usdd
    ["0x2e2466e22fcbe0732be385ee2fbb9c59a1098382" as const]: {
      core: undefined,
      isolated: [
        ["0x11537D023f489E4EF0C7157cc729C7B69CbE0c97" as const, "0xD804F74fe21290d213c46610ab171f7c2EeEBDE7" as const],
        ["0x1F4f0989C51f12DAcacD4025018176711f3Bf289" as const, "0xdeDf3B2bcF25d0023115fd71a0F8221C91C92B1a" as const],
        ["0x10b57706AD2345e590c2eA4DC02faef0d9f5b08B" as const, "0x899dDf81DfbbF5889a16D075c352F2b959Dd24A4" as const],
        ["0x23a73971A6B9f6580c048B9CB188869B2A2aA2aD " as const, "0xa109DE0abaeefC521Ec29D89eA42E64F37A6882E" as const],
        ["0x596B11acAACF03217287939f88d63b51d3771704" as const, "0xD5b20708d8f0FcA52cb609938D0594C4e32E5DaD" as const],
      ] as [Address, Address][],
    },
    // win
    ["0x2e6af3f3f059f43d764060968658c9f3c8f9479d" as const]: {
      core: undefined,
      isolated: [
        ["0x11537D023f489E4EF0C7157cc729C7B69CbE0c97" as const, "0xEe543D5de2Dbb5b07675Fc72831A2f1812428393" as const],
      ] as [Address, Address][],
    },
    // XRP
    ["0x3022a32fdadb4f02281e8fab33e0a6811237aab0" as const]: {
      core: "0x488aB2826a154da01CC4CC16A8C83d4720D3cA2C" as const,
      isolated: undefined,
    },
    // bnbx
    ["0x327d6e6fac0228070884e913263cff9efed4a2c8" as const]: {
      core: undefined,
      isolated: [
        ["0x596B11acAACF03217287939f88d63b51d3771704" as const, "0x644A149853E5507AdF3e682218b8AC86cdD62951" as const],
      ] as [Address, Address][],
    },
    // aave
    ["0x4b7268fc7c727b88c5fc127d41b491bfae63e144" as const]: {
      core: "0x714db6c38A17883964B68a07d56cE331501d9eb6" as const,
      isolated: undefined,
    },
    // planet
    ["0x52b4e1a2ba407813f829b4b3943a1e57768669a9" as const]: {
      core: undefined,
      isolated: [
        ["0x23a73971A6B9f6580c048B9CB188869B2A2aA2aD" as const, "0xe237aA131E7B004aC88CB808Fa56AF3dc4C408f1" as const],
      ] as [Address, Address][],
    },
    // ageur
    ["0x63061de4a25f24279aaab80400040684f92ee319" as const]: {
      core: undefined,
      isolated: [
        ["0x10b57706AD2345e590c2eA4DC02faef0d9f5b08B" as const, "0x4E1D35166776825402d50AfE4286c500027211D1" as const],
      ] as [Address, Address][],
    },
    // doge
    ["0x67d262ce2b8b846d9b94060bc04dc40a83f0e25b" as const]: {
      core: "0xF912d3001CAf6DC4ADD366A62Cc9115B4303c9A9" as const,
      isolated: undefined,
    },
    // alpaca
    ["0x6923189d91fdf62dbae623a55273f1d20306d9f2" as const]: {
      core: undefined,
      isolated: [
        ["0x23a73971A6B9f6580c048B9CB188869B2A2aA2aD" as const, "0xb7caC5Ef82cb7f9197ee184779bdc52c5490C02a" as const],
      ] as [Address, Address][],
    },
    // sxp
    ["0x75107940cf1121232c0559c747a986defbc69da9" as const]: {
      core: "0x74469281310195A04840Daf6EdF576F559a3dE80" as const,
      isolated: undefined,
    },
    // trx
    ["0x7d21841dc10ba1c5797951efc62fadbbdd06704b" as const]: {
      core: "0x6AF3Fdb3282c5bb6926269Db10837fa8Aec67C04" as const,
      isolated: [
        ["0x11537D023f489E4EF0C7157cc729C7B69CbE0c97" as const, "0x410286c43a525E1DCC7468a9B091C111C8324cd1" as const],
      ] as [Address, Address][],
    },
    // bsw
    ["0x7fcc76fc1f573d8eb445c236cc282246bc562bce" as const]: {
      core: undefined,
      isolated: [
        ["0x23a73971A6B9f6580c048B9CB188869B2A2aA2aD" as const, "0x5e68913fbbfb91af30366ab1B21324410b49a308" as const],
      ] as [Address, Address][],
    },
    // busd
    ["0x8301f2213c0eed49a7e28ae4c3e91722919b8b47" as const]: {
      core: "0x08e0A5575De71037aE36AbfAfb516595fE68e5e4" as const,
      isolated: undefined,
    },
    // uni
    ["0x8d2f061c75780d8d91c10a7230b907411acbc8fc" as const]: {
      core: "0x171B468b52d7027F12cEF90cd065d6776a25E24e" as const,
      isolated: undefined,
    },
    // ltc
    ["0x969f147b6b8d81f86175de33206a4fd43df17913" as const]: {
      core: "0xAfc13BC065ABeE838540823431055D2ea52eBA52" as const,
      isolated: undefined,
    },
    // eth
    ["0x98f7a83361f7ac8765ccebab1425da6b341958a7" as const]: {
      core: "0x162D005F0Fff510E54958Cfc5CF32A3180A84aab" as const,
      isolated: undefined,
    },
    // btcb
    ["0xa808e341e8e723dc6ba0bb5204bafc2330d7b8e4" as const]: {
      core: "0xb6e9322C49FD75a367Fcb17B0Fcd62C5070EbCBe" as const,
      isolated: undefined,
    },
    // wbnb
    ["0xae13d989dac2f0debff460ac112a837c89baa7cd" as const]: {
      core: undefined,
      isolated: [
        ["0x596B11acAACF03217287939f88d63b51d3771704" as const, "0x231dED0Dfc99634e52EE1a1329586bc970d773b3" as const],
      ] as [Address, Address][],
    },
    // floki
    ["0xb22cf15fbc089d470f8e532aead2bab76be87c88" as const]: {
      core: undefined,
      isolated: [
        ["0x1F4f0989C51f12DAcacD4025018176711f3Bf289" as const, "0xef470AbC365F88e4582D8027172a392C473A5B53" as const],
      ] as [Address, Address][],
    },
    // tusd
    ["0xb32171ecd878607ffc4f8fc0bcce6852bb3149e0" as const]: {
      core: "0xEFAACF73CE2D38ED40991f29E72B12C74bd4cf23" as const,
      isolated: undefined,
    },
    // twt
    ["0xb99c6b26fdf3678c6e2aff8466e3625a0e7182f8" as const]: {
      core: undefined,
      isolated: [
        ["0x23a73971A6B9f6580c048B9CB188869B2A2aA2aD" as const, "0x4C94e67d239aD585275Fdd3246Ab82c8a2668564" as const],
      ] as [Address, Address][],
    },
    // ada
    ["0xcd34bc54106bd45a04ed99ebcc2a6a3e70d7210f" as const]: {
      core: "0xcd34bc54106bd45a04ed99ebcc2a6a3e70d7210f" as const,
      isolated: undefined,
    },
    // fdusd
    ["0xcf27439fa231af9931ee40c4f27bb77b83826f3c" as const]: {
      core: "0xF06e662a00796c122AaAE935EC4F0Be3F74f5636" as const,
      isolated: undefined,
    },
    // matic
    ["0xcfeb0103d4befa041ea4c2dacce7b3e83e1ae7e3" as const]: {
      core: "0xcfeb0103d4befa041ea4c2dacce7b3e83e1ae7e3" as const,
      isolated: undefined,
    },
    // snBNB
    ["0xd2af6a916bc77764dc63742bc30f71af4cf423f4" as const]: {
      core: undefined,
      isolated: [
        ["0x596B11acAACF03217287939f88d63b51d3771704" as const, "0xeffE7874C345aE877c1D893cd5160DDD359b24dA" as const],
      ] as [Address, Address][],
    },
    // raca
    ["0xd60cc803d888a3e743f21d0bde4bf2cafdea1f26" as const]: {
      core: undefined,
      isolated: [
        ["0x1F4f0989C51f12DAcacD4025018176711f3Bf289" as const, "0x1958035231E125830bA5d17D168cEa07Bb42184a" as const],
      ] as [Address, Address][],
    },
    // ankr
    ["0xe4a90eb942cf2da7238e8f6cc9ef510c49fc8b4b" as const]: {
      core: undefined,
      isolated: [
        ["0x23a73971A6B9f6580c048B9CB188869B2A2aA2aD" as const, "0xb677e080148368EeeE70fA3865d07E92c6500174" as const],
      ] as [Address, Address][],
    },
    // hay
    ["0xe73774dfcd551bf75650772dc2cc56a2b6323453" as const]: {
      core: undefined,
      isolated: [
        ["0x10b57706AD2345e590c2eA4DC02faef0d9f5b08B" as const, "0x170d3b2da05cc2124334240fB34ad1359e34C562" as const],
      ] as [Address, Address][],
    },
    // cake
    ["0xe8bd7ccc165faeb9b81569b05424771b9a20cbef" as const]: {
      core: "0xeDaC03D29ff74b5fDc0CC936F6288312e1459BC6" as const,
      isolated: undefined,
    },
    // btt
    ["0xe98344a7c691b200ef47c9b8829110087d832c64" as const]: {
      core: undefined,
      isolated: [
        ["0x11537D023f489E4EF0C7157cc729C7B69CbE0c97" as const, "0x47793540757c6E6D84155B33cd8D9535CFdb9334" as const],
      ] as [Address, Address][],
    },
    // wbeth
    ["0xf9f98365566f4d55234f24b99caa1afbe6428d44" as const]: {
      core: "0x35566ED3AF9E537Be487C98b1811cDf95ad0C32b" as const,
      isolated: undefined,
    },
    // tusdold
    ["0xfec3a63401eb9c1476200d7c32c4009be0154169" as const]: {
      core: "0xfec3a63401eb9c1476200d7c32c4009be0154169" as const,
      isolated: undefined,
    },
    // xvs
    ["0xb9e0e753630434d7863528cc73cb7ac638a7c8ff" as const]: {
      core: "0x6d6F697e34145Bb95c54E77482d97cc261Dc237E" as const,
      isolated: undefined,
    },
  },
  bscmainnet: {},
}[network];

export default addresses[network];
