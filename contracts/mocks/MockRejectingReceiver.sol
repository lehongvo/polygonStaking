// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

/**
 * @title MockRejectingReceiver
 * @notice Used by the CHALLENGE-2825 tests as a configurable native-currency recipient
 *         (fee address / sponsor / award receiver). While `rejectEth` is true, any plain
 *         ETH transfer to this contract reverts, simulating a legitimate but misbehaving
 *         (or simply incompatible) payout recipient. `call(target, data)` lets the test
 *         suite drive arbitrary calls (e.g. claimPendingNative()) FROM this contract's
 *         address, bubbling up the real revert reason instead of swallowing it.
 */
contract MockRejectingReceiver {
    bool public rejectEth = true;

    function setReject(bool _reject) external {
        rejectEth = _reject;
    }

    function call(address target, bytes calldata data) external returns (bytes memory) {
        (bool ok, bytes memory ret) = target.call(data);
        if (!ok) {
            if (ret.length > 0) {
                assembly {
                    revert(add(ret, 32), mload(ret))
                }
            }
            revert("MockRejectingReceiver: call failed");
        }
        return ret;
    }

    receive() external payable {
        if (rejectEth) revert("MockRejectingReceiver: rejecting ETH");
    }
}
