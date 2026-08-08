// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

interface IExerciseSupplementNFTSignature {
    function checkValidSignature(
        uint256[] memory day,
        uint256[] memory stepIndex,
        uint64[2] memory data,
        bytes32 extraDataHash,
        bytes memory signature
    ) external;
}

/**
 * @title MockChallengeCaller
 * @notice CHALLENGE-2673: stand-in for a real Challenge contract when testing that the
 *         off-chain JS signing helpers (scripts/challenge/utils/getSignatureSendStep*.js)
 *         produce a signature the REAL ExerciseSupplementNFT.checkValidSignature accepts.
 *         getChallengeHistory() exists only because getSignatureSendStepForBaseStep.js calls it
 *         as a liveness precondition before signing -- it must not revert and its return value
 *         is otherwise unused by that helper. Deployed at a real, callable address (not an EOA)
 *         so msg.sender inside checkValidSignature is this contract, exactly matching how a
 *         genuine ChallengeBaseStep/ChallengeHIIT would invoke it.
 */
contract MockChallengeCaller {
    function getChallengeHistory() external pure returns (uint256[] memory date, uint256[] memory data) {
        return (new uint256[](0), new uint256[](0));
    }

    function callCheckValidSignature(
        address nft,
        uint256[] memory day,
        uint256[] memory stepIndex,
        uint64[2] memory data,
        bytes32 extraDataHash,
        bytes memory signature
    ) external {
        IExerciseSupplementNFTSignature(nft).checkValidSignature(day, stepIndex, data, extraDataHash, signature);
    }
}
