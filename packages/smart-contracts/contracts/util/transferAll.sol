// SPDX-License-Identifier: MIT

pragma solidity 0.8.25;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

using SafeERC20 for IERC20;

function transferAll(IERC20 token, address this_, address to) {
    uint256 balance = token.balanceOf(this_);
    if (balance > 0) {
        token.safeTransfer(to, balance);
    }
}
