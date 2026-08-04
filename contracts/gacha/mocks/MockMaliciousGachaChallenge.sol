// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

/**
 * @title MockMaliciousGachaChallenge
 * @notice CHALLENGE-2733: simulates a registered (CHALLENGE_ROLE-holding) but compromised
 *         Challenge contract that attempts to reenter Gacha.randomRewards from the
 *         onERC1155Received hook fired during its own ERC1155 reward payout. Used to prove
 *         Gacha's nonReentrant guard actually blocks the reentrant call -- the reentrant
 *         attempt is made via a raw low-level call (not a normal Solidity call) so a revert
 *         inside it does NOT unwind the outer, legitimate randomRewards() call; the test
 *         inspects `reentrySucceeded` afterward instead.
 *         Implements the full IChallenge surface Gacha.randomRewards/checkRequireBalanceNft
 *         reads (same defaults as MockGachaChallenge), since as _challengeAddress it stands in
 *         for the entire Challenge contract, not just the caller-identity check.
 * @dev isFinished() returns false so isSendDailyResultWithGacha is never set by the outer call
 *      -- isolates the test to specifically the nonReentrant guard, not the (also-fixed, but
 *      separate) early isSendDailyResultWithGacha write.
 */
contract MockMaliciousGachaChallenge {
    address public gacha;
    address public erc721AddressValue;
    bool public reentryAttempted;
    bool public reentrySucceeded;

    uint256 private _goal = 5000;
    uint256 private _duration = 30;
    uint256 private _dayRequired = 25;
    uint256 private _totalReward = 1 ether;
    bool private _allowGiveUp = true;
    address private _challenger;

    constructor(address _erc721Address) {
        erc721AddressValue = _erc721Address;
        _challenger = address(this); // reward destination is also routed here via the registry mock
    }

    function setGacha(address _gacha) external {
        gacha = _gacha;
    }

    // ---------- IChallenge surface read by Gacha.randomRewards / checkRequireBalanceNft ----------
    function erc721Address(uint256) external view returns (address) {
        return erc721AddressValue;
    }

    function isFinished() external pure returns (bool) {
        return false;
    }

    function goal() external view returns (uint256) {
        return _goal;
    }

    function duration() external view returns (uint256) {
        return _duration;
    }

    function challenger() external view returns (address) {
        return _challenger;
    }

    function dayRequired() external view returns (uint256) {
        return _dayRequired;
    }

    function totalReward() external view returns (uint256) {
        return _totalReward;
    }

    function allowGiveUp(uint256) external view returns (bool) {
        return _allowGiveUp;
    }

    // ---------- ERC1155 receiver hook: attempt reentrancy here ----------
    function onERC1155Received(
        address,
        address,
        uint256,
        uint256,
        bytes calldata
    ) external returns (bytes4) {
        reentryAttempted = true;
        uint256[] memory dataStep = new uint256[](0);
        (bool success, ) = gacha.call(
            abi.encodeWithSignature("randomRewards(address,uint256[])", address(this), dataStep)
        );
        reentrySucceeded = success;
        return this.onERC1155Received.selector;
    }
}
