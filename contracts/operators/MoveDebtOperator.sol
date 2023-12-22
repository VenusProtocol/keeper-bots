// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IVBep20 } from "@venusprotocol/venus-protocol/contracts/InterfacesV8.sol";
import { MoveDebtDelegate } from "@venusprotocol/venus-protocol/contracts/DelegateBorrowers/MoveDebtDelegate.sol";
import { ensureNonzeroAddress } from "@venusprotocol/solidity-utilities/contracts/validators.sol";

import { approveOrRevert } from "../util/approveOrRevert.sol";
import { transferAll } from "../util/transferAll.sol";
import { ISmartRouter } from "../third-party/pancakeswap-v8/ISmartRouter.sol";
import { ExactOutputFlashSwap } from "../flash-swap/ExactOutputFlashSwap.sol";

contract MoveDebtOperator is ExactOutputFlashSwap {
    using SafeERC20 for IERC20;

    struct MoveDebtParams {
        uint256 maxExtraAmount;
        address originalSender;
        address[] originalBorrowers;
        uint256[] repayAmounts;
        uint256 totalRepayAmount;
        IVBep20 vTokenToBorrow;
    }

    MoveDebtDelegate public immutable DELEGATE;

    constructor(ISmartRouter swapRouter_, MoveDebtDelegate delegate_) ExactOutputFlashSwap(swapRouter_) {
        ensureNonzeroAddress(address(delegate_));
        DELEGATE = delegate_;
    }

    function moveDebt(
        address originalBorrower,
        uint256 repayAmount,
        IVBep20 vTokenToBorrow,
        uint256 maxExtraAmount,
        bytes memory path
    ) external {
        address[] memory originalBorrowers = new address[](1);
        uint256[] memory repayAmounts = new uint256[](1);
        originalBorrowers[0] = originalBorrower;
        repayAmounts[0] = repayAmount;
        _moveDebts(originalBorrowers, repayAmounts, repayAmount, vTokenToBorrow, maxExtraAmount, path);
    }

    function moveAllDebts(
        address[] memory originalBorrowers,
        IVBep20 vTokenToBorrow,
        uint256 maxExtraAmount,
        bytes memory path
    ) external {
        uint256 borrowersCount = originalBorrowers.length;
        IVBep20 vTokenToRepay = DELEGATE.vTokenToRepay();

        uint256[] memory repayAmounts = new uint256[](borrowersCount);
        uint256 totalRepayAmount = 0;
        for (uint256 i = 0; i < borrowersCount; ++i) {
            uint256 amount = vTokenToRepay.borrowBalanceCurrent(originalBorrowers[i]);
            repayAmounts[i] = amount;
            totalRepayAmount += amount;
        }
        _moveDebts(originalBorrowers, repayAmounts, totalRepayAmount, vTokenToBorrow, maxExtraAmount, path);
    }

    function _moveDebts(
        address[] memory originalBorrowers,
        uint256[] memory repayAmounts,
        uint256 totalRepayAmount,
        IVBep20 vTokenToBorrow,
        uint256 maxExtraAmount,
        bytes memory path
    ) internal {
        MoveDebtParams memory params = MoveDebtParams({
            maxExtraAmount: maxExtraAmount,
            originalSender: msg.sender,
            originalBorrowers: originalBorrowers,
            repayAmounts: repayAmounts,
            totalRepayAmount: totalRepayAmount,
            vTokenToBorrow: vTokenToBorrow
        });
        bytes memory data = abi.encode(params);
        _flashSwap(FlashSwapParams({ amountOut: totalRepayAmount, path: path, data: data }));
    }

    function _onMoneyReceived(bytes memory data) internal override returns (IERC20 tokenIn, uint256 maxAmountIn) {
        MoveDebtParams memory params = abi.decode(data, (MoveDebtParams));
        IERC20 repayToken = _repayToken();
        IERC20 borrowToken = _borrowToken(params);

        uint256 balanceBefore = borrowToken.balanceOf(address(this));

        approveOrRevert(repayToken, address(DELEGATE), params.totalRepayAmount);
        uint256 borrowersCount = params.originalBorrowers.length;
        for (uint256 i = 0; i < borrowersCount; ++i) {
            DELEGATE.moveDebt(params.originalBorrowers[i], params.repayAmounts[i], params.vTokenToBorrow);
        }
        approveOrRevert(repayToken, address(DELEGATE), 0);

        if (params.maxExtraAmount > 0) {
            borrowToken.safeTransferFrom(params.originalSender, address(this), params.maxExtraAmount);
        }

        uint256 balanceAfter = borrowToken.balanceOf(address(this));
        return (borrowToken, balanceAfter - balanceBefore);
    }

    function _onFlashSwapCompleted(bytes memory data) internal override {
        MoveDebtParams memory params = abi.decode(data, (MoveDebtParams));

        transferAll(_borrowToken(params), address(this), params.originalSender);
        transferAll(_repayToken(), address(this), params.originalSender);
    }

    function _repayToken() internal view returns (IERC20) {
        return IERC20(DELEGATE.vTokenToRepay().underlying());
    }

    function _borrowToken(MoveDebtParams memory params) internal view returns (IERC20) {
        return IERC20(params.vTokenToBorrow.underlying());
    }
}
