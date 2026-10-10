// ChallengeBaseStepV3: step, walking speed and HIIT counted independently (CHALLENGE-2650 / Timer Spec v1.0).
import { expect } from 'chai';
import hre from 'hardhat';
import { time } from '@nomicfoundation/hardhat-toolbox/network-helpers.js';
import {
  DAY,
  deployV3,
  emptyHiit,
  emptySpeed,
  emptyStep,
  hiitInput,
  moveTo,
  payloadHashBaseStep,
  sendBaseStep,
  signPayload,
  speedInput,
  stepInput,
} from './helpersV3.ts';

const GOAL = 1000;
const SPEED = [5, 30, 2]; // target 5 km/h, 30 minutes per day, 2 speed days
const HIIT = [2, 6, 60]; // 2 HIIT success days; a day succeeds at 6 intervals and 60 seconds

async function deployAll(opts: Record<string, any> = {}) {
  const ctx = await deployV3('ChallengeBaseStepV3', {
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
  const p = await challenge.getProgressV3();
  return p.map((v: bigint) => Number(v));
}

describe('ChallengeBaseStepV3', () => {
  describe('constructor', () => {
    it('stores independent required days and version identifiers', async () => {
      const { challenge } = await deployV3('ChallengeBaseStepV3', {
        dayRequired: 3,
        walkingSpeedData: [5, 30, 7], // speed days may exceed step days (old speed <= step rule dropped)
        hiitData: [9, 6, 60],
      });
      expect(await progress(challenge)).to.deep.equal([0, 3, 0, 7, 0, 9]);
      expect([await challenge.hiitIntervalsRequired(), await challenge.hiitSecondsRequired()]).to.deep.equal([6n, 60n]);
      expect(await challenge.contractVersion()).to.equal(3n);
      expect(await challenge.metScale()).to.equal(100n);
      expect(await challenge.isHiitEnabled()).to.equal(true);
    });

    it('accepts a step-only challenge', async () => {
      const { challenge } = await deployV3('ChallengeBaseStepV3', { dayRequired: 2 });
      expect(await progress(challenge)).to.deep.equal([0, 2, 0, 0, 0, 0]);
      expect(await challenge.isHiitEnabled()).to.equal(false);
    });

    for (const [label, opts, reason] of [
      ['step days 0', { dayRequired: 0 }, 'Invalid step days'],
      ['step days > duration', { dayRequired: 11 }, 'Invalid step days'],
      ['HIIT days only (previous format)', { hiitData: [2] }, 'Invalid HIIT data'],
      ['two HIIT values', { hiitData: [5, 60] }, 'Invalid HIIT data'],
    ] as const) {
      it(`reverts on ${label}`, async () => {
        await expect(deployV3('ChallengeBaseStepV3', { duration: 10, ...(opts as any) })).to.be.revertedWith(
          reason
        );
      });
    }

    // The walking speed and HIIT values are not checked: the app and BACKEND own them.
    for (const [label, opts] of [
      ['speed days 0', { walkingSpeedData: [5, 30, 0] }],
      ['speed days > duration', { walkingSpeedData: [5, 30, 11] }],
      ['speed minutes 0', { walkingSpeedData: [5, 0, 2] }],
      ['HIIT days 0', { hiitData: [0, 6, 60] }],
      ['HIIT days > duration', { hiitData: [11, 6, 60] }],
      ['HIIT goal 0 intervals', { hiitData: [2, 0, 60] }],
      ['HIIT goal 0 seconds', { hiitData: [2, 6, 0] }],
    ] as const) {
      it(`accepts ${label} and stores it as given`, async () => {
        const { challenge } = await deployV3('ChallengeBaseStepV3', { duration: 10, ...(opts as any) });
        if ('walkingSpeedData' in opts) {
          expect(await challenge.speedDayRequired()).to.equal(BigInt(opts.walkingSpeedData[2]));
        } else {
          expect(await challenge.hiitDayRequired()).to.equal(BigInt(opts.hiitData[0]));
          expect([await challenge.hiitIntervalsRequired(), await challenge.hiitSecondsRequired()]).to.deep.equal([
            BigInt(opts.hiitData[1]),
            BigInt(opts.hiitData[2]),
          ]);
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

    it('0 required HIIT and speed days count as reached: the step days alone finish the challenge', async () => {
      const ctx = await deployAll({ walkingSpeedData: [5, 30, 0], hiitData: [0, 6, 60] });
      await sendBaseStep(ctx, { step: stepInput([{ day: ctx.dayKey(1), steps: GOAL }, { day: ctx.dayKey(2), steps: GOAL }]) });
      expect(await ctx.challenge.isSuccess()).to.equal(true);
      expect(await ctx.challenge.getState()).to.equal(1n); // SUCCESS
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
          : { hiit: { day: [shifted], intervals: [6], totalSeconds: [60], timeRange: [shifted, shifted + DAY - 1] } };
        await expect(sendBaseStep(ctx, input)).to.be.revertedWith('Day not on the challenge calendar');
      }
      expect((await progress(ctx.challenge))[0]).to.equal(1);
    });

    it('a key one hour off (daylight saving time) is the same day: updated, not counted again', async () => {
      const ctx = await deployAll({ dayRequired: 3 });
      const d1 = ctx.dayKey(1);
      await sendBaseStep(ctx, { step: stepInput([{ day: d1, steps: 1200 }]), hiit: hiitInput([{ day: d1, success: 1 }]) });
      const dst = d1 + 3600;
      await sendBaseStep(ctx, {
        step: { day: [dst], steps: [1500], timeRange: [dst, dst + DAY - 1] },
        hiit: { day: [dst], intervals: [6], totalSeconds: [60], timeRange: [dst, dst + DAY - 1] },
      });
      expect(await progress(ctx.challenge)).to.deep.equal([1, 3, 0, 2, 1, 2]);
      const h = await ctx.challenge.getHistoryV3();
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
      const h = await ctx.challenge.getHistoryV3();
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
      await sendBaseStep(ctx, { hiit: hiitInput([{ day: d1, success: 1 }]) });
      expect(await progress(ctx.challenge)).to.deep.equal([1, 2, 0, 2, 1, 2]);
    });

    it('never lowers a HIIT success and counts it once (1 -> 0 -> 1)', async () => {
      const ctx = await deployAll();
      const d1 = ctx.dayKey(1);
      await sendBaseStep(ctx, { hiit: hiitInput([{ day: d1, success: 1 }]) });
      await sendBaseStep(ctx, { hiit: hiitInput([{ day: d1, success: 0 }]) });
      await sendBaseStep(ctx, { hiit: hiitInput([{ day: d1, success: 1 }]) });
      expect((await progress(ctx.challenge))[4]).to.equal(1);
      expect(await ctx.challenge.getHIITAchievedOn(d1)).to.equal(1n);
    });

    it('counts HIIT and speed days independently of the step goal on that day', async () => {
      const ctx = await deployAll();
      const d1 = ctx.dayKey(1);
      await sendBaseStep(ctx, {
        step: stepInput([{ day: d1, steps: 10 }]),
        speed: speedInput([{ day: d1, minutes: 31, mets: 300 }]),
        hiit: hiitInput([{ day: d1, success: 1 }]),
      });
      expect(await progress(ctx.challenge)).to.deep.equal([0, 2, 1, 2, 1, 2]);
    });

    it('keeps three separate day lists in the history', async () => {
      const ctx = await deployAll();
      await sendBaseStep(ctx, {
        step: stepInput([{ day: ctx.dayKey(0), steps: 1000 }]),
        speed: speedInput([{ day: ctx.dayKey(1), minutes: 30, mets: 250 }]),
        hiit: hiitInput([{ day: ctx.dayKey(2), success: 1 }]),
      });
      const h = await ctx.challenge.getHistoryV3();
      expect(h.stepDate.map(Number)).to.deep.equal([ctx.dayKey(0)]);
      expect(h.speedDays.map(Number)).to.deep.equal([ctx.dayKey(1)]);
      expect(h.hiitDays.map(Number)).to.deep.equal([ctx.dayKey(2)]);
      expect(h.hiitSuccess.map(Number)).to.deep.equal([1]);
      const [date, data] = await ctx.challenge.getChallengeHistory();
      expect(date.map(Number)).to.deep.equal([ctx.dayKey(0)]);
      expect(data.map(Number)).to.deep.equal([1000]);
    });
  });

  describe('HIIT values (judged on chain against the HIIT goal)', () => {
    it('a day succeeds only when both intervals and seconds reach the goal; the highest values are kept', async () => {
      const ctx = await deployAll({ dayRequired: 3 });
      const d1 = ctx.dayKey(1);
      await sendBaseStep(ctx, { hiit: hiitInput([{ day: d1, intervals: 6, totalSeconds: 59 }]) });
      expect((await progress(ctx.challenge))[4]).to.equal(0);
      expect(await ctx.challenge.getHIITAchievedOn(d1)).to.equal(0n);
      await sendBaseStep(ctx, { hiit: hiitInput([{ day: d1, intervals: 5, totalSeconds: 75 }]) }); // highest: 6 / 75
      expect((await progress(ctx.challenge))[4]).to.equal(1);
      await sendBaseStep(ctx, { hiit: hiitInput([{ day: d1, intervals: 3, totalSeconds: 30 }]) }); // lower: not lowered
      const h = await ctx.challenge.getHistoryV3();
      expect(h.hiitDays.map(Number)).to.deep.equal([d1]);
      expect([h.hiitIntervals.map(Number), h.hiitSeconds.map(Number), h.hiitSuccess.map(Number)]).to.deep.equal([[6], [75], [1]]);
      expect((await progress(ctx.challenge))[4]).to.equal(1);
    });

    it('a day below the goal keeps its values with success 0; several days in one submission', async () => {
      const ctx = await deployAll({ dayRequired: 3 });
      await sendBaseStep(ctx, {
        hiit: hiitInput([
          { day: ctx.dayKey(1), intervals: 3, totalSeconds: 30 },
          { day: ctx.dayKey(2), intervals: 8, totalSeconds: 90 },
        ]),
      });
      const h = await ctx.challenge.getHistoryV3();
      expect(h.hiitDays.map(Number)).to.deep.equal([ctx.dayKey(1), ctx.dayKey(2)]);
      expect([h.hiitIntervals.map(Number), h.hiitSeconds.map(Number), h.hiitSuccess.map(Number)]).to.deep.equal([
        [3, 8],
        [30, 90],
        [0, 1],
      ]);
      expect((await progress(ctx.challenge))[4]).to.equal(1);
    });
  });

  describe('success', () => {
    it('succeeds only when every condition reaches its own required days, on different days', async () => {
      // 90%: the 5% success fee is paid first, so a 100% receiver could not be paid in full.
      const ctx = await deployAll({ awardReceiversPercent: [90] });
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
      await sendBaseStep(ctx, { hiit: hiitInput([{ day: d1, success: 1 }]) });
      expect(await ctx.challenge.isFinished()).to.equal(false);

      const receiver = ctx.signers[4].address;
      const before = await hre.ethers.provider.getBalance(receiver);
      await expect(sendBaseStep(ctx, { hiit: hiitInput([{ day: d3, success: 1 }]) }))
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
      const ctx = await deployV3('ChallengeBaseStepV3', { goal: GOAL, dayRequired: 2 });
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
      const ctx = await deployAll({ dayRequired: 2, awardReceiversPercent: [90] });
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
        hiit: hiitInput([
          { day: ctx.dayKey(2), success: 1 },
          { day: ctx.dayKey(3), success: 1 },
        ]),
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
      await expect(
        sendBaseStep(ctx, { step: stepInput([{ day: ctx.dayKey(-1), steps: 1000 }]) })
      ).to.be.revertedWith('Day outside challenge period');
    });

    it('rejects a day that has not started yet', async () => {
      const ctx = await deployAll();
      await expect(
        sendBaseStep(ctx, { hiit: hiitInput([{ day: ctx.dayKey(6), success: 1 }]) })
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
      await expect(sendBaseStep(ctx, { hiit: hiitInput([{ day: d1, success: 1 }]) })).to.be.revertedWith(
        'HIIT disabled'
      );
      const withHiit = await deployAll();
      const d = withHiit.dayKey(1);
      await expect(
        sendBaseStep(withHiit, { hiit: { day: [d], intervals: [6], totalSeconds: [], timeRange: [d, d + DAY - 1] } })
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
      const signedHiit = hiitInput([{ day: ctx.dayKey(1), success: 0 }]);
      const forgedHiit = hiitInput([{ day: ctx.dayKey(1), success: 1 }]);
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
      const ctx = await deployV3('ChallengeBaseStepV3', { goal: GOAL, dayRequired: 2, grantRole: false });
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
        hiit: hiitInput([{ day: d1, success: 1 }]),
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
    it('closeChallenge after endTime + 2 days settles as a failure', async () => {
      const ctx = await deployAll();
      await sendBaseStep(ctx, { step: stepInput([{ day: ctx.dayKey(0), steps: 1000 }]) });
      await expect(ctx.challenge.connect(ctx.sponsor).closeChallenge([], [], [], [])).to.be.revertedWith(
        'Challenge has not finished yet'
      );
      await moveTo(ctx.endTime + 2 * DAY + 1);
      await ctx.challenge.connect(ctx.sponsor).closeChallenge([], [], [], []);
      expect(await ctx.challenge.isFinished()).to.equal(true);
      expect(await ctx.challenge.isSuccess()).to.equal(false);
      expect(await ctx.challenge.getState()).to.equal(4n); // CLOSED
    });

    async function sponsorShareOnGiveUp(opts: Record<string, any>, sets: any) {
      const ctx = await deployAll({ dayRequired: 4, ...opts });
      for (const s of sets(ctx)) await sendBaseStep(ctx, s);
      const before = await hre.ethers.provider.getBalance(ctx.sponsor.address);
      await ctx.challenge.connect(ctx.challenger).giveUp([], [], [], []);
      return (await hre.ethers.provider.getBalance(ctx.sponsor.address)) - before;
    }

    it('giveUp pays by the lowest progress among the enabled conditions', async () => {
      const total = hre.ethers.parseEther('1');
      const amount = (total * 90n) / 100n; // after the 10% failure fee
      // Steps 2/4, HIIT 1/4 -> lowest progress 1/4, sponsor keeps 3/4.
      const lowest = await sponsorShareOnGiveUp(
        { walkingSpeedData: [], hiitData: [4, 6, 60] },
        (ctx: any) => [
          {
            step: stepInput([
              { day: ctx.dayKey(0), steps: 1000 },
              { day: ctx.dayKey(1), steps: 1000 },
            ]),
            hiit: hiitInput([{ day: ctx.dayKey(0), success: 1 }]),
          },
        ]
      );
      expect(lowest).to.equal(amount - (amount * 1n) / 4n);
      // Step-only 2/4 -> unchanged formula currentStatus / dayRequired, sponsor keeps 2/4.
      const stepOnly = await sponsorShareOnGiveUp({ walkingSpeedData: [], hiitData: [] }, (ctx: any) => [
        {
          step: stepInput([
            { day: ctx.dayKey(0), steps: 1000 },
            { day: ctx.dayKey(1), steps: 1000 },
          ]),
        },
      ]);
      expect(stepOnly).to.equal(amount - (amount * 2n) / 4n);
    });
  });

  describe('settlement and edge values', () => {
    it('success pays each receiver its exact share and the success fee', async () => {
      const ctx = await deployV3('ChallengeBaseStepV3', {
        goal: GOAL, dayRequired: 1, awardReceiversPercent: [50, 40], index: 2,
      });
      await moveTo(ctx.dayKey(0) + 3600);
      const [r0, r1, fee] = [ctx.signers[4].address, ctx.signers[5].address, ctx.signers[2].address];
      const before = await Promise.all([r0, r1, fee].map((a) => hre.ethers.provider.getBalance(a)));
      await sendBaseStep(ctx, { step: stepInput([{ day: ctx.dayKey(0), steps: 1000 }]) });
      const after = await Promise.all([r0, r1, fee].map((a) => hre.ethers.provider.getBalance(a)));
      const one = hre.ethers.parseEther('1');
      expect(after[0] - before[0]).to.equal((one * 50n) / 100n);
      expect(after[1] - before[1]).to.equal((one * 40n) / 100n);
      expect(after[2] - before[2]).to.equal((one * 5n) / 100n);
    });

    it('a token (ERC20) challenge settles in the token on success', async () => {
      const [sponsor] = await hre.ethers.getSigners();
      const token = await (await hre.ethers.getContractFactory('MockERC20')).deploy('Yen', 'JPYC');
      const amount = hre.ethers.parseEther('1000');
      await token.mint(sponsor.address, amount);
      const ctx = await deployV3('ChallengeBaseStepV3', {
        goal: GOAL, dayRequired: 1, awardReceiversPercent: [90], totalAmount: amount, msgValue: 0n,
        allowGiveUp: [true, false, false], erc20List: [await token.getAddress()],
      });
      await token.connect(sponsor).transfer(await ctx.challenge.getAddress(), amount);
      await moveTo(ctx.dayKey(0) + 3600);
      await sendBaseStep(ctx, { step: stepInput([{ day: ctx.dayKey(0), steps: 1000 }]) });
      expect(await ctx.challenge.isSuccess()).to.equal(true);
      expect(await token.balanceOf(ctx.signers[4].address)).to.equal((amount * 90n) / 100n);
      expect(await token.balanceOf(ctx.signers[2].address)).to.equal((amount * 10n) / 100n); // fee address
      expect(await token.balanceOf(await ctx.challenge.getAddress())).to.equal(0n);
    });

    // The Kaia mainnet NFT lists TTJP before JPYC, so a JPYC challenge has no balance in the first listed token.
    async function tokenGiveUpCtx(funded: Record<string, bigint>, listOrder: string[]) {
      const [sponsor] = await hre.ethers.getSigners();
      const Token = await hre.ethers.getContractFactory('MockERC20');
      const tokens: Record<string, any> = {};
      for (const name of listOrder) tokens[name] = await Token.deploy(name, name);
      for (const [name, amount] of Object.entries(funded)) await tokens[name].mint(sponsor.address, amount);
      const ctx = await deployV3('ChallengeBaseStepV3', {
        goal: GOAL, dayRequired: 4, awardReceiversPercent: [90], totalAmount: funded.JPYC, msgValue: 0n,
        allowGiveUp: [true, false, false], erc20List: await Promise.all(listOrder.map((n) => tokens[n].getAddress())),
      });
      for (const [name, amount] of Object.entries(funded)) await tokens[name].connect(sponsor).transfer(await ctx.challenge.getAddress(), amount);
      await moveTo(ctx.dayKey(0) + 3600);
      await sendBaseStep(ctx, { step: stepInput([{ day: ctx.dayKey(0), steps: 1000 }]) }); // progress 1/4
      return { ctx, tokens, sponsor };
    }

    it('giveUp splits a token that is not first in the NFT token list (Kaia: TTJP listed before JPYC)', async () => {
      const amount = hre.ethers.parseEther('100');
      const { ctx, tokens, sponsor } = await tokenGiveUpCtx({ JPYC: amount }, ['TTJP', 'JPYC']);
      await ctx.challenge.connect(ctx.challenger).giveUp([], [], [], []);
      const share = (((amount * 90n) / 100n) * 1n) / 4n; // 90 % after the 10 % failure fee, progress 1/4
      expect(await tokens.JPYC.balanceOf(ctx.signers[4].address)).to.equal(share);
      expect(await tokens.JPYC.balanceOf(sponsor.address)).to.equal((amount * 90n) / 100n - share);
      expect(await tokens.JPYC.balanceOf(ctx.signers[2].address)).to.equal((amount * 10n) / 100n); // fee address
      expect(await tokens.JPYC.balanceOf(await ctx.challenge.getAddress())).to.equal(0n);
    });

    it('giveUp splits every funded token by the same progress when some listed tokens are empty', async () => {
      const funded = { JPYC: hre.ethers.parseEther('100'), USDT: hre.ethers.parseEther('40') };
      const { ctx, tokens, sponsor } = await tokenGiveUpCtx(funded, ['TTJP', 'JPYC', 'USDT']);
      await ctx.challenge.connect(ctx.challenger).giveUp([], [], [], []);
      for (const [name, amount] of Object.entries(funded)) {
        const share = (((amount * 90n) / 100n) * 1n) / 4n;
        expect(await tokens[name].balanceOf(ctx.signers[4].address), `${name} receiver`).to.equal(share);
        expect(await tokens[name].balanceOf(sponsor.address), `${name} sponsor`).to.equal((amount * 90n) / 100n - share);
        expect(await tokens[name].balanceOf(ctx.signers[2].address), `${name} fee`).to.equal((amount * 10n) / 100n);
        expect(await tokens[name].balanceOf(await ctx.challenge.getAddress()), `${name} left`).to.equal(0n);
      }
    });

    it('closeChallenge is refused at exactly endTime + 2 days and allowed one second later', async () => {
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
      const h = await ctx.challenge.getHistoryV3();
      expect(h.stepData[0]).to.equal(huge);
      expect((await progress(ctx.challenge))[0]).to.equal(1);
    });
  });

  it('fits the EIP-170 contract size limit', async () => {
    const artifact = await hre.artifacts.readArtifact('ChallengeBaseStepV3');
    const size = (artifact.deployedBytecode.length - 2) / 2;
    expect(size).to.be.lessThan(24576);
  });
});
