// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

/**
 * @title MockBlockingERC20
 * @notice Minimal ERC20 for testing failed token transfers: a transfer to a blocked address reverts (like a
 *         blacklisted JPYC holder). Anyone can mint and block.
 */
contract MockBlockingERC20 {
    mapping(address => uint256) public balanceOf;
    mapping(address => bool) public blocked;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function setBlocked(address account, bool value) external {
        blocked[account] = value;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(!blocked[to], "blocked");
        require(balanceOf[msg.sender] >= amount, "insufficient");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}
