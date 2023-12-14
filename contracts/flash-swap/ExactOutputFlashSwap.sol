// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import { IPancakeV3SwapCallback } from "@pancakeswap/v3-core/contracts/interfaces/callback/IPancakeV3SwapCallback.sol";
import { IPancakeV3Pool } from "@pancakeswap/v3-core/contracts/interfaces/IPancakeV3Pool.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ensureNonzeroAddress } from "@venusprotocol/solidity-utilities/contracts/validators.sol";

import { approveOrRevert } from "../util/approveOrRevert.sol";
import { ISmartRouter } from "../third-party/pancakeswap-v8/ISmartRouter.sol";
import { Path } from "../third-party/pancakeswap-v8/Path.sol";
import { PoolAddress } from "../third-party/pancakeswap-v8/PoolAddress.sol";
import { MIN_SQRT_RATIO, MAX_SQRT_RATIO } from "../third-party/pancakeswap-v8/constants.sol";

/// @title ExactOutputFlashSwap
/// @notice A base contract for exact output flash swap operations.
///
///   Upon calling _flashSwap, swaps tokenX to tokenY using a flash swap, i.e. the contract:
///
///   1. Invokes the flash swap on the first pool from the path
///   2. Receives tokenY from the pool
///   3. Calls _onMoneyReceived, which should ensure that the contract has enough tokenX
///      to repay the flash swap
///   4. Repays the flash swap with tokenX (doing the conversion if necessary)
///   5. Calls _onFlashSwapCompleted
///
/// @dev This contract is abstract and should be inherited by a contract that implements
///   _onMoneyReceived and _onFlashSwapCompleted. Note that in the callbacks transaction
///   context (sender and value) is different from the original context. The inheriting
///   contracts should save the original context in the application-specific data bytes
///   passed to the callbacks.
abstract contract ExactOutputFlashSwap is IPancakeV3SwapCallback {
    using SafeERC20 for IERC20;
    using Path for bytes;

    /// @notice Flash swap parameters
    struct FlashSwapParams {
        /// @notice Amount of tokenY to receive during the flash swap
        uint256 amountOut;
        /// @notice Exact-output (reversed) swap path, starting with tokenY and ending with tokenX
        bytes path;
        /// @notice Application-specific data
        bytes data;
    }

    /// @notice Callback data passed to the swap callback
    struct Envelope {
        /// @notice Exact-output (reversed) swap path, starting with tokenY and ending with tokenX
        bytes path;
        /// @notice Application-specific data
        bytes data;
        /// @notice Pool key of the pool that should have called the callback
        PoolAddress.PoolKey poolKey;
    }

    /// @notice The PancakeSwap SmartRouter contract
    ISmartRouter public immutable SWAP_ROUTER;

    /// @notice The PancakeSwap deployer contract
    address public immutable DEPLOYER;

    /// @notice Thrown if swap callback is called by a non-PancakeSwap contract
    /// @param expected Expected callback sender (pool address computed based on the pool key)
    /// @param actual Actual callback sender
    error InvalidCallbackSender(address expected, address actual);

    /// @notice Thrown if the swap callback is called with unexpected or zero amount of tokens
    error EmptySwap();

    /// @param swapRouter_ PancakeSwap SmartRouter contract
    constructor(ISmartRouter swapRouter_) {
        ensureNonzeroAddress(address(swapRouter_));

        SWAP_ROUTER = swapRouter_;
        DEPLOYER = swapRouter_.deployer();
    }

    /// @notice Callback called by PancakeSwap pool during flash swap conversion
    /// @param amount0Delta Amount of pool's token0 to repay for the flash swap (negative if no need to repay this token)
    /// @param amount1Delta Amount of pool's token1 to repay for the flash swap (negative if no need to repay this token)
    /// @param data Callback data containing an Envelope structure
    function pancakeV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata data) external {
        Envelope memory envelope = abi.decode(data, (Envelope));
        _verifyCallback(envelope.poolKey);
        if (amount0Delta <= 0 && amount1Delta <= 0) {
            revert EmptySwap();
        }

        uint256 amountToPay;
        IERC20 tokenToPay;
        if (amount0Delta > 0) {
            tokenToPay = IERC20(envelope.poolKey.token0);
            amountToPay = uint256(amount0Delta);
        } else if (amount1Delta > 0) {
            tokenToPay = IERC20(envelope.poolKey.token1);
            amountToPay = uint256(amount1Delta);
        }

        uint256 maxAmountIn = _onMoneyReceived(envelope.data);

        if (envelope.path.hasMultiplePools()) {
            bytes memory remainingPath = envelope.path.skipToken();
            approveOrRevert(tokenToPay, address(SWAP_ROUTER), maxAmountIn);
            SWAP_ROUTER.exactOutput(
                ISmartRouter.ExactOutputParams({
                    path: remainingPath,
                    recipient: msg.sender, // repaying to the pool
                    amountOut: amountToPay,
                    amountInMaximum: maxAmountIn
                })
            );
            approveOrRevert(tokenToPay, address(SWAP_ROUTER), 0);
        } else {
            // If the path had just one pool, tokenToPay should be tokenX, so we can just repay the debt.
            tokenToPay.safeTransfer(msg.sender, amountToPay);
        }

        _onFlashSwapCompleted(envelope.data);
    }

    /// @dev Initiates a flash swap
    /// @param params Flash swap parameters
    function _flashSwap(FlashSwapParams memory params) internal {
        (address tokenY, address tokenB, uint24 fee) = params.path.decodeFirstPool();
        PoolAddress.PoolKey memory poolKey = PoolAddress.getPoolKey(tokenY, tokenB, fee);
        IPancakeV3Pool pool = IPancakeV3Pool(PoolAddress.computeAddress(DEPLOYER, poolKey));

        bool swapZeroForOne = poolKey.token1 == tokenY;
        uint160 sqrtPriceLimitX96 = (swapZeroForOne ? MIN_SQRT_RATIO + 1 : MAX_SQRT_RATIO - 1);
        pool.swap(
            address(this),
            swapZeroForOne,
            -int256(params.amountOut),
            sqrtPriceLimitX96,
            abi.encode(Envelope(params.path, params.data, poolKey))
        );
    }

    /// @dev Called when token Y is received during a flash swap. This function has to ensure
    ///   that at the end of the execution the contract has enough token X to repay the flash
    ///   swap.
    ///   Note that msg.sender is the pool that called the callback, not the original caller
    ///   of the transaction where _flashSwap was invoked.
    /// @param data Application-specific data
    /// @return maxAmountIn Maximum amount of token X to be used to repay the flash swap
    function _onMoneyReceived(bytes memory data) internal virtual returns (uint256 maxAmountIn);

    /// @dev Called when the flash swap is completed and was paid for. By default, does nothing.
    ///   Note that msg.sender is the pool that called the callback, not the original caller
    ///   of the transaction where _flashSwap was invoked.
    /// @param data Application-specific data
    // solhint-disable-next-line no-empty-blocks
    function _onFlashSwapCompleted(bytes memory data) internal virtual {}

    /// @dev Ensures that the caller of a callback is a legitimate PancakeSwap pool
    /// @param poolKey The pool key of the pool to verify
    function _verifyCallback(PoolAddress.PoolKey memory poolKey) internal view {
        address pool = PoolAddress.computeAddress(DEPLOYER, poolKey);
        if (msg.sender != pool) {
            revert InvalidCallbackSender(pool, msg.sender);
        }
    }
}
