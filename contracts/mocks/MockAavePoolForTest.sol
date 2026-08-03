// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

interface IERC20Minimal {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address owner) external view returns (uint256);
}

/**
 * @title MockAavePoolForTest
 * @notice Minimal Aave Pool mock for testing CHALLENGE-2695 (staking withdraw order). Only
 *         implements the 2 functions ChallengeDetailV2 actually calls: supply() pulls the
 *         approved amount from the caller (simulating a real deposit into the pool), and
 *         withdraw() sends this mock's ENTIRE held balance of the asset back to `to` --
 *         a test funds this contract with extra tokens beyond what supply() pulled in to
 *         simulate accrued yield. Deployed via hardhat_setCode at the real, hardcoded
 *         AAVE_POOL_ADDRESS.
 */
contract MockAavePoolForTest {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16) external {
        IERC20Minimal(asset).transferFrom(onBehalfOf, address(this), amount);
    }

    function withdraw(address asset, uint256 /* amount */, address to) external returns (uint256) {
        uint256 heldBalance = IERC20Minimal(asset).balanceOf(address(this));
        IERC20Minimal(asset).transfer(to, heldBalance);
        return heldBalance;
    }
}
