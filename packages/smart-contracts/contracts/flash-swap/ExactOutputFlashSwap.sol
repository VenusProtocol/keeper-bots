// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import { IPancakeV3SwapCallback } from "@pancakeswap/v3-core/contracts/interfaces/callback/IPancakeV3SwapCallback.sol";
import { IUniswapV3SwapCallback } from "@uniswap/v3-core/contracts/interfaces/callback/IUniswapV3SwapCallback.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { Token } from "../util/Token.sol";
import { IRouter } from "../third-party/interfaces/IRouter.sol";
import { IPool } from "../third-party/interfaces/IPool.sol";
import { Path } from "../third-party/pancakeswap-v8/Path.sol";
import { MIN_SQRT_RATIO, MAX_SQRT_RATIO } from "../third-party/pancakeswap-v8/constants.sol";

import { LiquidityProvider } from "./common.sol";
import { PoolKey, getPoolKey } from "./PoolAddress.sol";
import { FlashHandler } from "./FlashHandler.sol";

/// @notice Callback data passed to the swap callback
struct Envelope {
    /// @notice Exact-output (reversed) swap path, starting with tokenY and ending with tokenX
    bytes path;
    /// @notice Application-specific data
    bytes data;
    /// @notice Pool key of the pool that should have called the callback
    PoolKey poolKey;
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
abstract contract ExactOutputFlashSwap is IPancakeV3SwapCallback, IUniswapV3SwapCallback, FlashHandler {
    using Path for bytes;

    /// @notice Thrown if the swap callback is called with unexpected or zero amount of tokens
    error EmptySwap();

    /// @notice Callback called by PancakeSwap pool during flash swap conversion
    /// @param amount0Delta Amount of pool's token0 to repay for the flash swap (negative if no need to repay this token)
    /// @param amount1Delta Amount of pool's token1 to repay for the flash swap (negative if no need to repay this token)
    /// @param data Callback data containing an Envelope structure
    function pancakeV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata data) external {
        _handleSwapCallback(LiquidityProvider.PANCAKESWAP, amount0Delta, amount1Delta, data);
    }

    /// @notice Callback called by PancakeSwap pool during flash swap conversion
    /// @param amount0Delta Amount of pool's token0 to repay for the flash swap (negative if no need to repay this token)
    /// @param amount1Delta Amount of pool's token1 to repay for the flash swap (negative if no need to repay this token)
    /// @param data Callback data containing an Envelope structure
    function uniswapV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata data) external {
        _handleSwapCallback(LiquidityProvider.UNISWAP, amount0Delta, amount1Delta, data);
    }

    /// @dev Liquidity provider abstracted implementation of swap callback handler
    /// @param amount0Delta Amount of pool's token0 to repay for the flash swap (negative if no need to repay this token)
    /// @param amount1Delta Amount of pool's token1 to repay for the flash swap (negative if no need to repay this token)
    /// @param data Callback data containing an Envelope structure
    function _handleSwapCallback(
        LiquidityProvider provider,
        int256 amount0Delta,
        int256 amount1Delta,
        bytes calldata data
    ) internal {
        Envelope memory envelope = abi.decode(data, (Envelope));
        _verifyCallback(provider, envelope.poolKey);
        if (amount0Delta <= 0 && amount1Delta <= 0) {
            revert EmptySwap();
        }

        uint256 amountToPay;
        Token tokenToPay;
        if (amount0Delta > 0) {
            tokenToPay = Token.wrap(envelope.poolKey.token0);
            amountToPay = uint256(amount0Delta);
        } else if (amount1Delta > 0) {
            tokenToPay = Token.wrap(envelope.poolKey.token1);
            amountToPay = uint256(amount1Delta);
        }

        (Token tokenIn, uint256 maxAmountIn) = _onMoneyReceived(envelope.data);

        if (envelope.path.hasMultiplePools()) {
            bytes memory remainingPath = envelope.path.skipToken();
            _exactOutput(
                provider,
                remainingPath,
                msg.sender, // repaying to the pool
                amountToPay,
                tokenIn,
                maxAmountIn
            );
        } else {
            // If the path had just one pool, tokenToPay should be tokenX, so we can just repay the debt.
            tokenToPay.transfer(msg.sender, amountToPay);
        }

        _onFlashCompleted(envelope.data);
    }

    function _exactOutput(
        LiquidityProvider provider,
        bytes memory path,
        address recipient,
        uint256 amountOut,
        Token tokenIn,
        uint256 maxAmountIn
    ) internal {
        address router = provider == LiquidityProvider.UNISWAP ? address(UNISWAP_ROUTER) : address(PCS_ROUTER);

        tokenIn.approve(router, maxAmountIn);
        IRouter(router).exactOutput(
            IRouter.ExactOutputParams({
                path: path,
                recipient: recipient, // repaying to the pool
                amountOut: amountOut,
                amountInMaximum: maxAmountIn
            })
        );
        tokenIn.approve(router, 0);
    }

    /// @dev Initiates a flash swap
    /// @param amountOut Amount of tokenY to receive during the flash swap
    /// @param path Exact-output (reversed) swap path, starting with tokenY and ending with tokenX
    /// @param data Application-specific data
    function _flashSwap(
        LiquidityProvider provider,
        uint256 amountOut,
        bytes calldata path,
        bytes memory data
    ) internal {
        (address tokenY, address tokenB, uint24 fee) = path.decodeFirstPool();
        PoolKey memory poolKey = getPoolKey(tokenY, tokenB, fee);
        IPool pool = IPool(_computePoolAddress(provider, poolKey));
        bytes memory envelope = abi.encode(Envelope(path, data, poolKey));

        bool swapZeroForOne = poolKey.token1 == tokenY;
        uint160 sqrtPriceLimitX96 = (swapZeroForOne ? MIN_SQRT_RATIO + 1 : MAX_SQRT_RATIO - 1);
        pool.swap(address(this), swapZeroForOne, -int256(amountOut), sqrtPriceLimitX96, envelope);
    }
}
