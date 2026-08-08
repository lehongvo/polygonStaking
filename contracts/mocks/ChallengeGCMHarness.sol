// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "../ChallengeDetail/ChallengeGCM.sol";

// CHALLENGE-2706 test harness: sumAwardSuccess/sumAwardFail have no explicit visibility (default
// `internal`), so a real deployment exposes no way to read them and prove the accounting fix.
// This subclass adds a read-only getter for tests only -- it changes no logic in ChallengeGCM.
contract ChallengeGCMHarness is ChallengeGCM {
    constructor(
        address payable[] memory _stakeHolders,
        address _createByToken,
        address[] memory _erc721Address,
        uint256[] memory _primaryRequired,
        address payable[] memory _awardReceivers,
        uint256 _index,
        bool[] memory _allowGiveUp,
        uint256[] memory _gasData,
        bool _allAwardToSponsorWhenGiveUp,
        uint256[] memory _awardReceiversPercent,
        uint256 _totalAmount,
        uint256[] memory _gcmData
    )
        payable
        ChallengeGCM(
            _stakeHolders,
            _createByToken,
            _erc721Address,
            _primaryRequired,
            _awardReceivers,
            _index,
            _allowGiveUp,
            _gasData,
            _allAwardToSponsorWhenGiveUp,
            _awardReceiversPercent,
            _totalAmount,
            _gcmData
        )
    {}

    function getSumAwards() external view returns (uint256 successSum, uint256 failSum) {
        return (sumAwardSuccess, sumAwardFail);
    }
}
