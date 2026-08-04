// CHALLENGE-2698: on-chain processedDay uniqueness + strictly-increasing day-batch validation.
//
// Bug (before fix): the backend signature does not bind _timeRange, and currentStatus was
// incremented for each qualifying input day independently of any persistent on-chain
// processed-day uniqueness invariant. If the backend issued another valid signature covering an
// already-counted day (or a signed batch itself contained duplicate days), the same activity
// could count multiple times toward currentStatus -- inflating progress and potentially
// triggering an undeserved SUCCESS settlement.
//
// Fix: `processedDay[day]` is set the first time a day increments currentStatus and checked
// before every future increment attempt for that same day -- independent of the caller-supplied
// _timeRange, of how many different (even individually "valid") signatures cover that day, and
// of the existing isSendSameDay/history-array resubmission-correction bookkeeping. A batch
// (_day array) must also be strictly increasing, rejecting duplicate/unsorted days outright.
//
// MockExerciseSupplementNFT.checkValidSignature() is a permissive no-op (see contracts/mocks/
// MockExerciseSupplementNFT.sol) -- it does not itself enforce one-time-use signatures, so any
// two calls here with different signature BYTES both "verify". That is intentional: it isolates
// the on-chain processedDay invariant from the separate, already-covered signature-replay
// protection (see test/exerciseSupplement/signature.test.ts's "replay (same signature 2nd time)
// reverts"), and directly proves processedDay closes the gap even when every signature involved
// is independently "valid" -- exactly the ticket's "new-signature same-day replay" scenario.
import { expect } from 'chai';
import hre from 'hardhat';
import { deployChallenge, moveToStart } from '../helpers/deployHelpers.ts';

const MAX = 2 ** 53 - 1;

async function sendRaw(
  challenge: any,
  challenger: any,
  day: number[],
  steps: number[],
  sig: string,
  timeRange: [number, number] = [0, MAX]
) {
  return challenge
    .connect(challenger)
    .sendDailyResult(day, steps, [0, 0], sig, [], [], [], [], [], timeRange, [], [], [], []);
}

describe('CHALLENGE-2698: processedDay uniqueness + sorted/deduped day batches (ChallengeBaseStep)', function () {
  async function setup() {
    const { challenge, signers, startTime } = await deployChallenge('ChallengeBaseStep', {
      awardReceiversPercent: [100],
      index: 1,
      goal: 1000,
      dayRequired: 3, // needs 3 distinct achieved days to succeed
      duration: 30,
    });
    const challenger = signers[1];
    await moveToStart(startTime);
    return { challenge, challenger, startTime };
  }

  it('new-signature same-day replay: a DIFFERENT (still "valid") signature for an already-processed day does not double-count', async function () {
    const { challenge, challenger, startTime } = await setup();
    const day1 = startTime + 300;

    await sendRaw(challenge, challenger, [day1], [1001], '0x01');
    expect(await challenge.currentStatus()).to.equal(1n);

    // A different signature (simulating a second, independently-issued backend signature)
    // covering the SAME day must not increment currentStatus again. _timeRange upper bound is
    // kept below day1 so the resubmission takes the plain history-update branch rather than
    // the separate isSendSameDay "correction" branch (which has its own, unrelated guard
    // against re-marking an already-goal-reaching day) -- isolating the processedDay check.
    await sendRaw(challenge, challenger, [day1], [1001], '0x02', [0, day1 - 1]);
    expect(await challenge.currentStatus()).to.equal(1n);

    await sendRaw(challenge, challenger, [day1], [1001], '0xdeadbeef', [0, day1 - 1]);
    expect(await challenge.currentStatus()).to.equal(1n);
  });

  it('range alteration: changing the unsigned _timeRange on a resubmitted day does not bypass processedDay', async function () {
    const { challenge, challenger, startTime } = await setup();
    const day1 = startTime + 300;

    await sendRaw(challenge, challenger, [day1], [1001], '0x01', [0, MAX]);
    expect(await challenge.currentStatus()).to.equal(1n);

    // Same day, same underlying activity, but the caller now supplies a completely different
    // (unsigned) _timeRange that excludes day1 from the isSendSameDay window entirely -- this
    // is exactly the ticket's concern ("the caller can alter the unsigned range used by
    // duplicate logic without invalidating the signature"). processedDay must still block it.
    await sendRaw(challenge, challenger, [day1], [1001], '0x02', [0, day1 - 1]);
    expect(await challenge.currentStatus()).to.equal(1n);
  });

  it('duplicate days within a single batch revert (UnsortedOrDuplicateDays)', async function () {
    const { challenge, challenger, startTime } = await setup();
    const day1 = startTime + 300;
    const day2 = startTime + 86700;

    await expect(
      sendRaw(challenge, challenger, [day1, day1], [1001, 1001], '0x01')
    ).to.be.revertedWithCustomError(challenge, 'UnsortedOrDuplicateDays');

    await expect(
      sendRaw(challenge, challenger, [day1, day2, day2], [1001, 1001, 1001], '0x01')
    ).to.be.revertedWithCustomError(challenge, 'UnsortedOrDuplicateDays');
  });

  it('unsorted days within a single batch revert (UnsortedOrDuplicateDays)', async function () {
    const { challenge, challenger, startTime } = await setup();
    const day1 = startTime + 300;
    const day2 = startTime + 86700;

    await expect(
      sendRaw(challenge, challenger, [day2, day1], [1001, 1001], '0x01')
    ).to.be.revertedWithCustomError(challenge, 'UnsortedOrDuplicateDays');
  });

  it('a strictly-increasing multi-day batch is accepted and counts each distinct day once', async function () {
    const { challenge, challenger, startTime } = await setup();
    const day1 = startTime + 300;
    const day2 = startTime + 86700;
    const day3 = startTime + 173100;

    await sendRaw(challenge, challenger, [day1, day2, day3], [1001, 1001, 1001], '0x01');
    expect(await challenge.currentStatus()).to.equal(3n);
    expect(await challenge.isSuccess()).to.equal(true); // dayRequired=3 reached
  });

  it('genuinely new days after an already-processed day still count normally', async function () {
    const { challenge, challenger, startTime } = await setup();
    const day1 = startTime + 300;
    const day2 = startTime + 86700;

    await sendRaw(challenge, challenger, [day1], [1001], '0x01');
    expect(await challenge.currentStatus()).to.equal(1n);

    // Resubmit day1 (no-op, already processed) AND submit a genuinely new day2 in the same batch.
    await sendRaw(challenge, challenger, [day1, day2], [1001, 1001], '0x02');
    // Only day2 is new -- but day1 re-included in a batch with day2 would need day1 < day2,
    // which holds here; processedDay must still block the day1 contribution while day2 counts.
    expect(await challenge.currentStatus()).to.equal(2n);
  });
});
