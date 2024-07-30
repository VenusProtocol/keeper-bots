// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IRouter } from "../interfaces/IRouter.sol";

interface IUniswapRouter is IRouter {
    function factory() external view returns (address);
}
