import { Percent } from "@pancakeswap/sdk";
import { SmartRouter } from "@pancakeswap/smart-router/evm";
import { erc20Abi } from "viem";

import { mockRoute, mockTrade, mockUniswapRoute } from "../__mocks__";
import {
  coreVTokenAbi,
  protocolShareReserveAbi,
  tokenConverterOperatorAbi,
  vBnbAdminAbi,
} from "../config/abis/generated";
import { PancakeSwapProvider, UniswapProvider } from "../providers";
import TokenConverter from "./TokenConverter";
import readTokenConvertersTokenBalances, { BalanceResult } from "./queries/getTokenConvertersTokenBalances";

jest.mock("@pancakeswap/smart-router/evm");
jest.mock("./queries/getTokenConvertersTokenBalances");
jest.mock("../subgraph-client");
jest.mock("../config/clients/walletClient");
jest.mock("../config/clients/publicClient");

const addresses = {
  usdcHolder: "0x2Ce1d0ffD7E869D9DF33e28552b12DdDed326706" as const,
  usdtHolder: "0x2Ce1d0ffD7E869D9DF33e28552b12DdDed326706" as const,
  USDTPrimeConverter: "0xf1FA230D25fC5D6CAfe87C5A6F9e1B17Bc6F194E" as const,
  USDCPrimeConverter: "0x2ecEdE6989d8646c992344fF6C97c72a3f811A13" as const,
  vUSDT: "0xfD5840Cd36d94D7229439859C0112a4185BC0255" as const,
  vBNBCore: "0x95c78222B3D6e262426483D42CfA53685A67Ab9D" as const,
  vBNBIL: "0xe10E80B7FD3a29fE46E16C30CC8F4dd938B742e2" as const,
  vUSDC: "0xecA88125a5ADbe82614ffC12D0DB554E2e2867C8" as const,
  BUSD: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56" as const,
  WBNB: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c" as const,
  USDT: "0x55d398326f99059fF775485246999027B3197955" as const,
  USDC: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d" as const,
  coreComptroller: "0xfD36E2c2a6789Db23113685031d7F16329158384" as const,
  stableCoinComptroller: "0x10b57706AD2345e590c2eA4DC02faef0d9f5b08B" as const,
  protocolShareReserve: "0xCa01D5A9A248a830E9D93231e791B1afFed7c446" as const,
  VBNBAdmin: "0x9A7890534d9d91d473F28cB97962d176e2B65f1d" as const,
  tokenConverterOperator: "0xa0EC2A2489D57CD8385A565F38168cC539586B07" as const,
};

const createTokenConverterInstance = ({ simulate = false }: { simulate: boolean } = { simulate: false }) => {
  const subscriberMock = jest.fn();
  const pancakeSwapProvider = new PancakeSwapProvider({ subscriber: subscriberMock });
  (pancakeSwapProvider.publicClient.multicall as jest.Mock).mockImplementation(() => [
    { result: 18 },
    { result: "USDT" },
  ]);
  (pancakeSwapProvider.publicClient.simulateContract as jest.Mock).mockImplementation(() => ({
    result: [1000000000000000000n, 1000000000000000000n],
  }));
  const tokenConverter = new TokenConverter({
    subscriber: subscriberMock,
    simulate,
    swapProvider: PancakeSwapProvider,
  });
  return { tokenConverter, pancakeSwapProvider, subscriberMock };
};

