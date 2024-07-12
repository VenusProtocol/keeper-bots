// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IRouter } from "../interfaces/IRouter.sol";

interface IPancakeSwapRouter is IRouter {
    function deployer() external view returns (address);
}
