import ilComptrollerArtifact from "@venusprotocol/isolated-pools/artifacts/contracts/Comptroller.sol/Comptroller.json" assert { type: "json" };
import poolLensArtifact from "@venusprotocol/isolated-pools/artifacts/contracts/Lens/PoolLens.sol/PoolLens.json" assert { type: "json" };
import protocolShareReserveArtifact from "@venusprotocol/protocol-reserve/artifacts/contracts/ProtocolReserve/ProtocolShareReserve.sol/ProtocolShareReserve.json" assert { type: "json" };
import tokenConverterArtifact from "@venusprotocol/protocol-reserve/artifacts/contracts/TokenConverter/AbstractTokenConverter.sol/AbstractTokenConverter.json" assert { type: "json" };
import vBnbAdminArtifact from "@venusprotocol/venus-protocol/artifacts/contracts/Admin/VBNBAdmin.sol/VBNBAdmin.json" assert { type: "json" };
import diamondComptrollerArtifact from "@venusprotocol/venus-protocol/artifacts/contracts/Comptroller/Diamond/DiamondConsolidated.sol/DiamondConsolidated.json" assert { type: "json" };
import venusLensArtifact from "@venusprotocol/venus-protocol/artifacts/contracts/Lens/VenusLens.sol/VenusLens.json" assert { type: "json" };
import coreVTokenArtifact from "@venusprotocol/venus-protocol/artifacts/contracts/Tokens/VTokens/VBep20Delegate.sol/VBep20Delegate.json" assert { type: "json" };
import { defineConfig } from "@wagmi/cli";
import { hardhat } from "@wagmi/cli/plugins";
import { Abi } from "abitype";

const getExternalContracts = async (): Promise<{ name: string; abi: Abi }[]> => [
  {
    abi: poolLensArtifact.abi as Abi,
    name: "PoolLens",
  },
  {
    abi: diamondComptrollerArtifact.abi as Abi,
    name: "CoreComptroller",
  },
  {
    abi: ilComptrollerArtifact.abi as Abi,
    name: "IlComptroller",
  },
  {
    abi: coreVTokenArtifact.abi as Abi,
    name: "CoreVToken",
  },
  {
    abi: protocolShareReserveArtifact.abi as Abi,
    name: "ProtocolShareReserve",
  },
  {
    abi: vBnbAdminArtifact.abi as Abi,
    name: "VBnbAdmin",
  },
  {
    abi: tokenConverterArtifact.abi as Abi,
    name: "TokenConverter",
  },
  {
    abi: venusLensArtifact.abi as Abi,
    name: "VenusLens",
  },
];

export default defineConfig(async () => {
  const externalContracts = await getExternalContracts();
  return {
    out: "src/config/abis/generated.ts",
    contracts: externalContracts,
    plugins: [
      hardhat({
        project: "../smart-contracts",
      }),
    ],
  };
});
