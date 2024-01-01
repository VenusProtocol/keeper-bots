// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import { IPancakeV3SwapCallback } from "@pancakeswap/v3-core/contracts/interfaces/callback/IPancakeV3SwapCallback.sol";
import { IPancakeV3FlashCallback } from "@pancakeswap/v3-core/contracts/interfaces/callback/IPancakeV3FlashCallback.sol";
import { IPancakeV3Pool } from "@pancakeswap/v3-core/contracts/interfaces/IPancakeV3Pool.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ensureNonzeroAddress } from "@venusprotocol/solidity-utilities/contracts/validators.sol";

import { approveOrRevert } from "../util/approveOrRevert.sol";
import { ISmartRouter } from "../third-party/pancakeswap-v8/ISmartRouter.sol";
import { Path } from "../third-party/pancakeswap-v8/Path.sol";
import { PoolAddress } from "../third-party/pancakeswap-v8/PoolAddress.sol";
import { MIN_SQRT_RATIO, MAX_SQRT_RATIO } from "../third-party/pancakeswap-v8/constants.sol";

/// @title ExactOutputFlash
/// @notice A base contract for exact output flash swap operations.
///
///   Upon calling _flash, swaps tokenX to tokenY using a flash swap or a flash loan,
///   i.e. the contract:
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
abstract contract ExactOutputFlash is IPancakeV3SwapCallback, IPancakeV3FlashCallback {
    using SafeERC20 for IERC20;
    using Path for bytes;

    /// @notice Flash swap parameters
    struct FlashParams {
        /// @notice Amount of tokenY to receive during the flash swap
        uint256 amountOut;
        /// @notice Exact-output (reversed) swap path, starting with tokenY and ending with tokenX
        bytes path;
        /// @notice Application-specific data
        bytes data;
    }

    /// @notice Callback data passed to the swap callback
    struct FlashSwapEnvelope {
        /// @notice Exact-output (reversed) swap path, starting with tokenY and ending with tokenX
        bytes path;
        /// @notice Application-specific data
        bytes data;
        /// @notice Pool key of the pool that should have called the callback
        PoolAddress.PoolKey poolKey;
    }

    /// @notice Callback data passed to the flash loan callback
    struct FlashLoanEnvelope {
        /// @notice Token (the same as tokenX and tokenY)
        IERC20 token;
        /// @notice Amount of tokenY to receive during the flash loan
        uint256 amountOut;
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

    /// @notice Thrown if the application tries a flash loan with tokenX != tokenY
    error UnexpectedFlashLoan(address tokenX, address tokenY);

    /// @notice Thrown if maxAmountIn threshold is violated while repaying a flash loan
    error MaxAmountInViolated(uint256 amountToPay, uint256 maxAmountIn);

    /// @param swapRouter_ PancakeSwap SmartRouter contract
    constructor(ISmartRouter swapRouter_) {
        ensureNonzeroAddress(address(swapRouter_));

        SWAP_ROUTER = swapRouter_;
        DEPLOYER = swapRouter_.deployer();
    }

    /// @notice Callback called by PancakeSwap pool during flash swap conversion
    /// @param amount0Delta Amount of pool's token0 to repay for the flash swap (negative if no need to repay this token)
    /// @param amount1Delta Amount of pool's token1 to repay for the flash swap (negative if no need to repay this token)
    /// @param data Callback data containing a FlashSwapEnvelope structure
    function pancakeV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata data) external {
        FlashSwapEnvelope memory envelope = abi.decode(data, (FlashSwapEnvelope));
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

    /// @notice Callback called by PancakeSwap pool during in-kind liquidation. Liquidates the
    /// borrow, seizing vTokens with the same underlying as the borrowed asset, redeems these
    /// vTokens and repays the flash swap.
    /// @param fee0 Fee amount in pool's token0
    /// @param fee1 Fee amount in pool's token1
    /// @param data Callback data, passed during _flashLiquidateInKind
    function pancakeV3FlashCallback(uint256 fee0, uint256 fee1, bytes memory data) external {
        FlashLoanEnvelope memory envelope = abi.decode(data, (FlashLoanEnvelope));
        _verifyCallback(envelope.poolKey);

        (IERC20 tokenIn, uint256 maxAmountIn) = _onMoneyReceived(envelope.data);

        if (tokenIn != envelope.token) {
            revert UnexpectedFlashLoan(address(tokenIn), address(envelope.token));
        }

        uint256 fee = (fee0 == 0 ? fee1 : fee0);
        uint256 amountToPay = envelope.amountOut + fee;
        if (maxAmountIn > amountToPay) {
            revert MaxAmountInViolated(amountToPay, maxAmountIn);
        }

        envelope.token.safeTransfer(msg.sender, envelope.amountOut + fee);
    }

    /// @dev Initiates a flash swap
    /// @param params Flash swap parameters
    function _flashSwap(FlashParams memory params) internal {
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
            abi.encode(FlashSwapEnvelope(params.path, params.data, poolKey))
        );
    }

    /// @dev Initiates a flash swap
    /// @param params Flash loan parameters
    function _flashLoan(FlashParams memory params) internal {
        (address tokenY, address tokenB, uint24 fee) = params.path.decodeFirstPool();
        PoolAddress.PoolKey memory poolKey = PoolAddress.getPoolKey(tokenY, tokenB, fee);
        IPancakeV3Pool pool = IPancakeV3Pool(PoolAddress.computeAddress(DEPLOYER, poolKey));
        pool.flash(
            address(this),
            poolKey.token0 == tokenY ? params.amountOut : 0,
            poolKey.token1 == tokenY ? params.amountOut : 0,
            abi.encode(FlashLoanEnvelope(IERC20(tokenY), params.amountOut, params.data, poolKey))
        );
    }

    /// @dev Called when token Y is received during a flash swap or a flash loan. This function
    ///   has to ensure that at the end of the execution the contract has enough token X to repay
    ///   the flash swap.
    ///   Note that msg.sender is the pool that called the callback, not the original caller
    ///   of the transaction where _flashSwap or _flashLoan was invoked.
    /// @param data Application-specific data
    /// @return tokenIn Token X
    /// @return maxAmountIn Maximum amount of token X to be used to repay the flash swap
    function _onMoneyReceived(bytes memory data) internal virtual returns (IERC20 tokenIn, uint256 maxAmountIn);

    /// @dev Called when the flash swap or flash loan is completed and was paid for. By default,
    ///   does nothing.
    ///   Note that msg.sender is the pool that called the callback, not the original caller
    ///   of the transaction where _flashSwap or _flashLoan was invoked.
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
