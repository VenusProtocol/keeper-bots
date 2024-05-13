// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import { BytesLib } from "../third-party/pancakeswap-v8/BytesLib.sol";

/// @notice Thrown if the provided swap path start does not correspond to the expected one
/// @param expected Expected swap path start
/// @param actual Provided swap path start
error InvalidSwapStart(address expected, address actual);

/// @notice Thrown if the provided swap path end does not correspond to the expected one
/// @param expected Expected swap path end
/// @param actual Provided swap path end
error InvalidSwapEnd(address expected, address actual);

/// @notice Thrown if the deadline has passed
error DeadlinePassed(uint256 currentTimestamp, uint256 deadline);

/// @notice Checks if swap path starts with `expectedPathStart`, reverts otherwise.
/// @param expectedPathStart Expected swap path start
function validatePathStart(bytes calldata path, address expectedPathStart) pure {
    address swapStart = BytesLib.toAddress(path, 0);
    if (swapStart != expectedPathStart) {
        revert InvalidSwapStart(expectedPathStart, swapStart);
    }
}

/// @notice Checks if swap path ends with `expectedPathEnd`, reverts otherwise.
/// @param expectedPathEnd Expected swap path end
function validatePathEnd(bytes calldata path, address expectedPathEnd) pure {
    address swapEnd = BytesLib.toAddress(path, path.length - 20);
    if (swapEnd != expectedPathEnd) {
        revert InvalidSwapEnd(expectedPathEnd, swapEnd);
    }
}

/// @notice Checks if swap path starts with `expectedPathStart` and ends with `expectedPathEnd`,
///   reverts if either of the checks is not successful.
/// @param expectedPathStart Expected swap path start
/// @param expectedPathEnd Expected swap path end
function validatePath(bytes calldata path, address expectedPathStart, address expectedPathEnd) pure {
    validatePathStart(path, expectedPathStart);
    validatePathEnd(path, expectedPathEnd);
}

/// @notice Check whether the current timestamp is less than or equal to the specified
///   deadline, reverts otherwise.
/// @param deadline The deadline to check against
function checkDeadline(uint256 deadline) view {
    if (deadline < block.timestamp) {
        revert DeadlinePassed(block.timestamp, deadline);
    }
}
