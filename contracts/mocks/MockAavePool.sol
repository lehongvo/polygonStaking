// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract MockAavePool {
    using SafeERC20 for IERC20;

    mapping(address => mapping(address => uint256)) public userBalances;
    mapping(address => uint256) public totalSupplied;

    bool public shouldFail = false;
    uint256 public interestRate = 1050; // 5% interest (1.05x)

    function supply(
        address asset,
        uint256 amount,
        address onBehalfOf,
        uint16 referralCode
    ) external {
        require(!shouldFail, "Mock: Supply failed");

        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
        userBalances[onBehalfOf][asset] += amount;
        totalSupplied[asset] += amount;
    }

    function withdraw(address asset, uint256 amount, address to) external returns (uint256) {
        require(!shouldFail, "Mock: Withdraw failed");
        require(userBalances[to][asset] >= amount, "Insufficient balance");

        // Simulate interest earned
        uint256 withdrawAmount = (amount * interestRate) / 1000;

        userBalances[to][asset] -= amount;
        totalSupplied[asset] -= amount;

        IERC20(asset).safeTransfer(to, withdrawAmount);
        return withdrawAmount;
    }

    function getUserBalance(address user, address asset) external view returns (uint256) {
        return userBalances[user][asset];
    }

    function setFailure(bool _shouldFail) external {
        shouldFail = _shouldFail;
    }

    function setInterestRate(uint256 _rate) external {
        interestRate = _rate;
    }
}
