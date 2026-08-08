import { expect } from 'chai';
import hre from 'hardhat';
import { time } from '@nomicfoundation/hardhat-toolbox/network-helpers.js';

const SUCCESS_FEE = 10;
const FAIL_FEE = 10;

// CHALLENGE-2653: _listNFTAddress/_listIndexNFT/_listSenderAddress/_statusTypeNft are parallel
// arrays consumed together inside the NFT transfer loops. Before this fix, a length mismatch
// only surfaced as an out-of-bounds panic deep inside those loops (after some transfers/state
// changes may already have run) instead of an explicit up-front revert. Uses the direct
// onlyChallenger sendDailyResult path (not the relayer) so no signature/assetHash needs to be
// constructed -- the length check happens before any of that is relevant.
async function deploy() {
  const [, challenger, feeAddr, returnedNFTWallet, sponsor, recv1, recv2] = await hre.ethers.getSigners();
  const MockNFT = await hre.ethers.getContractFactory('MockExerciseSupplementNFT');
  const nft = await MockNFT.deploy(returnedNFTWallet.address, SUCCESS_FEE, FAIL_FEE);
  const Factory = await hre.ethers.getContractFactory('ChallengeBaseStep');
  const block = await hre.ethers.provider.getBlock('latest');
  const startTime = block!.timestamp + 60;
  const duration = 5;
  const endTime = startTime + duration * 86400;
  const challenge = await Factory.deploy(
    [sponsor.address, challenger.address, feeAddr.address],
    hre.ethers.ZeroAddress,
    [await nft.getAddress()],
    [duration, startTime, endTime, 1000, 4],
    [recv1.address, recv2.address],
    1,
    [true, true, false],
    [0, 0, 0],
    false,
    [50, 40],
    hre.ethers.parseEther('10'),
    [],
    [],
    { value: hre.ethers.parseEther('10') }
  );
  return { challenger, challenge, startTime };
}

describe('ChallengeBaseStep — sendDailyResult parallel-array length validation (CHALLENGE-2653)', function () {
  it('_listSenderAddress shorter than _listNFTAddress → InvalidLists (not a raw panic)', async function () {
    const { challenger, challenge, startTime } = await deploy();
    await time.increaseTo(startTime + 100);
    const day = [startTime + 200];
    const stepIndex = [1500];
    const nftAddr = challenger.address; // any address; length check reverts before it's dereferenced
    await expect(
      challenge
        .connect(challenger)
        .sendDailyResult(day, stepIndex, [0, 0], '0x', [], [nftAddr], [[1]], [], [true], [0, 0], [], [], [], [])
    ).to.be.revertedWithCustomError(challenge, 'InvalidLists');
  });

  it('_statusTypeNft shorter than _listNFTAddress → InvalidLists', async function () {
    const { challenger, challenge, startTime } = await deploy();
    await time.increaseTo(startTime + 100);
    const day = [startTime + 200];
    const stepIndex = [1500];
    const nftAddr = challenger.address;
    await expect(
      challenge
        .connect(challenger)
        .sendDailyResult(day, stepIndex, [0, 0], '0x', [], [nftAddr], [[1]], [[nftAddr]], [], [0, 0], [], [], [], [])
    ).to.be.revertedWithCustomError(challenge, 'InvalidLists');
  });

  it('_listIndexNFT shorter than _listNFTAddress → InvalidLists', async function () {
    const { challenger, challenge, startTime } = await deploy();
    await time.increaseTo(startTime + 100);
    const day = [startTime + 200];
    const stepIndex = [1500];
    const nftAddr = challenger.address;
    await expect(
      challenge
        .connect(challenger)
        .sendDailyResult(day, stepIndex, [0, 0], '0x', [], [nftAddr], [], [[nftAddr]], [true], [0, 0], [], [], [], [])
    ).to.be.revertedWithCustomError(challenge, 'InvalidLists');
  });

  it('all parallel arrays equal length → passes the length check (reaches unrelated later logic)', async function () {
    const { challenger, challenge, startTime } = await deploy();
    await time.increaseTo(startTime + 100);
    const day = [startTime + 200];
    const stepIndex = [1500];
    // Empty-but-equal-length arrays across the board must NOT revert with InvalidLists.
    await expect(
      challenge
        .connect(challenger)
        .sendDailyResult(day, stepIndex, [0, 0], '0x', [], [], [], [], [], [0, 0], [], [], [], [])
    ).to.not.be.revertedWithCustomError(challenge, 'InvalidLists');
  });
});
