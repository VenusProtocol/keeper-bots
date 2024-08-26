const walletClientMock = {
  account: {
    address: "0x4CCeBa2d7D2B4fdcE4304d3e09a1fea9fbEb1528",
  },
  writeContract: jest.fn(() => "0xtransactionHash"),
};

export default walletClientMock;
