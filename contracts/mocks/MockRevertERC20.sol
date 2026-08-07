// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

contract MockRevertERC20 {
    string public name;
    string public symbol;
    uint8 public decimals = 18;
    mapping(address => uint256) public balanceOf;

    event Transfer(address indexed from, address indexed to, uint256 value);

    constructor(string memory _name, string memory _symbol) {
        name = _name;
        symbol = _symbol;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function transfer(address, uint256) external pure returns (bool) {
        revert("MockRevertERC20: transfer blocked");
    }
}
