# Venus CLI

## Install

```bash
$ yarn install --global @venusprotocol/cli
```

## Venus Keeper Bots CLI

The Venus Keeper Bots CLI is a easy way to run tasks and interact with keeper bots from the command line.

### Token Converter

```
$ venus --help

  Usage
    $ venus convert

  Options
    -c, --converter [converters...]        Token converter address
    --no-profitable                        Require trade be profitable
    -in, --asset-in [asset-in]             Asset In address
    -out, --asset-out [asset-out]          Asset Out address
    -s, --simulate                         Simulate transactions (default: false)
    -d, --debug                            Add debug logging (default: false)
    -rf, --release-funds                   Release funds (default: false)
    -min, --min-trade-usd [min-trade-usd]  Minimum value of tokens to try and convert (default: 500)
    -max, --max-trade-usd [max-trade-usd]  Maximum value of tokens to try and convert (default: 5000)
    -l, --loop                             Continuously query and execute trades (default: false)
    -bp, --min-income-bp [min-income-bp]   Min income in basis points as percentage of amount (default: 50)
```

## Environment variables

Environment variables are read from a .env file in the directory where the command is run or can be set inline
