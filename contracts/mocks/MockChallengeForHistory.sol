// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "../HistoryChallenges/IChallenge.sol";

/**
 * @title MockChallengeForHistory
 * @notice CHALLENGE-2705: minimal, fully-settable IChallenge implementation for testing
 *         HistoryChallenges in isolation -- a real ChallengeDetail deployment couples this
 *         helper's tests to unrelated settlement/constructor logic. Every field defaults to
 *         the interface's zero value and is set individually via the setters below.
 */
contract MockChallengeForHistory is IChallenge {
    uint256 public goal;
    uint256 public duration;
    uint256 public dayRequired;
    uint256 public totalReward;
    uint256[] private balanceTokenArr;
    mapping(uint256 => bool) private allowGiveUpArr;
    address public donationWalletAddress;
    address public returnedNFTWallet;
    uint256[] private awardReceiversPercentArr;
    address public challenger;
    address public sponsor;
    bool public isFinished;
    bool public isSuccess;
    mapping(uint256 => address) private erc721AddressArr;
    uint256 public startTime;
    uint256 public endTime;
    address[] private erc20ListAddressArr;
    uint256 public indexNft;
    address public createByToken;
    uint256 public contractBalance;
    uint256 public totalBalanceBaseToken;

    function setAllowGiveUp(uint256 index, bool value) external {
        allowGiveUpArr[index] = value;
    }

    function allowGiveUp(uint256 _index) external view returns (bool) {
        return allowGiveUpArr[_index];
    }

    function setErc721Address(uint256 index, address addr) external {
        erc721AddressArr[index] = addr;
    }

    function erc721Address(uint256 _index) external view returns (address) {
        return erc721AddressArr[_index];
    }

    function setErc20List(address[] memory list) external {
        delete erc20ListAddressArr;
        for (uint256 i = 0; i < list.length; i++) {
            erc20ListAddressArr.push(list[i]);
        }
    }

    function allContractERC20() external view returns (address[] memory) {
        return erc20ListAddressArr;
    }

    function setBalanceToken(uint256[] memory arr) external {
        delete balanceTokenArr;
        for (uint256 i = 0; i < arr.length; i++) {
            balanceTokenArr.push(arr[i]);
        }
    }

    function getBalanceToken() external view returns (uint256[] memory) {
        return balanceTokenArr;
    }

    function getAwardReceiversPercent() external view returns (uint256[] memory) {
        return awardReceiversPercentArr;
    }

    function getAwardReceiversAtIndex(uint256, bool) external pure returns (address) {
        return address(0);
    }

    function getContractBalance() external view returns (uint256) {
        return contractBalance;
    }

    // Plain setters for the remaining simple fields.
    function setGoal(uint256 v) external { goal = v; }
    function setDuration(uint256 v) external { duration = v; }
    function setDayRequired(uint256 v) external { dayRequired = v; }
    function setTotalReward(uint256 v) external { totalReward = v; }
    function setDonationWalletAddress(address v) external { donationWalletAddress = v; }
    function setReturnedNFTWallet(address v) external { returnedNFTWallet = v; }
    function setChallenger(address v) external { challenger = v; }
    function setSponsor(address v) external { sponsor = v; }
    function setIsFinished(bool v) external { isFinished = v; }
    function setIsSuccess(bool v) external { isSuccess = v; }
    function setStartTime(uint256 v) external { startTime = v; }
    function setEndTime(uint256 v) external { endTime = v; }
    function setIndexNft(uint256 v) external { indexNft = v; }
    function setCreateByToken(address v) external { createByToken = v; }
    function setContractBalance(uint256 v) external { contractBalance = v; }
    function setTotalBalanceBaseToken(uint256 v) external { totalBalanceBaseToken = v; }
}
