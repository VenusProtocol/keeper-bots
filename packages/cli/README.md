# Venus Keeper Bots CLI

The Venus Keeper Bots CLI is a easy way to run tasks and interact with keeper bots from the command line.

Each command has a help flag for more details

```
$ venus convert --help
```

## Install

```bash
$ yarn install --global @venusprotocol/cli
```

### Token Conversion Commands

Commands form managing token conversions using the Venus Token Converters.

#### Convert

The `convert` command can be used to to query and execute token conversions with parameters to manage the cost and size of the conversions.

```
Usage
  $ venus convert [options]

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

#### Release Funds

Command for releasing funds from markets and bnb admin which are then distributed per defined schema, which includes a percentage sent to the token converters.

```
Usage: venus release-funds [options]

Options:
  --simulate            Simulate transactions (default: false)
  --verbose             Verbose logging (default: false)
  --accrue-interest     Accrue Interest (default: false)
  --no-reduce-reserves  Reduce BNB Reserves
  -d, --debug           Add debug logging (default: false)
  -h, --help            Show help
```

## Environment variables

Environment variables are read by default from a `.venus/.env` file in the current user's home directory. If you want to use a different location for the .env file you can specify a path with the `VENUS_ENV_PATH` environment variable.

An example of required variables is defined in `.env.example`. For convenience, they can be set using the config command

```
venus config set NETWORK bsctestnet
```
