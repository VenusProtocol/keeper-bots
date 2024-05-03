// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

// A utility library for handling token transfers. Instead of extending IERC20 interface,
// introduces a new `Token` type with most of the operations "done right", e.g. it uses
// a reverting version of `approve` and `transfer`. It also has some utility methods like
// balanceOfSelf and transferAll that has proven to be useful in our contracts.
//
// The library exposes addr() and ierc20() methods to simplify the conversion to
// other kinds of ERC20 token types commonly used in contracts.

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { approveOrRevert } from "./approveOrRevert.sol";

type Token is address;

library TokenLibrary {
    using TokenLibrary for Token;
    using SafeERC20 for IERC20;

    /**
     * @dev Approves the specified amount or reverts. Handles non-compliant tokens.
     * @param token Token
     * @param spender The account approved to spend the tokens
     * @param amount The approved amount
     */
    function approve(Token token, address spender, uint256 amount) internal {
        approveOrRevert(IERC20(token.addr()), spender, amount);
    }

    /**
     * @dev Wrapper for SafeERC20.safeTransfer
     * @param token Token
     * @param receiver The account that would receive the tokens
     * @param amount The amount to transfer
     */
    function transfer(Token token, address receiver, uint256 amount) internal {
        token.ierc20().safeTransfer(receiver, amount);
    }

    /**
     * @dev Wrapper for SafeERC20.safeTransferFrom
     * @param token Token
     * @param receiver The account that would receive the tokens
     * @param amount The amount to transfer
     */
    function transferFrom(Token token, address payer, address receiver, uint256 amount) internal {
        token.ierc20().safeTransferFrom(payer, receiver, amount);
    }

    /**
     * @dev Transfer from payer to address(this)
     * @param token Token
     * @param amount The amount to transfer
     */
    function transferToSelf(Token token, address payer, uint256 amount) internal {
        token.transferFrom(payer, address(this), amount);
    }

    /**
     * @dev Transfers the entire contract's balance to the receiver
     * @param token Token
     * @param receiver The account that would receive the tokens
     */
    function transferAll(Token token, address receiver) internal {
        uint256 balance = token.balanceOfSelf();
        if (balance > 0) {
            token.transfer(receiver, balance);
        }
    }

    function balanceOf(Token token, address account) internal view returns (uint256) {
        return token.ierc20().balanceOf(account);
    }

    function balanceOfSelf(Token token) internal view returns (uint256) {
        return token.balanceOf(address(this));
    }

    function addr(Token token) internal pure returns (address) {
        return Token.unwrap(token);
    }

    function ierc20(Token token) internal pure returns (IERC20) {
        return IERC20(token.addr());
    }
}

using TokenLibrary for Token global;

function eq(Token a, Token b) pure returns (bool) {
    return a.addr() == b.addr();
}

function neq(Token a, Token b) pure returns (bool) {
    return a.addr() != b.addr();
}

using { eq as == } for Token global;
using { neq as != } for Token global;
