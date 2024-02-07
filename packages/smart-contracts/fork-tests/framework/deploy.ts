import { Signer } from "ethers";
import { ethers } from "hardhat";

export const deploy = async <
  FactoryClass extends new (signer: Signer) => any,
  DeployFn extends InstanceType<FactoryClass>["deploy"],
>(
  factory: FactoryClass,
  ...args: Parameters<DeployFn>
): Promise<ReturnType<DeployFn>> => {
  const [defaultSigner] = await ethers.getSigners();
  return new factory(defaultSigner).deploy(...args);
};
