// ChallengeHIITV4: HIIT-only challenge for Timer V1. The phone judges the day, the backend checks the
// workout record and signs, and the contract records achieved days (CHALLENGE-2884).
import { expect } from 'chai';
import hre from 'hardhat';
import { time } from '@nomicfoundation/hardhat-toolbox/network-helpers.js';
import {
  achievedInput,
  DAY,
  deployHiit,
  deployV4,
  GAVE_UP,
  giveUp,
  MAIN_MENU,
  moveTo,
  payloadHashHiit,
  PROCESSING,
  sendHiit,
  signPayload,
  SUCCESS,
  withRange,
} from './helpersV4.ts';

/** Deploy, then move inside day 5, so days 1 to 5 have started. */
async function started(opts: Record<string, any> = {}) {
  const ctx = await deployHiit({ dayRequired: 2, ...opts });
  await moveTo(ctx.dayKey(5) + 3600);
  return ctx;
}

const info = async (ctx: any) => (await ctx.challenge.getChallengeInfo()).map(Number);
const counting = async () => (await hre.ethers.getContractFactory('MockCountingGacha')).deploy();

describe('ChallengeHIITV4', () => {
  describe('constructor and menu', () => {
    it('stores the menu, the required days and version 4', async () => {
      const ctx = await deployV4('ChallengeHIITV4', { dayRequired: 3 });
      expect(await ctx.challenge.contractVersion()).to.equal(4n);
      expect((await ctx.challenge.getHiitMenu()).map(Number)).to.deep.equal(MAIN_MENU);
      expect(await ctx.challenge.dayRequired()).to.equal(3n);
    });

    it('rejects the V3 6-value layout', async () => {
      await expect(deployHiit({ primaryRequired: [10, 1, 2, 3, 6, 60] })).to.be.revertedWith('Invalid HIIT data');
    });

    for (const bad of [
      [0, 10, 8, 2, 80],
      [20, 0, 8, 2, 80],
      [20, 10, 0, 2, 80],
      [20, 10, 8, 0, 80],
      [20, 10, 8, 8, 80],
      [20, 10, 8, 2, 0],
      [20, 10, 8, 2, 101],
    ]) {
      it(`rejects the menu ${bad}`, async () => {
        await expect(deployHiit({ menu: bad })).to.be.revertedWith('Invalid HIIT menu');
      });
    }

    it('accepts a menu beyond the current Custom limits', async () => {
      const ctx = await deployHiit({ menu: [120, 120, 40, 5, 90] });
      expect((await ctx.challenge.getHiitMenu()).map(Number)).to.deep.equal([120, 120, 40, 5, 90]);
    });
  });

  describe('recording achieved days', () => {
    it('counts an achieved day once and does not revert on a resend', async () => {
      const ctx = await started({ dayRequired: 3 });
      const d1 = ctx.dayKey(1);
      await sendHiit(ctx, achievedInput([d1]));
      await sendHiit(ctx, achievedInput([d1]));
      expect(await info(ctx)).to.deep.equal([1, 3, 2]);
      expect((await ctx.challenge.getHistoryV4()).map(Number)).to.deep.equal([d1]);
      expect(await ctx.challenge.getHIITAchievedOn(d1)).to.equal(1n);
    });

    it('counts a day repeated inside one submission once', async () => {
      const ctx = await started({ dayRequired: 3 });
      const d1 = ctx.dayKey(1);
      await sendHiit(ctx, achievedInput([d1, d1]));
      expect(await info(ctx)).to.deep.equal([1, 3, 2]);
    });

    it('passes only newly achieved days to the gacha', async () => {
      const ctx = await started({ dayRequired: 5 });
      const gacha = await counting();
      const list = [await gacha.getAddress()];
      const [d1, d2] = [ctx.dayKey(1), ctx.dayKey(2)];
      await sendHiit(ctx, achievedInput([d1]), ctx.challenger, list);
      expect(await gacha.calls()).to.equal(1n);
      await sendHiit(ctx, achievedInput([d1]), ctx.challenger, list);
      expect(await gacha.calls()).to.equal(1n);
      await sendHiit(ctx, achievedInput([d1, d2]), ctx.challenger, list);
      expect(await gacha.calls()).to.equal(2n);
      expect(await gacha.lastValues(0)).to.equal(1n);
      await expect(gacha.lastValues(1)).to.be.reverted; // one flag only: the new day
    });

    it('a failing gacha emits GachaRewardFailed and does not block the result', async () => {
      const ctx = await started({ dayRequired: 3 });
      const gacha = await counting();
      await gacha.setShouldRevert(true);
      await expect(sendHiit(ctx, achievedInput([ctx.dayKey(1)]), ctx.challenger, [await gacha.getAddress()]))
        .to.emit(ctx.challenge, 'GachaRewardFailed')
        .withArgs(await gacha.getAddress());
      expect(await info(ctx)).to.deep.equal([1, 3, 2]);
    });

    it('rejects achieved other than 1', async () => {
      const ctx = await started();
      const d1 = ctx.dayKey(1);
      for (const value of [0, 2]) {
        await expect(sendHiit(ctx, { day: [d1], achieved: [value], timeRange: [d1, d1 + DAY - 1] })).to.be.revertedWith('Invalid achieved');
      }
    });

    it('rejects mismatched and empty arrays', async () => {
      const ctx = await started();
      const d1 = ctx.dayKey(1);
      await expect(sendHiit(ctx, { day: [d1], achieved: [], timeRange: [d1, d1 + DAY - 1] })).to.be.revertedWith('Invalid HIIT results length');
      await expect(sendHiit(ctx, { day: [], achieved: [], timeRange: [] })).to.be.revertedWith('Invalid HIIT results length');
    });

    it('rejects a signature with the V3 domain', async () => {
      const ctx = await started();
      const hiit = achievedInput([ctx.dayKey(1)]);
      const { data, signature } = await signPayload(ctx.security, await ctx.challenge.getAddress(), payloadHashHiit(hiit), 300, 0x4553505633535221n);
      await expect(ctx.challenge.connect(ctx.challenger).sendDailyResult(hiit, data, signature, [], [], [], [])).to.be.revertedWith(
        'Invalid signature domain'
      );
    });

    it('rejects a payload different from the signed one', async () => {
      const ctx = await started();
      const address = await ctx.challenge.getAddress();
      const signed = achievedInput([ctx.dayKey(1)]);
      const { data, signature } = await signPayload(ctx.security, address, payloadHashHiit(signed));
      const send = (forged: any) => ctx.challenge.connect(ctx.challenger).sendDailyResult(forged, data, signature, [], [], [], []);
      await expect(send(achievedInput([ctx.dayKey(2)]))).to.be.revertedWith('InvalidSignature');
      await expect(send({ ...signed, timeRange: [signed.timeRange[0], signed.timeRange[1] + 3600] })).to.be.revertedWith('InvalidSignature');
    });

    it('succeeds and pays exactly when the required days are reached (coin: 5% fee, 95% receiver)', async () => {
      const ctx = await started({ dayRequired: 2, awardReceiversPercent: [95] });
      const [receiver, fee] = [ctx.signers[4].address, ctx.signers[2].address];
      const balance = (a: string) => hre.ethers.provider.getBalance(a);
      const [r0, f0] = [await balance(receiver), await balance(fee)];
      await sendHiit(ctx, achievedInput([ctx.dayKey(2), ctx.dayKey(4)]));
      expect(await ctx.challenge.getState()).to.equal(SUCCESS);
      expect((await balance(receiver)) - r0).to.equal(hre.ethers.parseEther('0.95'));
      expect((await balance(fee)) - f0).to.equal(hre.ethers.parseEther('0.05'));
      expect(await ctx.challenge.getContractBalance()).to.equal(0n);
      await expect(sendHiit(ctx, achievedInput([ctx.dayKey(5)]))).to.be.revertedWith('Challenge was finished');
    });

    it('settles an ERC20 challenge to several success receivers by their shares (token fee 10%)', async () => {
      const token = await (await hre.ethers.getContractFactory('contracts/mocks/MockERC20.sol:MockERC20')).deploy('JPY Coin', 'JPYC');
      const ctx = await started({ dayRequired: 1, awardReceiversPercent: [60, 30, 90], index: 2, erc20List: [await token.getAddress()] });
      const amount = hre.ethers.parseEther('100');
      await token.mint(await ctx.challenge.getAddress(), amount);
      const [r4, r5, r6, fee] = [4, 5, 6, 2].map((i) => ctx.signers[i].address);
      await sendHiit(ctx, achievedInput([ctx.dayKey(1)]));
      expect(await ctx.challenge.getState()).to.equal(SUCCESS);
      expect([await token.balanceOf(r4), await token.balanceOf(r5), await token.balanceOf(r6), await token.balanceOf(fee)]).to.deep.equal([
        hre.ethers.parseEther('60'), hre.ethers.parseEther('30'), 0n, hre.ethers.parseEther('10'),
      ]);
      expect(await token.balanceOf(await ctx.challenge.getAddress())).to.equal(0n);
    });

    it('rejects a result sent by anyone but the challenger', async () => {
      const ctx = await started();
      await expect(sendHiit(ctx, achievedInput([ctx.dayKey(1)]), ctx.sponsor)).to.be.revertedWith('Only challenger can call this function');
      await expect(sendHiit(ctx, achievedInput([ctx.dayKey(1)]), ctx.signers[8])).to.be.revertedWith('Only challenger can call this function');
    });

    it('rejects a signature made for another challenge contract', async () => {
      const ctx = await started();
      const other = await deployHiit({ dayRequired: 2 });
      const hiit = achievedInput([ctx.dayKey(1)]);
      const { data, signature } = await signPayload(ctx.security, await other.challenge.getAddress(), payloadHashHiit(hiit));
      await expect(ctx.challenge.connect(ctx.challenger).sendDailyResult(hiit, data, signature, [], [], [], [])).to.be.revertedWith('InvalidSignature');
    });

    it('a day before the anchor is on the same calendar and counts', async () => {
      const ctx = await started({ dayRequired: 3 });
      await sendHiit(ctx, achievedInput([ctx.dayKey(3)]));
      await sendHiit(ctx, achievedInput([ctx.dayKey(1)]));
      expect(await info(ctx)).to.deep.equal([2, 3, 1]);
      expect((await ctx.challenge.getHistoryV4()).map(Number)).to.deep.equal([ctx.dayKey(3), ctx.dayKey(1)]);
      expect(await ctx.challenge.getHIITAchievedOn(ctx.dayKey(1))).to.equal(1n);
    });

    it('getHIITAchievedOn: 0 before any result, for an unrecorded day and for an off-calendar key; 1 for a DST alias', async () => {
      const ctx = await started({ dayRequired: 3 });
      expect(await ctx.challenge.getHIITAchievedOn(ctx.dayKey(1))).to.equal(0n);
      await sendHiit(ctx, achievedInput([ctx.dayKey(1)]));
      expect(await ctx.challenge.getHIITAchievedOn(ctx.dayKey(2))).to.equal(0n);
      expect(await ctx.challenge.getHIITAchievedOn(ctx.dayKey(1) + 3 * 3600)).to.equal(0n);
      expect(await ctx.challenge.getHIITAchievedOn(ctx.dayKey(1) - 3600)).to.equal(1n);
    });

    it('0 required days: the first submission finishes the challenge as a success', async () => {
      const ctx = await started({ dayRequired: 0 });
      await sendHiit(ctx, achievedInput([ctx.dayKey(1)]));
      expect(await ctx.challenge.isSuccess()).to.equal(true);
    });

    it('accepts late results after endTime + 2 days while not finalized', async () => {
      const ctx = await started({ dayRequired: 1 });
      await moveTo(ctx.endTime + 4 * DAY);
      await sendHiit(ctx, achievedInput([ctx.dayKey(9)]));
      expect(await ctx.challenge.isSuccess()).to.equal(true);
    });

    it('has no early failure', async () => {
      const ctx = await started({ dayRequired: 8 });
      await sendHiit(ctx, achievedInput([ctx.dayKey(5)]));
      expect(await ctx.challenge.getState()).to.equal(PROCESSING);
      expect(await ctx.challenge.isFinished()).to.equal(false);
    });

    it('caps the count at the required days, so getChallengeInfo cannot underflow', async () => {
      const ctx = await started({ dayRequired: 5, awardReceiversPercent: [90] });
      await sendHiit(ctx, achievedInput([1, 2, 3, 4, 5].map(ctx.dayKey)));
      expect(await info(ctx)).to.deep.equal([5, 5, 0]);
    });

    it('keeps getChallengeInfo compatible for CRON', async () => {
      const ctx = await started({ dayRequired: 3 });
      await sendHiit(ctx, achievedInput([ctx.dayKey(1)]));
      expect(await info(ctx)).to.deep.equal([1, 3, 2]);
    });
  });

  describe('day ranges', () => {
    it('day 1 accepts [startTime, end of day] when the challenge starts mid-day', async () => {
      const ctx = await deployHiit({ startOffset: 14 * 3600 + 300, dayRequired: 2 });
      await moveTo(ctx.startTime);
      await sendHiit(ctx, withRange([ctx.day0], [ctx.startTime, ctx.day0 + DAY - 1]));
      expect(await info(ctx)).to.deep.equal([1, 2, 1]);
      expect(await ctx.challenge.dayAnchor()).to.equal(BigInt(ctx.day0));
    });

    it('the day after a mid-day start sits on the same calendar', async () => {
      const ctx = await deployHiit({ startOffset: 14 * 3600 + 300, dayRequired: 3 });
      await moveTo(ctx.dayKey(1) + 3600);
      await sendHiit(ctx, withRange([ctx.day0], [ctx.startTime, ctx.day0 + DAY - 1]));
      await sendHiit(ctx, achievedInput([ctx.dayKey(1)]));
      await sendHiit(ctx, withRange([ctx.day0], [ctx.startTime, ctx.day0 + DAY - 1]));
      expect(await info(ctx)).to.deep.equal([2, 3, 1]);
    });

    it('a future start at 00:00:01 uses [day + 1, end of day] for day 1', async () => {
      const ctx = await deployHiit({ startOffset: 1, dayRequired: 2 });
      await moveTo(ctx.startTime + 60);
      await sendHiit(ctx, withRange([ctx.day0], [ctx.day0 + 1, ctx.day0 + DAY - 1]));
      expect(await ctx.challenge.dayAnchor()).to.equal(BigInt(ctx.day0));
      expect(await info(ctx)).to.deep.equal([1, 2, 1]);
    });

    it('day 1 rejects [00:00, end] when the challenge starts later', async () => {
      const ctx = await deployHiit({ startOffset: 14 * 3600 + 300 });
      await moveTo(ctx.startTime);
      await expect(sendHiit(ctx, achievedInput([ctx.day0]))).to.be.revertedWith('Invalid time range');
    });

    it('later days require the full day; 23 h and 25 h days pass', async () => {
      const ctx = await started({ dayRequired: 5 });
      const [d1, d2, d3] = [ctx.dayKey(1), ctx.dayKey(2), ctx.dayKey(3)];
      await expect(sendHiit(ctx, withRange([d1], [d1 + 1, d1 + DAY - 1]))).to.be.revertedWith('Invalid time range');
      await expect(sendHiit(ctx, withRange([d1], [d1, d1 + 22 * 3600]))).to.be.revertedWith('Invalid time range');
      await expect(sendHiit(ctx, withRange([d1], [d1, d1 + 25 * 3600]))).to.be.revertedWith('Invalid time range');
      await sendHiit(ctx, withRange([d2], [d2, d2 + 23 * 3600 - 1]));
      await sendHiit(ctx, withRange([d3], [d3, d3 + 25 * 3600 - 1]));
      expect((await info(ctx))[0]).to.equal(2);
    });

    it('rejects a mismatched range length', async () => {
      const ctx = await started();
      const d1 = ctx.dayKey(1);
      await expect(sendHiit(ctx, withRange([d1], [d1]))).to.be.revertedWith('Invalid time range length');
    });

    it('rejects a day that has not started', async () => {
      const ctx = await started();
      await expect(sendHiit(ctx, achievedInput([ctx.dayKey(6)]))).to.be.revertedWith('Day has not started');
    });

    it('rejects days outside the challenge period (full-day ranges)', async () => {
      const ctx = await started();
      const before = ctx.dayKey(-1);
      await expect(sendHiit(ctx, withRange([before], [ctx.startTime, before + DAY - 1]))).to.be.revertedWith('Day outside challenge period');
      await moveTo(ctx.endTime + 2 * DAY);
      await expect(sendHiit(ctx, achievedInput([ctx.dayKey(10)]))).to.be.revertedWith('Day outside challenge period');
    });

    it('documents the 1 h tolerance: the day before a 00:00:01 start counts with a 25 h range (as V3; the backend never signs it)', async () => {
      const ctx = await started();
      const before = ctx.dayKey(-1);
      await sendHiit(ctx, withRange([before], [ctx.startTime, before + 25 * 3600 - 1]));
      expect(await info(ctx)).to.deep.equal([1, 2, 1]);
      expect((await ctx.challenge.getHistoryV4()).map(Number)).to.deep.equal([before]);
    });

    it('rejects another time zone key and maps a DST key to the same day', async () => {
      const ctx = await started({ dayRequired: 3 });
      const d1 = ctx.dayKey(1);
      await sendHiit(ctx, achievedInput([d1]));
      const shifted = d1 + 9 * 3600;
      await expect(sendHiit(ctx, achievedInput([shifted]))).to.be.revertedWith('Day not on the challenge calendar');
      await sendHiit(ctx, achievedInput([d1 - 3600]));
      expect(await info(ctx)).to.deep.equal([1, 3, 2]);
      expect((await ctx.challenge.getHistoryV4()).map(Number)).to.deep.equal([d1]);
    });
  });

  describe('giveUp and close', () => {
    it('only the challenger can give up', async () => {
      const ctx = await started({ dayRequired: 4 });
      await expect(giveUp(ctx, ctx.sponsor)).to.be.revertedWith('Only challenger can call this function');
      await giveUp(ctx, ctx.challenger);
      expect(await ctx.challenge.getState()).to.equal(GAVE_UP);
    });

    it('giveUp pays by HIIT progress (1 of 4 days)', async () => {
      const ctx = await started({ dayRequired: 4 });
      await sendHiit(ctx, achievedInput([ctx.dayKey(1)]));
      const before = await hre.ethers.provider.getBalance(ctx.sponsor.address);
      await giveUp(ctx, ctx.challenger);
      const amount = (hre.ethers.parseEther('1') * 90n) / 100n;
      expect((await hre.ethers.provider.getBalance(ctx.sponsor.address)) - before).to.equal(amount - amount / 4n);
    });

    it('0 required days: giveUp does not divide by zero', async () => {
      const ctx = await started({ dayRequired: 0 });
      await giveUp(ctx, ctx.challenger);
      expect(await ctx.challenge.getState()).to.equal(GAVE_UP);
    });

    it('closeChallenge: the challenger from endTime + 2 days; the sponsor waits 30 days, so late results still count', async () => {
      const ctx = await started({ dayRequired: 3 });
      await expect(ctx.challenge.connect(ctx.challenger).closeChallenge([], [], [], [])).to.be.revertedWith('Challenge has not finished yet');
      await moveTo(ctx.endTime + 2 * DAY + 1);
      await expect(ctx.challenge.connect(ctx.sponsor).closeChallenge([], [], [], [])).to.be.revertedWith('Sponsor can close 30 days after the end');
      await sendHiit(ctx, achievedInput([ctx.dayKey(3)]));
      expect(await info(ctx)).to.deep.equal([1, 3, 2]);
      await ctx.challenge.connect(ctx.challenger).closeChallenge([], [], [], []);
      expect(await ctx.challenge.isFinished()).to.equal(true);
      expect(await ctx.challenge.isSuccess()).to.equal(false);
    });

    it('the sponsor can close from endTime + 30 days + 1 s, not at exactly endTime + 30 days', async () => {
      const ctx = await started({ dayRequired: 3 });
      await time.setNextBlockTimestamp(ctx.endTime + 30 * DAY);
      await expect(ctx.challenge.connect(ctx.sponsor).closeChallenge([], [], [], [])).to.be.revertedWith('Sponsor can close 30 days after the end');
      await time.setNextBlockTimestamp(ctx.endTime + 30 * DAY + 1);
      await ctx.challenge.connect(ctx.sponsor).closeChallenge([], [], [], []);
      expect(await ctx.challenge.getState()).to.equal(4n); // CLOSED
    });
  });

  it('fits the EIP-170 contract size limit', async () => {
    const artifact = await hre.artifacts.readArtifact('ChallengeHIITV4');
    expect((artifact.deployedBytecode.length - 2) / 2).to.be.lessThan(24576);
  });
});
