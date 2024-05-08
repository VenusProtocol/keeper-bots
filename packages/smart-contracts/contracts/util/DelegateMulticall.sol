// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

/// @title DelegateMulticall
/// @notice A base contract that allows the integrations to delegatecall into the current
///   contract or make regular calls to any contract in a batch fashion. Note that inheriting
///   from DelegateMulticall makes the contract useful for a SINGLE TRANSACTION ONLY.
///   Since the sender can directly request the contract to perform any call, e.g., transfer
///   ERC-20 tokens or execute a permissioned action, it is NOT SAFE to grant ANY permissions
///   to the inheriting contract or store any tokens (apart from within a single tx) in the
///   inheriting contract. This contract is NOT reentrancy-safe, i.e. the receiver of any
///   call can reenter into the calling contract. Thus, the caller MUST ensure that they're
///   only interacting with the known contracts.
contract DelegateMulticall {
    struct Call {
        address target;
        bool allowFailure;
        bytes callData;
    }

    struct Result {
        bool success;
        bytes returnData;
    }

    error CallFailed(uint256 callIndex, bytes err);

    function batch(Call[] calldata calls) external returns (Result[] memory returnData) {
        uint256 length = calls.length;
        returnData = new Result[](length);
        Call calldata call;
        for (uint256 i = 0; i < length; ++i) {
            Result memory result = returnData[i];
            call = calls[i];
            if (call.target == address(0)) {
                (result.success, result.returnData) = address(this).delegatecall(call.callData);
            } else {
                (result.success, result.returnData) = call.target.call(call.callData);
            }
            if (!result.success && !call.allowFailure) {
                revert CallFailed(i, result.returnData);
            }
        }
    }
}
