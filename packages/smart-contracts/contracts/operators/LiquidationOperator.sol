// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { VTokenInterface } from "@venusprotocol/isolated-pools/contracts/VTokenInterfaces.sol";

import { LiquidityProvider } from "../flash-swap/common.sol";
import { FlashHandler } from "../flash-swap/FlashHandler.sol";
import { ExactOutputFlashSwap } from "../flash-swap/ExactOutputFlashSwap.sol";
import { FlashLoan } from "../flash-swap/FlashLoan.sol";
import { IPancakeSwapRouter } from "../third-party/interfaces/IPancakeSwapRouter.sol";
import { IUniswapRouter } from "../third-party/interfaces/IUniswapRouter.sol";
import { Token } from "../util/Token.sol";
import { checkDeadline, validatePathStart, validatePathEnd } from "../util/validators.sol";

contract LiquidationOperator is ExactOutputFlashSwap, FlashLoan {
    /// @notice Liquidation parameters
    struct FlashLiquidationParameters {
        /// @notice AMM providing liquidity (either Uniswap or PancakeSwap)
        LiquidityProvider liquidityProvider;
        /// @notice The receiver of the liquidated collateral
        address beneficiary;
        /// @notice vToken for the borrowed underlying
        VTokenInterface vTokenBorrowed;
        /// @notice Borrower whose position is being liquidated
        address borrower;
        /// @notice Amount of borrowed tokens to repay
        uint256 repayAmount;
        /// @notice Collateral vToken to seize
        VTokenInterface vTokenCollateral;
        /// @notice Reversed (!) swap path to use for liquidation. For regular (not in-kind)
        /// liquidations it should start with the borrowed token and end with the collateral
        /// token. For in-kind liquidations, must consist of a single PancakeSwap pool to
        /// source the liquidity from.
        bytes path;
    }

    /// @notice Liquidation data to pass between the calls
    struct FlashLiquidationData {
        /// @notice The receiver of the liquidated collateral
        address beneficiary;
        /// @notice The borrowed underlying
        Token borrowedUnderlying;
        /// @notice vToken for the borrowed underlying
        VTokenInterface vTokenBorrowed;
        /// @notice Borrower whose position is being liquidated
        address borrower;
        /// @notice Amount of borrowed tokens to repay
        uint256 repayAmount;
        /// @notice Collateral asset
        Token collateralUnderlying;
        /// @notice Collateral vToken to seize
        VTokenInterface vTokenCollateral;
    }

    /// @notice Thrown if vToken.redeem(...) returns a nonzero error code
    error RedeemFailed(uint256 errorCode);

    /// @param uniswapSwapRouter_ Uniswap SwapRouter contract
    /// @param pcsSwapRouter_ PancakeSwap SmartRouter contract
    constructor(
        IUniswapRouter uniswapSwapRouter_,
        IPancakeSwapRouter pcsSwapRouter_
    ) FlashHandler(uniswapSwapRouter_, pcsSwapRouter_) {}

    /// @notice Liquidates a borrower's position using flash swap or a flash loan
    /// @param params Liquidation parameters
    function liquidate(FlashLiquidationParameters calldata params, uint256 deadline) external {
        checkDeadline(deadline);

        address borrowedTokenAddress = params.vTokenBorrowed.underlying();
        address collateralTokenAddress = params.vTokenCollateral.underlying();

        uint256 repayAmount;
        if (params.repayAmount == type(uint256).max) {
            repayAmount = params.vTokenBorrowed.borrowBalanceCurrent(params.borrower);
        } else {
            repayAmount = params.repayAmount;
        }

        validatePathStart(params.path, borrowedTokenAddress);
        FlashLiquidationData memory data = FlashLiquidationData({
            beneficiary: params.beneficiary,
            borrowedUnderlying: Token.wrap(borrowedTokenAddress),
            vTokenBorrowed: params.vTokenBorrowed,
            borrower: params.borrower,
            repayAmount: repayAmount,
            collateralUnderlying: Token.wrap(collateralTokenAddress),
            vTokenCollateral: params.vTokenCollateral
        });

        if (collateralTokenAddress == borrowedTokenAddress) {
            _flashLoan(params.liquidityProvider, params.repayAmount, params.path, abi.encode(data));
        } else {
            validatePathEnd(params.path, collateralTokenAddress);
            _flashSwap(params.liquidityProvider, params.repayAmount, params.path, abi.encode(data));
        }
    }

    function _onMoneyReceived(bytes memory data_) internal override returns (Token tokenIn, uint256 maxAmountIn) {
        FlashLiquidationData memory data = abi.decode(data_, (FlashLiquidationData));

        data.borrowedUnderlying.approve(address(data.vTokenBorrowed), data.repayAmount);
        data.vTokenBorrowed.liquidateBorrow(data.borrower, data.repayAmount, data.vTokenCollateral);
        data.borrowedUnderlying.approve(address(data.vTokenBorrowed), 0);

        _redeem(data.vTokenCollateral, data.vTokenCollateral.balanceOf(address(this)));

        return (data.collateralUnderlying, data.collateralUnderlying.balanceOfSelf());
    }

    function _onFlashCompleted(bytes memory data_) internal override {
        FlashLiquidationData memory data = abi.decode(data_, (FlashLiquidationData));
        data.collateralUnderlying.transferAll(data.beneficiary);
    }

    /// @dev Redeems ERC-20 tokens from the given vToken
    /// @param vToken The vToken to redeem tokens from
    /// @param vTokenAmount The amount of vTokens to redeem
    function _redeem(VTokenInterface vToken, uint256 vTokenAmount) internal {
        uint256 errorCode = vToken.redeem(vTokenAmount);
        if (errorCode != 0) {
            revert RedeemFailed(errorCode);
        }
    }
}
