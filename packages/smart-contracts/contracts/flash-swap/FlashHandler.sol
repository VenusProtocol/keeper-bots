// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import { ensureNonzeroAddress } from "@venusprotocol/solidity-utilities/contracts/validators.sol";

import { Token } from "../util/Token.sol";
import { ISmartRouter } from "../third-party/pancakeswap-v8/ISmartRouter.sol";
import { PoolAddress } from "../third-party/pancakeswap-v8/PoolAddress.sol";

abstract contract FlashHandler {
    /// @notice The PancakeSwap SmartRouter contract
    ISmartRouter public immutable SWAP_ROUTER;

    /// @notice The PancakeSwap deployer contract
    address public immutable DEPLOYER;

    /// @notice Thrown if operation callback is called by a non-PancakeSwap contract
    /// @param expected Expected callback sender (pool address computed based on the pool key)
    /// @param actual Actual callback sender
    error InvalidCallbackSender(address expected, address actual);

    /// @param swapRouter_ PancakeSwap SmartRouter contract
    constructor(ISmartRouter swapRouter_) {
        ensureNonzeroAddress(address(swapRouter_));

        SWAP_ROUTER = swapRouter_;
        DEPLOYER = swapRouter_.deployer();
    }

    /// @dev Called when token Y is received during a flash operation. This function has to ensure
    ///   that at the end of the execution the contract has enough token X to repay the flash
    ///   operation.
    ///   Note that msg.sender is the pool that called the callback, not the original caller
    ///   of the transaction where flash operation was invoked.
    /// @param data Application-specific data
    /// @return tokenIn Token X
    /// @return maxAmountIn Maximum amount of token X to be used to repay the flash operation
    function _onMoneyReceived(bytes memory data) internal virtual returns (Token tokenIn, uint256 maxAmountIn);

    /// @dev Called when the flash operation is completed and was paid for. By default, does nothing.
    ///   Note that msg.sender is the pool that called the callback, not the original caller
    ///   of the transaction where flash operation was invoked.
    /// @param data Application-specific data
    // solhint-disable-next-line no-empty-blocks
    function _onFlashCompleted(bytes memory data) internal virtual {}

    /// @dev Ensures that the caller of a callback is a legitimate PancakeSwap pool
    /// @param poolKey The pool key of the pool to verify
    function _verifyCallback(PoolAddress.PoolKey memory poolKey) internal view {
        address pool = PoolAddress.computeAddress(DEPLOYER, poolKey);
        if (msg.sender != pool) {
            revert InvalidCallbackSender(pool, msg.sender);
        }
    }
}
