// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

/** @title MockCountingGacha  @notice Counts randomRewards calls (or reverts on demand), for gacha trigger tests. */
contract MockCountingGacha {
    uint256 public calls;
    uint256[] public lastValues;
    bool public shouldRevert;

    function setShouldRevert(bool value) external {
        shouldRevert = value;
    }

    function randomRewards(address, uint256[] memory _values) external returns (bool) {
        require(!shouldRevert, "MOCK: gacha paused");
        calls = calls + 1;
        lastValues = _values;
        return true;
    }
}