describe("Token Converter", () => {
  beforeEach(() => {
    (SmartRouter.getPriceImpact as jest.Mock).mockImplementation(() => new Percent(2n, 1000n));
    (SmartRouter.getBestTrade as jest.Mock).mockImplementation(() => mockRoute);
  });

  describe("getBestTrade", () => {
    test("should throw error if not trade found", async () => {
      const { tokenConverter } = createTokenConverterInstance();
      (tokenConverter.publicClient.multicall as jest.Mock).mockImplementation(() => [
        { result: 18 },
        { result: "USDT" },
      ]);
      (tokenConverter.publicClient.simulateContract as jest.Mock).mockImplementation(() => ({
        result: [1000000000000000000n, 1000000000000000000n],
      }));

      (SmartRouter.getBestTrade as jest.Mock).mockImplementationOnce(() => null);

      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      expect(
        tokenConverter.getBestTrade(
          addresses.USDCPrimeConverter,
          addresses.WBNB,
          addresses.USDC,
          1000000000000000000000n,
        ),
      ).rejects.toThrow("No trade found");
    });

    test("should handle thrown error", async () => {
      const { tokenConverter } = createTokenConverterInstance();
      (tokenConverter.publicClient.multicall as jest.Mock).mockImplementation(() => [
        { result: 18 },
        { result: "USDT" },
      ]);
      (tokenConverter.publicClient.simulateContract as jest.Mock).mockImplementation(() => ({
        result: [1000000000000000000n, 1000000000000000000n],
      }));

      (SmartRouter.getBestTrade as jest.Mock).mockImplementationOnce(() => {
        throw new Error("Cannot find a valid swap route");
      });
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      expect(
        tokenConverter.getBestTrade(
          addresses.USDCPrimeConverter,
          addresses.WBNB,
          addresses.USDC,
          1000000000000000000000n,
        ),
      ).rejects.toThrow("Error getting best trade - Cannot find a valid swap route");
    });

    test("should return trade with low price impact", async () => {
      const { tokenConverter } = createTokenConverterInstance();
      (tokenConverter.publicClient.multicall as jest.Mock).mockImplementation(() => [
        { result: 18 },
        { result: "USDT" },
      ]);
      (tokenConverter.publicClient.simulateContract as jest.Mock).mockImplementation(() => ({
        result: [1000000000000000000n, 1000000000000000000n],
      }));
      const [trade] = await tokenConverter.getBestTrade(
        addresses.USDCPrimeConverter,
        addresses.WBNB,
        addresses.USDC,
        1000000000000000000000n,
      );

      expect(trade.inputToken).toEqual({
        address: "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
        amount: {
          currency: {
            address: "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
            chainId: 56,
            decimals: 18,
            isNative: false,
            isToken: true,
            name: undefined,
            projectLink: undefined,
            symbol: "WBNB",
          },
          decimalScale: 1000000000000000000n,
          denominator: 1n,
          numerator: 8904975230019520420n,
        },
      });
      expect(trade.outputToken).toEqual({
        address: "0xcf6bb5389c92bdda8a3747ddb454cb7a64626c63",
        amount: {
          currency: {
            address: "0xcf6bb5389c92bdda8a3747ddb454cb7a64626c63",
            chainId: 56,
            decimals: 18,
            isNative: false,
            isToken: true,
            name: undefined,
            projectLink: undefined,
            symbol: "XVS",
          },
          decimalScale: 1000000000000000000n,
          denominator: 1n,
          numerator: 517926942058379677423n,
        },
      });
      expect(trade.path).toEqual(
        "0xcf6bb5389c92bdda8a3747ddb454cb7a64626c630009c4bb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
      );
    });

    test("should call getBestTrade again if price impact is high with lower amount", async () => {
      const { tokenConverter, subscriberMock, pancakeSwapProvider } = createTokenConverterInstance();
      (tokenConverter.publicClient.multicall as jest.Mock).mockImplementation(() => [
        { result: 18 },
        { result: "USDT" },
      ]);
      (tokenConverter.publicClient.simulateContract as jest.Mock).mockImplementation(() => ({
        result: [1000000000000000000n, 1000000000000000000n],
      }));

      const pancakeSwapProviderMock = jest
        .spyOn(PancakeSwapProvider.prototype, "getBestTrade")
        .mockImplementationOnce(pancakeSwapProvider.getBestTrade);

      let called = false;
      (SmartRouter.getPriceImpact as jest.Mock).mockImplementationOnce(() => {
        if (called) {
          return new Percent(2n, 10000n);
        }
        called = true;
        return new Percent(9n, 1000n);
      });

      const [trade] = await pancakeSwapProvider.getBestTrade(
        addresses.USDCPrimeConverter,
        addresses.WBNB,
        addresses.USDC,
        1000000000000000000000n,
      );

      expect(trade.inputToken).toEqual({
        address: "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
        amount: {
          currency: {
            address: "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
            chainId: 56,
            decimals: 18,
            isNative: false,
            isToken: true,
            name: undefined,
            projectLink: undefined,
            symbol: "WBNB",
          },
          decimalScale: 1000000000000000000n,
          denominator: 1n,
          numerator: 8904975230019520420n,
        },
      });
      expect(trade.outputToken).toEqual({
        address: "0xcf6bb5389c92bdda8a3747ddb454cb7a64626c63",
        amount: {
          currency: {
            address: "0xcf6bb5389c92bdda8a3747ddb454cb7a64626c63",
            chainId: 56,
            decimals: 18,
            isNative: false,
            isToken: true,
            name: undefined,
            projectLink: undefined,
            symbol: "XVS",
          },
          decimalScale: 1000000000000000000n,
          denominator: 1n,
          numerator: 517926942058379677423n,
        },
      });
      expect(trade.path).toEqual(
        "0xcf6bb5389c92bdda8a3747ddb454cb7a64626c630009c4bb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
      );

      expect(pancakeSwapProviderMock).toHaveBeenNthCalledWith(
        3,
        addresses.USDCPrimeConverter,
        addresses.WBNB,
        addresses.USDC,
        750000000000000000n,
      );
      expect(subscriberMock).toHaveBeenCalledWith({
        type: "GetBestTrade",
        trx: undefined,
        error: "High price impact",
        blockNumber: undefined,
        context: {
          converter: "0x2ecEdE6989d8646c992344fF6C97c72a3f811A13",
          tokenToReceiveFromConverter: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
          tokenToSendToConverter: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
          priceImpact: "0.90",
        },
      });
    });
  });

  describe("encodeExactInputPath - PancakeSwapProvider", () => {
    const { pancakeSwapProvider } = createTokenConverterInstance();

    expect(pancakeSwapProvider.encodeExactInputPath(mockRoute.routes[0])).toEqual(
      "0xcf6bb5389c92bdda8a3747ddb454cb7a64626c630009c4bb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
    );
  });

  describe("encodeExactInputPath - UniswapProvider", () => {
    const subscriberMock = jest.fn();
    const uniswapProvider = new UniswapProvider({ subscriber: subscriberMock });

    expect(uniswapProvider.encodeExactInputPath(mockUniswapRoute.trade.routes[0])).toEqual(
      "0xcf6bb5389c92bdda8a3747ddb454cb7a64626c630001f4bb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
    );
  });

  describe("accrueInterest", () => {
    test("should successfully simulate accrue interest", async () => {
      const { tokenConverter, subscriberMock } = createTokenConverterInstance({ simulate: true });

      await tokenConverter.accrueInterest([
        { vTokenAddress: addresses.vUSDT, underlyingAddress: addresses.USDT },
        { vTokenAddress: addresses.vUSDC, underlyingAddress: addresses.USDC },
      ]);

      expect(tokenConverter.publicClient.simulateContract).toHaveBeenNthCalledWith(1, {
        account: tokenConverter.walletClient.account.address,
        address: addresses.vUSDT,
        abi: coreVTokenAbi,
        functionName: "accrueInterest",
      });

      expect(tokenConverter.publicClient.simulateContract).toHaveBeenNthCalledWith(2, {
        account: tokenConverter.walletClient.account.address,
        address: addresses.vUSDC,
        abi: coreVTokenAbi,
        functionName: "accrueInterest",
      });

      expect(subscriberMock).toHaveBeenCalledWith({
        type: "AccrueInterest",
        trx: undefined,
        error: [],
        blockNumber: undefined,
        context: undefined,
      });
    });

    test("should successfully accrue interest", async () => {
      const { tokenConverter, subscriberMock } = createTokenConverterInstance();

      await tokenConverter.accrueInterest([
        { vTokenAddress: addresses.vUSDT, underlyingAddress: addresses.USDT },
        { vTokenAddress: addresses.vUSDC, underlyingAddress: addresses.USDC },
      ]);

      expect(tokenConverter.walletClient.writeContract).toHaveBeenNthCalledWith(1, {
        address: addresses.vUSDT,
        abi: coreVTokenAbi,
        functionName: "accrueInterest",
      });

      expect(tokenConverter.walletClient.writeContract).toHaveBeenNthCalledWith(2, {
        address: addresses.vUSDC,
        abi: coreVTokenAbi,
        functionName: "accrueInterest",
      });

      expect(subscriberMock).toHaveBeenCalledWith({
        type: "AccrueInterest",
        trx: undefined,
        error: [],
        blockNumber: undefined,
        context: undefined,
      });
    });

    test("should report error if accrue interest is unsuccessful", async () => {
      const { tokenConverter, subscriberMock } = createTokenConverterInstance();
      (tokenConverter.walletClient.writeContract as jest.Mock).mockImplementationOnce(() => {
        throw new Error("NETWORK ERROR");
      });

      await tokenConverter.accrueInterest([
        { vTokenAddress: addresses.vUSDT, underlyingAddress: addresses.USDT },
        { vTokenAddress: addresses.vUSDC, underlyingAddress: addresses.USDC },
      ]);

      expect(subscriberMock).toHaveBeenCalledWith({
        type: "AccrueInterest",
        trx: undefined,
        error: ["NETWORK ERROR"],
        blockNumber: undefined,
        context: undefined,
      });
    });
  });

  describe("reduceReserves", () => {
    test("should do nothing if there is no cash", async () => {
      const { tokenConverter } = createTokenConverterInstance();
      (tokenConverter.publicClient.readContract as jest.Mock).mockImplementation(args => {
        if (args.functionName === "totalReserves") {
          return 1000000000000000000000n;
        }
        return 0n;
      });

      await tokenConverter.reduceReserves();

      expect(tokenConverter.publicClient.simulateContract).toHaveBeenCalledTimes(0);
    });

    test("should successfully simulate reduce reserves with cash if cash is less than reserves", async () => {
      const { tokenConverter, subscriberMock } = createTokenConverterInstance({ simulate: true });

      const totalReserves = 1000000000000000000000n;
      const cash = 1000000000000000000n;
      (tokenConverter.publicClient.readContract as jest.Mock).mockImplementation(args => {
        if (args.functionName === "totalReserves") {
          return totalReserves;
        }
        return cash;
      });

      await tokenConverter.reduceReserves();

      expect(tokenConverter.publicClient.simulateContract).toHaveBeenNthCalledWith(1, {
        account: tokenConverter.walletClient.account.address,
        address: addresses.VBNBAdmin,
        abi: vBnbAdminAbi,
        functionName: "reduceReserves",
        args: [cash],
      });

      expect(subscriberMock).toHaveBeenCalledWith({
        type: "ReduceReserves",
        trx: undefined,
        error: undefined,
        blockNumber: undefined,
        context: undefined,
      });
    });
    test("should successfully simulate reduce reserves with reserves if cash is greater than reserves", async () => {
      const { tokenConverter } = createTokenConverterInstance({ simulate: true });
      const totalReserves = 1000000000000000000n;
      const cash = 1000000000000000000000n;

      (tokenConverter.publicClient.readContract as jest.Mock).mockImplementation(args => {
        if (args.functionName === "totalReserves") {
          return totalReserves;
        }
        return cash;
      });

      await tokenConverter.reduceReserves();

      expect(tokenConverter.publicClient.simulateContract).toHaveBeenNthCalledWith(1, {
        account: tokenConverter.walletClient.account.address,
        address: addresses.VBNBAdmin,
        abi: vBnbAdminAbi,
        functionName: "reduceReserves",
        args: [totalReserves],
      });
    });

    test("should successfully reduce reserves with cash if cash is less than reserves", async () => {
      const { tokenConverter, subscriberMock } = createTokenConverterInstance();

      const totalReserves = 1000000000000000000000n;
      const cash = 1000000000000000000n;
      (tokenConverter.publicClient.readContract as jest.Mock).mockImplementation(args => {
        if (args.functionName === "totalReserves") {
          return totalReserves;
        }
        return cash;
      });

      await tokenConverter.reduceReserves();

      expect(tokenConverter.walletClient.writeContract).toHaveBeenNthCalledWith(1, {
        address: addresses.VBNBAdmin,
        abi: vBnbAdminAbi,
        functionName: "reduceReserves",
        args: [cash],
      });

      expect(subscriberMock).toHaveBeenCalledWith({
        type: "ReduceReserves",
        trx: "0xtransactionHash",
        error: undefined,
        blockNumber: undefined,
        context: undefined,
      });
    });

    test("should successfully reduce reserves with reserves if cash is greater than reserves", async () => {
      const { tokenConverter, subscriberMock } = createTokenConverterInstance();
      const totalReserves = 1000000000000000000n;
      const cash = 1000000000000000000000n;

      (tokenConverter.publicClient.readContract as jest.Mock).mockImplementation(args => {
        if (args.functionName === "totalReserves") {
          return totalReserves;
        }
        return cash;
      });

      await tokenConverter.reduceReserves();

      expect(tokenConverter.walletClient.writeContract).toHaveBeenNthCalledWith(1, {
        address: addresses.VBNBAdmin,
        abi: vBnbAdminAbi,
        functionName: "reduceReserves",
        args: [totalReserves],
      });

      expect(subscriberMock).toHaveBeenCalledWith({
        type: "ReduceReserves",
        trx: "0xtransactionHash",
        error: undefined,
        blockNumber: undefined,
        context: undefined,
      });
    });

    test("should report error if reduce reserves is unsuccessful", async () => {
      const { tokenConverter, subscriberMock } = createTokenConverterInstance();
      (tokenConverter.walletClient.writeContract as jest.Mock).mockImplementation(() => {
        throw new Error("NETWORK ERROR");
      });

      const totalReserves = 1000000000000000000n;
      const cash = 1000000000000000000000n;

      (tokenConverter.publicClient.readContract as jest.Mock).mockImplementation(args => {
        if (args.functionName === "totalReserves") {
          return totalReserves;
        }
        return cash;
      });

      await tokenConverter.reduceReserves();

      expect(subscriberMock).toHaveBeenCalledWith({
        type: "ReduceReserves",
        trx: undefined,
        error: "NETWORK ERROR",
        blockNumber: undefined,
        context: undefined,
      });
    });
  });

  describe("queryConversions", () => {
    test("should filter out opportunities where converter has no asset out balance", async () => {
      const { tokenConverter } = createTokenConverterInstance();
      (readTokenConvertersTokenBalances as jest.Mock).mockImplementationOnce(() => ({
        results: [
          {
            tokenConverter: "0xd5b9ae835f4c59272032b3b954417179573331e0",
            assetIn: "0xcf6bb5389c92bdda8a3747ddb454cb7a64626c63",
            assetOut: { address: "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c", balance: 0n },
            assetOutVTokens: {
              core: undefined,
              isolated: undefined,
            },
            accountBalanceAssetOut: 1000000000000000000n,
          },
        ],
        blockNumber: 100n,
      }));

      const trades = await tokenConverter.queryConversions({
        converter: "0xd5b9ae835f4c59272032b3b954417179573331e0",
        assetOut: "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
        assetIn: "0xcf6bb5389c92bdda8a3747ddb454cb7a64626c63",
        releaseFunds: false,
      });
      expect(trades.length).toBe(0);
    });

    test("should return opportunities where converter has asset out balance", async () => {
      const { tokenConverter } = createTokenConverterInstance();
      (readTokenConvertersTokenBalances as jest.Mock).mockImplementationOnce(() => ({
        results: [
          {
            tokenConverter: "0xd5b9ae835f4c59272032b3b954417179573331e0",
            assetIn: "0xcf6bb5389c92bdda8a3747ddb454cb7a64626c63",
            assetOut: { address: "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c", balance: 1000000000000000000n },
            assetOutVTokens: {
              core: undefined,
              isolated: undefined,
            },
            accountBalanceAssetOut: 1000000000000000000n,
          },
        ],
        blockNumber: 100n,
      }));

      const trades = await tokenConverter.queryConversions({
        converter: "0xd5b9ae835f4c59272032b3b954417179573331e0",
        assetOut: "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
        assetIn: "0xcf6bb5389c92bdda8a3747ddb454cb7a64626c63",
        releaseFunds: false,
      });
      expect(trades.length).toBe(1);
    });
  });

  describe("releaseFundsForConversions", () => {
    test("should reduce BalanceResults and call releaseFunds with tuple of [comptroller, markets[]]", async () => {
      const tokenConverterMock = jest.spyOn(TokenConverter.prototype, "releaseFunds").mockImplementationOnce(jest.fn());
      const { tokenConverter } = createTokenConverterInstance();
      const balanceResults: BalanceResult[] = [
        {
          tokenConverter: addresses.USDCPrimeConverter,
          assetIn: { address: addresses.USDC, symbol: "USDC", decimals: 18 },
          assetOut: { address: addresses.BUSD, balance: 600000000000000000000n, symbol: "BUSD", decimals: 18 },
          assetOutVTokens: { core: addresses.vBNBCore, isolated: [] },
          accountBalanceAssetOut: 6000000000000000000n,
        },
        {
          tokenConverter: addresses.USDTPrimeConverter,
          assetIn: { address: addresses.USDT, symbol: "USDT", decimals: 18 },
          assetOut: { address: addresses.WBNB, balance: 400000000000000000000n, symbol: "BUSD", decimals: 18 },
          assetOutVTokens: { core: undefined, isolated: [[addresses.stableCoinComptroller, addresses.vBNBIL]] },
          accountBalanceAssetOut: 4000000000000000000n,
        },
      ];
      await tokenConverter.releaseFundsForConversions(balanceResults);

      expect(tokenConverterMock).toHaveBeenCalledWith({
        [addresses.stableCoinComptroller]: [addresses.WBNB],
        [addresses.coreComptroller]: [addresses.BUSD],
      });
    });
  });

  describe("releaseFunds", () => {
    test("should simulate the release of funds ", async () => {
      const { tokenConverter, subscriberMock } = createTokenConverterInstance({ simulate: true });

      await tokenConverter.releaseFunds({
        [addresses.stableCoinComptroller]: [addresses.WBNB],
        [addresses.coreComptroller]: [addresses.BUSD],
      });

      expect(tokenConverter.publicClient.simulateContract).toHaveBeenNthCalledWith(1, {
        account: tokenConverter.walletClient.account.address,
        address: addresses.protocolShareReserve,
        abi: protocolShareReserveAbi,
        functionName: "releaseFunds",
        args: [addresses.stableCoinComptroller, [addresses.WBNB]],
      });
      expect(subscriberMock).toHaveBeenCalledWith({
        type: "ReleaseFunds",
        trx: undefined,
        error: undefined,
        blockNumber: undefined,
        context: [addresses.stableCoinComptroller, [addresses.WBNB]],
      });
    });

    test("should execute the release of funds", async () => {
      const { tokenConverter, subscriberMock } = createTokenConverterInstance();
      await tokenConverter.releaseFunds({
        [addresses.stableCoinComptroller]: [addresses.WBNB],
        [addresses.coreComptroller]: [addresses.BUSD],
      });

      expect(tokenConverter.walletClient.writeContract).toHaveBeenNthCalledWith(1, {
        address: addresses.protocolShareReserve,
        abi: protocolShareReserveAbi,
        functionName: "releaseFunds",
        args: [addresses.stableCoinComptroller, [addresses.WBNB]],
      });

      expect(subscriberMock).toHaveBeenCalledWith({
        type: "ReleaseFunds",
        trx: "0xtransactionHash",
        error: undefined,
        blockNumber: undefined,
        context: [addresses.stableCoinComptroller, [addresses.WBNB]],
      });
    });

    test("should report error", async () => {
      const { tokenConverter, subscriberMock } = createTokenConverterInstance();
      (tokenConverter.walletClient.writeContract as jest.Mock).mockImplementationOnce(() => {
        throw new Error("Failed Transation");
      });

      await tokenConverter.releaseFunds({
        [addresses.stableCoinComptroller]: [addresses.WBNB],
        [addresses.coreComptroller]: [addresses.BUSD],
      });

      expect(tokenConverter.walletClient.writeContract).toHaveBeenNthCalledWith(1, {
        address: addresses.protocolShareReserve,
        abi: protocolShareReserveAbi,
        functionName: "releaseFunds",
        args: [addresses.stableCoinComptroller, [addresses.WBNB]],
      });

      expect(subscriberMock).toHaveBeenCalledWith({
        type: "ReleaseFunds",
        trx: undefined,
        error: "Failed Transation",
        blockNumber: undefined,
        context: [addresses.stableCoinComptroller, [addresses.WBNB]],
      });
    });
  });

  describe("getUsdValue", () => {
    test("should get usd value from addresses", async () => {
      const { tokenConverter } = createTokenConverterInstance();
      (tokenConverter.publicClient.multicall as jest.Mock).mockImplementationOnce(() => [
        { result: 18 },
        { result: { underlyingPrice: 20000000000000000000000000000000000000n } },
      ]);

      expect(await tokenConverter.getUsdValue(addresses.USDC, addresses.vUSDC, 1n)).toEqual({
        underlyingPriceUsd: "20000000000000000000",
        underlyingUsdValue: "20",
        underlyingDecimals: 18,
      });
    });
  });

  describe("checkAndRequestAllowance", () => {
    test("should request approval if needed", async () => {
      const { tokenConverter } = createTokenConverterInstance();
      (tokenConverter.publicClient.readContract as jest.Mock).mockImplementationOnce(() => 0n);

      await tokenConverter.checkAndRequestAllowance(
        addresses.usdcHolder,
        addresses.USDC,
        addresses.USDCPrimeConverter,
        1000000000000000000n,
      );

      expect(tokenConverter.walletClient.writeContract).toHaveBeenNthCalledWith(1, {
        address: addresses.usdcHolder,
        abi: erc20Abi,
        functionName: "approve",
        args: [addresses.tokenConverterOperator, 1000000000000000000n],
      });
    });

    test("should do nothing if already approved", async () => {
      const { tokenConverter } = createTokenConverterInstance();
      (tokenConverter.publicClient.readContract as jest.Mock).mockImplementationOnce(() => 2000000000000000000n);

      await tokenConverter.checkAndRequestAllowance(
        addresses.usdcHolder,
        addresses.USDC,
        addresses.USDCPrimeConverter,
        1000000000000000000n,
      );

      expect(tokenConverter.walletClient.writeContract).toHaveBeenCalledTimes(0);
    });
  });

  describe("arbitrage", () => {
    test("should simulate arbitrage", async () => {
      const { tokenConverter, subscriberMock } = createTokenConverterInstance({ simulate: true });
      (tokenConverter.publicClient.getBlock as jest.Mock).mockImplementation(() => ({ timestamp: 1713214109n }));
      (tokenConverter.publicClient.waitForTransactionReceipt as jest.Mock).mockImplementation(() => ({
        blockNumber: 23486902n,
      }));

      const tokenConverterMock = jest
        .spyOn(TokenConverter.prototype, "checkAndRequestAllowance")
        .mockImplementationOnce(jest.fn());

      await tokenConverter.arbitrage(addresses.USDCPrimeConverter, mockTrade, 1000000000000000000000n, 10000n);

      expect(tokenConverterMock).toHaveBeenCalledTimes(0);

      expect(tokenConverter.publicClient.estimateContractGas).toHaveBeenCalledWith({
        abi: tokenConverterOperatorAbi,
        functionName: "convert" as const,
        account: { address: tokenConverter.walletClient.account.address },
        address: addresses.tokenConverterOperator,
        args: [
          {
            beneficiary: "0x4CCeBa2d7D2B4fdcE4304d3e09a1fea9fbEb1528",
            tokenToReceiveFromConverter: mockTrade.inputToken.address,
            amount: 1000000000000000000000n,
            minIncome: 10000n,
            tokenToSendToConverter: mockTrade.outputToken.address,
            converter: addresses.USDCPrimeConverter,
            path: "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c000cf6bb5389c92bdda8a3747ddb454cb7a64626c63",
            deadline: 1713214169n,
            liquidityProvider: 1,
          },
        ],
      });

      expect(tokenConverter.walletClient.writeContract).toHaveBeenCalledTimes(0);

      expect(subscriberMock).toHaveBeenCalledWith({
        type: "Arbitrage",
        trx: undefined,
        error: undefined,
        blockNumber: undefined,
        context: {
          amount: 1000000000000000000000n,
          beneficiary: "0x4CCeBa2d7D2B4fdcE4304d3e09a1fea9fbEb1528",
          converter: "0x2ecEdE6989d8646c992344fF6C97c72a3f811A13",
          deadline: 1713214169n,
          liquidityProvider: 1,
          minIncome: 10000n,
          path: "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c000cf6bb5389c92bdda8a3747ddb454cb7a64626c63",
          tokenToReceiveFromConverter: "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
          tokenToSendToConverter: "0xcf6bb5389c92bdda8a3747ddb454cb7a64626c63",
        },
      });
    });

    test("should arbitrage and check approvals if minIncome is negative", async () => {
      const { tokenConverter, subscriberMock } = createTokenConverterInstance();
      (tokenConverter.publicClient.getBlock as jest.Mock).mockImplementation(() => ({ timestamp: 1713214109n }));
      (tokenConverter.publicClient.waitForTransactionReceipt as jest.Mock).mockImplementation(() => ({
        blockNumber: 23486902n,
      }));
      const tokenConverterMock = jest
        .spyOn(TokenConverter.prototype, "checkAndRequestAllowance")
        .mockImplementationOnce(jest.fn());

      await tokenConverter.arbitrage(addresses.USDCPrimeConverter, mockTrade, 1000000000000000000000n, -10000n);

      expect(tokenConverterMock).toHaveBeenNthCalledWith(
        1,
        mockRoute.inputAmount.currency.address,
        tokenConverter.walletClient.account.address,
        addresses.tokenConverterOperator,
        10000n,
      );

      expect(tokenConverter.publicClient.estimateContractGas).toHaveBeenCalledWith({
        abi: tokenConverterOperatorAbi,
        functionName: "convert" as const,
        account: { address: tokenConverter.walletClient.account.address },
        address: addresses.tokenConverterOperator,
        args: [
          {
            beneficiary: "0x4CCeBa2d7D2B4fdcE4304d3e09a1fea9fbEb1528",
            tokenToReceiveFromConverter: mockTrade.inputToken.address,
            amount: 1000000000000000000000n,
            minIncome: -10000n,
            tokenToSendToConverter: mockTrade.outputToken.address,
            converter: addresses.USDCPrimeConverter,
            path: "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c000cf6bb5389c92bdda8a3747ddb454cb7a64626c63",
            deadline: 1713214169n,
            liquidityProvider: 1,
          },
        ],
      });

      expect(subscriberMock).toHaveBeenCalledWith({
        type: "Arbitrage",
        trx: "0xtransactionHash",
        error: undefined,
        blockNumber: 23486902n,
        context: {
          amount: 1000000000000000000000n,
          beneficiary: "0x4CCeBa2d7D2B4fdcE4304d3e09a1fea9fbEb1528",
          converter: "0x2ecEdE6989d8646c992344fF6C97c72a3f811A13",
          deadline: 1713214169n,
          liquidityProvider: 1,
          minIncome: -10000n,
          path: "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c000cf6bb5389c92bdda8a3747ddb454cb7a64626c63",
          tokenToReceiveFromConverter: "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
          tokenToSendToConverter: "0xcf6bb5389c92bdda8a3747ddb454cb7a64626c63",
        },
      });
    });

    test("should handle error calling arbitrage", async () => {
      const { tokenConverter, subscriberMock } = createTokenConverterInstance();
      (tokenConverter.publicClient.getBlock as jest.Mock).mockImplementation(() => ({ timestamp: 1713214109n }));
      (tokenConverter.publicClient.waitForTransactionReceipt as jest.Mock).mockImplementation(() => ({
        blockNumber: 23486902n,
      }));
      (tokenConverter.walletClient.writeContract as jest.Mock).mockImplementation(() => {
        throw new Error("NETWORK ERROR");
      });

      (SmartRouter.getBestTrade as jest.Mock).mockImplementation(() => mockRoute);

      await tokenConverter.arbitrage(addresses.USDCPrimeConverter, mockTrade, 1000000000000000000000n, -10000n);

      expect(subscriberMock).toHaveBeenCalledWith({
        type: "Arbitrage",
        trx: undefined,
        error: "Execution: NETWORK ERROR",
        blockNumber: undefined,
        context: {
          amount: 1000000000000000000000n,
          beneficiary: "0x4CCeBa2d7D2B4fdcE4304d3e09a1fea9fbEb1528",
          converter: "0x2ecEdE6989d8646c992344fF6C97c72a3f811A13",
          deadline: 1713214169n,
          liquidityProvider: 1,
          minIncome: -10000n,
          path: "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c000cf6bb5389c92bdda8a3747ddb454cb7a64626c63",
          tokenToReceiveFromConverter: "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
          tokenToSendToConverter: "0xcf6bb5389c92bdda8a3747ddb454cb7a64626c63",
        },
      });
    });
  });

  describe("prepareConversion", () => {
    test("should correctly return conversion arguments", async () => {
      const { tokenConverter, subscriberMock } = createTokenConverterInstance();
      (tokenConverter.publicClient.multicall as jest.Mock).mockImplementation(() => [
        { result: 18 },
        { result: "USDT" },
      ]);
      (tokenConverter.publicClient.simulateContract as jest.Mock).mockImplementation(() => ({
        result: [1000000000000000000n, 1000000000000000000n],
      }));

      const arbitrageArgs = await tokenConverter.prepareConversion(
        addresses.USDCPrimeConverter,
        addresses.WBNB,
        addresses.USDC,
        1000000000000000000000n,
      );

      expect(arbitrageArgs?.amount).toEqual(1000000000000000000n);
      expect(arbitrageArgs?.trade.inputToken).toEqual({
        address: "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
        amount: {
          currency: {
            address: "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
            chainId: 56,
            decimals: 18,
            isNative: false,
            isToken: true,
            name: undefined,
            projectLink: undefined,
            symbol: "WBNB",
          },
          decimalScale: 1000000000000000000n,
          denominator: 1n,
          numerator: 8904975230019520420n,
        },
      });
      expect(arbitrageArgs?.trade.outputToken).toEqual({
        address: "0xcf6bb5389c92bdda8a3747ddb454cb7a64626c63",
        amount: {
          currency: {
            address: "0xcf6bb5389c92bdda8a3747ddb454cb7a64626c63",
            chainId: 56,
            decimals: 18,
            isNative: false,
            isToken: true,
            name: undefined,
            projectLink: undefined,
            symbol: "XVS",
          },
          decimalScale: 1000000000000000000n,
          denominator: 1n,
          numerator: 517926942058379677423n,
        },
      });
      expect(arbitrageArgs?.trade.path).toEqual(
        "0xcf6bb5389c92bdda8a3747ddb454cb7a64626c630009c4bb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
      );
      expect(arbitrageArgs?.minIncome).toEqual(-7904975230019520420n);

      expect(subscriberMock).toHaveBeenCalledWith({
        type: "GetBestTrade",
        trx: undefined,
        error: undefined,
        blockNumber: undefined,
        context: {
          converter: "0x2ecEdE6989d8646c992344fF6C97c72a3f811A13",
          swap: {
            inputToken: {
              amount: "8",
              token: "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
            },
            outputToken: {
              amount: "517",
              token: "0xcf6bb5389c92bdda8a3747ddb454cb7a64626c63",
            },
          },
          tokenToReceiveFromConverter: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
          tokenToSendToConverter: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
          tradeAmount: {
            amountIn: 1000000000000000000n,
            amountOut: 1000000000000000000n,
          },
        },
      });
    });

    test("should handle error calling prepareConversion", async () => {
      const { tokenConverter, subscriberMock } = createTokenConverterInstance();
      (tokenConverter.publicClient.multicall as jest.Mock).mockImplementation(() => [
        { result: 18 },
        { result: "USDT" },
      ]);
      (tokenConverter.publicClient.simulateContract as jest.Mock).mockImplementation(() => ({
        result: [1000000000000000000n, 1000000000000000000n],
      }));

      (SmartRouter.getPriceImpact as jest.Mock).mockImplementation(() => new Percent(2n, 1000n));
      (SmartRouter.getBestTrade as jest.Mock).mockImplementation(() => {
        throw new Error("Unable to find route");
      });

      await tokenConverter.prepareConversion(
        addresses.USDCPrimeConverter,
        addresses.WBNB,
        addresses.USDC,
        1000000000000000000000n,
      );

      expect(subscriberMock).toHaveBeenCalledWith({
        type: "GetBestTrade",
        trx: undefined,
        error: "Error getting best trade - Unable to find route",
        blockNumber: undefined,
        context: {
          converter: "0x2ecEdE6989d8646c992344fF6C97c72a3f811A13",
          tokenToReceiveFromConverter: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
          tokenToSendToConverter: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
        },
      });
    });
  });
});
