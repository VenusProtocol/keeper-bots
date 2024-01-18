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
import { ExactOutputFlash } from "../flash-swap/ExactOutputFlash.sol";

contract MoveDebtOperator is ExactOutputFlash {
    using SafeERC20 for IERC20;

    struct MoveDebtParams {
        uint256 maxExtraAmount;
        address originalSender;
        IVBep20 vTokenToRepay;
        address[] originalBorrowers;
        uint256[] repayAmounts;
        uint256 totalRepayAmount;
        IVBep20 vTokenToBorrow;
    }

    MoveDebtDelegate public immutable DELEGATE;

    constructor(ISmartRouter swapRouter_, MoveDebtDelegate delegate_) ExactOutputFlash(swapRouter_) {
        ensureNonzeroAddress(address(delegate_));
        DELEGATE = delegate_;
    }

    function moveDebt(
        IVBep20 vTokenToRepay,
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
        _moveDebts(vTokenToRepay, originalBorrowers, repayAmounts, repayAmount, vTokenToBorrow, maxExtraAmount, path);
    }

    function moveAllDebts(
        IVBep20 vTokenToRepay,
        address[] memory originalBorrowers,
        IVBep20 vTokenToBorrow,
        uint256 maxExtraAmount,
        bytes memory path
    ) external {
        uint256 borrowersCount = originalBorrowers.length;

        uint256[] memory repayAmounts = new uint256[](borrowersCount);
        uint256 totalRepayAmount = 0;
        for (uint256 i = 0; i < borrowersCount; ++i) {
            uint256 amount = vTokenToRepay.borrowBalanceCurrent(originalBorrowers[i]);
            repayAmounts[i] = amount;
            totalRepayAmount += amount;
        }
        _moveDebts(
            vTokenToRepay,
            originalBorrowers,
            repayAmounts,
            totalRepayAmount,
            vTokenToBorrow,
            maxExtraAmount,
            path
        );
    }

    function _moveDebts(
        IVBep20 vTokenToRepay,
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
            vTokenToRepay: vTokenToRepay,
            originalBorrowers: originalBorrowers,
            repayAmounts: repayAmounts,
            totalRepayAmount: totalRepayAmount,
            vTokenToBorrow: vTokenToBorrow
        });
        bytes memory data = abi.encode(params);
        FlashParams memory flashParams = FlashParams({ amountOut: totalRepayAmount, path: path, data: data });
        if (_underlying(vTokenToRepay) == _underlying(vTokenToBorrow)) {
            _flashLoan(flashParams);
        } else {
            _flashSwap(flashParams);
        }
    }

    function _onMoneyReceived(bytes memory data) internal override returns (IERC20 tokenIn, uint256 maxAmountIn) {
        MoveDebtParams memory params = abi.decode(data, (MoveDebtParams));
        IERC20 repayToken = _underlying(params.vTokenToRepay);
        IERC20 borrowToken = _underlying(params.vTokenToBorrow);

        uint256 balanceBefore = borrowToken.balanceOf(address(this));

        approveOrRevert(repayToken, address(DELEGATE), params.totalRepayAmount);
        uint256 borrowersCount = params.originalBorrowers.length;
        for (uint256 i = 0; i < borrowersCount; ++i) {
            DELEGATE.moveDebt(
                params.vTokenToRepay,
                params.originalBorrowers[i],
                params.repayAmounts[i],
                params.vTokenToBorrow
            );
        }
        approveOrRevert(repayToken, address(DELEGATE), 0);

        if (params.maxExtraAmount > 0) {
            borrowToken.safeTransferFrom(params.originalSender, address(this), params.maxExtraAmount);
        }

        uint256 balanceAfter = borrowToken.balanceOf(address(this));
        return (borrowToken, balanceAfter - balanceBefore);
    }

    function _onFlashCompleted(bytes memory data) internal override {
        MoveDebtParams memory params = abi.decode(data, (MoveDebtParams));

        transferAll(_underlying(params.vTokenToBorrow), address(this), params.originalSender);
        transferAll(_underlying(params.vTokenToRepay), address(this), params.originalSender);
    }

    function _underlying(IVBep20 vToken) internal view returns (IERC20) {
        return IERC20(vToken.underlying());
    }
}
