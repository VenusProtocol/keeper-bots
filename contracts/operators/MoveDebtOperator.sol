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
        address originalBorrower;
        uint256 repayAmount;
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
        MoveDebtParams memory params = MoveDebtParams({
            maxExtraAmount: maxExtraAmount,
            originalSender: msg.sender,
            originalBorrower: originalBorrower,
            repayAmount: repayAmount,
            vTokenToBorrow: vTokenToBorrow
        });

        bytes memory data = abi.encode(params);
        _flashSwap(FlashSwapParams({ amountOut: repayAmount, path: path, data: data }));
    }

    function _onMoneyReceived(bytes memory data) internal override returns (IERC20 tokenIn, uint256 maxAmountIn) {
        MoveDebtParams memory params = abi.decode(data, (MoveDebtParams));
        IERC20 repayToken = _repayToken();
        IERC20 borrowToken = _borrowToken(params);

        uint256 balanceBefore = borrowToken.balanceOf(address(this));

        approveOrRevert(repayToken, address(DELEGATE), params.repayAmount);
        DELEGATE.moveDebt(params.originalBorrower, params.repayAmount, params.vTokenToBorrow);
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
