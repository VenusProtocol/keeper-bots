import bscmainnetGovernance from "@venusprotocol/governance-contracts/deployments/bscmainnet_addresses.json";
import bsctestnetGovernance from "@venusprotocol/governance-contracts/deployments/bsctestnet_addresses.json";
import bscmainnetProtocolReserve from "@venusprotocol/protocol-reserve/deployments/bscmainnet_addresses.json";
import bsctestnetProtocolReserve from "@venusprotocol/protocol-reserve/deployments/bsctestnet_addresses.json";
import bscmainnetCore from "@venusprotocol/venus-protocol/deployments/bscmainnet_addresses.json";
import bsctestnetCore from "@venusprotocol/venus-protocol/deployments/bsctestnet_addresses.json";

export default {
  bscmainnet: {
    ...bscmainnetCore.addresses,
    ...bscmainnetProtocolReserve.addresses,
    ...bscmainnetGovernance.addresses,
    BUSD: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56",
    USDT: "0x55d398326f99059fF775485246999027B3197955",
    USDC: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
    WBNB: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
    PancakeSwapRouter: "0x13f4EA83D0bd40E75C8222255bc855a974568Dd4",
    MoveDebtDelegate: "0x89621C48EeC04A85AfadFD37d32077e65aFe2226",
    Unitroller: "0xfD36E2c2a6789Db23113685031d7F16329158384",
    NormalTimelock: "0x939bD8d64c0A9583A7Dcea9933f7b21697ab6396",
    vUSDT: "0xfD5840Cd36d94D7229439859C0112a4185BC0255",
    vBUSD: "0x95c78222B3D6e262426483D42CfA53685A67Ab9D",
    vUSDC: "0xecA88125a5ADbe82614ffC12D0DB554E2e2867C8",

    xvsHolder: "0xF977814e90dA44bFA03b6295A0616a897441aceC",
    usdtHolder: "0xF977814e90dA44bFA03b6295A0616a897441aceC",
  },
  bsctestnet: {
    ...bsctestnetCore.addresses,
    ...bsctestnetProtocolReserve.addresses,
    ...bsctestnetGovernance.addresses,
    PancakeSwapRouter: "0x1b81D678ffb9C0263b24A97847620C99d213eB14",
    XVSVaultConverter: "0x258f49254C758a0E37DAb148ADDAEA851F4b02a2",
    xvsHolder: "0x2Ce1d0ffD7E869D9DF33e28552b12DdDed326706",
    usdtHolder: "0x2Ce1d0ffD7E869D9DF33e28552b12DdDed326706",
  },
} as const;
