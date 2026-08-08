// CHALLENGE-2673 (TANIMOTO re-review): checkValidSignature's canonical digest was upgraded to
// keccak256(abi.encode(msg.sender, day, stepIndex, data, chainId, extraDataHash)), but
// scripts/challenge/utils/getSignatureSendStepBaseStep.js and getSignatureSendStepHIIT.js still
// computed the OBSOLETE five-field solidityPackedKeccak256 digest with no extraDataHash --
// signatures they produce would be rejected by every newly-deployed BaseStep/HIIT contract.
// "no test invokes these helpers against the current BaseStep/HIIT contracts, so CI does not
// expose the mismatch" (TANIMOTO). This is exactly that missing helper-to-contract test: it
// calls the REAL fixed JS helpers, feeds their output into the REAL
// ExerciseSupplementNFT.checkValidSignature (not a mock that ignores the signature), and proves
// it accepts them -- via MockChallengeCaller, which stands in for a real Challenge contract so
// msg.sender inside the NFT is a genuine contract address (matching
// getSignatureSendStepForBaseStep.js's own getChallengeHistory() liveness precondition call,
// and how a real Challenge always invokes checkValidSignature).
import { loadFixture, time } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import hre from 'hardhat';
import { deployExerciseSupplementFixture } from '../exerciseSupplement/fixtures';

const { ethers } = hre as any;

const getSignatureSendStepForBaseStep = require('../../scripts/challenge/utils/getSignatureSendStepBaseStep');
const getSignatureSendStepForHIIT = require('../../scripts/challenge/utils/getSignatureSendStepHIIT');

describe('CHALLENGE-2673: signing helper scripts produce signatures the real NFT accepts', function () {
  async function setup() {
    const ctx = await loadFixture(deployExerciseSupplementFixture);
    const { nft, owner } = ctx;

    // A fresh, self-contained signer for CHALLENGE_PRIVATE_KEY -- doesn't need funds, only
    // signs messages (read-only provider calls, no transactions sent by this wallet).
    const securitySigner = ethers.Wallet.createRandom();
    await nft.connect(owner).updateSecurityAddress(securitySigner.address);

    const nftAddress = await nft.getAddress();

    const callerFactory = await ethers.getContractFactory('MockChallengeCaller');
    const caller = await callerFactory.deploy();
    await caller.waitForDeployment();
    const callerAddress = await caller.getAddress();

    const role = await nft.ALLOWED_CONTRACTS_CHALLENGE();
    await nft.connect(owner).batchGrantRole(role, [callerAddress]);

    process.env.CHALLENGE_PRIVATE_KEY = securitySigner.privateKey;

    return { ...ctx, caller, callerAddress, nftAddress };
  }

  afterEach(function () {
    delete process.env.CHALLENGE_PRIVATE_KEY;
  });

  it('BaseStep helper: signature is accepted end-to-end through a real Challenge-shaped caller', async function () {
    const { caller, callerAddress, nftAddress } = await setup();
    const now = await time.latest();
    const day = [now + 100];
    const stepIndex = [1000];
    const minutesAtTargetSpeed = [30];
    const metsWalkingSpeed = [4];
    const intervals: number[] = [];
    const totalSeconds: number[] = [];

    const result = await getSignatureSendStepForBaseStep(
      ethers.provider,
      callerAddress,
      day,
      stepIndex,
      600,
      minutesAtTargetSpeed,
      metsWalkingSpeed,
      intervals,
      totalSeconds
    );
    expect(result.error, JSON.stringify(result)).to.be.undefined;

    const extraDataHash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ['uint256[]', 'uint256[]', 'uint256[]', 'uint256[]'],
        [minutesAtTargetSpeed, metsWalkingSpeed, intervals, totalSeconds]
      )
    );

    await expect(
      caller.callCheckValidSignature(
        nftAddress,
        day,
        stepIndex,
        result.dataSendStep,
        extraDataHash,
        result.signature
      )
    ).to.not.be.reverted;
  });

  it('BaseStep helper: mutation check -- the OLD (no-extraDataHash) packed digest format is now rejected', async function () {
    const { caller, callerAddress, nftAddress } = await setup();
    const now = await time.latest();
    const day = [now + 100];
    const stepIndex = [1000];

    const [getNetwork, currentNonce, blockNumber] = await Promise.all([
      ethers.provider.getNetwork(),
      ethers.provider.getTransactionCount(callerAddress),
      ethers.provider.getBlockNumber(),
    ]);
    const block = await ethers.provider.getBlock(blockNumber);
    const dataSendStep = [currentNonce, Number(block.timestamp) + 600];
    const chainId = Number(getNetwork.chainId);

    // Exact pre-fix formula this helper used to compute (packed, 5 fields, no extraDataHash).
    const oldHash = ethers.solidityPackedKeccak256(
      ['address', 'uint256[]', 'uint256[]', 'uint64[2]', 'uint256'],
      [callerAddress, day, stepIndex, dataSendStep, chainId]
    );
    const wallet = new ethers.Wallet(process.env.CHALLENGE_PRIVATE_KEY, ethers.provider);
    const oldSignature = await wallet.signMessage(ethers.getBytes(oldHash));

    const extraDataHash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ['uint256[]', 'uint256[]', 'uint256[]', 'uint256[]'],
        [[], [], [], []]
      )
    );

    await expect(
      caller.callCheckValidSignature(nftAddress, day, stepIndex, dataSendStep, extraDataHash, oldSignature)
    ).to.be.revertedWithCustomError(await ethers.getContractAt('contracts/ExerciseSupplementNFT.sol:ExerciseSupplementNFT', nftAddress), 'InvalidSignature');
  });

  it('HIIT helper: signature is accepted end-to-end through a real Challenge-shaped caller', async function () {
    const { caller, callerAddress, nftAddress } = await setup();
    const now = await time.latest();
    const day = [now + 100];
    const intervals = [5];
    const totalSeconds = [1800];

    const result = await getSignatureSendStepForHIIT(
      ethers.provider,
      callerAddress,
      day,
      600,
      intervals,
      totalSeconds
    );
    expect(result.error, JSON.stringify(result)).to.be.undefined;

    const extraDataHash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(['uint256[]', 'uint256[]'], [intervals, totalSeconds])
    );

    await expect(
      caller.callCheckValidSignature(nftAddress, day, [], result.dataSendStep, extraDataHash, result.signature)
    ).to.not.be.reverted;
  });

  it('HIIT helper: changing intervals/totalSeconds after signing invalidates the signature (extraDataHash is load-bearing)', async function () {
    const { caller, callerAddress, nftAddress } = await setup();
    const now = await time.latest();
    const day = [now + 100];
    const signedIntervals = [5];
    const signedTotalSeconds = [1800];

    const result = await getSignatureSendStepForHIIT(
      ethers.provider,
      callerAddress,
      day,
      600,
      signedIntervals,
      signedTotalSeconds
    );
    expect(result.error, JSON.stringify(result)).to.be.undefined;

    // Tamper: submit different intervals than what was actually signed.
    const tamperedExtraDataHash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(['uint256[]', 'uint256[]'], [[999], signedTotalSeconds])
    );

    await expect(
      caller.callCheckValidSignature(
        nftAddress,
        day,
        [],
        result.dataSendStep,
        tamperedExtraDataHash,
        result.signature
      )
    ).to.be.revertedWithCustomError(
      await ethers.getContractAt('contracts/ExerciseSupplementNFT.sol:ExerciseSupplementNFT', nftAddress),
      'InvalidSignature'
    );
  });
});
