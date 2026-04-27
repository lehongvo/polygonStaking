'use strict';

require('dotenv/config');
const { ethers } = require('ethers');

/**
 * Get signature and data for sendDailyResult (ChallengeBaseStep).
 * privateKey is read from CHALLENGE_PRIVATE_KEY in .env.
 *
 * @param {ethers.Provider} provider - Ethers provider (e.g. JsonRpcProvider)
 * @param {string} challengeContractAddress - Challenge contract address
 * @param {number[]} days - Array of day timestamps
 * @param {number[]} stepIndex - Array of step index values
 * @param {number} [timeRelease] - Optional time release (seconds to add to block timestamp); default 600
 * @returns {Promise<{ dataSendStep: number[], signature: string } | { error: string, message: string }>}
 */
const getSignatureSendStepForBaseStep = async (
  provider,
  challengeContractAddress,
  days,
  stepIndex,
  timeRelease = 600
) => {
  const privateKey = process.env.CHALLENGE_PRIVATE_KEY;
  if (!privateKey || privateKey.trim() === '') {
    return {
      error: 'MISSING_CHALLENGE_PRIVATE_KEY',
      message: 'CHALLENGE_PRIVATE_KEY is not set in .env',
    };
  }

  try {
    const abiGetChallengeHistory = [
      'function getChallengeHistory() view returns (uint256[] date, uint256[] data)',
    ];
    const challengeContract = new ethers.Contract(
      challengeContractAddress,
      abiGetChallengeHistory,
      provider
    );
    await challengeContract.getChallengeHistory();

    const [getNetwork, currentNonce, blockNumber] = await Promise.all([
      provider.getNetwork(),
      provider.getTransactionCount(challengeContractAddress),
      provider.getBlockNumber(),
    ]);
    const chainId = Number(getNetwork.chainId);
    const dataSendStep = [];
    dataSendStep.push(currentNonce);
    const block = await provider.getBlock(blockNumber);
    dataSendStep.push(Number(block.timestamp) + (timeRelease || 600));

    const hash = ethers.solidityPackedKeccak256(
      ['address', 'uint256[]', 'uint256[]', 'uint64[2]', 'uint256'],
      [challengeContractAddress, days, stepIndex, dataSendStep, chainId]
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
      error: err?.code ? err.code : 'ERROR_GET_SIGNATURE_SEND_STEP_BASE_STEP',
      message: err?.message
        ? err.message
        : 'Error get signature send step for BaseStep',
    };
  }
};

module.exports = getSignatureSendStepForBaseStep;
