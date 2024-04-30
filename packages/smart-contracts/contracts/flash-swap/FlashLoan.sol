// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import { IPancakeV3FlashCallback } from "@pancakeswap/v3-core/contracts/interfaces/callback/IPancakeV3FlashCallback.sol";
import { IPancakeV3Pool } from "@pancakeswap/v3-core/contracts/interfaces/IPancakeV3Pool.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { Path } from "../third-party/pancakeswap-v8/Path.sol";
import { PoolAddress } from "../third-party/pancakeswap-v8/PoolAddress.sol";

import { FlashHandler } from "./FlashHandler.sol";

/// @notice Callback data passed to the flash loan callback
struct Envelope {
    /// @notice Token (the same as path[0])
    IERC20 token;
    /// @notice Amount of token to receive during the flash loan
    uint256 amountOut;
    /// @notice Application-specific data
    bytes data;
    /// @notice Pool key of the pool that should have called the callback
    PoolAddress.PoolKey poolKey;
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
abstract contract FlashLoan is IPancakeV3FlashCallback, FlashHandler {
    using SafeERC20 for IERC20;
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
        Envelope memory envelope = abi.decode(data, (Envelope));
        _verifyCallback(envelope.poolKey);

        (IERC20 tokenIn, uint256 maxAmountIn) = _onMoneyReceived(envelope.data);

        if (tokenIn != envelope.token) {
            revert UnexpectedFlashLoan(address(tokenIn), address(envelope.token));
        }

        uint256 fee = (fee0 == 0 ? fee1 : fee0);
        uint256 amountToPay = envelope.amountOut + fee;
        if (amountToPay > maxAmountIn) {
            revert MaxAmountInViolated(amountToPay, maxAmountIn);
        }

        envelope.token.safeTransfer(msg.sender, envelope.amountOut + fee);

        _onFlashCompleted(envelope.data);
    }

    /// @dev Initiates a flash loan using a path passed in the calldata
    /// @param amountOut Amount of path[0] token to receive during the flash loan
    /// @param path A path containing a single pool to flash-loan from
    /// @param data Application-specific data to pass to the callbacks
    function _flashLoan(uint256 amountOut, bytes calldata path, bytes memory data) internal {
        (address tokenA, address tokenB, uint24 fee) = path.decodeFirstPool();
        PoolAddress.PoolKey memory poolKey = PoolAddress.getPoolKey(tokenA, tokenB, fee);
        _flashLoan(amountOut, tokenA, poolKey, data);
    }

    /// @dev Initiates a flash loan using a token address and a pool key
    /// @param amountOut Amount of token to receive during the flash loan
    /// @param token Token to flash-borrow
    /// @param poolKey A pool key of the pool to flash-loan from
    /// @param data Application-specific data to pass to the callbacks
    function _flashLoan(
        uint256 amountOut,
        address token,
        PoolAddress.PoolKey memory poolKey,
        bytes memory data
    ) internal {
        IPancakeV3Pool pool = IPancakeV3Pool(PoolAddress.computeAddress(DEPLOYER, poolKey));
        pool.flash(
            address(this),
            poolKey.token0 == token ? amountOut : 0,
            poolKey.token1 == token ? amountOut : 0,
            abi.encode(Envelope(IERC20(token), amountOut, data, poolKey))
        );
    }
}
