# Token Converter Bot

The Token Converter Bot uses the [ConverterOperator](../smart-contracts/contracts/operators/TokenConverterOperator.sol) to perform swaps using the Venus TokenConverter contracts.

## Setup

**Installation**

```bash
yarn add @venusprotocol/token-converter-bot
```

You will also need to copy the .env.example file and add the appropriate values for the RPC and private key variables.

## Guide

Start by querying available conversions by asset to send to the converter (assetIn), asset to receive from the converter (assetOut) or the converter you'd like to interact with. `TokenConverter.queryConversions` also takes a `releaseFunds: boolean` which will query using converter balances after releasing funds.

```js
const potentialConversions = await tokenConverter.queryConversions({ assetIn, assetOut, converters, releaseFunds });
```

If you queried for conversions assuming the release of funds you'll want to release those funds before attempting conversions to ensure the converter balance is as you expect. An advanced version would be to check the amount you want to convert over the current balance and the balance after released to decide if you need to release the funds or not.

```js
await tokenConverter.releaseFundsForConversions(potentialConversions);
```

Once you have the possible conversions, you can query for details on the flash swap required to execute conversion using `TokenConverter.prepareConversion`. Based on the amount you want to receive from the converter it will return a pancakeSwap trade, an updated amount out and a min income required for the trade (the difference between the amount you will receive from the converter and the amount that will be send to pancake swap).

```js
const { trade, amount, minIncome } = await tokenConverter.prepareConversion(
  tokenConverter,
  assetOutAddress,
  assetInAddress,
  amountOut,
);
```

Using these values you can call arbitrage which will simulate the transaction and if successful execute it.

```js
await tokenConverter.arbitrage(tokenConverter, trade, amount, minIncome);
```

## Example

You can run a working example using the [Venus Keeper Bot CLI ](../cli/README.md).
