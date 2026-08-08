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
    // CHALLENGE-2734 re-review: `catch Error(string)` / bare `catch` collapse every custom
    // error to the same "(low-level revert)" string, so a test asserting only
    // lastReentryReverted/lastRevertReason cannot tell "blocked by nonReentrant" apart from
    // "blocked by some other, unrelated guard" -- exactly the gap that let this test pass
    // identically with the guard present or removed. The 4-byte selector is the one thing
    // that actually distinguishes them.
    bytes4 public lastRevertSelector;

    function setTarget(address _t) external {
        target = _t;
    }

    function arm() external {
        attackArmed = true;
        reentryAttempts = 0;
        lastReentryReverted = false;
        lastRevertReason = "";
        lastRevertSelector = bytes4(0);
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
            } catch (bytes memory data) {
                lastReentryReverted = true;
                lastRevertReason = "(low-level revert)";
                if (data.length >= 4) {
                    lastRevertSelector = bytes4(data);
                }
            }
        }
    }
}
