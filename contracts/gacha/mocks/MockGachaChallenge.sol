// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

/**
 * @title MockGachaChallenge
 * @notice Implements IChallenge surface required by Gacha contract.
 *         Every value is settable via dedicated setters so each test can
 *         construct deterministic scenarios without touching real Challenge logic.
 */
contract MockGachaChallenge {
    uint256 private _goal = 5000;
    uint256 private _duration = 30;
    uint256 private _dayRequired = 25;
    uint256 private _totalReward = 1 ether;
    bool private _allowGiveUp = true;
    bool private _isFinished = true;
    bool private _isSuccess = true;
    address private _challenger;
    address private _sponsor;
    address private _erc721Address;
    address private _donationWalletAddress;
    string private _name = "MockChallenge";
    uint256[] private _awardReceiversPercent;
    address[2] private _awardReceiversSuccess;
    address[2] private _awardReceiversFail;

    constructor(address challengerAddr, address erc721) {
        _challenger = challengerAddr;
        _sponsor = challengerAddr;
        _erc721Address = erc721;
        _awardReceiversPercent.push(98);
        _awardReceiversPercent.push(2);
    }

    // ---------- Setters used by tests ----------
    function setGoal(uint256 v) external {
        _goal = v;
    }
    function setDuration(uint256 v) external {
        _duration = v;
    }
    function setDayRequired(uint256 v) external {
        _dayRequired = v;
    }
    function setTotalReward(uint256 v) external {
        _totalReward = v;
    }
    function setAllowGiveUp(bool v) external {
        _allowGiveUp = v;
    }
    function setIsFinished(bool v) external {
        _isFinished = v;
    }
    function setIsSuccess(bool v) external {
        _isSuccess = v;
    }
    function setChallenger(address v) external {
        _challenger = v;
    }
    function setSponsor(address v) external {
        _sponsor = v;
    }
    function setErc721Address(address v) external {
        _erc721Address = v;
    }
    function setDonationWalletAddress(address v) external {
        _donationWalletAddress = v;
    }
    function setName(string calldata v) external {
        _name = v;
    }
    function setAwardReceiversPercent(uint256[] calldata v) external {
        delete _awardReceiversPercent;
        for (uint256 i = 0; i < v.length; i++) _awardReceiversPercent.push(v[i]);
    }
    function setAwardReceiversAtIndex(uint256 idx, bool successFlag, address addr) external {
        if (successFlag) _awardReceiversSuccess[idx] = addr;
        else _awardReceiversFail[idx] = addr;
    }

    // ---------- IChallenge implementation ----------
    function goal() external view returns (uint256) {
        return _goal;
    }
    function duration() external view returns (uint256) {
        return _duration;
    }
    function dayRequired() external view returns (uint256) {
        return _dayRequired;
    }
    function totalReward() external view returns (uint256) {
        return _totalReward;
    }
    function getBalanceToken() external pure returns (uint256[] memory) {
        return new uint256[](0);
    }
    function allowGiveUp(uint256) external view returns (bool) {
        return _allowGiveUp;
    }
    function donationWalletAddress() external view returns (address) {
        return _donationWalletAddress;
    }
    function returnedNFTWallet() external pure returns (address) {
        return address(0);
    }
    function getAwardReceiversPercent() external view returns (uint256[] memory) {
        return _awardReceiversPercent;
    }
    function challenger() external view returns (address) {
        return _challenger;
    }
    function sponsor() external view returns (address) {
        return _sponsor;
    }
    function getAwardReceiversAtIndex(
        uint256 idx,
        bool successFlag
    ) external view returns (address) {
        return successFlag ? _awardReceiversSuccess[idx] : _awardReceiversFail[idx];
    }
    function isFinished() external view returns (bool) {
        return _isFinished;
    }
    function isSuccess() external view returns (bool) {
        return _isSuccess;
    }
    function erc721Address(uint256) external view returns (address) {
        return _erc721Address;
    }
    function name() external view returns (string memory) {
        return _name;
    }

    /**
     * @notice Helper to call gacha.randomRewards(this, dataStep) so msg.sender == _challengeAddress.
     *         Bubbles up revert reason verbatim so tests can pattern-match the underlying require message.
     */
    function callRandomRewards(address gacha, uint256[] calldata dataStep) external returns (bool) {
        (bool ok, bytes memory ret) = gacha.call(
            abi.encodeWithSignature("randomRewards(address,uint256[])", address(this), dataStep)
        );
        if (!ok) {
            assembly {
                revert(add(ret, 32), mload(ret))
            }
        }
        return abi.decode(ret, (bool));
    }
}
