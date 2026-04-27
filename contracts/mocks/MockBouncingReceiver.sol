// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

/**
 * @title MockBouncingReceiver
 * @notice On receiving ETH, immediately sends `bounceAmount` back to msg.sender.
 *         Used to test that the patched receive() guard prevents the
 *         CEI + receive() infinite-loop DoS scenario.
 *         When `enabled` is false, behaves like a normal EOA — accepts ETH silently.
 */
contract MockBouncingReceiver {
    bool public enabled;
    uint256 public bounceCount;
    uint256 public maxBounces = 3;

    function setEnabled(bool _v) external {
        enabled = _v;
    }

    function reset() external {
        bounceCount = 0;
    }

    receive() external payable {
        if (enabled && bounceCount < maxBounces && msg.value > 0) {
            bounceCount += 1;
            (bool ok, ) = payable(msg.sender).call{ value: msg.value }("");
            require(ok, "bounce failed");
        }
    }
}
