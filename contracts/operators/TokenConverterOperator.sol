// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import { IPancakeV3SwapCallback } from "@pancakeswap/v3-core/contracts/interfaces/callback/IPancakeV3SwapCallback.sol";
import { IPancakeV3Pool } from "@pancakeswap/v3-core/contracts/interfaces/IPancakeV3Pool.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ensureNonzeroAddress } from "@venusprotocol/solidity-utilities/contracts/validators.sol";
import { IAbstractTokenConverter } from "@venusprotocol/protocol-reserve/contracts/TokenConverter/IAbstractTokenConverter.sol";

import { ExactOutputFlashSwap } from "../flash-swap/ExactOutputFlashSwap.sol";
import { approveOrRevert } from "../util/approveOrRevert.sol";
import { transferAll } from "../util/transferAll.sol";
import { ISmartRouter } from "../third-party/pancakeswap-v8/ISmartRouter.sol";
import { BytesLib } from "../third-party/pancakeswap-v8/BytesLib.sol";

/// @title TokenConverterOperator
/// @notice Converts tokens in a TokenConverter using an exact-output flash swap
/// @dev Expects a reversed (exact output) path, i.e. the path starting with the token
///   that it _sends_ to TokenConverter and ends with the token that it _receives_ from
///   TokenConverter, e.g. if TokenConverter has BTC and wants USDT, the path should be
///   USDT->(TokenB)->(TokenC)->...->BTC. This contract will then:
///     1. Compute the amount of USDT required for the conversion
///     2. Flash-swap TokenB to USDT (`tokenToSendToConverter`)
///     3. Use TokenConverter to convert USDT to BTC (`tokenToReceiveFromConverter`)
///     4. Swap some portion of BTC to an exact amount of TokenB (`tokenToPay`)
///     5. Repay for the swap in TokenB
///     6. Transfer the rest of BTC to the caller
///   The exact output converter differs from an exact input version in that it sends the
///   income in `tokenToReceiveFromConverter` to the beneficiary, while an exact input
///   version would send the income in `tokenToSendToConverter`. The former is supposedly
///   a bit more efficient since there's no slippage associated with the income conversion.
contract TokenConverterOperator is ExactOutputFlashSwap {
    using SafeERC20 for IERC20;
    using BytesLib for bytes;

    /// @notice Conversion parameters
    struct ConversionParameters {
        /// @notice The receiver of the arbitrage income
        address beneficiary;
        /// @notice The token currently in the TokenConverter
        IERC20 tokenToReceiveFromConverter;
        /// @notice The amount (in `tokenToReceiveFromConverter` tokens) to receive as a result of conversion
        uint256 amount;
        /// @notice Minimal income to get from the arbitrage transaction (in `tokenToReceiveFromConverter`).
        ///   This value can be negative to indicate that the sender is willing to pay for the transaction
        ///   execution. In this case, abs(minIncome) will be withdrawn from the sender's wallet, the
        ///   arbitrage will be executed, and the excess  (if any) will be sent to the beneficiary.
        int256 minIncome;
        /// @notice The token the TokenConverter would get
        IERC20 tokenToSendToConverter;
        /// @notice Address of the token converter contract to arbitrage
        IAbstractTokenConverter converter;
        /// @notice Reversed (exact output) path to trade from `tokenToReceiveFromConverter`
        /// to `tokenToSendToConverter`
        bytes path;
        /// @notice Deadline for the transaction execution
        uint256 deadline;
    }

    /// @notice Conversion data to pass between calls
    struct ConversionData {
        /// @notice The receiver of the arbitrage income
        address beneficiary;
        /// @notice The token the TokenConverter would receive
        IERC20 tokenToSendToConverter;
        /// @notice The amount (in `amountToSendToConverter` tokens) to send to converter
        uint256 amountToSendToConverter;
        /// @notice The token currently in the TokenConverter
        IERC20 tokenToReceiveFromConverter;
        /// @notice The amount (in `tokenToReceiveFromConverter` tokens) to receive
        uint256 amountToReceiveFromConverter;
        /// @notice Minimal income to get from the arbitrage transaction (in `amountToReceiveFromConverter`).
        int256 minIncome;
        /// @notice Address of the token converter contract to arbitrage
        IAbstractTokenConverter converter;
    }

    /// @notice Thrown if the provided swap path start does not correspond to tokenToSendToConverter
    /// @param expected Expected swap path start (tokenToSendToConverter)
    /// @param actual Provided swap path start
    error InvalidSwapStart(address expected, address actual);

    /// @notice Thrown if the provided swap path end does not correspond to tokenToReceiveFromConverter
    /// @param expected Expected swap path end (tokenToReceiveFromConverter)
    /// @param actual Provided swap path end
    error InvalidSwapEnd(address expected, address actual);

    /// @notice Thrown if the amount of to receive from TokenConverter is less than expected
    /// @param expected Expected amount of tokens
    /// @param actual Actual amount of tokens
    error InsufficientLiquidity(uint256 expected, uint256 actual);

    /// @notice Thrown if the deadline has passed
    error DeadlinePassed(uint256 currentTimestamp, uint256 deadline);

    /// @notice Thrown on math underflow
    error Underflow();

    /// @notice Thrown on math overflow
    error Overflow();

    /// @param swapRouter_ PancakeSwap SmartRouter contract
    // solhint-disable-next-line no-empty-blocks
    constructor(ISmartRouter swapRouter_) ExactOutputFlashSwap(swapRouter_) {}

    /// @notice Converts tokens in a TokenConverter using a flash swap
    /// @param params Conversion parameters
    function convert(ConversionParameters calldata params) external {
        if (params.deadline < block.timestamp) {
            revert DeadlinePassed(block.timestamp, params.deadline);
        }

        _validatePath(params.path, address(params.tokenToSendToConverter), address(params.tokenToReceiveFromConverter));

        (uint256 amountToReceive, uint256 amountToPay) = params.converter.getUpdatedAmountIn(
            params.amount,
            address(params.tokenToSendToConverter),
            address(params.tokenToReceiveFromConverter)
        );
        if (params.amount != amountToReceive) {
            revert InsufficientLiquidity(params.amount, amountToReceive);
        }

        if (params.minIncome < 0) {
            params.tokenToReceiveFromConverter.safeTransferFrom(msg.sender, address(this), _u(-params.minIncome));
        }

        ConversionData memory data = ConversionData({
            beneficiary: params.beneficiary,
            tokenToSendToConverter: params.tokenToSendToConverter,
            amountToSendToConverter: amountToPay,
            tokenToReceiveFromConverter: params.tokenToReceiveFromConverter,
            amountToReceiveFromConverter: amountToReceive,
            minIncome: params.minIncome,
            converter: params.converter
        });

        _flashSwap(FlashSwapParams({ amountOut: amountToPay, path: params.path, data: abi.encode(data) }));
    }

    function _validatePath(bytes calldata path, address expectedPathStart, address expectedPathEnd) internal pure {
        address swapStart = path.toAddress(0);
        if (swapStart != expectedPathStart) {
            revert InvalidSwapStart(expectedPathStart, swapStart);
        }

        address swapEnd = path.toAddress(path.length - 20);
        if (swapEnd != expectedPathEnd) {
            revert InvalidSwapEnd(expectedPathEnd, swapEnd);
        }
    }

    function _onMoneyReceived(bytes memory data) internal override returns (IERC20 tokenIn, uint256 maxAmountIn) {
        ConversionData memory decoded = abi.decode(data, (ConversionData));

        uint256 receivedAmount = _convertViaTokenConverter(
            decoded.converter,
            decoded.tokenToSendToConverter,
            decoded.tokenToReceiveFromConverter,
            decoded.amountToReceiveFromConverter
        );

        return (decoded.tokenToReceiveFromConverter, _u(_i(receivedAmount) - decoded.minIncome));
    }

    function _onFlashSwapCompleted(bytes memory data) internal override {
        ConversionData memory decoded = abi.decode(data, (ConversionData));
        transferAll(decoded.tokenToReceiveFromConverter, address(this), decoded.beneficiary);
    }

    /// @dev Get `tokenToReceive` from TokenConverter, paying with `tokenToPay`
    /// @param converter TokenConverter contract
    /// @param tokenToPay Token to be sent to TokenConverter
    /// @param tokenToReceive Token to be received from TokenConverter
    /// @param amountToReceive Amount to receive from TokenConverter in `tokenToReceive` tokens
    function _convertViaTokenConverter(
        IAbstractTokenConverter converter,
        IERC20 tokenToPay,
        IERC20 tokenToReceive,
        uint256 amountToReceive
    ) internal returns (uint256) {
        uint256 balanceBefore = tokenToReceive.balanceOf(address(this));
        uint256 maxAmountToPay = tokenToPay.balanceOf(address(this));
        approveOrRevert(tokenToPay, address(converter), maxAmountToPay);
        converter.convertForExactTokens(
            maxAmountToPay,
            amountToReceive,
            address(tokenToPay),
            address(tokenToReceive),
            address(this)
        );
        approveOrRevert(tokenToPay, address(converter), 0);
        uint256 tokensReceived = tokenToReceive.balanceOf(address(this)) - balanceBefore;
        return tokensReceived;
    }

    function _u(int256 value) private pure returns (uint256) {
        if (value < 0) {
            revert Underflow();
        }
        return uint256(value);
    }

    function _i(uint256 value) private pure returns (int256) {
        if (value > uint256(type(int256).max)) {
            revert Overflow();
        }
        return int256(value);
    }
}
