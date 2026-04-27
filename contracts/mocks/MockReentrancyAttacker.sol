// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

interface IGiveUpTarget {
    function giveUp(
        address[] memory,
        uint256[][] memory,
        address[][] memory,
        bool[] memory
    ) external;
}

/**
 * @title MockReentrancyAttacker
 * @notice On receiving ETH, attempts to re-enter `giveUp(...)` on `target`.
 *         Uses try/catch so the outer transfer succeeds; we can then read
 *         `reentryAttempts` and `lastRevertReason` to prove the reentrancy
 *         guard fired without crashing the outer transaction.
 */
contract MockReentrancyAttacker {
    address public target;
    bool public attackArmed;
    uint256 public reentryAttempts;
    bool public lastReentryReverted;
    string public lastRevertReason;

    function setTarget(address _t) external {
        target = _t;
    }

    function arm() external {
        attackArmed = true;
        reentryAttempts = 0;
        lastReentryReverted = false;
        lastRevertReason = "";
    }

    function disarm() external {
        attackArmed = false;
    }

    receive() external payable {
        if (attackArmed && target != address(0) && reentryAttempts == 0) {
            reentryAttempts = 1;
            address[] memory empty = new address[](0);
            uint256[][] memory emptyIdx = new uint256[][](0);
            address[][] memory emptySender = new address[][](0);
            bool[] memory emptyStatus = new bool[](0);
            try IGiveUpTarget(target).giveUp(empty, emptyIdx, emptySender, emptyStatus) {
                // Reentry succeeded (BAD — guard failed)
                lastReentryReverted = false;
            } catch Error(string memory reason) {
                lastReentryReverted = true;
                lastRevertReason = reason;
            } catch {
                lastReentryReverted = true;
                lastRevertReason = "(low-level revert)";
            }
        }
    }
}
