// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import { IPancakeV3SwapCallback } from "@pancakeswap/v3-core/contracts/interfaces/callback/IPancakeV3SwapCallback.sol";
import { IPancakeV3Pool } from "@pancakeswap/v3-core/contracts/interfaces/IPancakeV3Pool.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { approveOrRevert } from "../util/approveOrRevert.sol";
import { ISmartRouter } from "../third-party/pancakeswap-v8/ISmartRouter.sol";
import { Path } from "../third-party/pancakeswap-v8/Path.sol";
import { PoolAddress } from "../third-party/pancakeswap-v8/PoolAddress.sol";
import { MIN_SQRT_RATIO, MAX_SQRT_RATIO } from "../third-party/pancakeswap-v8/constants.sol";

import { FlashHandler } from "./FlashHandler.sol";

/// @notice Callback data passed to the swap callback
struct Envelope {
    /// @notice Exact-output (reversed) swap path, starting with tokenY and ending with tokenX
    bytes path;
    /// @notice Application-specific data
    bytes data;
    /// @notice Pool key of the pool that should have called the callback
    PoolAddress.PoolKey poolKey;
}

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
///   5. Calls _onFlashCompleted
///
/// @dev This contract is abstract and should be inherited by a contract that implements
///   _onMoneyReceived and _onFlashCompleted. Note that in the callbacks transaction
///   context (sender and value) is different from the original context. The inheriting
///   contracts should save the original context in the application-specific data bytes
///   passed to the callbacks.
abstract contract ExactOutputFlashSwap is IPancakeV3SwapCallback, FlashHandler {
    using SafeERC20 for IERC20;
    using Path for bytes;

    /// @notice Thrown if the swap callback is called with unexpected or zero amount of tokens
    error EmptySwap();

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

        (IERC20 tokenIn, uint256 maxAmountIn) = _onMoneyReceived(envelope.data);

        if (envelope.path.hasMultiplePools()) {
            bytes memory remainingPath = envelope.path.skipToken();
            approveOrRevert(tokenIn, address(SWAP_ROUTER), maxAmountIn);
            SWAP_ROUTER.exactOutput(
                ISmartRouter.ExactOutputParams({
                    path: remainingPath,
                    recipient: msg.sender, // repaying to the pool
                    amountOut: amountToPay,
                    amountInMaximum: maxAmountIn
                })
            );
            approveOrRevert(tokenIn, address(SWAP_ROUTER), 0);
        } else {
            // If the path had just one pool, tokenToPay should be tokenX, so we can just repay the debt.
            tokenToPay.safeTransfer(msg.sender, amountToPay);
        }

        _onFlashCompleted(envelope.data);
    }

    /// @dev Initiates a flash swap
    /// @param amountOut Amount of tokenY to receive during the flash swap
    /// @param path Exact-output (reversed) swap path, starting with tokenY and ending with tokenX
    /// @param data Application-specific data
    function _flashSwap(uint256 amountOut, bytes calldata path, bytes memory data) internal {
        (address tokenY, address tokenB, uint24 fee) = path.decodeFirstPool();
        PoolAddress.PoolKey memory poolKey = PoolAddress.getPoolKey(tokenY, tokenB, fee);
        IPancakeV3Pool pool = IPancakeV3Pool(PoolAddress.computeAddress(DEPLOYER, poolKey));
        bytes memory envelope = abi.encode(Envelope(path, data, poolKey));

        bool swapZeroForOne = poolKey.token1 == tokenY;
        uint160 sqrtPriceLimitX96 = (swapZeroForOne ? MIN_SQRT_RATIO + 1 : MAX_SQRT_RATIO - 1);
        pool.swap(address(this), swapZeroForOne, -int256(amountOut), sqrtPriceLimitX96, envelope);
    }
}
