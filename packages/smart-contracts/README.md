# Venus Keeper Bot Smart Contracts

Contracts to make it easy for the Venus Community to perform maintenance and community delegated actions. This package implements the Venus Protocol Smart Contract framework and best practices.

## Prerequisites

- NodeJS - 18.x
- Solc - v0.8.13 (https://github.com/ethereum/solidity/releases/tag/v0.8.13)

## Deployments

Deployments are managed using `hardhat-deploy`. Addresses conveniently organized under `deployment/<network>_addresses.json`. You can also find JSON files for contract abis in the [deployments](./deployments/) directory by network.

## Testing the contracts

```
yarn test
```

To run fork tests add FORK=true, FORKED_NETWORK and one ARCHIVE_NODE var in the .env file, then run

```
yarn hardhat test fork-tests/index.ts
```
