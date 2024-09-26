// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IVToken, IVBep20, IVAIController, IVBNB } from "@venusprotocol/venus-protocol/contracts/InterfacesV8.sol";
import { Liquidator } from "@venusprotocol/venus-protocol/contracts/Liquidator/Liquidator.sol";

import { LiquidityProvider } from "../flash-swap/common.sol";
import { FlashHandler } from "../flash-swap/FlashHandler.sol";
import { ExactOutputFlashSwap } from "../flash-swap/ExactOutputFlashSwap.sol";
import { FlashLoan } from "../flash-swap/FlashLoan.sol";
import { IPancakeSwapRouter } from "../third-party/interfaces/IPancakeSwapRouter.sol";
import { IUniswapRouter } from "../third-party/interfaces/IUniswapRouter.sol";
import { IWETH9 } from "../third-party/IWETH.sol";
import { transferAll } from "../util/transferAll.sol";
import { Token } from "../util/Token.sol";
import { checkDeadline, validatePathStart, validatePathEnd } from "../util/validators.sol";

contract CorePoolLiquidationOperator is ExactOutputFlashSwap, FlashLoan {
    /// @notice Liquidation parameters
    struct FlashLiquidationParameters {
        /// @notice AMM providing liquidity (either Uniswap or PancakeSwap)
        LiquidityProvider liquidityProvider;
        /// @notice The receiver of the liquidated collateral
        address beneficiary;
        /// @notice vToken for the borrowed underlying
        address vTokenBorrowed;
        /// @notice Borrower whose position is being liquidated
        address borrower;
        /// @notice Amount of borrowed tokens to repay
        uint256 repayAmount;
        /// @notice Collateral vToken to seize
        address vTokenCollateral;
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
        address vTokenBorrowed;
        /// @notice Borrower whose position is being liquidated
        address borrower;
        /// @notice Amount of borrowed tokens to repay
        uint256 repayAmount;
        /// @notice Collateral asset
        Token collateralUnderlying;
        /// @notice Collateral vToken to seize
        address vTokenCollateral;
    }

    Liquidator public immutable CORE_POOL_LIQUIDATOR;
    IVBNB public immutable VNATIVE;
    IVAIController public immutable VAI_CONTROLLER;
    Token public immutable VAI;
    IWETH9 public immutable WRAPPED_NATIVE;

    /// @notice Thrown if vToken.redeem(...) returns a nonzero error code
    error RedeemFailed(uint256 errorCode);

    /// @notice Thrown if receiving native assets from an unexpected sender
    error UnexpectedSender();

    /// @param uniswapSwapRouter_ Uniswap SwapRouter contract
    /// @param pcsSwapRouter_ PancakeSwap SmartRouter contract
    /// @param corePoolLiquidator_ Core pool Liquidator contract
    constructor(
        IUniswapRouter uniswapSwapRouter_,
        IPancakeSwapRouter pcsSwapRouter_,
        Liquidator corePoolLiquidator_
    ) FlashHandler(uniswapSwapRouter_, pcsSwapRouter_) {
        CORE_POOL_LIQUIDATOR = corePoolLiquidator_;
        VNATIVE = corePoolLiquidator_.vBnb();
        VAI_CONTROLLER = corePoolLiquidator_.vaiController();
        VAI = Token.wrap(VAI_CONTROLLER.getVAIAddress());
        WRAPPED_NATIVE = IWETH9(corePoolLiquidator_.wBNB());
    }

    receive() external payable {
        if (msg.sender != address(WRAPPED_NATIVE) && msg.sender != address(VNATIVE)) {
            revert UnexpectedSender();
        }
    }

    /// @notice Liquidates a borrower's position using flash swap or a flash loan
    /// @param params Liquidation parameters
    function liquidate(FlashLiquidationParameters calldata params, uint256 deadline) external {
        checkDeadline(deadline);

        address borrowedTokenAddress = _underlying(params.vTokenBorrowed);
        address collateralTokenAddress = _underlying(params.vTokenCollateral);

        uint256 repayAmount;
        if (params.repayAmount == type(uint256).max) {
            repayAmount = _borrowBalanceCurrent(params.vTokenBorrowed, params.borrower);
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
            _flashLoan(params.liquidityProvider, repayAmount, params.path, abi.encode(data));
        } else {
            validatePathEnd(params.path, collateralTokenAddress);
            _flashSwap(params.liquidityProvider, repayAmount, params.path, abi.encode(data));
        }
    }

    function _onMoneyReceived(bytes memory data_) internal override returns (Token tokenIn, uint256 maxAmountIn) {
        FlashLiquidationData memory data = abi.decode(data_, (FlashLiquidationData));

        _liquidateBorrow(
            data.vTokenBorrowed,
            data.borrowedUnderlying,
            data.borrower,
            data.repayAmount,
            data.vTokenCollateral
        );
        _redeem(data.vTokenCollateral, IVToken(data.vTokenCollateral).balanceOf(address(this)));

        return (data.collateralUnderlying, data.collateralUnderlying.balanceOfSelf());
    }

    function _onFlashCompleted(bytes memory data_) internal override {
        FlashLiquidationData memory data = abi.decode(data_, (FlashLiquidationData));
        data.collateralUnderlying.transferAll(data.beneficiary);
    }

    /// @dev Redeems ERC-20 tokens from the given vToken
    /// @param vToken The vToken to redeem tokens from
    /// @param vTokenAmount The amount of vTokens to redeem
    function _redeem(address vToken, uint256 vTokenAmount) internal {
        uint256 errorCode = IVToken(vToken).redeem(vTokenAmount);
        if (errorCode != 0) {
            revert RedeemFailed(errorCode);
        }
        if (vToken == address(VNATIVE)) {
            IWETH9(WRAPPED_NATIVE).deposit{ value: address(this).balance }();
        }
    }

    function _liquidateBorrow(
        address vTokenBorrowed,
        Token borrowedUnderlying,
        address borrower,
        uint256 repayAmount,
        address vTokenCollateral
    ) internal {
        if (vTokenBorrowed == address(VNATIVE)) {
            IWETH9(WRAPPED_NATIVE).withdraw(repayAmount);
            CORE_POOL_LIQUIDATOR.liquidateBorrow{ value: repayAmount }(
                vTokenBorrowed,
                borrower,
                repayAmount,
                IVToken(vTokenCollateral)
            );
        } else {
            borrowedUnderlying.approve(address(CORE_POOL_LIQUIDATOR), repayAmount);
            CORE_POOL_LIQUIDATOR.liquidateBorrow(vTokenBorrowed, borrower, repayAmount, IVToken(vTokenCollateral));
            borrowedUnderlying.approve(address(CORE_POOL_LIQUIDATOR), 0);
        }
    }

    function _borrowBalanceCurrent(address vToken, address borrower) internal returns (uint256) {
        if (vToken == address(VAI_CONTROLLER)) {
            VAI_CONTROLLER.accrueVAIInterest();
            return VAI_CONTROLLER.getVAIRepayAmount(borrower);
        }
        return IVToken(vToken).borrowBalanceCurrent(borrower);
    }

    function _underlying(address vToken) internal view returns (address) {
        if (vToken == address(VNATIVE)) {
            return address(WRAPPED_NATIVE);
        }
        if (vToken == address(VAI_CONTROLLER)) {
            return VAI.addr();
        }
        return IVBep20(vToken).underlying();
    }
}
