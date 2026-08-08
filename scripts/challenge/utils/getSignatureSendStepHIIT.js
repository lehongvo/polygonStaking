'use strict';

require('dotenv/config');
const { ethers } = require('ethers');

/**
 * Get signature and data for sendDailyResult (Challenge HIIT).
 * Mirrors BAP BACKEND getSignatureSendStepForHIIT: no contract call, stepIndex = [] in hash.
 * privateKey from CHALLENGE_PRIVATE_KEY in .env. Recovered signer must equal NFT's securityAddress.
 *
 * CHALLENGE-2673: also binds intervals/totalSeconds (HIIT achievement evidence) into the signed
 * payload via _extraDataHash -- callers MUST pass the exact same arrays they will later submit
 * on-chain, or verification will fail. Mirrors BACKEND's getSignatureSendStepForHIIT
 * (app/Helpers/ChallengeGachaHelper.js) exactly: same field set, same ordering, same abi.encode
 * (not packed) digest, matching ChallengeHIIT._executeDailyResult's
 * keccak256(abi.encode(_intervals, _totalSeconds)).
 *
 * @param {ethers.Provider} provider - Ethers provider
 * @param {string} challengeContractAddress - Challenge contract address
 * @param {number[]} days - Array of day timestamps (e.g. [dayTs])
 * @param {number} [timeRelease] - Seconds to add to block timestamp; default 600
 * @param {number[]} [intervals] - HIIT intervals per day (must match the on-chain call)
 * @param {number[]} [totalSeconds] - HIIT total seconds per day (must match the on-chain call)
 * @returns {Promise<{ dataSendStep: number[], signature: string } | { error: string, message: string }>}
 */
const getSignatureSendStepForHIIT = async (
  provider,
  challengeContractAddress,
  days,
  timeRelease = 600,
  intervals = [],
  totalSeconds = []
) => {
  const privateKey = process.env.CHALLENGE_PRIVATE_KEY;
  if (!privateKey || privateKey.trim() === '') {
    return {
      error: 'MISSING_CHALLENGE_PRIVATE_KEY',
      message: 'CHALLENGE_PRIVATE_KEY is not set in .env',
    };
  }

  try {
    const [getNetwork, currentNonce, blockNumber] = await Promise.all([
      provider.getNetwork(),
      provider.getTransactionCount(challengeContractAddress),
      provider.getBlockNumber(),
    ]);
    const chainId = Number(getNetwork.chainId);
    const dataSendStep = [];
    dataSendStep.push(currentNonce);
    const block = await provider.getBlock(blockNumber);
    const currentTime = Number(block.timestamp) + (timeRelease || 600);
    dataSendStep.push(currentTime);

    const stepIndexEmpty = [];
    const extraDataHash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ['uint256[]', 'uint256[]'],
        [intervals, totalSeconds]
      )
    );
    const hash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'uint256[]', 'uint256[]', 'uint64[2]', 'uint256', 'bytes32'],
        [challengeContractAddress, days, stepIndexEmpty, dataSendStep, chainId, extraDataHash]
      )
    );
    const sigHashBytes = ethers.getBytes(hash);
    const wallet = new ethers.Wallet(privateKey, provider);
    const signature = await wallet.signMessage(sigHashBytes);

    return { dataSendStep, signature };
  } catch (error) {
    let err = error;
    try {
      if (error?.error?.body && typeof error.error.body === 'string') {
        err = JSON.parse(error.error.body).error || error;
      } else if (error?.error) {
        err = error.error;
      }
    } catch (_) {}
    return {
      error: err?.code ? err.code : 'ERROR_GET_SIGNATURE_SEND_STEP_HIIT',
      message: err?.message
        ? err.message
        : 'Error get signature send step for HIIT',
    };
  }
};

module.exports = getSignatureSendStepForHIIT;
