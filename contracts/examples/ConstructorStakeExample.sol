// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

interface IPolygonDeFiAggregatorExample {
    function createTimeLockedStake(
        address _token,
        uint256 _amount,
        string memory _protocol,
        uint256 _lockDuration
    ) external payable returns (uint256 stakeId);

    function withdrawTimeLockedStake(uint256 _stakeId) external;

    function WMATIC_ADDRESS() external view returns (address);
}

contract ConstructorStakeExample {
    address public immutable aggregator = 0xC56E28efdcf5c1974F3b7148a0a72c8bc2Fdb559; // Polygon DeFi Aggregator
    uint256 public immutable stakeId;
    uint256 public immutable stakedAmount;
    address public immutable owner;

    constructor(
        uint256 _amount,
        string memory _protocol
    ) payable {
        require(msg.value == _amount, "value != amount");
        owner = msg.sender; // Set owner
        stakedAmount = _amount;
        
        IPolygonDeFiAggregatorExample agg = IPolygonDeFiAggregatorExample(aggregator);
        address wmatic = agg.WMATIC_ADDRESS();
        uint256 id = agg.createTimeLockedStake{value: _amount}(
            wmatic,
            _amount,
            _protocol,
            2 days
        );
        stakeId = id;
    }

    /**
     * @dev Withdraw the staked amount + rewards to the owner
     * Only the owner (deployer) can call this function
     */
    function withdrawStake() external {
        require(msg.sender == owner, "Only owner can withdraw");
        
        // Get balance before withdrawal
        uint256 balanceBefore = address(this).balance;
        
        // Withdraw from staking protocol
        IPolygonDeFiAggregatorExample agg = IPolygonDeFiAggregatorExample(aggregator);
        agg.withdrawTimeLockedStake(stakeId);
        
        // Get balance after withdrawal
        uint256 balanceAfter = address(this).balance;
        uint256 withdrawnAmount = balanceAfter - balanceBefore;
        
        // Transfer all withdrawn amount to owner
        if (withdrawnAmount > 0) {
            payable(owner).transfer(withdrawnAmount);
        }
    }

    /**
     * @dev Get the current balance of this contract
     */
    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @dev Emergency function to withdraw any remaining funds
     * Only the owner can call this function
     */
    function emergencyWithdraw() external {
        require(msg.sender == owner, "Only owner can emergency withdraw");
        uint256 balance = address(this).balance;
        if (balance > 0) {
            payable(owner).transfer(balance);
        }
    }

    /**
     * @dev Accept native MATIC from PolygonDeFiAggregator
     * This allows the contract to receive MATIC when withdrawing from staking
     */
    receive() external payable {}

    /**
     * @dev Fallback function to accept any calls
     */
    fallback() external payable {}
}


