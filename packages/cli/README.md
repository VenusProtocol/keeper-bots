# Venus CLI

## Install

```bash
$ yarn install --global @venusprotocol/cli
```

## Venus CLI

The Venus CLI is a easy way to run tasks and interact with the Venus Protocol from the command line.

### Token Converter

```
$ venus --help

  Usage
    $ venus convert

  Options
    --converter Query a specific converter for available assets
	  --assetOut Filter configs by asset you will receive
	  --simulate Simulates contracts calls for testing
	  --verbose Print debugging console logs
	  --releaseFunds Releases funds as part of the conversion
```

## Environment variables

Environment variables are read from a .env file in the directory where the command is run or can be set inline
