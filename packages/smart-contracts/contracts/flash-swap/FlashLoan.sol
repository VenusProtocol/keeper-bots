// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import { IPancakeV3FlashCallback } from "@pancakeswap/v3-core/contracts/interfaces/callback/IPancakeV3FlashCallback.sol";
import { IUniswapV3FlashCallback } from "@uniswap/v3-core/contracts/interfaces/callback/IUniswapV3FlashCallback.sol";

import { Token } from "../util/Token.sol";
import { IPool } from "../third-party/interfaces/IPool.sol";
import { Path } from "../third-party/pancakeswap-v8/Path.sol";

import { LiquidityProvider } from "./common.sol";
import { PoolKey, getPoolKey } from "./PoolAddress.sol";
import { FlashHandler } from "./FlashHandler.sol";

/// @notice Callback data passed to the flash loan callback
struct Envelope {
    /// @notice Token (the same as path[0])
    Token token;
    /// @notice Amount of token to receive during the flash loan
    uint256 amountOut;
    /// @notice Application-specific data
    bytes data;
    /// @notice Pool key of the pool that should have called the callback
    PoolKey poolKey;
}

/// @title FlashLoan
/// @notice A base contract for flash loan operations.
///
///   Upon calling _flashLoan, flash-loans path[0] token in the specified pool:
///
///   1. Invokes the flash loan on the first pool in the path
///   2. Receives the specified amount of token from the pool
///   3. Calls _onMoneyReceived, which should ensure that the contract has enough tokens
///      to repay the flash swap
///   4. Repays the flash loan with the tokens
///   5. Calls _onFlashCompleted
///
/// @dev This contract is abstract and should be inherited by a contract that implements
///   _onMoneyReceived and _onFlashCompleted. Note that in the callbacks transaction
///   context (sender and value) is different from the original context. The inheriting
///   contracts should save the original context in the application-specific data bytes
///   passed to the callbacks.
abstract contract FlashLoan is IPancakeV3FlashCallback, IUniswapV3FlashCallback, FlashHandler {
    using Path for bytes;

    /// @notice Flash swap parameters
    struct FlashLoanParams {
        uint256 amountOut;
        /// @notice Exact-output (reversed) swap path, starting with tokenY and ending with tokenX
        bytes path;
        /// @notice Application-specific data
        bytes data;
    }

    /// @notice Thrown if the application tries a flash loan with token to repay != borrowed token
    error UnexpectedFlashLoan(address tokenX, address tokenY);

    /// @notice Thrown if maxAmountIn threshold is violated while repaying a flash loan
    error MaxAmountInViolated(uint256 amountToPay, uint256 maxAmountIn);

    /// @notice Callback called by PancakeSwap pool during a flash loan. Does a sanity check
    ///  that token to repay is equal to the borrowed token, and repays the flash loan, capped
    ///  to the specified maxAmountIn. Invokes _onFlashCompleted once the flash loan is repaid.
    /// @param fee0 Fee amount in pool's token0
    /// @param fee1 Fee amount in pool's token1
    /// @param data Callback data containing an Envelope structure
    function pancakeV3FlashCallback(uint256 fee0, uint256 fee1, bytes memory data) external {
        _handleFlashCallback(LiquidityProvider.PANCAKESWAP, fee0, fee1, data);
    }

    /// @notice Callback called by Uniswap pool during a flash loan. Does a sanity check
    ///  that token to repay is equal to the borrowed token, and repays the flash loan, capped
    ///  to the specified maxAmountIn. Invokes _onFlashCompleted once the flash loan is repaid.
    /// @param fee0 Fee amount in pool's token0
    /// @param fee1 Fee amount in pool's token1
    /// @param data Callback data containing an Envelope structure
    function uniswapV3FlashCallback(uint256 fee0, uint256 fee1, bytes memory data) external {
        _handleFlashCallback(LiquidityProvider.UNISWAP, fee0, fee1, data);
    }

    /// @dev Liquidity provider abstracted implementation of flash callback. Does a sanity check
    ///  that token to repay is equal to the borrowed token, and repays the flash loan, capped
    ///  to the specified maxAmountIn. Invokes _onFlashCompleted once the flash loan is repaid.
    /// @param provider Liquidity provider (either Uniswap or PancakeSwap)
    /// @param fee0 Fee amount in pool's token0
    /// @param fee1 Fee amount in pool's token1
    /// @param data Callback data containing an Envelope structure
    function _handleFlashCallback(LiquidityProvider provider, uint256 fee0, uint256 fee1, bytes memory data) internal {
        Envelope memory envelope = abi.decode(data, (Envelope));
        _verifyCallback(provider, envelope.poolKey);

        (Token tokenIn, uint256 maxAmountIn) = _onMoneyReceived(envelope.data);

        if (tokenIn != envelope.token) {
            revert UnexpectedFlashLoan(tokenIn.addr(), envelope.token.addr());
        }

        uint256 fee = (fee0 == 0 ? fee1 : fee0);
        uint256 amountToPay = envelope.amountOut + fee;
        if (amountToPay > maxAmountIn) {
            revert MaxAmountInViolated(amountToPay, maxAmountIn);
        }

        envelope.token.transfer(msg.sender, envelope.amountOut + fee);

        _onFlashCompleted(envelope.data);
    }

    /// @dev Initiates a flash loan using a path passed in the calldata
    /// @param provider Liquidity provider (either Uniswap or PancakeSwap)
    /// @param amountOut Amount of path[0] token to receive during the flash loan
    /// @param path A path containing a single pool to flash-loan from
    /// @param data Application-specific data to pass to the callbacks
    function _flashLoan(
        LiquidityProvider provider,
        uint256 amountOut,
        bytes calldata path,
        bytes memory data
    ) internal {
        (address tokenA, address tokenB, uint24 fee) = path.decodeFirstPool();
        PoolKey memory poolKey = getPoolKey(tokenA, tokenB, fee);
        _flashLoan(provider, amountOut, tokenA, poolKey, data);
    }

    /// @dev Initiates a flash loan using a token address and a pool key
    /// @param provider Liquidity provider (either Uniswap or PancakeSwap)
    /// @param amountOut Amount of token to receive during the flash loan
    /// @param token Token to flash-borrow
    /// @param poolKey A pool key of the pool to flash-loan from
    /// @param data Application-specific data to pass to the callbacks
    function _flashLoan(
        LiquidityProvider provider,
        uint256 amountOut,
        address token,
        PoolKey memory poolKey,
        bytes memory data
    ) internal {
        IPool pool = IPool(_computePoolAddress(provider, poolKey));
        pool.flash(
            address(this),
            poolKey.token0 == token ? amountOut : 0,
            poolKey.token1 == token ? amountOut : 0,
            abi.encode(Envelope(Token.wrap(token), amountOut, data, poolKey))
        );
    }
}
