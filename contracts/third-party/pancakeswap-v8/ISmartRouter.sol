// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;

interface ISmartRouter {
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

    function deployer() external view returns (address);

    function WETH9() external view returns (address);
}
