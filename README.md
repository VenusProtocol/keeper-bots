# Keeper bots for Venus Protocol

Keeper bots are intended to perform regular permissionless tasks like liquidations, token converter arbitrage, shortfall auctions, VAI arbitrage.

The repository contains a combination of contracts and scripts. Contracts are implemented and tested using the established Venus toolset – ethers v5, hardhat, solidity v0.8.13. Scripts, in turn, use viem to interact with the smart contracts.

## Prerequisites

- NodeJS - 18.x
- Solc - v0.8.13 (https://github.com/ethereum/solidity/releases/tag/v0.8.13)

## Linting and code formatting

Linting is done using eslint for typescript and solhint for solidity. Prettier is used to format solidity and typescript files.

To check linting and formatting on all files run:

```
$ yarn lint
```

Linting command can be run with the fix flag to fix eligible errors automatically

```
$ yarn lint:sol --fix
$ yarn lint:ts --fix
```

To pretty all files run:

```
$ yarn prettier
```

## Testing the contracts

```
yarn test
```

To run fork tests add FORK=true, FORKED_NETWORK and one ARCHIVE_NODE var in the .env file, then run

```
yarn hardhat test fork-tests/index.ts
```
