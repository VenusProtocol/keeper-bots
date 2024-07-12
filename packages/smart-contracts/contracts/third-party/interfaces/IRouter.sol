// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

interface IRouter {
    struct ExactInputParams {
        bytes path;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
    }

    struct ExactOutputParams {
        bytes path;
        address recipient;
        uint256 amountOut;
        uint256 amountInMaximum;
    }

    function exactInput(ExactInputParams calldata params) external payable returns (uint256 amountOut);

    function exactOutput(ExactOutputParams calldata params) external payable returns (uint256 amountIn);

    function WETH9() external view returns (address);
}