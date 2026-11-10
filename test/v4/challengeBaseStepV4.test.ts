// ChallengeBaseStepV4: step, walking speed and HIIT counted independently. The step and speed cases are
// ported from the V3 suite to prove their behaviour did not change (CHALLENGE-2884).
import { expect } from 'chai';
import hre from 'hardhat';
import { time } from '@nomicfoundation/hardhat-toolbox/network-helpers.js';
import {
  DAY,
  deployV4,
  emptyHiit,
  emptySpeed,
  emptyStep,
  achievedInput,
  giveUp,
  moveTo,
  payloadHashBaseStep,
  sendBaseStep,
  signPayload,
  speedInput,
  stepInput,
  withRange,
} from './helpersV4.ts';

const GOAL = 1000;
const SPEED = [5, 30, 2]; // target 5 km/h, 30 minutes per day, 2 speed days
const MENU = [20, 10, 8, 2, 80];
const HIIT = [2, ...MENU]; // 2 HIIT days with the Main menu

async function deployAll(opts: Record<string, any> = {}) {
  const ctx = await deployV4('ChallengeBaseStepV4', {
    goal: GOAL,
    dayRequired: 2,
    walkingSpeedData: SPEED,
    hiitData: HIIT,
    ...opts,
  });
  await moveTo(ctx.dayKey(5) + 3600); // day 5 of 10 has started
  return ctx;
}

async function progress(challenge: any) {
  const p = await challenge.getProgressV4();
  return p.map((v: bigint) => Number(v));
}

