// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IAbstractTokenConverter } from "@venusprotocol/protocol-reserve/contracts/TokenConverter/IAbstractTokenConverter.sol";

import { FlashHandler } from "../flash-swap/FlashHandler.sol";
import { ExactOutputFlashSwap } from "../flash-swap/ExactOutputFlashSwap.sol";
import { Token } from "../util/Token.sol";
import { DelegateMulticall } from "../util/DelegateMulticall.sol";
import { checkDeadline as _checkDeadline, validatePath } from "../util/validators.sol";
import { ISmartRouter } from "../third-party/pancakeswap-v8/ISmartRouter.sol";
import { ISignatureTransfer } from "../third-party/permit2/ISignatureTransfer.sol";

/// @title BatchTokenConverterOperator
/// @notice Converts tokens in a TokenConverter using an exact-output flash swap,
///   allowing for batch calls via multicall and permit2-style approvals.
///   Note that this contract is NOT designed to be operational outside of a single
///   transaction, e.g. anyone can withdraw all of its token holdings, so it's
///   important to use convert(...) and claimAll(...) in one transaction via batch().
///   See `DelegateMulticall` documentation for more detais on how to use this
///   contract securely.
/// @dev Conversions happen similar to TokenConverterOperator
contract BatchTokenConverterOperator is ExactOutputFlashSwap, DelegateMulticall {
    using SafeERC20 for IERC20;

    /// @notice Conversion parameters
    struct ConversionParameters {
        /// @notice The token currently in the TokenConverter
        Token tokenToReceiveFromConverter;
        /// @notice The amount (in `tokenToReceiveFromConverter` tokens) to receive as a result of conversion
        uint256 amount;
        /// @notice Minimal income to get from the arbitrage transaction (in `tokenToReceiveFromConverter`).
        ///   This value can be negative to indicate that the sender is willing to pay for the transaction
        ///   execution. In this case, a `sponsorWithPermit(...)` call should be made before the conversion.
        int256 minIncome;
        /// @notice The token the TokenConverter would get
        Token tokenToSendToConverter;
        /// @notice Address of the token converter contract to arbitrage
        IAbstractTokenConverter converter;
        /// @notice Reversed (exact output) path to trade from `tokenToReceiveFromConverter`
        /// to `tokenToSendToConverter`
        bytes path;
    }

    /// @notice Conversion data to pass between calls
    struct ConversionData {
        /// @notice The token the TokenConverter would receive
        Token tokenToSendToConverter;
        /// @notice The amount (in `amountToSendToConverter` tokens) to send to converter
        uint256 amountToSendToConverter;
        /// @notice The token currently in the TokenConverter
        Token tokenToReceiveFromConverter;
        /// @notice The amount (in `tokenToReceiveFromConverter` tokens) to receive
        uint256 amountToReceiveFromConverter;
        /// @notice Minimal income to get from the arbitrage transaction (in `amountToReceiveFromConverter`).
        int256 minIncome;
        /// @notice Address of the token converter contract to arbitrage
        IAbstractTokenConverter converter;
    }

    ISignatureTransfer public immutable PERMIT2;

    /// @notice Thrown if the amount of to receive from TokenConverter is less than expected
    /// @param expected Expected amount of tokens
    /// @param actual Actual amount of tokens
    error InsufficientLiquidity(uint256 expected, uint256 actual);

    /// @notice Thrown on math underflow
    error Underflow();

    /// @notice Thrown on math overflow
    error Overflow();

    /// @param swapRouter_ PancakeSwap SmartRouter contract
    // solhint-disable-next-line no-empty-blocks
    constructor(ISmartRouter swapRouter_, ISignatureTransfer permit2_) FlashHandler(swapRouter_) {
        PERMIT2 = permit2_;
    }

    /// @notice Transfers the specified token amounts from sender to this contract
    /// @param permit Permit2-style batch transfer permit
    /// @param signature Permit signature
    function sponsorWithPermit(
        ISignatureTransfer.PermitBatchTransferFrom calldata permit,
        bytes calldata signature
    ) external {
        uint256 tokensCount = permit.permitted.length;
        ISignatureTransfer.SignatureTransferDetails[]
            memory transferDetails = new ISignatureTransfer.SignatureTransferDetails[](tokensCount);
        for (uint256 i; i < tokensCount; ++i) {
            transferDetails[i] = ISignatureTransfer.SignatureTransferDetails({
                to: address(this),
                requestedAmount: permit.permitted[i].amount
            });
        }
        PERMIT2.permitTransferFrom(permit, transferDetails, msg.sender, signature);
    }

    /// @notice Same as convert(...) but does not perform the deadline check
    /// @param params Conversion parameters
    function convert(ConversionParameters calldata params) external {
        validatePath(params.path, params.tokenToSendToConverter.addr(), params.tokenToReceiveFromConverter.addr());

        (uint256 amountToReceive, uint256 amountToPay) = params.converter.getUpdatedAmountIn(
            params.amount,
            params.tokenToSendToConverter.addr(),
            params.tokenToReceiveFromConverter.addr()
        );
        if (params.amount != amountToReceive) {
            revert InsufficientLiquidity(params.amount, amountToReceive);
        }

        ConversionData memory data = ConversionData({
            tokenToSendToConverter: params.tokenToSendToConverter,
            amountToSendToConverter: amountToPay,
            tokenToReceiveFromConverter: params.tokenToReceiveFromConverter,
            amountToReceiveFromConverter: amountToReceive,
            minIncome: params.minIncome,
            converter: params.converter
        });

        _flashSwap(amountToPay, params.path, abi.encode(data));
    }

    /// @notice Claim refund or income to beneficiary
    /// @param token ERC-20 token address
    /// @param amount Amount to transfer
    /// @param beneficiary Receiver of the token
    function claimTo(Token token, uint256 amount, address beneficiary) external {
        token.transfer(beneficiary, amount);
    }

    /// @notice Claim the entire token balance to beneficiary
    /// @param token ERC-20 token address
    /// @param beneficiary Receiver of the token
    function claimAllTo(Token token, address beneficiary) external {
        token.transferAll(beneficiary);
    }

    /// @notice Reverts if transaction execution deadline has passed
    /// @param deadline Deadline timestamp
    function checkDeadline(uint256 deadline) external view {
        _checkDeadline(deadline);
    }

    function _onMoneyReceived(bytes memory data) internal override returns (Token tokenIn, uint256 maxAmountIn) {
        ConversionData memory decoded = abi.decode(data, (ConversionData));

        uint256 receivedAmount = _convertViaTokenConverter(
            decoded.converter,
            decoded.tokenToSendToConverter,
            decoded.tokenToReceiveFromConverter,
            decoded.amountToReceiveFromConverter
        );

        return (decoded.tokenToReceiveFromConverter, _u(_i(receivedAmount) - decoded.minIncome));
    }

    /// @dev Get `tokenToReceive` from TokenConverter, paying with `tokenToPay`
    /// @param converter TokenConverter contract
    /// @param tokenToPay Token to be sent to TokenConverter
    /// @param tokenToReceive Token to be received from TokenConverter
    /// @param amountToReceive Amount to receive from TokenConverter in `tokenToReceive` tokens
    function _convertViaTokenConverter(
        IAbstractTokenConverter converter,
        Token tokenToPay,
        Token tokenToReceive,
        uint256 amountToReceive
    ) internal returns (uint256) {
        uint256 balanceBefore = tokenToReceive.balanceOf(address(this));
        uint256 maxAmountToPay = tokenToPay.balanceOf(address(this));

        tokenToPay.approve(address(converter), maxAmountToPay);
        converter.convertForExactTokens(
            maxAmountToPay,
            amountToReceive,
            tokenToPay.addr(),
            tokenToReceive.addr(),
            address(this)
        );
        tokenToPay.approve(address(converter), 0);
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
