// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

/**
 * @title MockAToken
 * @notice Minimal mintable/burnable aToken balance mock for testing CHALLENGE-2697
 *         (PolygonDeFiAggregator Aave custody/share accounting). Only `pool` may mint/burn.
 *         Deployed via hardhat_setCode at the real hardcoded aToken address
 *         PolygonDeFiAggregator._getATokenAddress() returns -- hardhat_setCode replaces only
 *         bytecode, so `pool` starts unset and must be configured after planting.
 */
contract MockAToken {
    address public pool;
    mapping(address => uint256) public balanceOf;

    function setPool(address _pool) external {
        pool = _pool;
    }

    function mint(address to, uint256 amount) external {
        require(msg.sender == pool, "MockAToken: only pool");
        balanceOf[to] += amount;
    }

    function burn(address from, uint256 amount) external {
        require(msg.sender == pool, "MockAToken: only pool");
        balanceOf[from] -= amount;
    }
}