describe('ChallengeBaseStepV4', () => {
  describe('constructor', () => {
    it('stores independent required days and version identifiers', async () => {
      const { challenge } = await deployV4('ChallengeBaseStepV4', {
        dayRequired: 3,
        walkingSpeedData: [5, 30, 7], // speed days may exceed step days (old speed <= step rule dropped)
        hiitData: [9, ...MENU],
      });
      expect(await progress(challenge)).to.deep.equal([0, 3, 0, 7, 0, 9]);
      expect((await challenge.getHiitMenu()).map(Number)).to.deep.equal(MENU);
      expect(await challenge.contractVersion()).to.equal(4n);
      expect(await challenge.metScale()).to.equal(100n);
      expect(await challenge.isHiitEnabled()).to.equal(true);
    });

    it('accepts a step-only challenge', async () => {
      const { challenge } = await deployV4('ChallengeBaseStepV4', { dayRequired: 2 });
      expect(await progress(challenge)).to.deep.equal([0, 2, 0, 0, 0, 0]);
      expect(await challenge.isHiitEnabled()).to.equal(false);
    });

    for (const [label, opts, reason] of [
      ['step days 0', { dayRequired: 0 }, 'Invalid step days'],
      ['step days > duration', { dayRequired: 11 }, 'Invalid step days'],
      ['HIIT days only (previous format)', { hiitData: [2] }, 'Invalid HIIT data'],
      ['two HIIT values', { hiitData: [5, 60] }, 'Invalid HIIT data'],
      ['the V3 three HIIT values', { hiitData: [2, 6, 60] }, 'Invalid HIIT data'],
      ['M 0', { hiitData: [2, 0, 10, 8, 2, 80] }, 'Invalid HIIT menu'],
      ['R 0', { hiitData: [2, 20, 0, 8, 2, 80] }, 'Invalid HIIT menu'],
      ['N 0', { hiitData: [2, 20, 10, 8, 0, 80] }, 'Invalid HIIT menu'],
      ['N = T', { hiitData: [2, 20, 10, 8, 8, 80] }, 'Invalid HIIT menu'],
      ['target 0', { hiitData: [2, 20, 10, 8, 2, 0] }, 'Invalid HIIT menu'],
      ['target 101', { hiitData: [2, 20, 10, 8, 2, 101] }, 'Invalid HIIT menu'],
      // B7: every enabled minimum is 1 to the number of days of the period.
      ['speed days 0', { walkingSpeedData: [5, 30, 0] }, 'Invalid required days'],
      ['speed days > the period', { walkingSpeedData: [5, 30, 11] }, 'Invalid required days'],
      ['HIIT days 0', { hiitData: [0, ...MENU] }, 'Invalid required days'],
      ['HIIT days > the period', { hiitData: [11, ...MENU] }, 'Invalid required days'],
      // Q5: shares + fee of each outcome make 100.
      ['shares 100 + 100', { awardReceiversPercent: [100, 100] }, 'Invalid award percent'],
      ['shares 90 + 90 (success 90 + fee 5)', { awardReceiversPercent: [90, 90] }, 'Invalid award percent'],
      ['no failure receiver', { awardReceiversPercent: [95] }, 'Invalid award percent'],
    ] as const) {
      it(`reverts on ${label}`, async () => {
        await expect(deployV4('ChallengeBaseStepV4', { duration: 10, ...(opts as any) })).to.be.revertedWith(
          reason
        );
      });
    }

    // The walking speed minutes and the HIIT menu limits are not checked: the app and BACKEND own them.
    for (const [label, opts] of [
      ['speed days = the period', { walkingSpeedData: [5, 30, 10] }],
      ['speed minutes 0', { walkingSpeedData: [5, 0, 2] }],
      ['HIIT days = the period', { hiitData: [10, ...MENU] }],
      ['a menu beyond the current Custom limits', { hiitData: [2, 120, 120, 40, 5, 90] }],
    ] as const) {
      it(`accepts ${label} and stores it as given`, async () => {
        const { challenge } = await deployV4('ChallengeBaseStepV4', { duration: 10, ...(opts as any) });
        if ('walkingSpeedData' in opts) {
          expect(await challenge.speedDayRequired()).to.equal(BigInt(opts.walkingSpeedData[2]));
        } else {
          expect(await challenge.hiitDayRequired()).to.equal(BigInt(opts.hiitData[0]));
          expect((await challenge.getHiitMenu()).map(Number)).to.deep.equal(opts.hiitData.slice(1));
        }
      });
    }

    it('0 required speed minutes: a speed day counts when first recorded (any minutes), once', async () => {
      const ctx = await deployAll({ dayRequired: 1, walkingSpeedData: [5, 0, 2], hiitData: [] });
      const [d1, d2] = [ctx.dayKey(1), ctx.dayKey(2)];
      await sendBaseStep(ctx, { speed: speedInput([{ day: d1, minutes: 0, mets: 150 }]) });
      expect((await progress(ctx.challenge))[2]).to.equal(1);
      await sendBaseStep(ctx, { speed: speedInput([{ day: d1, minutes: 25, mets: 300 }]) });
      expect((await progress(ctx.challenge))[2]).to.equal(1); // the same day is not counted twice
      await sendBaseStep(ctx, { step: stepInput([{ day: d2, steps: GOAL }]), speed: speedInput([{ day: d2, minutes: 5, mets: 200 }]) });
      expect((await progress(ctx.challenge))[2]).to.equal(2);
      expect(await ctx.challenge.isSuccess()).to.equal(true);
    });

  });

  describe('counting', () => {
    it('counts each step day once even when the same day is sent again (old double-count bug)', async () => {
      const ctx = await deployAll({ dayRequired: 3 });
      const d1 = ctx.dayKey(1);
      await sendBaseStep(ctx, { step: stepInput([{ day: d1, steps: 1200 }]) });
      await sendBaseStep(ctx, { step: stepInput([{ day: d1, steps: 1500 }]) });
      await sendBaseStep(ctx, {
        step: stepInput([
          { day: ctx.dayKey(0), steps: 100 },
          { day: d1, steps: 1600 },
        ]),
      });
      expect((await progress(ctx.challenge))[0]).to.equal(1);
      expect(await ctx.challenge.isFinished()).to.equal(false);
    });

    it('anchors the calendar on the first recorded day; earlier days still count', async () => {
      const ctx = await deployAll({ dayRequired: 3 });
      await sendBaseStep(ctx, { step: stepInput([{ day: ctx.dayKey(2), steps: 1000 }]) });
      expect(await ctx.challenge.dayAnchor()).to.equal(BigInt(ctx.dayKey(2)));
      await sendBaseStep(ctx, { step: stepInput([{ day: ctx.dayKey(0), steps: 1000 }]) });
      expect((await progress(ctx.challenge))[0]).to.equal(2);
    });

    it('rejects a key built in another time zone for an already-anchored calendar (no extra day)', async () => {
      const ctx = await deployAll({ dayRequired: 3 });
      await sendBaseStep(ctx, { step: stepInput([{ day: ctx.dayKey(1), steps: 1000 }]) });
      // The same physical day keyed at another offset (e.g. 9 hours later) is not on the calendar.
      const shifted = ctx.dayKey(1) + 9 * 3600;
      await expect(
        sendBaseStep(ctx, { step: { day: [shifted], steps: [1000], timeRange: [shifted, shifted + DAY - 1] } })
      ).to.be.revertedWith('Day not on the challenge calendar');
      for (const set of ['speed', 'hiit'] as const) {
        const input = set === 'speed'
          ? { speed: { day: [shifted], minutesAtTargetSpeed: [40], metsWalkingSpeed: [300], timeRange: [shifted, shifted + DAY - 1] } }
          : { hiit: achievedInput([shifted]) };
        await expect(sendBaseStep(ctx, input)).to.be.revertedWith('Day not on the challenge calendar');
      }
      expect((await progress(ctx.challenge))[0]).to.equal(1);
    });

    it('a key one hour off (daylight saving time) is the same day: updated, not counted again', async () => {
      const ctx = await deployAll({ dayRequired: 3 });
      const d1 = ctx.dayKey(1);
      await sendBaseStep(ctx, { step: stepInput([{ day: d1, steps: 1200 }]), hiit: achievedInput([d1]) });
      const dst = d1 + 3600;
      await sendBaseStep(ctx, {
        step: { day: [dst], steps: [1500], timeRange: [dst, dst + DAY - 1] },
        hiit: achievedInput([dst]),
      });
      expect(await progress(ctx.challenge)).to.deep.equal([1, 3, 0, 2, 1, 2]);
      const h = await ctx.challenge.getHistoryV4();
      expect(h.stepDate.map(Number)).to.deep.equal([d1]);
      expect(h.stepData.map(Number)).to.deep.equal([1500]);
      expect(h.hiitDays.map(Number)).to.deep.equal([d1]);
      expect(await ctx.challenge.getHIITAchievedOn(dst)).to.equal(1n);
    });

    it('counts a duplicate day inside one batch once', async () => {
      const ctx = await deployAll({ dayRequired: 3 });
      const d1 = ctx.dayKey(1);
      await sendBaseStep(ctx, {
        step: stepInput([
          { day: d1, steps: 1200 },
          { day: d1, steps: 1300 },
        ]),
      });
      expect((await progress(ctx.challenge))[0]).to.equal(1);
    });

    it('only increases stored values; a lower resend is ignored', async () => {
      const ctx = await deployAll();
      const d1 = ctx.dayKey(1);
      await sendBaseStep(ctx, {
        step: stepInput([{ day: d1, steps: 800 }]),
        speed: speedInput([{ day: d1, minutes: 40, mets: 246 }]),
      });
      await sendBaseStep(ctx, {
        step: stepInput([{ day: d1, steps: 500 }]),
        speed: speedInput([{ day: d1, minutes: 10, mets: 100 }]),
      });
      const h = await ctx.challenge.getHistoryV4();
      expect(h.stepData.map(Number)).to.deep.equal([800]);
      expect(h.speedMinutes.map(Number)).to.deep.equal([40]);
      expect(h.speedMets.map(Number)).to.deep.equal([246]);
    });

    it('counts a past day when its later update first reaches the goal', async () => {
      const ctx = await deployAll({ dayRequired: 3 });
      const d0 = ctx.dayKey(0);
      await sendBaseStep(ctx, { step: stepInput([{ day: d0, steps: 900 }]) });
      expect((await progress(ctx.challenge))[0]).to.equal(0);
      await sendBaseStep(ctx, { step: stepInput([{ day: d0, steps: 1100 }]) });
      expect((await progress(ctx.challenge))[0]).to.equal(1);
    });

    it('adds HIIT for a day whose steps were already sent, without resending steps', async () => {
      const ctx = await deployAll();
      const d1 = ctx.dayKey(1);
      await sendBaseStep(ctx, { step: stepInput([{ day: d1, steps: 2000 }]) });
      await sendBaseStep(ctx, { hiit: achievedInput([d1]) });
      expect(await progress(ctx.challenge)).to.deep.equal([1, 2, 0, 2, 1, 2]);
    });

    it('counts a HIIT day once and does not revert on a resend', async () => {
      const ctx = await deployAll({ dayRequired: 3 });
      const d1 = ctx.dayKey(1);
      await sendBaseStep(ctx, { hiit: achievedInput([d1]) });
      await sendBaseStep(ctx, { hiit: achievedInput([d1]) });
      await sendBaseStep(ctx, { hiit: achievedInput([d1, d1]) });
      expect((await progress(ctx.challenge))[4]).to.equal(1);
      expect(await ctx.challenge.getHIITAchievedOn(d1)).to.equal(1n);
      expect((await ctx.challenge.getHistoryV4()).hiitDays.map(Number)).to.deep.equal([d1]);
    });

    it('resending a HIIT day with new steps still records the steps', async () => {
      const ctx = await deployAll({ dayRequired: 3 });
      const d1 = ctx.dayKey(1);
      await sendBaseStep(ctx, { hiit: achievedInput([d1]) });
      await sendBaseStep(ctx, { step: stepInput([{ day: d1, steps: GOAL }]), hiit: achievedInput([d1]) });
      expect(await progress(ctx.challenge)).to.deep.equal([1, 3, 0, 2, 1, 2]);
    });

    it('counts HIIT and speed days independently of the step goal on that day', async () => {
      const ctx = await deployAll();
      const d1 = ctx.dayKey(1);
      await sendBaseStep(ctx, {
        step: stepInput([{ day: d1, steps: 10 }]),
        speed: speedInput([{ day: d1, minutes: 31, mets: 300 }]),
        hiit: achievedInput([d1]),
      });
      expect(await progress(ctx.challenge)).to.deep.equal([0, 2, 1, 2, 1, 2]);
    });

    it('keeps three separate day lists in the history', async () => {
      const ctx = await deployAll();
      await sendBaseStep(ctx, {
        step: stepInput([{ day: ctx.dayKey(0), steps: 1000 }]),
        speed: speedInput([{ day: ctx.dayKey(1), minutes: 30, mets: 250 }]),
        hiit: achievedInput([ctx.dayKey(2)]),
      });
      const h = await ctx.challenge.getHistoryV4();
      expect(h.stepDate.map(Number)).to.deep.equal([ctx.dayKey(0)]);
      expect(h.speedDays.map(Number)).to.deep.equal([ctx.dayKey(1)]);
      expect(h.hiitDays.map(Number)).to.deep.equal([ctx.dayKey(2)]);
      const [date, data] = await ctx.challenge.getChallengeHistory();
      expect(date.map(Number)).to.deep.equal([ctx.dayKey(0)]);
      expect(data.map(Number)).to.deep.equal([1000]);
    });
  });

  describe('HIIT days', () => {
    it('caps the HIIT count at the required days, so getChallengeInfo cannot underflow', async () => {
      const ctx = await deployAll({ dayRequired: 9, walkingSpeedData: [], hiitData: [2, ...MENU] });
      await sendBaseStep(ctx, { hiit: achievedInput([ctx.dayKey(1), ctx.dayKey(2), ctx.dayKey(3)]) });
      expect((await progress(ctx.challenge))[4]).to.equal(2);
      expect((await ctx.challenge.getChallengeInfo()).map(Number)[2]).to.equal(9);
    });

    it('rejects achieved other than 1', async () => {
      const ctx = await deployAll();
      const d1 = ctx.dayKey(1);
      await expect(
        sendBaseStep(ctx, { hiit: { day: [d1], achieved: [0], timeRange: [d1, d1 + DAY - 1] } })
      ).to.be.revertedWith('Invalid achieved');
    });

    it('c: day 1 of steps, speed and HIIT uses [startTime, end of the day]; a full-day range is refused', async () => {
      const ctx = await deployV4('ChallengeBaseStepV4', {
        goal: GOAL, dayRequired: 2, walkingSpeedData: SPEED, hiitData: HIIT, startOffset: 14 * 3600 + 300,
      });
      await moveTo(ctx.startTime);
      const day = ctx.day0;
      const fullDay = { step: stepInput([{ day, steps: GOAL }]), raw: true };
      await expect(sendBaseStep(ctx, fullDay)).to.be.revertedWith('Invalid time range');
      await expect(
        sendBaseStep(ctx, { speed: speedInput([{ day, minutes: 30, mets: 300 }]), raw: true })
      ).to.be.revertedWith('Invalid time range');
      await expect(sendBaseStep(ctx, { hiit: achievedInput([day]) })).to.be.revertedWith('Invalid time range');
      await sendBaseStep(ctx, {
        step: { day: [day], steps: [GOAL], timeRange: [ctx.startTime, day + DAY - 1] },
        speed: { day: [day], minutesAtTargetSpeed: [30], metsWalkingSpeed: [300], timeRange: [ctx.startTime, day + DAY - 1] },
        hiit: withRange([day], [ctx.startTime, day + DAY - 1]),
        raw: true,
      });
      expect(await progress(ctx.challenge)).to.deep.equal([1, 2, 1, 2, 1, 2]);
    });

    it('a day-1 range ending before a late start (23:30) is refused for each set', async () => {
      const ctx = await deployV4('ChallengeBaseStepV4', {
        goal: GOAL, dayRequired: 2, walkingSpeedData: SPEED, hiitData: HIIT, startOffset: 23 * 3600 + 1800,
      });
      await moveTo(ctx.startTime + 60);
      const day = ctx.day0;
      const inverted = [ctx.startTime, ctx.startTime - 1];
      await expect(sendBaseStep(ctx, { step: { day: [day], steps: [GOAL], timeRange: inverted }, raw: true })).to.be.revertedWith('Day outside challenge period');
      await expect(
        sendBaseStep(ctx, { speed: { day: [day], minutesAtTargetSpeed: [30], metsWalkingSpeed: [300], timeRange: inverted }, raw: true })
      ).to.be.revertedWith('Day outside challenge period');
      await expect(sendBaseStep(ctx, { hiit: withRange([day], inverted) })).to.be.revertedWith('Day outside challenge period');
      await sendBaseStep(ctx, { step: stepInput([{ day, steps: GOAL }]) });
      expect(await progress(ctx.challenge)).to.deep.equal([1, 2, 0, 2, 0, 2]);
    });

    it('HIIT sent first anchors the calendar on its day key, not on the range start', async () => {
      const ctx = await deployV4('ChallengeBaseStepV4', {
        goal: GOAL, dayRequired: 2, hiitData: HIIT, startOffset: 14 * 3600 + 300,
      });
      await moveTo(ctx.dayKey(1) + 3600);
      await sendBaseStep(ctx, { hiit: withRange([ctx.day0], [ctx.startTime, ctx.day0 + DAY - 1]) });
      expect(await ctx.challenge.dayAnchor()).to.equal(BigInt(ctx.day0));
      await sendBaseStep(ctx, { step: stepInput([{ day: ctx.dayKey(1), steps: GOAL }]) });
      expect(await progress(ctx.challenge)).to.deep.equal([1, 2, 0, 0, 1, 2]);
    });

    it('HIIT never causes an early failure', async () => {
      const ctx = await deployAll({ walkingSpeedData: [], hiitData: [9, ...MENU] });
      await sendBaseStep(ctx, { step: stepInput([{ day: ctx.dayKey(1), steps: GOAL }, { day: ctx.dayKey(2), steps: GOAL }]) });
      expect(await ctx.challenge.getState()).to.equal(0n);
      expect(await ctx.challenge.isFinished()).to.equal(false);
    });

    it('a HIIT-only submission does not roll the gacha', async () => {
      const ctx = await deployAll();
      const gacha = await (await hre.ethers.getContractFactory('MockCountingGacha')).deploy();
      await sendBaseStep(ctx, { hiit: achievedInput([ctx.dayKey(1)]), gacha: [await gacha.getAddress()] });
      expect(await gacha.calls()).to.equal(0n);
    });
  });

  describe('give up', () => {
    it('with HIIT only the challenger can give up', async () => {
      const ctx = await deployAll();
      await expect(giveUp(ctx, ctx.sponsor)).to.be.revertedWith('Only challenger can call this function');
      await expect(giveUp(ctx, ctx.signers[9])).to.be.revertedWith('Only challenger can call this function');
      await giveUp(ctx, ctx.challenger);
      expect(await ctx.challenge.getState()).to.equal(3n);
    });

    it('B1: without HIIT too, only the challenger can give up', async () => {
      const ctx = await deployAll({ hiitData: [] });
      await expect(giveUp(ctx, ctx.sponsor)).to.be.revertedWith('Only challenger can call this function');
      await giveUp(ctx, ctx.challenger);
      expect(await ctx.challenge.getState()).to.equal(3n);
    });
  });

  describe('success', () => {
    it('succeeds only when every condition reaches its own required days, on different days', async () => {
      // Default shares 95 (success) + 5% success fee and 90 (failure) + 10% failure fee (Q5).
      const ctx = await deployAll();
      const [d0, d1, d2, d3] = [0, 1, 2, 3].map(ctx.dayKey);
      // Steps on days 0 and 1, speed on days 2 and 3, HIIT on days 1 and 3.
      await sendBaseStep(ctx, {
        step: stepInput([
          { day: d0, steps: 1000 },
          { day: d1, steps: 1000 },
        ]),
      });
      await sendBaseStep(ctx, {
        speed: speedInput([
          { day: d2, minutes: 30, mets: 300 },
          { day: d3, minutes: 45, mets: 300 },
        ]),
      });
      await sendBaseStep(ctx, { hiit: achievedInput([d1]) });
      expect(await ctx.challenge.isFinished()).to.equal(false);

      const receiver = ctx.signers[4].address;
      const before = await hre.ethers.provider.getBalance(receiver);
      await expect(sendBaseStep(ctx, { hiit: achievedInput([d3]) }))
        .to.emit(ctx.challenge, 'SendDailyResult')
        .withArgs(2);
      expect(await ctx.challenge.isSuccess()).to.equal(true);
      expect(await ctx.challenge.isFinished()).to.equal(true);
      expect(await ctx.challenge.getState()).to.equal(1n); // SUCCESS
      expect(await hre.ethers.provider.getBalance(receiver)).to.be.gt(before);

      await expect(
        sendBaseStep(ctx, { step: stepInput([{ day: ctx.dayKey(4), steps: 1000 }]) })
      ).to.be.revertedWith('Challenge was finished');
    });

    it('step-only challenge succeeds on steps alone', async () => {
      const ctx = await deployV4('ChallengeBaseStepV4', { goal: GOAL, dayRequired: 2 });
      await moveTo(ctx.dayKey(2) + 60);
      await sendBaseStep(ctx, {
        step: stepInput([
          { day: ctx.dayKey(0), steps: 1000 },
          { day: ctx.dayKey(1), steps: 1000 },
        ]),
      });
      expect(await ctx.challenge.isSuccess()).to.equal(true);
    });

    it('getChallengeInfo: cleared/required are step days (ratio <= 100%); daysRemained is 0 only when all are met', async () => {
      const ctx = await deployAll({ dayRequired: 2 });
      await sendBaseStep(ctx, {
        step: stepInput([
          { day: ctx.dayKey(0), steps: 1000 },
          { day: ctx.dayKey(1), steps: 1000 },
        ]),
      });
      // Step days complete (2/2) but speed 0/2 and HIIT 0/2 missing: 4 days remain.
      expect((await ctx.challenge.getChallengeInfo()).map(Number)).to.deep.equal([2, 2, 4]);
      await sendBaseStep(ctx, {
        speed: speedInput([
          { day: ctx.dayKey(0), minutes: 30, mets: 300 },
          { day: ctx.dayKey(1), minutes: 30, mets: 300 },
        ]),
        hiit: achievedInput([ctx.dayKey(2), ctx.dayKey(3)]),
      });
      expect((await ctx.challenge.getChallengeInfo()).map(Number)).to.deep.equal([2, 2, 0]);
      expect(await ctx.challenge.isSuccess()).to.equal(true);
    });
  });

  describe('acceptance window and day checks', () => {
    it('has no early failure: many failed days do not finalize the challenge', async () => {
      const ctx = await deployAll({ dayRequired: 2 });
      await sendBaseStep(ctx, {
        step: stepInput([0, 1, 2, 3, 4, 5].map(k => ({ day: ctx.dayKey(k), steps: 1 }))),
      });
      expect(await ctx.challenge.isFinished()).to.equal(false);
    });

    it('accepts results after endTime + 2 days for days inside the period, until finalized', async () => {
      const ctx = await deployAll({ dayRequired: 2, walkingSpeedData: [], hiitData: [] });
      await moveTo(ctx.endTime + 5 * DAY);
      await sendBaseStep(ctx, {
        step: stepInput([
          { day: ctx.dayKey(8), steps: 1000 },
          { day: ctx.dayKey(9), steps: 1000 },
        ]),
      });
      expect(await ctx.challenge.isSuccess()).to.equal(true);
    });

    it('rejects a day outside the challenge period', async () => {
      const ctx = await deployAll();
      await moveTo(ctx.endTime + DAY);
      await expect(
        sendBaseStep(ctx, { step: stepInput([{ day: ctx.dayKey(10), steps: 1000 }]) })
      ).to.be.revertedWith('Day outside challenge period');
      // 3.2: the day before the first day, even with a range starting at startTime.
      const before = ctx.dayKey(-1);
      await expect(
        sendBaseStep(ctx, { step: { day: [before], steps: [1000], timeRange: [ctx.startTime, before + DAY - 1] }, raw: true })
      ).to.be.revertedWith('Day outside challenge period');
    });

    it('rejects a day that has not started yet', async () => {
      const ctx = await deployAll();
      await expect(
        sendBaseStep(ctx, { hiit: achievedInput([ctx.dayKey(6)]) })
      ).to.be.revertedWith('Day has not started');
    });

    it('rejects a day key that is not the start of its range, or a range over 25 hours', async () => {
      const ctx = await deployAll();
      const d1 = ctx.dayKey(1);
      const shifted = { day: [d1 + 5], steps: [1000], timeRange: [d1, d1 + DAY - 1] };
      await expect(sendBaseStep(ctx, { step: shifted })).to.be.revertedWith('Invalid time range');
      const long = { day: [d1], steps: [1000], timeRange: [d1, d1 + 25 * 3600] };
      await expect(sendBaseStep(ctx, { step: long })).to.be.revertedWith('Invalid time range');
      const short = { day: [d1], steps: [1000], timeRange: [d1, d1 + 23 * 3600 - 2] };
      await expect(sendBaseStep(ctx, { step: short })).to.be.revertedWith('Invalid time range');
      const dstLong = { day: [d1], steps: [1000], timeRange: [d1, d1 + 25 * 3600 - 1] }; // 25-hour DST day
      await sendBaseStep(ctx, { step: dstLong });
      const d2 = ctx.dayKey(2);
      const dstShort = { day: [d2], steps: [1000], timeRange: [d2, d2 + 23 * 3600 - 1] }; // 23-hour DST day
      await sendBaseStep(ctx, { step: dstShort });
    });

    it('rejects mismatched array lengths', async () => {
      const ctx = await deployAll();
      const d1 = ctx.dayKey(1);
      await expect(
        sendBaseStep(ctx, { step: { day: [d1], steps: [1000], timeRange: [d1] } })
      ).to.be.revertedWith('Invalid time range length');
      await expect(
        sendBaseStep(ctx, { step: { day: [d1], steps: [], timeRange: [d1, d1 + DAY - 1] } })
      ).to.be.revertedWith('Invalid step data length');
      await expect(
        sendBaseStep(ctx, {
          speed: { day: [d1], minutesAtTargetSpeed: [30], metsWalkingSpeed: [], timeRange: [d1, d1 + DAY - 1] },
        })
      ).to.be.revertedWith('Invalid walking speed data length');
      await expect(sendBaseStep(ctx, {})).to.be.revertedWith('Invalid day length');
    });

    it('rejects speed or HIIT results when that condition is disabled, and HIIT arrays of different lengths', async () => {
      const ctx = await deployAll({ walkingSpeedData: [], hiitData: [] });
      const d1 = ctx.dayKey(1);
      await expect(
        sendBaseStep(ctx, { speed: speedInput([{ day: d1, minutes: 30, mets: 100 }]) })
      ).to.be.revertedWith('Walking speed disabled');
      await expect(sendBaseStep(ctx, { hiit: achievedInput([d1]) })).to.be.revertedWith(
        'HIIT disabled'
      );
      const withHiit = await deployAll();
      const d = withHiit.dayKey(1);
      await expect(
        sendBaseStep(withHiit, { hiit: { day: [d], achieved: [], timeRange: [d, d + DAY - 1] } })
      ).to.be.revertedWith('Invalid HIIT data length');
    });

    it('only the challenger can send', async () => {
      const ctx = await deployAll();
      await expect(
        sendBaseStep(ctx, { step: stepInput([{ day: ctx.dayKey(1), steps: 1000 }]) }, ctx.sponsor)
      ).to.be.revertedWith('Only challenger can call this function');
    });
  });

  describe('signature binds every submitted value', () => {
    it('rejects a payload different from the signed one (e.g. a forged HIIT success)', async () => {
      const ctx = await deployAll();
      const addr = await ctx.challenge.getAddress();
      const signedHiit = achievedInput([ctx.dayKey(1)]);
      const forgedHiit = achievedInput([ctx.dayKey(2)]);
      const { data, signature } = await signPayload(
        ctx.security,
        addr,
        payloadHashBaseStep(emptyStep(), emptySpeed(), signedHiit)
      );
      await expect(
        ctx.challenge
          .connect(ctx.challenger)
          .sendDailyResult(emptyStep(), emptySpeed(), forgedHiit, data, signature, [], [], [], [])
      ).to.be.revertedWith('InvalidSignature');
    });

    it('rejects a reused signature and an expired one', async () => {
      const ctx = await deployAll();
      const addr = await ctx.challenge.getAddress();
      const step = stepInput([{ day: ctx.dayKey(1), steps: 1000 }]);
      const hash = payloadHashBaseStep(step, emptySpeed(), emptyHiit());
      const { data, signature } = await signPayload(ctx.security, addr, hash);
      await ctx.challenge
        .connect(ctx.challenger)
        .sendDailyResult(step, emptySpeed(), emptyHiit(), data, signature, [], [], [], []);
      await expect(
        ctx.challenge
          .connect(ctx.challenger)
          .sendDailyResult(step, emptySpeed(), emptyHiit(), data, signature, [], [], [], [])
      ).to.be.revertedWith('HashUsed');

      const late = await signPayload(ctx.security, addr, hash, 60);
      await moveTo((await hre.ethers.provider.getBlock('latest'))!.timestamp + 120);
      await expect(
        ctx.challenge
          .connect(ctx.challenger)
          .sendDailyResult(step, emptySpeed(), emptyHiit(), late.data, late.signature, [], [], [], [])
      ).to.be.revertedWith('Signature is inaccessible');
    });

    it('rejects a signature in the legacy format (contract nonce in _data[0])', async () => {
      const ctx = await deployAll();
      const addr = await ctx.challenge.getAddress();
      const step = stepInput([{ day: ctx.dayKey(1), steps: 1000 }]);
      const legacy = await signPayload(ctx.security, addr, payloadHashBaseStep(step, emptySpeed(), emptyHiit()), 300, 1n);
      await expect(
        ctx.challenge
          .connect(ctx.challenger)
          .sendDailyResult(step, emptySpeed(), emptyHiit(), legacy.data, legacy.signature, [], [], [], [])
      ).to.be.revertedWith('Invalid signature domain');
    });

    it('reverts until the challenge role is granted on the NFT contract', async () => {
      const ctx = await deployV4('ChallengeBaseStepV4', { goal: GOAL, dayRequired: 2, grantRole: false });
      await moveTo(ctx.dayKey(1) + 60);
      const step = stepInput([{ day: ctx.dayKey(0), steps: 1000 }]);
      await expect(sendBaseStep(ctx, { step })).to.be.revertedWith('AccessControl: missing challenge role');
      await ctx.nft.grantChallengeRole(await ctx.challenge.getAddress());
      await sendBaseStep(ctx, { step });
      expect((await progress(ctx.challenge))[0]).to.equal(1);
    });

    it('rejects a signature from another key', async () => {
      const ctx = await deployAll();
      const other = hre.ethers.Wallet.createRandom();
      await expect(
        sendBaseStep(
          { ...ctx, security: other },
          { step: stepInput([{ day: ctx.dayKey(1), steps: 1000 }]) }
        )
      ).to.be.revertedWith('InvalidSignature');
    });
  });

  describe('gacha', () => {
    it('rolls the gacha only with step values that are new or higher', async () => {
      const ctx = await deployAll({ dayRequired: 5 });
      const Gacha = await hre.ethers.getContractFactory('MockCountingGacha');
      const gacha = await Gacha.deploy();
      const gachaList = [await gacha.getAddress()];
      const [d0, d1] = [ctx.dayKey(0), ctx.dayKey(1)];
      await sendBaseStep(ctx, { step: stepInput([{ day: d1, steps: 1200 }]), gacha: gachaList });
      expect(await gacha.calls()).to.equal(1n);
      expect(await gacha.lastValues(0)).to.equal(1200n);
      // Identical or lower resend, or only speed / HIIT changes: no gacha roll.
      await sendBaseStep(ctx, { step: stepInput([{ day: d1, steps: 1200 }]), gacha: gachaList });
      await sendBaseStep(ctx, { step: stepInput([{ day: d1, steps: 900 }]), gacha: gachaList });
      await sendBaseStep(ctx, {
        step: stepInput([{ day: d1, steps: 1200 }]),
        speed: speedInput([{ day: d1, minutes: 40, mets: 300 }]),
        hiit: achievedInput([d1]),
        gacha: gachaList,
      });
      expect(await gacha.calls()).to.equal(1n);
      // A batch with an unchanged day and a new day passes only the new value.
      await sendBaseStep(ctx, {
        step: stepInput([
          { day: d1, steps: 1200 },
          { day: d0, steps: 1500 },
        ]),
        gacha: gachaList,
      });
      expect(await gacha.calls()).to.equal(2n);
      expect(await gacha.lastValues(0)).to.equal(1500n);
      await expect(gacha.lastValues(1)).to.be.reverted;
    });
  });

  describe('close and give-up', () => {
    it('Q1: only the sponsor closes, from endTime + 2 days, with or without HIIT, with no upper limit', async () => {
      for (const hiitData of [HIIT, []]) {
        const ctx = await deployAll({ hiitData });
        await sendBaseStep(ctx, { step: stepInput([{ day: ctx.dayKey(0), steps: 1000 }]) });
        await expect(ctx.challenge.connect(ctx.sponsor).closeChallenge([], [], [], [])).to.be.revertedWith(
          'Challenge has not finished yet'
        );
        await moveTo(ctx.endTime + 2 * DAY + 1);
        await expect(ctx.challenge.connect(ctx.challenger).closeChallenge([], [], [], [])).to.be.revertedWith(
          'Only sponsor can close'
        );
        // Late results still count until the sponsor closes.
        await sendBaseStep(ctx, { step: stepInput([{ day: ctx.dayKey(1), steps: 1000 }]) });
        expect((await progress(ctx.challenge))[0]).to.equal(2);
        await moveTo(ctx.endTime + 400 * DAY);
        await ctx.challenge.connect(ctx.sponsor).closeChallenge([], [], [], []);
        expect(await ctx.challenge.isFinished()).to.equal(true);
        expect(await ctx.challenge.isSuccess()).to.equal(false);
        expect(await ctx.challenge.getState()).to.equal(4n); // CLOSED
      }
    });

    it('B1: giveUp returns the deposit minus the failure fee to the sponsor, whatever the progress', async () => {
      const ctx = await deployAll({ dayRequired: 4, walkingSpeedData: [], hiitData: [4, ...MENU], allAwardToSponsor: false });
      await sendBaseStep(ctx, {
        step: stepInput([{ day: ctx.dayKey(0), steps: 1000 }, { day: ctx.dayKey(1), steps: 1000 }]),
        hiit: achievedInput([ctx.dayKey(1)]),
      });
      const balance = (a: string) => hre.ethers.provider.getBalance(a);
      const [receiver, fee] = [ctx.signers[4].address, ctx.signers[2].address];
      const [s0, r0, f0] = [await balance(ctx.sponsor.address), await balance(receiver), await balance(fee)];
      await ctx.challenge.connect(ctx.challenger).giveUp([], [], [], []);
      expect((await balance(ctx.sponsor.address)) - s0).to.equal(hre.ethers.parseEther('0.9'));
      expect((await balance(receiver)) - r0).to.equal(0n);
      expect((await balance(fee)) - f0).to.equal(hre.ethers.parseEther('0.1'));
      expect(await ctx.challenge.getContractBalance()).to.equal(0n);
    });
  });

  describe('settlement and edge values', () => {
    it('success pays each receiver its exact share and the success fee', async () => {
      const ctx = await deployV4('ChallengeBaseStepV4', {
        goal: GOAL, dayRequired: 1, awardReceiversPercent: [50, 45, 90], index: 2,
      });
      await moveTo(ctx.dayKey(0) + 3600);
      const [r0, r1, fee] = [ctx.signers[4].address, ctx.signers[5].address, ctx.signers[2].address];
      const before = await Promise.all([r0, r1, fee].map((a) => hre.ethers.provider.getBalance(a)));
      await sendBaseStep(ctx, { step: stepInput([{ day: ctx.dayKey(0), steps: 1000 }]) });
      const after = await Promise.all([r0, r1, fee].map((a) => hre.ethers.provider.getBalance(a)));
      const one = hre.ethers.parseEther('1');
      expect(after[0] - before[0]).to.equal((one * 50n) / 100n);
      expect(after[1] - before[1]).to.equal((one * 45n) / 100n);
      expect(after[2] - before[2]).to.equal((one * 5n) / 100n);
    });

    it('Q5: a token (ERC20) challenge settles in the token on success, with the success fee', async () => {
      const [sponsor] = await hre.ethers.getSigners();
      const token = await (await hre.ethers.getContractFactory('MockERC20')).deploy('Yen', 'JPYC');
      const amount = hre.ethers.parseEther('1000');
      await token.mint(sponsor.address, amount);
      const ctx = await deployV4('ChallengeBaseStepV4', {
        goal: GOAL, dayRequired: 1, totalAmount: amount, msgValue: 0n,
        allowGiveUp: [true, false, false], erc20List: [await token.getAddress()],
      });
      await token.connect(sponsor).transfer(await ctx.challenge.getAddress(), amount);
      await moveTo(ctx.dayKey(0) + 3600);
      await sendBaseStep(ctx, { step: stepInput([{ day: ctx.dayKey(0), steps: 1000 }]) });
      expect(await ctx.challenge.isSuccess()).to.equal(true);
      expect(await token.balanceOf(ctx.signers[4].address)).to.equal((amount * 95n) / 100n);
      expect(await token.balanceOf(ctx.signers[2].address)).to.equal((amount * 5n) / 100n); // fee address: success fee
      expect(await token.balanceOf(await ctx.challenge.getAddress())).to.equal(0n);
    });

    // The Kaia mainnet NFT lists TTJP before JPYC, so a JPYC challenge has no balance in the first listed token.
    async function tokenGiveUpCtx(funded: Record<string, bigint>, listOrder: string[]) {
      const [sponsor] = await hre.ethers.getSigners();
      const Token = await hre.ethers.getContractFactory('MockERC20');
      const tokens: Record<string, any> = {};
      for (const name of listOrder) tokens[name] = await Token.deploy(name, name);
      for (const [name, amount] of Object.entries(funded)) await tokens[name].mint(sponsor.address, amount);
      const ctx = await deployV4('ChallengeBaseStepV4', {
        goal: GOAL, dayRequired: 4, totalAmount: funded.JPYC, msgValue: 0n,
        allowGiveUp: [true, false, false], erc20List: await Promise.all(listOrder.map((n) => tokens[n].getAddress())),
      });
      for (const [name, amount] of Object.entries(funded)) await tokens[name].connect(sponsor).transfer(await ctx.challenge.getAddress(), amount);
      await moveTo(ctx.dayKey(0) + 3600);
      await sendBaseStep(ctx, { step: stepInput([{ day: ctx.dayKey(0), steps: 1000 }]) }); // progress 1/4
      return { ctx, tokens, sponsor };
    }

    it('B1: giveUp returns a token that is not first in the NFT token list to the sponsor (Kaia: TTJP before JPYC)', async () => {
      const amount = hre.ethers.parseEther('100');
      const { ctx, tokens, sponsor } = await tokenGiveUpCtx({ JPYC: amount }, ['TTJP', 'JPYC']);
      await ctx.challenge.connect(ctx.challenger).giveUp([], [], [], []);
      expect(await tokens.JPYC.balanceOf(ctx.signers[4].address)).to.equal(0n);
      expect(await tokens.JPYC.balanceOf(sponsor.address)).to.equal((amount * 90n) / 100n);
      expect(await tokens.JPYC.balanceOf(ctx.signers[2].address)).to.equal((amount * 10n) / 100n); // fee address
      expect(await tokens.JPYC.balanceOf(await ctx.challenge.getAddress())).to.equal(0n);
    });

    it('B1: giveUp returns every funded token to the sponsor when some listed tokens are empty', async () => {
      const funded = { JPYC: hre.ethers.parseEther('100'), USDT: hre.ethers.parseEther('40') };
      const { ctx, tokens, sponsor } = await tokenGiveUpCtx(funded, ['TTJP', 'JPYC', 'USDT']);
      await ctx.challenge.connect(ctx.challenger).giveUp([], [], [], []);
      for (const [name, amount] of Object.entries(funded)) {
        expect(await tokens[name].balanceOf(ctx.signers[4].address), `${name} receiver`).to.equal(0n);
        expect(await tokens[name].balanceOf(sponsor.address), `${name} sponsor`).to.equal((amount * 90n) / 100n);
        expect(await tokens[name].balanceOf(ctx.signers[2].address), `${name} fee`).to.equal((amount * 10n) / 100n);
        expect(await tokens[name].balanceOf(await ctx.challenge.getAddress()), `${name} left`).to.equal(0n);
      }
    });

    it('a coin challenge settles while the NFT also lists a token with no balance (success and Close)', async () => {
      const token = await (await hre.ethers.getContractFactory('MockERC20')).deploy('Yen', 'JPYC');
      const ok = await deployAll({ dayRequired: 1, walkingSpeedData: [], hiitData: [], erc20List: [await token.getAddress()] });
      await sendBaseStep(ok, { step: stepInput([{ day: ok.dayKey(1), steps: 1000 }]) });
      expect(await ok.challenge.isSuccess()).to.equal(true);
      const closed = await deployAll({ erc20List: [await token.getAddress()] });
      await moveTo(closed.endTime + 2 * DAY + 1);
      await closed.challenge.connect(closed.sponsor).closeChallenge([], [], [], []);
      expect(await closed.challenge.getState()).to.equal(4n);
      expect(await closed.challenge.getContractBalance()).to.equal(0n);
    });

    it('closeChallenge is refused at exactly endTime + 2 days and allowed one second later (sponsor)', async () => {
      const ctx = await deployAll();
      await time.setNextBlockTimestamp(ctx.endTime + 2 * DAY);
      await expect(ctx.challenge.connect(ctx.sponsor).closeChallenge([], [], [], [])).to.be.revertedWith(
        'Challenge has not finished yet'
      );
      await time.setNextBlockTimestamp(ctx.endTime + 2 * DAY + 1);
      await ctx.challenge.connect(ctx.sponsor).closeChallenge([], [], [], []);
      expect(await ctx.challenge.isFinished()).to.equal(true);
    });

    it('a failing gacha emits GachaRewardFailed and does not block the result', async () => {
      const ctx = await deployAll({ dayRequired: 3 });
      const gacha = await (await hre.ethers.getContractFactory('MockCountingGacha')).deploy();
      await gacha.setShouldRevert(true);
      await expect(
        sendBaseStep(ctx, { step: stepInput([{ day: ctx.dayKey(1), steps: 1200 }]), gacha: [await gacha.getAddress()] })
      )
        .to.emit(ctx.challenge, 'GachaRewardFailed')
        .withArgs(await gacha.getAddress());
      expect((await progress(ctx.challenge))[0]).to.equal(1);
    });

    it('stores very large values without overflow', async () => {
      const ctx = await deployAll({ dayRequired: 3 });
      const huge = 2n ** 200n;
      await sendBaseStep(ctx, { step: { day: [ctx.dayKey(1)], steps: [huge as any], timeRange: [ctx.dayKey(1), ctx.dayKey(1) + DAY - 1] } });
      const h = await ctx.challenge.getHistoryV4();
      expect(h.stepData[0]).to.equal(huge);
      expect((await progress(ctx.challenge))[0]).to.equal(1);
    });
  });

  it('fits the EIP-170 contract size limit', async () => {
    const artifact = await hre.artifacts.readArtifact('ChallengeBaseStepV4');
    const size = (artifact.deployedBytecode.length - 2) / 2;
    expect(size).to.be.lessThan(24576);
  });
});
