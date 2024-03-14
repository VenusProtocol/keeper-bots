// import { Address } from "viem";
import TokenConverter from "./TokenConverter";
import readTokenConvertersTokenBalances from "./queries/read/readTokenConvertersTokenBalances";
jest.mock('./queries/read/readTokenConvertersTokenBalances')

describe("Token Converter", () => {
  test("should filter out opportunities where converter has no asset out balance", async () => {
    const subscriberMock = jest.fn();
    const tokenConverter = new TokenConverter({ subscriber: subscriberMock, verbose: false, simulate: true });
    (readTokenConvertersTokenBalances as jest.Mock).mockImplementationOnce(() => ({
      results: [{
        tokenConverter: '0xd5b9ae835f4c59272032b3b954417179573331e0',
        assetIn: '0xcf6bb5389c92bdda8a3747ddb454cb7a64626c63',
        assetOut: { address: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c', balance: 0n },
        assetOutVTokens: {
          core: undefined,
          isolated: undefined,
        },
        accountBalanceAssetOut: 1000000000000000000n,
      }], blockNumber: 100n
    }))

    const trades = await tokenConverter.checkForTrades([{
      tokenConverter: '0xd5b9ae835f4c59272032b3b954417179573331e0',
      tokenAddressOut: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
      tokenAddressIn: '0xcf6bb5389c92bdda8a3747ddb454cb7a64626c63'
    }]);
    expect(trades.length).toBe(0)
  });

  test("should return opportunities where converter has asset out balance", async () => {
    const subscriberMock = jest.fn();
    const tokenConverter = new TokenConverter({ subscriber: subscriberMock, verbose: false, simulate: true });
    (readTokenConvertersTokenBalances as jest.Mock).mockImplementationOnce(() => ({
      results: [{
        tokenConverter: '0xd5b9ae835f4c59272032b3b954417179573331e0',
        assetIn: '0xcf6bb5389c92bdda8a3747ddb454cb7a64626c63',
        assetOut: { address: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c', balance: 1000000000000000000n },
        assetOutVTokens: {
          core: undefined,
          isolated: undefined,
        },
        accountBalanceAssetOut: 1000000000000000000n,
      }], blockNumber: 100n
    }))

    const trades = await tokenConverter.checkForTrades([{
      tokenConverter: '0xd5b9ae835f4c59272032b3b954417179573331e0',
      tokenAddressOut: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
      tokenAddressIn: '0xcf6bb5389c92bdda8a3747ddb454cb7a64626c63'
    }]);
    expect(trades.length).toBe(1)
  });
});
