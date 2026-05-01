// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

/**
 * @title MockVRFConsumerBase
 * @notice Implements IVRFConsumerBase interface used by Gacha. Random value
 *         is fully controlled via setRandomResult so tests are deterministic.
 *         No actual Chainlink VRF interaction.
 */
contract MockVRFConsumerBase {
    uint256 public randomResult;
    uint256 public lastLimit;
    uint256 public requestCount;

    function setRandomResult(uint256 v) external {
        randomResult = v;
    }

    function getRandomNumber() external returns (bytes32) {
        requestCount++;
        return bytes32(requestCount);
    }

    function createRandomNumberOnlyTime(uint256 limit) external {
        lastLimit = limit;
        requestCount++;
    }

    function createRandomNumberMultipleTime(uint256 limit) external view returns (uint256) {
        // View function returns current randomResult bounded by limit
        return limit == 0 ? 0 : randomResult % limit;
    }
}
