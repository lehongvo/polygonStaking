// CHALLENGE-2706: ChallengeGCM's updateRewardSuccessAndfail wrote approvalSuccessOf for EVERY
// award receiver (not just the [0,index) success partition) and used `=` instead of `+=` for
// both sumAwardSuccess and sumAwardFail, so each only ever held the LAST loop iteration's share
// instead of the sum of its partition. Neither sum nor the out-of-partition mapping writes are
// read by any current payout path, so the bug has no effect on actual transferred amounts --
// this test proves the internal accounting itself is now correct, via a harness subclass that
// exposes the otherwise-unreadable (default-internal) sumAwardSuccess/sumAwardFail.
import { expect } from 'chai';
import hre from 'hardhat';

const SUCCESS_FEE = 10;
const FAIL_FEE = 10;

async function deployHarness() {
  const [, challenger, feeAddr, returnedNFTWallet, sponsor, recv0, recv1, recv2] =
    await hre.ethers.getSigners();
  const MockNFT = await hre.ethers.getContractFactory('MockExerciseSupplementNFT');
  const nft = await MockNFT.deploy(returnedNFTWallet.address, SUCCESS_FEE, FAIL_FEE);
  const Factory = await hre.ethers.getContractFactory('ChallengeGCMHarness');
  const block = await hre.ethers.provider.getBlock('latest');
  const startTime = block!.timestamp + 60;
  const duration = 5;
  const endTime = startTime + duration * 86400;
  const totalAmount = hre.ethers.parseEther('100');
  // 3 receivers, index=1: recv0 is the ONLY success-partition receiver (60%), recv1+recv2 are
  // the fail-partition receivers (20% + 20% = 40%). This is the minimum shape that can tell the
  // old bug apart from the fix on BOTH sums:
  //  - sumAwardSuccess: old code overwrites across all 3 receivers, ending on recv2's 20% (WRONG,
  //    should be recv0's 60% -- and recv2 isn't even in the success partition).
  //  - sumAwardFail: old code's range was already correct (index..length) but `=` instead of
  //    `+=` means it ends on recv2's 20% alone, silently dropping recv1's 20% (WRONG, should be
  //    40%). A single-fail-receiver setup couldn't distinguish `=` from `+=` here.
  const challenge = await Factory.deploy(
    [sponsor.address, challenger.address, feeAddr.address],
    hre.ethers.ZeroAddress,
    [await nft.getAddress()],
    [duration, startTime, endTime, 1000, 1], // dayRequired=1 -> single-day success
    [recv0.address, recv1.address, recv2.address],
    1, // index: [0,1) success = recv0, [1,3) fail = recv1, recv2
    [true, true, false],
    [0, 0, 0],
    false,
    [60, 20, 20],
    totalAmount,
    [0, 200, 1], // gcmData: wide glucose range, 1-day success gate
    { value: totalAmount }
  );
  return { challenger, challenge, startTime, totalAmount };
}

describe('CHALLENGE-2706: ChallengeGCM reward accounting partition (success/fail, sum accumulation)', function () {
  it('SUCCESS settlement: sumAwardSuccess = only the success-partition share; sumAwardFail = accumulated fail-partition shares', async function () {
    const { challenger, challenge, startTime, totalAmount } = await deployHarness();
    await hre.ethers.provider.send('evm_setNextBlockTimestamp', [startTime + 300]);

    await challenge.connect(challenger).sendDailyResult(
      [startTime + 300],
      [1001],
      [0, 0],
      '0x',
      [],
      [],
      [],
      [],
      [],
      [0, 2 ** 53 - 1],
      [100] // glucoseLevels within [0,200]
    );

    expect(await challenge.isSuccess()).to.equal(true);

    const [successSum, failSum] = await challenge.getSumAwards();
    expect(successSum).to.equal((totalAmount * 60n) / 100n, 'sumAwardSuccess must be recv0-only (60%), not the last-iterated receiver');
    expect(failSum).to.equal((totalAmount * 40n) / 100n, 'sumAwardFail must accumulate BOTH fail receivers (20%+20%), not just the last one');
  });
});
