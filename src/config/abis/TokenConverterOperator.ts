// @kkirka: This is a typescript file and not a JSON file because I wanted to keep
// the narrow type for viem (importing from JSON yields an array of garbage). I guess
// we could generate these files similarly to how it's done in the frontend repo
// (in the postinstall script), but I'd keep this up for discussion for now.

export default [
  {
    inputs: [
      {
        internalType: "contract ISmartRouter",
        name: "swapRouter_",
        type: "address",
      },
    ],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    inputs: [],
    name: "ApproveFailed",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "currentTimestamp",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "deadline",
        type: "uint256",
      },
    ],
    name: "DeadlinePassed",
    type: "error",
  },
  {
    inputs: [],
    name: "EmptySwap",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "expected",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "actual",
        type: "uint256",
      },
    ],
    name: "InsufficientLiquidity",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "expected",
        type: "address",
      },
      {
        internalType: "address",
        name: "actual",
        type: "address",
      },
    ],
    name: "InvalidCallbackSender",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "expected",
        type: "address",
      },
      {
        internalType: "address",
        name: "actual",
        type: "address",
      },
    ],
    name: "InvalidSwapEnd",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "expected",
        type: "address",
      },
      {
        internalType: "address",
        name: "actual",
        type: "address",
      },
    ],
    name: "InvalidSwapStart",
    type: "error",
  },
  {
    inputs: [],
    name: "Overflow",
    type: "error",
  },
  {
    inputs: [],
    name: "Underflow",
    type: "error",
  },
  {
    inputs: [],
    name: "ZeroAddressNotAllowed",
    type: "error",
  },
  {
    inputs: [],
    name: "DEPLOYER",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "SWAP_ROUTER",
    outputs: [
      {
        internalType: "contract ISmartRouter",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          {
            internalType: "address",
            name: "beneficiary",
            type: "address",
          },
          {
            internalType: "contract IERC20",
            name: "tokenToReceiveFromConverter",
            type: "address",
          },
          {
            internalType: "uint256",
            name: "amount",
            type: "uint256",
          },
          {
            internalType: "int256",
            name: "minIncome",
            type: "int256",
          },
          {
            internalType: "contract IERC20",
            name: "tokenToSendToConverter",
            type: "address",
          },
          {
            internalType: "contract IAbstractTokenConverter",
            name: "converter",
            type: "address",
          },
          {
            internalType: "bytes",
            name: "path",
            type: "bytes",
          },
          {
            internalType: "uint256",
            name: "deadline",
            type: "uint256",
          },
        ],
        internalType: "struct TokenConverterOperator.ConversionParameters",
        name: "params",
        type: "tuple",
      },
    ],
    name: "convert",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "int256",
        name: "amount0Delta",
        type: "int256",
      },
      {
        internalType: "int256",
        name: "amount1Delta",
        type: "int256",
      },
      {
        internalType: "bytes",
        name: "data",
        type: "bytes",
      },
    ],
    name: "pancakeV3SwapCallback",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;
