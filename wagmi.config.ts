import { defineConfig } from '@wagmi/cli'
import { hardhat } from '@wagmi/cli/plugins'
import poolLensArtifact from '@venusprotocol/isolated-pools/artifacts/contracts/Lens/PoolLens.sol/PoolLens.json' assert { type: "json"};
import diamondComptrollerArtifact from '@venusprotocol/venus-protocol/artifacts/contracts/Comptroller/Diamond/DiamondConsolidated.sol/DiamondConsolidated.json' assert { type: "json"};
import ilComptrollerArtifact from '@venusprotocol/isolated-pools/artifacts/contracts/Comptroller.sol/Comptroller.json' assert { type: "json"};
import coreVTokenArtifact from '@venusprotocol/venus-protocol/artifacts/contracts/Tokens/VTokens/VBep20Delegate.sol/VBep20Delegate.json' assert { type: "json"};
import protocolShareReserveArtifact from '@venusprotocol/protocol-reserve/artifacts/contracts/ProtocolReserve/ProtocolShareReserve.sol/ProtocolShareReserve.json' assert { type: "json"};
import vBnbAdminArtifact from '@venusprotocol/venus-protocol/artifacts/contracts/Admin/VBNBAdmin.sol/VBNBAdmin.json' assert { type: "json"};
import vBNB from '@venusprotocol/venus-protocol/artifacts/contracts/Admin/VBNBAdminStorage.sol/VTokenInterface.json' assert { type: "json"};


const getExternalContracts = async (): Promise<any> => [
  {
    abi: poolLensArtifact.abi,
    name: 'PoolLens'
  },
  {
    abi: diamondComptrollerArtifact.abi,
    name: 'CoreComptroller'
  },
  {
    abi: ilComptrollerArtifact.abi,
    name: 'IlComptroller'
  },
  {
    abi: coreVTokenArtifact.abi,
    name: 'CoreVToken'
  },
  {
    abi: protocolShareReserveArtifact.abi,
    name: 'ProtocolShareReserve'
  },
  {
    abi: vBnbAdminArtifact.abi,
    name: 'VBnbAdmin'
  },
  {
    abi: vBNB.abi,
    name: 'vBNB'
  }
]

export default defineConfig(async () => {
  const externalContracts = await getExternalContracts()
  return {
    out: 'src/config/abis/generated.ts',
    contracts: externalContracts,
    plugins: [
      hardhat({
        project: '.',
      }),
    ],
  }
})
