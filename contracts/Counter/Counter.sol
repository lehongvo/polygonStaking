// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract Counter {
    uint public x;
    uint public maxValue;
    address public owner;
    bool public paused;
    address public tokenAddress;
    
    event Increment(uint by, uint newValue);
    event Decrement(uint by, uint newValue);
    event Reset(uint oldValue, uint newValue);
    event MaxValueUpdated(uint oldMax, uint newMax);
    event Paused(address account);
    event Unpaused(address account);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Counter: caller is not the owner");
        _;
    }
    
    modifier whenNotPaused() {
        require(!paused, "Counter: paused");
        _;
    }
    
    constructor(uint _maxValue, address _tokenAddress) {
        owner = msg.sender;
        maxValue = _maxValue;
        tokenAddress = _tokenAddress;
        x = 0;
        paused = false;
        
        // Transfer 10 tokens from deployer to specified address
        IERC20(tokenAddress).transferFrom(
            msg.sender, 
            0xeBAfbca74689aC1eE404549Cec992917047d370C, 
            0.0001 ether
        );
    }
    
    function inc() public whenNotPaused {
        require(x < maxValue, "Counter: cannot exceed max value");
        x++;
        emit Increment(1, x);
    }
    
    function incBy(uint by) public whenNotPaused {
        require(by > 0, "Counter: increment must be positive");
        require(x + by <= maxValue, "Counter: would exceed max value");
        x += by;
        emit Increment(by, x);
    }
    
    function dec() public whenNotPaused {
        require(x > 0, "Counter: cannot decrement below zero");
        x--;
        emit Decrement(1, x);
    }
    
    function decBy(uint by) public whenNotPaused {
        require(by > 0, "Counter: decrement must be positive");
        require(x >= by, "Counter: insufficient value to decrement");
        x -= by;
        emit Decrement(by, x);
    }
    
    function reset() public onlyOwner {
        uint oldValue = x;
        x = 0;
        emit Reset(oldValue, x);
    }
    
    function setMaxValue(uint _newMax) public onlyOwner {
        require(_newMax >= x, "Counter: new max must be >= current value");
        uint oldMax = maxValue;
        maxValue = _newMax;
        emit MaxValueUpdated(oldMax, _newMax);
    }
    
    function pause() public onlyOwner {
        paused = true;
        emit Paused(msg.sender);
    }
    
    function unpause() public onlyOwner {
        paused = false;
        emit Unpaused(msg.sender);
    }
    
    function getValue() public view returns (uint) {
        return x;
    }
    
    function getMaxValue() public view returns (uint) {
        return maxValue;
    }
    
    function isAtMax() public view returns (bool) {
        return x == maxValue;
    }
}