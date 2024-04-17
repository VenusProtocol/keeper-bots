# Keeper bots for Venus Protocol

Keeper bots are intended to perform regular permissionless tasks like liquidations, token converter arbitrage, shortfall auctions, VAI arbitrage.

The repository is organized into several packages
- Smart contracts
- CLI
- Token Converter Bot

## Packages

### Smart Contracts
This package contains the operator and related contracts for various keeper bot operations. It follows Venus Protocol Smart Contract best practices.

### CLI
The cli is a convenient way to execute and test keeper bot operations. It can also be used as a reference for building more complex keeper bot strategies.

### Token Converter Bot
The Token Converter Bot package contains code for interacting with the `TokenConverterOperator` and can be used to build complex conversion strategies.


## Linting and code formatting

Linting is done using eslint for typescript and solhint for solidity. Prettier is used to format solidity and typescript files. Linting can be run from the root of the repository with each package extending the base config

To check linting and formatting on all files run:

```
$ yarn lint
```
