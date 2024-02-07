import { IERC20 } from "@venusprotocol/venus-protocol/dist/typechain";
import { BigNumberish, ContractTransaction, Signer } from "ethers";
import { parseEther } from "ethers/lib/utils";

import { IERC20__factory } from "../../typechain";
import { connect } from "./connect";
import { initUser } from "./initUser";

export const faucet = async (
  token: IERC20 | string,
  from: Signer | string,
  to: Signer | string,
  amount: BigNumberish,
): Promise<ContractTransaction> => {
  const fromSigner = typeof from === "string" ? await initUser(from, parseEther("1")) : from;
  const tokenContract = typeof token === "string" ? connect(IERC20__factory, token, fromSigner) : token;
  const toAddress = typeof to === "string" ? to : await to.getAddress();
  return tokenContract.connect(fromSigner).transfer(toAddress, amount);
};
