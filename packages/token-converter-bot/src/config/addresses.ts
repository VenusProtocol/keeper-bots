import bscmainnetGovernance from "@venusprotocol/governance-contracts/deployments/bscmainnet_addresses.json";
import bsctestnetGovernance from "@venusprotocol/governance-contracts/deployments/bsctestnet_addresses.json";
import bscmainnetIsolated from "@venusprotocol/isolated-pools/deployments/bscmainnet_addresses.json";
import bsctestnetIsolated from "@venusprotocol/isolated-pools/deployments/bsctestnet_addresses.json";
import bscmainnetProtocolReserve from "@venusprotocol/protocol-reserve/deployments/bscmainnet_addresses.json";
import bsctestnetProtocolReserve from "@venusprotocol/protocol-reserve/deployments/bsctestnet_addresses.json";
import bscmainnetCore from "@venusprotocol/venus-protocol/deployments/bscmainnet_addresses.json";
import bsctestnetCore from "@venusprotocol/venus-protocol/deployments/bsctestnet_addresses.json";
import { Address } from "viem";

import config from ".";

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
    TokenConverterOperator: "0x9Db8ABe20D004ab172DBE07c6Ea89680A5a3c337",
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

const { network } = config;

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
        ["0x11537D023f489E4EF0C7157cc729C7B69CbE0c97", "0xD804F74fe21290d213c46610ab171f7c2EeEBDE7"],
        ["0x1F4f0989C51f12DAcacD4025018176711f3Bf289", "0xdeDf3B2bcF25d0023115fd71a0F8221C91C92B1a"],
        ["0x10b57706AD2345e590c2eA4DC02faef0d9f5b08B", "0x899dDf81DfbbF5889a16D075c352F2b959Dd24A4"],
        ["0x23a73971A6B9f6580c048B9CB188869B2A2aA2aD ", "0xa109DE0abaeefC521Ec29D89eA42E64F37A6882E"],
        ["0x596B11acAACF03217287939f88d63b51d3771704", "0xD5b20708d8f0FcA52cb609938D0594C4e32E5DaD"],
      ] as [Address, Address][],
    },
    // win
    ["0x2e6af3f3f059f43d764060968658c9f3c8f9479d" as const]: {
      core: undefined,
      isolated: [["0x11537D023f489E4EF0C7157cc729C7B69CbE0c97", "0xEe543D5de2Dbb5b07675Fc72831A2f1812428393"]] as [
        Address,
        Address,
      ][],
    },
    // XRP
    ["0x3022a32fdadb4f02281e8fab33e0a6811237aab0" as const]: {
      core: "0x488aB2826a154da01CC4CC16A8C83d4720D3cA2C" as const,
      isolated: undefined,
    },
    // bnbx
    ["0x327d6e6fac0228070884e913263cff9efed4a2c8" as const]: {
      core: undefined,
      isolated: [["0x596B11acAACF03217287939f88d63b51d3771704", "0x644A149853E5507AdF3e682218b8AC86cdD62951"]] as [
        Address,
        Address,
      ][],
    },
    // aave
    ["0x4b7268fc7c727b88c5fc127d41b491bfae63e144" as const]: {
      core: "0x714db6c38A17883964B68a07d56cE331501d9eb6" as const,
      isolated: undefined,
    },
    // planet
    ["0x52b4e1a2ba407813f829b4b3943a1e57768669a9" as const]: {
      core: undefined,
      isolated: [["0x23a73971A6B9f6580c048B9CB188869B2A2aA2aD", "0xe237aA131E7B004aC88CB808Fa56AF3dc4C408f1"]] as [
        Address,
        Address,
      ][],
    },
    // ageur
    ["0x63061de4a25f24279aaab80400040684f92ee319" as const]: {
      core: undefined,
      isolated: [["0x10b57706AD2345e590c2eA4DC02faef0d9f5b08B", "0x4E1D35166776825402d50AfE4286c500027211D1"]] as [
        Address,
        Address,
      ][],
    },
    // doge
    ["0x67d262ce2b8b846d9b94060bc04dc40a83f0e25b" as const]: {
      core: "0xF912d3001CAf6DC4ADD366A62Cc9115B4303c9A9" as const,
      isolated: undefined,
    },
    // alpaca
    ["0x6923189d91fdf62dbae623a55273f1d20306d9f2" as const]: {
      core: undefined,
      isolated: [["0x23a73971A6B9f6580c048B9CB188869B2A2aA2aD", "0xb7caC5Ef82cb7f9197ee184779bdc52c5490C02a"]] as [
        Address,
        Address,
      ][],
    },
    // sxp
    ["0x75107940cf1121232c0559c747a986defbc69da9" as const]: {
      core: "0x74469281310195A04840Daf6EdF576F559a3dE80" as const,
      isolated: undefined,
    },
    // trx
    ["0x7d21841dc10ba1c5797951efc62fadbbdd06704b" as const]: {
      core: "0x6AF3Fdb3282c5bb6926269Db10837fa8Aec67C04" as const,
      isolated: [["0x11537D023f489E4EF0C7157cc729C7B69CbE0c97", "0x410286c43a525E1DCC7468a9B091C111C8324cd1"]] as [
        Address,
        Address,
      ][],
    },
    // bsw
    ["0x7fcc76fc1f573d8eb445c236cc282246bc562bce" as const]: {
      core: undefined,
      isolated: [["0x23a73971A6B9f6580c048B9CB188869B2A2aA2aD", "0x5e68913fbbfb91af30366ab1B21324410b49a308"]] as [
        Address,
        Address,
      ][],
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
      isolated: [["0x596B11acAACF03217287939f88d63b51d3771704", "0x231dED0Dfc99634e52EE1a1329586bc970d773b3"]] as [
        Address,
        Address,
      ][],
    },
    // floki
    ["0xb22cf15fbc089d470f8e532aead2bab76be87c88" as const]: {
      core: undefined,
      isolated: [["0x1F4f0989C51f12DAcacD4025018176711f3Bf289", "0xef470AbC365F88e4582D8027172a392C473A5B53"]] as [
        Address,
        Address,
      ][],
    },
    // tusd
    ["0xb32171ecd878607ffc4f8fc0bcce6852bb3149e0" as const]: {
      core: "0xEFAACF73CE2D38ED40991f29E72B12C74bd4cf23" as const,
      isolated: undefined,
    },
    // twt
    ["0xb99c6b26fdf3678c6e2aff8466e3625a0e7182f8" as const]: {
      core: undefined,
      isolated: [["0x23a73971A6B9f6580c048B9CB188869B2A2aA2aD", "0x4C94e67d239aD585275Fdd3246Ab82c8a2668564"]] as [
        Address,
        Address,
      ][],
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
      isolated: [["0x596B11acAACF03217287939f88d63b51d3771704", "0xeffE7874C345aE877c1D893cd5160DDD359b24dA"]] as [
        Address,
        Address,
      ][],
    },
    // raca
    ["0xd60cc803d888a3e743f21d0bde4bf2cafdea1f26" as const]: {
      core: undefined,
      isolated: [["0x1F4f0989C51f12DAcacD4025018176711f3Bf289", "0x1958035231E125830bA5d17D168cEa07Bb42184a"]] as [
        Address,
        Address,
      ][],
    },
    // ankr
    ["0xe4a90eb942cf2da7238e8f6cc9ef510c49fc8b4b" as const]: {
      core: undefined,
      isolated: [["0x23a73971A6B9f6580c048B9CB188869B2A2aA2aD", "0xb677e080148368EeeE70fA3865d07E92c6500174"]] as [
        Address,
        Address,
      ][],
    },
    // hay
    ["0xe73774dfcd551bf75650772dc2cc56a2b6323453" as const]: {
      core: undefined,
      isolated: [["0x10b57706AD2345e590c2eA4DC02faef0d9f5b08B", "0x170d3b2da05cc2124334240fB34ad1359e34C562"]] as [
        Address,
        Address,
      ][],
    },
    // cake
    ["0xe8bd7ccc165faeb9b81569b05424771b9a20cbef" as const]: {
      core: "0xeDaC03D29ff74b5fDc0CC936F6288312e1459BC6" as const,
      isolated: undefined,
    },
    // btt
    ["0xe98344a7c691b200ef47c9b8829110087d832c64" as const]: {
      core: undefined,
      isolated: [["0x11537D023f489E4EF0C7157cc729C7B69CbE0c97", "0x47793540757c6E6D84155B33cd8D9535CFdb9334"]] as [
        Address,
        Address,
      ][],
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
  //
  bscmainnet: {
    // btcb
    ["0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c" as const]: {
      core: "0x882C173bC7Ff3b7786CA16dfeD3DFFfb9Ee7847B" as const,
      isolated: undefined,
    },
    // usdt
    ["0x55d398326f99059ff775485246999027b3197955" as const]: {
      core: "0xfD5840Cd36d94D7229439859C0112a4185BC0255" as const,
      isolated: [
        ["0x1b43ea8622e76627B81665B1eCeBB4867566B963", "0x4978591f17670A846137d9d613e333C38dc68A37"],
        ["0x3344417c9360b963ca93A4e8305361AEde340Ab9", "0x1D8bBDE12B6b34140604E18e9f9c6e14deC16854"],
        ["0x23b4404E4E5eC5FF5a6FFb70B7d14E3FabF237B0", "0x281E5378f99A4bc55b295ABc0A3E7eD32Deba059"],
        ["0x94c1495cD4c557f1560Cbd68EAB0d197e6291571", "0x5e3072305F9caE1c7A82F6Fe9E38811c74922c3B"],
      ] as [Address, Address][],
    },
    // wbeth
    ["0xa2e3356610840701bdf5611a53974510ae27e2e1" as const]: {
      core: "0x6CFdEc747f37DAf3b87a35a1D9c8AD3063A1A8A0" as const,
      isolated: undefined,
    },
    // cake
    ["0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82" as const]: {
      core: "0x86aC3974e2BD0d60825230fa6F355fF11409df5c" as const,
      isolated: undefined,
    },
    // eth
    ["0x2170ed0880ac9a755fd29b2688956bd959f933f8" as const]: {
      core: "0xf508fCD89b8bd15579dc79A6827cB4686A3592c8" as const,
      isolated: undefined,
    },
    // xvs
    ["0xcf6bb5389c92bdda8a3747ddb454cb7a64626c63" as const]: {
      core: "0x151B1e2635A717bcDc836ECd6FbB62B674FE3E1D" as const,
      isolated: undefined,
    },
    // usdc
    ["0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d" as const]: {
      core: "0xecA88125a5ADbe82614ffC12D0DB554E2e2867C8" as const,
      isolated: undefined,
    },
    // ada
    ["0x3ee2200efb3400fabb9aacf31297cbdd1d435d47" as const]: {
      core: "0x9A0AF7FDb2065Ce470D72664DE73cAE409dA28Ec" as const,
      isolated: undefined,
    },
    // fdusd
    ["0xc5f0f7b66764f6ec8c8dff7ba683102295e16409" as const]: {
      core: "0xC4eF4229FEc74Ccfe17B2bdeF7715fAC740BA0ba" as const,
      isolated: undefined,
    },
    // link
    ["0xf8a0bf9cf54bb92f17374d9e9a321e6a111a51bd" as const]: {
      core: "0x650b940a1033B8A1b1873f78730FcFC73ec11f1f" as const,
      isolated: undefined,
    },
    // xrp
    ["0x1d2f0da169ceb9fc7b3144628db156f3f6c60dbe" as const]: {
      core: "0xB248a295732e0225acd3337607cc01068e3b9c10" as const,
      isolated: undefined,
    },
    // ltc
    ["0x4338665cbb7b2485a8855a139b75d5e34ab0db94" as const]: {
      core: "0x57A5297F2cB2c0AaC9D554660acd6D385Ab50c6B" as const,
      isolated: undefined,
    },
    // matic
    ["0xcc42724c6683b7e57334c4e856f4c9965ed682bd" as const]: {
      core: "0x5c9476FcD6a4F9a3654139721c949c2233bBbBc8" as const,
      isolated: undefined,
    },
    // doge
    ["0xba2ae424d960c26247dd6c32edc70b295c744c43" as const]: {
      core: "0xec3422Ef92B2fb59e84c8B02Ba73F1fE84Ed8D71" as const,
      isolated: undefined,
    },
    // sxp
    ["0x47bead2563dcbf3bf2c9407fea4dc236faba485a" as const]: {
      core: "0x2fF3d0F6990a40261c66E1ff2017aCBc282EB6d0" as const,
      isolated: undefined,
    },
    // dot
    ["0x7083609fce4d1d8dc0c979aab8c869ea2c873402" as const]: {
      core: "0x1610bc33319e9398de5f57B33a5b184c806aD217" as const,
      isolated: undefined,
    },
    // fil
    ["0x0d8ce2a99bb6e3b7db580ed848240e4a0f9ae153" as const]: {
      core: "0xf91d58b5aE142DAcC749f58A49FCBac340Cb0343" as const,
      isolated: undefined,
    },
    // busd
    ["0xe9e7cea3dedca5984780bafc599bd69add087d56" as const]: {
      core: "0x95c78222B3D6e262426483D42CfA53685A67Ab9D" as const,
      isolated: undefined,
    },
    // dai
    ["0x1af3f329e8be154074d8769d1ffa4ee058b1dbc3" as const]: {
      core: "0x334b3eCB4DCa3593BCCC3c7EBD1A1C1d1780FBF1" as const,
      isolated: undefined,
    },
    // bch
    ["0x8ff795a6f4d97e7887c79bea79aba5cc76444adf" as const]: {
      core: "0x5F0388EBc2B94FA8E123F404b79cCF5f40b29176" as const,
      isolated: undefined,
    },
    // beth
    ["0x250632378e573c6be1ac2f97fcdf00515d0aa91b" as const]: {
      core: "0x972207A639CC1B374B893cc33Fa251b55CEB7c07" as const,
      isolated: undefined,
    },
    // uni
    ["0xbf5140a22578168fd562dccf235e5d43a02ce9b1" as const]: {
      core: "0x27FF564707786720C71A2e5c1490A63266683612" as const,
      isolated: undefined,
    },
    // aave
    ["0xfb6115445bff7b52feb98650c87f44907e58f802" as const]: {
      core: "0x26DA28954763B92139ED49283625ceCAf52C6f94" as const,
      isolated: undefined,
    },
    // trx
    ["0xce7de646e7208a4ef112cb6ed5038fa6cc6b12e3" as const]: {
      core: "0xC5D3466aA484B040eE977073fcF337f2c00071c1" as const,
      isolated: [["0x23b4404E4E5eC5FF5a6FFb70B7d14E3FabF237B0", "0x836beb2cB723C498136e1119248436A645845F4E"]] as [
        Address,
        Address,
      ][],
    },
    // trxold
    ["0x85eac5ac2f758618dfa09bdbe0cf174e7d574d5b" as const]: {
      core: "0x61eDcFe8Dd6bA3c891CB9bEc2dc7657B3B422E93" as const,
      isolated: undefined,
    },
    // tusd
    ["0x40af3827f39d0eacbf4a168f8d4ee67c121d11c9" as const]: {
      core: "0xBf762cd5991cA1DCdDaC9ae5C638F5B5Dc3Bee6E" as const,
      isolated: undefined,
    },
    // tusdold
    ["0x14016e85a25aeb13065688cafb43044c2ef86784" as const]: {
      core: "0x08CEB3F4a7ed3500cA0982bcd0FC7816688084c3" as const,
      isolated: undefined,
    },
    // luna
    ["0x156ab3346823b651294766e23e6cf87254d68962" as const]: {
      core: "0xb91A659E88B51474767CD97EF3196A3e7cEDD2c8" as const,
      isolated: undefined,
    },
    // ust
    ["0x3d4350cd54aef9f9b2c29435e0fa809957b3f30a" as const]: {
      core: "0x78366446547D062f45b4C0f320cDaa6d710D87bb" as const,
      isolated: undefined,
    },
    // floki
    ["0xfb5b838b6cfeedc2873ab27866079ac55363d37e" as const]: {
      core: undefined,
      isolated: [["0x1b43ea8622e76627B81665B1eCeBB4867566B963", "0xc353B7a1E13dDba393B5E120D4169Da7185aA2cb"]] as [
        Address,
        Address,
      ][],
    },
    // raca
    ["0x12bb890508c125661e03b09ec06e404bc9289040" as const]: {
      core: undefined,
      isolated: [["0x1b43ea8622e76627B81665B1eCeBB4867566B963", "0xE5FE5527A5b76C75eedE77FdFA6B80D52444A465"]] as [
        Address,
        Address,
      ][],
    },
    // usdd
    ["0xd17479997f34dd9156deef8f95a52d81d265be9c" as const]: {
      core: undefined,
      isolated: [
        ["0x1b43ea8622e76627B81665B1eCeBB4867566B963", "0x9f2FD23bd0A5E08C5f2b9DD6CF9C96Bfb5fA515C"],
        ["0x3344417c9360b963ca93A4e8305361AEde340Ab9", "0xA615467caE6B9E0bb98BC04B4411d9296fd1dFa0"],
        ["0x23b4404E4E5eC5FF5a6FFb70B7d14E3FabF237B0", "0xf1da185CCe5BeD1BeBbb3007Ef738Ea4224025F7"],
        ["0x94c1495cD4c557f1560Cbd68EAB0d197e6291571", "0xc3a45ad8812189cAb659aD99E64B1376f6aCD035"],
      ] as [Address, Address][],
    },
    // twt
    ["0x4b0f1812e5df2a09796481ff14017e6005508003" as const]: {
      core: undefined,
      isolated: [["0x3344417c9360b963ca93A4e8305361AEde340Ab9", "0x736bf1D21A28b5DC19A1aC8cA71Fc2856C23c03F"]] as [
        Address,
        Address,
      ][],
    },
    // planet
    ["0xca6d678e74f553f0e59cccc03ae644a3c2c5ee7d" as const]: {
      core: undefined,
      isolated: [["0x3344417c9360b963ca93A4e8305361AEde340Ab9", "0xFf1112ba7f88a53D4D23ED4e14A117A2aE17C6be"]] as [
        Address,
        Address,
      ][],
    },
    // bsw
    ["0x965f527d9159dce6288a2219db51fc6eef120dd1" as const]: {
      core: undefined,
      isolated: [["0x3344417c9360b963ca93A4e8305361AEde340Ab9", "0x8f657dFD3a1354DEB4545765fE6840cc54AFd379"]] as [
        Address,
        Address,
      ][],
    },
    // alpaca
    ["0x8f0528ce5ef7b51152a59745befdd91d97091d2f" as const]: {
      core: undefined,
      isolated: [["0x3344417c9360b963ca93A4e8305361AEde340Ab9", "0x02c5Fb0F26761093D297165e902e96D08576D344"]] as [
        Address,
        Address,
      ][],
    },
    // ankr
    ["0xf307910a4c7bbc79691fd374889b36d8531b08e3" as const]: {
      core: undefined,
      isolated: [["0x3344417c9360b963ca93A4e8305361AEde340Ab9", "0x19CE11C8817a1828D1d357DFBF62dCf5b0B2A362"]] as [
        Address,
        Address,
      ][],
    },
    // ankrbnb
    ["0x52f24a5e03aee338da5fd9df68d2b6fae1178827" as const]: {
      core: undefined,
      isolated: [
        ["0x3344417c9360b963ca93A4e8305361AEde340Ab9", "0x53728FD51060a85ac41974C6C3Eb1DaE42776723"],
        ["0xd933909A4a2b7A4638903028f44D1d38ce27c352", "0xBfe25459BA784e70E2D7a718Be99a1f3521cA17f"],
      ] as [Address, Address][],
    },
    // bnbx
    ["0x1bdd3cf7f79cfb8edbb955f20ad99211551ba275" as const]: {
      core: undefined,
      isolated: [["0xd933909A4a2b7A4638903028f44D1d38ce27c352", "0x5E21bF67a6af41c74C1773E4b473ca5ce8fd3791"]] as [
        Address,
        Address,
      ][],
    },
    // wbnb
    ["0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c" as const]: {
      core: undefined,
      isolated: [["0xd933909A4a2b7A4638903028f44D1d38ce27c352", "0xe10E80B7FD3a29fE46E16C30CC8F4dd938B742e2"]] as [
        Address,
        Address,
      ][],
    },
    // stkbnb
    ["0xc2e9d07f66a89c44062459a47a0d2dc038e4fb16" as const]: {
      core: undefined,
      isolated: [["0xd933909A4a2b7A4638903028f44D1d38ce27c352", "0xcc5D9e502574cda17215E70bC0B4546663785227"]] as [
        Address,
        Address,
      ][],
    },
    // slisBNB
    ["0xb0b84d294e0c75a6abe60171b70edeb2efd14a1b" as const]: {
      core: undefined,
      isolated: [["0xd933909A4a2b7A4638903028f44D1d38ce27c352", "0xd3CC9d8f3689B83c91b7B59cAB4946B063EB894A"]] as [
        Address,
        Address,
      ][],
    },
    // btt
    ["0x352cb5e19b12fc216548a2677bd0fce83bae434b" as const]: {
      core: undefined,
      isolated: [["0x23b4404E4E5eC5FF5a6FFb70B7d14E3FabF237B0", "0x49c26e12959345472E2Fd95E5f79F8381058d3Ee"]] as [
        Address,
        Address,
      ][],
    },
    // win
    ["0xaef0d72a118ce24fee3cd1d43d383897d05b4e99" as const]: {
      core: undefined,
      isolated: [["0x23b4404E4E5eC5FF5a6FFb70B7d14E3FabF237B0", "0xb114cfA615c828D88021a41bFc524B800E64a9D5"]] as [
        Address,
        Address,
      ][],
    },
    // agEUR
    ["0x12f31b73d812c6bb0d735a218c086d44d5fe5f89" as const]: {
      core: undefined,
      isolated: [["0x94c1495cD4c557f1560Cbd68EAB0d197e6291571", "0x795DE779Be00Ea46eA97a28BDD38d9ED570BCF0F"]] as [
        Address,
        Address,
      ][],
    },
    // lisUSD
    ["0x0782b6d8c4551b9760e74c0545a9bcd90bdc41e5" as const]: {
      core: undefined,
      isolated: [["0x94c1495cD4c557f1560Cbd68EAB0d197e6291571", "0xCa2D81AA7C09A1a025De797600A7081146dceEd9"]] as [
        Address,
        Address,
      ][],
    },
  },
}[network];

export default addresses[network];
