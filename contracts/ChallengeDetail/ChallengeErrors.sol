// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

/**
 * Module 5B — shared custom errors for the ChallengeDetail family.
 *
 * These 34 errors are declared IDENTICALLY (inline) in all 6 challenge contracts
 * (ChallengeDetail / DetailV2 / BaseStep / HIIT / GCM / GCMAndSpeed). In the current
 * flattened source each contract carries its own copy = 34 × 6 = 204 duplicate declarations.
 *
 * This file is the FOUNDATION for the consolidation redeploy: a re-modularized contract set
 * would `import "./ChallengeErrors.sol";` and drop the inline copies. Custom errors are
 * file-scoped selectors, so importing vs declaring inline yields IDENTICAL bytecode/selectors —
 * the migration is behavior-preserving.
 *
 * ADDITIVE + SAFE: this file does NOT modify any deployed contract source; it compiles standalone
 * and does not conflict with the existing inline declarations (Solidity file-scoped errors in
 * different files are separate declarations with the same selector).
 *
 * CHALLENGE-2736: this file is currently UNUSED -- no contract imports it, and the inline
 * duplicates it was meant to replace are still declared in all 6 Challenge contracts. The
 * in-place migration described above (importing this file and dropping the inline copies,
 * subject to a bytecode-size check per contract) has not been done and is owner-gated redeploy
 * work; there is no committed plan document for it in this repository.
 *
 * BaseStep additionally has 2 variant-specific errors kept local to it:
 *   error InvalidHiitDataLength(); error InvalidWalkingSpeedDataLength();
 */

error RelayExpired();
error RelayBadNonce();
error RelayBadSignature();
error TransferHelperFailed();
error OnlyStakeholdersCanCallThisFunction();
error AddressInsufficientBalance();
error AddressUnableToSendValueRecipientMayHaveReverted();
error ReentrancyguardReentrantCall();
error ChallengeHasNotStartedYet();
error ChallengeWasFinished();
error ChallengeHasNotFinishedYet();
error CanNotGiveUp();
error ThisChallengeWasGiveUp();
error OnlyChallengerCanCallThisFunction();
error CantCall();
error SumOfPercentsExceeds100();
error InvalidStepExceedsGoalOrNotGreater();
error TheChallengeHasNotYetBeenFinished();
error OnlyReturnedNftWalletAddress();
error InsufficientContractBalance();
error InvalidDayLength();
error InvalidStepIndexLength();
error InvalidAllowGiveUp();
error InvalidHiitData();
error InvalidAward();
error InvalidValue();
error InvalidLists();
error InvalidValue0();
error InvalidValue1();
error InvalidHiitResultsLength();
error InsufficientMaticForNativeStaking();
error PrincipalMaticTransferFailed();
error RewardsMaticTransferFailed();
error SystemFeeMaticTransferFailed();
