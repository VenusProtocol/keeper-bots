// This module blends typechain and hardhat-ethers together so that we could
// instantiate contract factories with on-chain contract addresses in a
// synchronous manner.
//
// There are two main ways to instantiate factories:
// * Using `ContractName__factory.connect(address, signerOrProvider)`
// * Using `await ethers.getContractAt<ContractName>("ContractName", address)`
//
// Both are quite verbose: the former requires us to pass signerOrProvider
// because typechain doesn't know we're in a hardhat environment. The latter,
// in turn, wants both a type parameter and a contract name as a string to
// look up the ABI and type the contract correctly. Moreover, the latter is
// asynchronous, which results in a boilerplate in tests: we can't just write
// `const contract = await ...` in the describe block, we need to do it in a
// fixture or `beforeEach` hook.
//
// This `connect` function avoids the annoying boilerplate and allows us to do
// `const contract = connect(ContractName__factory, address)` in the describe
// block.
import { Provider } from "@ethersproject/providers";
import { Signer } from "ethers";
import { ethers } from "hardhat";

interface FactoryClass<T> {
  connect(address: string, signerOrProvider: Signer | Provider): T;
}

export const connect = <ContractType>(
  factory: FactoryClass<ContractType>,
  address: string,
  signerOrProvider?: Signer | Provider,
): ContractType => {
  return factory.connect(address, signerOrProvider ?? ethers.provider);
};
