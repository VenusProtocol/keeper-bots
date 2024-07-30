// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import { ZeroAddressNotAllowed } from "@venusprotocol/solidity-utilities/contracts/validators.sol";

import { LiquidityProvider } from "./common.sol";
import { PoolKey, computePoolAddress } from "./PoolAddress.sol";
import { Token } from "../util/Token.sol";
import { IUniswapRouter } from "../third-party/interfaces/IUniswapRouter.sol";
import { IPancakeSwapRouter } from "../third-party/interfaces/IPancakeSwapRouter.sol";

bytes32 constant UNISWAP_POOL_INIT_CODE_HASH = 0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54;
bytes32 constant PCS_POOL_INIT_CODE_HASH = 0x6ce8eb472fa82df5469c6ab6d485f17c3ad13c8cd7af59b3d4a8026c5ce0f7e2;

abstract contract FlashHandler {
    /// @notice PancakeSwap SmartRouter contract
    IPancakeSwapRouter public immutable PCS_ROUTER;

    /// @notice PancakeSwap deployer contract
    address public immutable PCS_DEPLOYER;

    /// @notice Uniswap SwapRouter contract
    IUniswapRouter public immutable UNISWAP_ROUTER;

    /// @notice Uniswap factory contract
    address public immutable UNISWAP_FACTORY;

    /// @notice Thrown if operation callback is called by a non-PancakeSwap contract
    /// @param expected Expected callback sender (pool address computed based on the pool key)
    /// @param actual Actual callback sender
    error InvalidCallbackSender(address expected, address actual);

    /// @param uniswapSwapRouter_ Uniswap SwapRouter contract
    /// @param pcsSwapRouter_ PancakeSwap SmartRouter contract
    /// @dev Either of the routers must be nonzero address
    constructor(IUniswapRouter uniswapSwapRouter_, IPancakeSwapRouter pcsSwapRouter_) {
        if (address(uniswapSwapRouter_) == address(0) && address(pcsSwapRouter_) == address(0)) {
            revert ZeroAddressNotAllowed();
        }
        if (address(uniswapSwapRouter_) != address(0)) {
            UNISWAP_ROUTER = uniswapSwapRouter_;
            UNISWAP_FACTORY = uniswapSwapRouter_.factory();
        }
        if (address(pcsSwapRouter_) != address(0)) {
            PCS_ROUTER = pcsSwapRouter_;
            PCS_DEPLOYER = pcsSwapRouter_.deployer();
        }
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

    /// @dev Computes PancakeSwap or Uniswap pool address
    /// @param provider Liquidity provider (either Uniswap or PancakeSwap)
    /// @param poolKey PoolKey struct identifying a pool
    function _computePoolAddress(LiquidityProvider provider, PoolKey memory poolKey) internal view returns (address) {
        if (provider == LiquidityProvider.UNISWAP) {
            return computePoolAddress(UNISWAP_FACTORY, UNISWAP_POOL_INIT_CODE_HASH, poolKey);
        } else {
            return computePoolAddress(PCS_DEPLOYER, PCS_POOL_INIT_CODE_HASH, poolKey);
        }
    }

    /// @dev Ensures that the caller of a callback is a legitimate PancakeSwap pool
    /// @param provider Liquidity provider (either Uniswap or PancakeSwap)
    /// @param poolKey The pool key of the pool to verify
    function _verifyCallback(LiquidityProvider provider, PoolKey memory poolKey) internal view {
        address pool = _computePoolAddress(provider, poolKey);
        if (msg.sender != pool) {
            revert InvalidCallbackSender(pool, msg.sender);
        }
    }
}
