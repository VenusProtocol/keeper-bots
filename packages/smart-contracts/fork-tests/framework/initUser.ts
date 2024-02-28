import { impersonateAccount, setBalance } from "@nomicfoundation/hardhat-network-helpers";
import { NumberLike } from "@nomicfoundation/hardhat-network-helpers/dist/src/types";
import { ethers } from "hardhat";

export const initUser = async (user: string, balance?: NumberLike) => {
  await impersonateAccount(user);
  if (balance !== undefined) {
    await setBalance(user, balance);
  }
  return ethers.getSigner(user);
};
