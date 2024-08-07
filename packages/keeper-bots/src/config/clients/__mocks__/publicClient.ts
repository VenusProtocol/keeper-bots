const getPublicClientMock = () => ({
  simulateContract: jest.fn(),
  readContract: jest.fn(),
  multicall: jest.fn(),
  getBlock: jest.fn(),
  getBlockNumber: jest.fn(),
  waitForTransactionReceipt: jest.fn(),
  estimateContractGas: jest.fn(),
});

export default getPublicClientMock;
