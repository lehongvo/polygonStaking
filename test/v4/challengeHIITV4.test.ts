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
      const ctx = await started({ dayRequired: 2, awardReceiversPercent: [95, 90] });
      const [receiver, fee] = [ctx.signers[4].address, ctx.signers[2].address];
      const balance = (a: string) => hre.ethers.provider.getBalance(a);
      const [r0, f0] = [await balance(receiver), await balance(fee)];
      const tx = await sendHiit(ctx, achievedInput([ctx.dayKey(2), ctx.dayKey(4)]));
      expect(await ctx.challenge.getState()).to.equal(SUCCESS);
      expect((await balance(receiver)) - r0).to.equal(hre.ethers.parseEther('0.95'));
      expect((await balance(fee)) - f0).to.equal(hre.ethers.parseEther('0.05'));
      await expect(tx).to.emit(ctx.challenge, 'FundTransfer').withArgs(fee, hre.ethers.parseEther('0.05'));
      expect(await ctx.challenge.getContractBalance()).to.equal(0n);
      await expect(sendHiit(ctx, achievedInput([ctx.dayKey(5)]))).to.be.revertedWith('Challenge was finished');
    });

    it('Q5: settles an ERC20 challenge to several success receivers by their shares, with the success fee (5%)', async () => {
      const token = await (await hre.ethers.getContractFactory('contracts/mocks/MockERC20.sol:MockERC20')).deploy('JPY Coin', 'JPYC');
      const ctx = await started({ dayRequired: 1, awardReceiversPercent: [60, 35, 90], index: 2, erc20List: [await token.getAddress()] });
      const amount = hre.ethers.parseEther('100');
      await token.mint(await ctx.challenge.getAddress(), amount);
      const [r4, r5, r6, fee] = [4, 5, 6, 2].map((i) => ctx.signers[i].address);
      await sendHiit(ctx, achievedInput([ctx.dayKey(1)]));
      expect(await ctx.challenge.getState()).to.equal(SUCCESS);
      expect([await token.balanceOf(r4), await token.balanceOf(r5), await token.balanceOf(r6), await token.balanceOf(fee)]).to.deep.equal([
        hre.ethers.parseEther('60'), hre.ethers.parseEther('35'), 0n, hre.ethers.parseEther('5'),
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

    it('B7: refuses 0 required days and more than the days of the period', async () => {
      await expect(deployHiit({ dayRequired: 0 })).to.be.revertedWith('Invalid required days');
      await expect(deployHiit({ dayRequired: 11 })).to.be.revertedWith('Invalid required days');
      expect(await (await deployHiit({ dayRequired: 10 })).challenge.dayRequired()).to.equal(10n);
    });

    it('Q5: refuses shares that do not make 100% with the fee of each outcome', async () => {
      for (const percents of [[100, 100], [90, 90], [95, 100], [95]]) {
        await expect(deployHiit({ awardReceiversPercent: percents })).to.be.revertedWith('Invalid award percent');
      }
      await expect(deployHiit({ awardReceiversPercent: [50, 45, 90], index: 2 })).not.to.be.reverted;
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
      const ctx = await started({ dayRequired: 5 });
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

    it('3.2: refuses the day before a 00:00:01 start, even with a 25 h range; the first day counts', async () => {
      const ctx = await started();
      const before = ctx.dayKey(-1);
      await expect(sendHiit(ctx, withRange([before], [ctx.startTime, before + 25 * 3600 - 1]))).to.be.revertedWith('Day outside challenge period');
      await sendHiit(ctx, withRange([ctx.dayKey(0)], [ctx.startTime, ctx.dayKey(0) + DAY - 1]));
      expect(await info(ctx)).to.deep.equal([1, 2, 1]);
    });

    it('a day-1 range ending before a late start (23:30) is refused; [start, end of the day] is accepted', async () => {
      const ctx = await deployHiit({ startOffset: 23 * 3600 + 1800, dayRequired: 2 });
      await moveTo(ctx.startTime + 60);
      const day = ctx.dayKey(0);
      await expect(sendHiit(ctx, withRange([day], [ctx.startTime, ctx.startTime - 1]))).to.be.revertedWith('Day outside challenge period');
      await sendHiit(ctx, withRange([day], [ctx.startTime, day + DAY - 1]));
      expect(await info(ctx)).to.deep.equal([1, 2, 1]);
    });

    it('a range ending after the end time is refused (pair end <= endTime)', async () => {
      const ctx = await deployHiit({ dayRequired: 2, duration: 2 });
      await moveTo(ctx.dayKey(1) + 3600);
      const last = ctx.dayKey(1);
      await expect(sendHiit(ctx, withRange([last], [last, last + 25 * 3600 - 1]))).to.be.revertedWith('Day outside challenge period');
      await sendHiit(ctx, withRange([last], [last, ctx.endTime]));
      expect(await info(ctx)).to.deep.equal([1, 2, 1]);
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

    it('B1: giveUp returns the deposit minus the failure fee to the sponsor, nothing by achievement', async () => {
      const ctx = await started({ dayRequired: 4, allAwardToSponsor: false });
      await sendHiit(ctx, achievedInput([ctx.dayKey(1)]));
      const balance = (a: string) => hre.ethers.provider.getBalance(a);
      const [receiver, fee] = [ctx.signers[4].address, ctx.signers[2].address];
      const [s0, r0, f0] = [await balance(ctx.sponsor.address), await balance(receiver), await balance(fee)];
      const tx = await giveUp(ctx, ctx.challenger);
      expect(await ctx.challenge.getState()).to.equal(GAVE_UP);
      expect((await balance(ctx.sponsor.address)) - s0).to.equal(hre.ethers.parseEther('0.9'));
      expect((await balance(receiver)) - r0).to.equal(0n);
      expect((await balance(fee)) - f0).to.equal(hre.ethers.parseEther('0.1'));
      expect(await ctx.challenge.getContractBalance()).to.equal(0n);
      await expect(tx).to.emit(ctx.challenge, 'GiveUp').withArgs(ctx.challenger.address);
      await expect(tx).to.emit(ctx.challenge, 'FundTransfer').withArgs(fee, hre.ethers.parseEther('0.1'));
    });

    it('Q1: only the sponsor closes, from endTime + 2 days; late results count until then; failure distribution', async () => {
      const ctx = await started({ dayRequired: 3 });
      await expect(ctx.challenge.connect(ctx.sponsor).closeChallenge([], [], [], [])).to.be.revertedWith('Challenge has not finished yet');
      await time.setNextBlockTimestamp(ctx.endTime + 2 * DAY);
      await expect(ctx.challenge.connect(ctx.sponsor).closeChallenge([], [], [], [])).to.be.revertedWith('Challenge has not finished yet');
      await moveTo(ctx.endTime + 2 * DAY + 1);
      await expect(ctx.challenge.connect(ctx.challenger).closeChallenge([], [], [], [])).to.be.revertedWith('Only sponsor can close');
      await sendHiit(ctx, achievedInput([ctx.dayKey(3)]));
      expect(await info(ctx)).to.deep.equal([1, 3, 2]);
      const balance = (a: string) => hre.ethers.provider.getBalance(a);
      const [failReceiver, fee] = [ctx.signers[5].address, ctx.signers[2].address];
      const [r0, f0] = [await balance(failReceiver), await balance(fee)];
      const tx = await ctx.challenge.connect(ctx.sponsor).closeChallenge([], [], [], []);
      expect(await ctx.challenge.getState()).to.equal(4n); // CLOSED
      expect((await balance(failReceiver)) - r0).to.equal(hre.ethers.parseEther('0.9'));
      expect((await balance(fee)) - f0).to.equal(hre.ethers.parseEther('0.1'));
      await expect(tx).to.emit(ctx.challenge, 'FundTransfer').withArgs(fee, hre.ethers.parseEther('0.1'));
      expect(await ctx.challenge.getContractBalance()).to.equal(0n);
      await expect(sendHiit(ctx, achievedInput([ctx.dayKey(4)]))).to.be.revertedWith('Challenge was finished');
    });

    it('Q1: Close has no upper limit (the sponsor closes 400 days after the end)', async () => {
      const ctx = await started({ dayRequired: 3 });
      await moveTo(ctx.endTime + 400 * DAY);
      await ctx.challenge.connect(ctx.sponsor).closeChallenge([], [], [], []);
      expect(await ctx.challenge.getState()).to.equal(4n);
    });
  });

  describe('Q5: failed transfers and the remainder', () => {
    /** A HIIT challenge (1 required day) whose success receiver is a MockClaimReceiver that rejects coin. */
    async function withRejectingReceiver() {
      const base = await deployHiit({ dayRequired: 1 });
      const receiver = await (await hre.ethers.getContractFactory('MockClaimReceiver')).deploy();
      const challenge = await (await hre.ethers.getContractFactory('ChallengeHIITV4')).deploy(
        [base.sponsor.address, base.challenger.address, base.signers[2].address], hre.ethers.ZeroAddress, [await base.nft.getAddress()],
        [10, base.startTime, base.endTime, 1, ...MAIN_MENU], [await receiver.getAddress(), base.signers[5].address], 1,
        [true, true, false], [0, 0, 0], false, [95, 90], hre.ethers.parseEther('1'), { value: hre.ethers.parseEther('1') }
      );
      await base.nft.grantChallengeRole(await challenge.getAddress());
      await moveTo(base.dayKey(5) + 3600);
      return { ...base, challenge, receiver };
    }

    it('a coin award that cannot be paid stays claimable by its recipient and is never sent to the sponsor', async () => {
      const ctx = await withRejectingReceiver();
      const balance = (a: string) => hre.ethers.provider.getBalance(a);
      const s0 = await balance(ctx.sponsor.address);
      const receiver = await ctx.receiver.getAddress();
      await expect(sendHiit(ctx, achievedInput([ctx.dayKey(1)])))
        .to.emit(ctx.challenge, 'TransferClaimable').withArgs(hre.ethers.ZeroAddress, receiver, hre.ethers.parseEther('0.95'));
      expect(await ctx.challenge.isSuccess()).to.equal(true);
      expect(await ctx.challenge.claimable(hre.ethers.ZeroAddress, receiver)).to.equal(hre.ethers.parseEther('0.95'));
      expect(await ctx.challenge.getContractBalance()).to.equal(hre.ethers.parseEther('0.95'));
      expect((await balance(ctx.sponsor.address)) - s0).to.equal(0n);
      await expect(ctx.challenge.connect(ctx.sponsor).claim(hre.ethers.ZeroAddress)).to.be.revertedWith('Nothing to claim');
      // Still rejecting: the claim reverts and the amount stays recorded.
      await expect(ctx.receiver.claimFrom(await ctx.challenge.getAddress(), hre.ethers.ZeroAddress)).to.be.reverted;
      await ctx.receiver.setAccept(true);
      await expect(ctx.receiver.claimFrom(await ctx.challenge.getAddress(), hre.ethers.ZeroAddress))
        .to.emit(ctx.challenge, 'Claimed').withArgs(hre.ethers.ZeroAddress, receiver, hre.ethers.parseEther('0.95'));
      expect(await balance(receiver)).to.equal(hre.ethers.parseEther('0.95'));
      expect(await ctx.challenge.getContractBalance()).to.equal(0n);
      expect(await ctx.challenge.totalClaimable(hre.ethers.ZeroAddress)).to.equal(0n);
      await expect(ctx.receiver.claimFrom(await ctx.challenge.getAddress(), hre.ethers.ZeroAddress)).to.be.reverted;
    });

    it('a token award that cannot be paid stays claimable; the remainder and withdrawTokensOnCompletion leave it', async () => {
      const token = await (await hre.ethers.getContractFactory('MockBlockingERC20')).deploy();
      const tokenAddress = await token.getAddress();
      const ctx = await started({ dayRequired: 1, erc20List: [tokenAddress], msgValue: 0n, allowGiveUp: [true, false, false] });
      const challengeAddress = await ctx.challenge.getAddress();
      await token.mint(challengeAddress, hre.ethers.parseEther('100'));
      const [receiver, fee, returned] = [ctx.signers[4].address, ctx.signers[2].address, ctx.signers[3]];
      await token.setBlocked(receiver, true);
      await sendHiit(ctx, achievedInput([ctx.dayKey(1)]));
      expect(await ctx.challenge.isSuccess()).to.equal(true);
      expect(await ctx.challenge.claimable(tokenAddress, receiver)).to.equal(hre.ethers.parseEther('95'));
      expect(await token.balanceOf(fee)).to.equal(hre.ethers.parseEther('5'));
      expect(await token.balanceOf(ctx.sponsor.address)).to.equal(0n);
      expect(await token.balanceOf(challengeAddress)).to.equal(hre.ethers.parseEther('95'));
      await ctx.challenge.connect(returned).withdrawTokensOnCompletion([tokenAddress], [], [], []);
      expect(await token.balanceOf(challengeAddress)).to.equal(hre.ethers.parseEther('95'));
      await token.setBlocked(receiver, false);
      await ctx.challenge.connect(ctx.signers[4]).claim(tokenAddress);
      expect(await token.balanceOf(receiver)).to.equal(hre.ethers.parseEther('95'));
      expect(await ctx.challenge.totalClaimable(tokenAddress)).to.equal(0n);
    });

    it('a coin challenge settles while the NFT also lists a token with no balance (success and Close)', async () => {
      const token = await (await hre.ethers.getContractFactory('contracts/mocks/MockERC20.sol:MockERC20')).deploy('JPY Coin', 'JPYC');
      const ok = await started({ dayRequired: 1, erc20List: [await token.getAddress()] });
      await sendHiit(ok, achievedInput([ok.dayKey(1)]));
      expect(await ok.challenge.isSuccess()).to.equal(true);
      const closed = await started({ dayRequired: 3, erc20List: [await token.getAddress()] });
      await moveTo(closed.endTime + 2 * DAY + 1);
      await closed.challenge.connect(closed.sponsor).closeChallenge([], [], [], []);
      expect(await closed.challenge.getState()).to.equal(4n);
      expect(await closed.challenge.getContractBalance()).to.equal(0n);
    });

    it('the remainder of a rounding goes back to the sponsor, nothing stays in the contract', async () => {
      const ctx = await started({ dayRequired: 1, totalAmount: 1001n, msgValue: 1001n });
      const balance = (a: string) => hre.ethers.provider.getBalance(a);
      const s0 = await balance(ctx.sponsor.address);
      await sendHiit(ctx, achievedInput([ctx.dayKey(1)]));
      // 95% of 1001 = 950 (floor) to the receiver, 5% of 1001 = 50 fee: 1 wei goes back to the sponsor.
      expect((await balance(ctx.sponsor.address)) - s0).to.equal(1n);
      expect(await ctx.challenge.getContractBalance()).to.equal(0n);
    });
  });

  // B-1 / B-2 (E2E of 11/11): native coin is split by list position, like tokens. An address in both lists, or twice
  // in one list, receives the share of each of its positions. Odd deposit so that every rounding is visible.
  describe('coin split by list position (B-1, B-2)', () => {
    const B = hre.ethers.parseEther('1') + 7n;
    const pct = (p: bigint) => (B * p) / 100n;
    const bal = (a: string) => hre.ethers.provider.getBalance(a);
    const deltas = async (addrs: string[], action: () => Promise<any>) => {
      const before = await Promise.all(addrs.map(bal));
      await (await action()).wait();
      return (await Promise.all(addrs.map(bal))).map((v, i) => v - before[i]);
    };
    async function hiitCoin(list: (s: any[]) => string[], percents: number[], index: number) {
      const signers = await hre.ethers.getSigners();
      const ctx = await deployHiit({ dayRequired: 1, awardReceivers: list(signers), awardReceiversPercent: percents, index, totalAmount: B, msgValue: B });
      await moveTo(ctx.dayKey(1) + 3600);
      return ctx;
    }
    const succeed = (ctx: any) => () => sendHiit(ctx, achievedInput([ctx.dayKey(1)]));
    const close = async (ctx: any) => {
      await moveTo(ctx.endTime + 2 * DAY + 1);
      return () => ctx.challenge.connect(ctx.sponsor).closeChallenge([], [], [], []);
    };

    it('B-1: an address in both lists gets its success share on success and its failure share on close', async () => {
      const list = (s: any[]) => [s[4].address, s[5].address, s[4].address, s[6].address];
      const ok = await hiitCoin(list, [5, 90, 20, 70], 2);
      const [r1, r2, r3, fee] = [4, 5, 6, 2].map((i) => ok.signers[i].address);
      expect(await deltas([r1, r2, fee], succeed(ok))).to.deep.equal([pct(5n), pct(90n), pct(5n)]);
      const cl = await hiitCoin(list, [5, 90, 20, 70], 2);
      expect(await deltas([r1, r2, r3, fee], await close(cl))).to.deep.equal([pct(20n), 0n, pct(70n), pct(10n)]);
    });

    it('B-2: an address listed twice in the success list receives both shares', async () => {
      const ctx = await hiitCoin((s) => [s[4].address, s[4].address, s[5].address, s[6].address], [50, 45, 53, 37], 2);
      const [r1, fee, sponsor] = [ctx.signers[4].address, ctx.signers[2].address, ctx.sponsor.address];
      const d = await deltas([r1, fee, sponsor], succeed(ctx));
      expect(d).to.deep.equal([pct(50n) + pct(45n), pct(5n), B - pct(50n) - pct(45n) - pct(5n)]);
      expect(await ctx.challenge.getContractBalance()).to.equal(0n);
    });

    it('B-2: an address listed twice in the failure list receives both shares on close', async () => {
      const ctx = await hiitCoin((s) => [s[4].address, s[5].address, s[5].address], [95, 53, 37], 1);
      const [r1, r2, fee] = [4, 5, 2].map((i) => ctx.signers[i].address);
      expect(await deltas([r1, r2, fee], await close(ctx))).to.deep.equal([0n, pct(53n) + pct(37n), pct(10n)]);
      expect(await ctx.challenge.getContractBalance()).to.equal(0n);
    });
  });

  it('fits the EIP-170 contract size limit', async () => {
    const artifact = await hre.artifacts.readArtifact('ChallengeHIITV4');
    expect((artifact.deployedBytecode.length - 2) / 2).to.be.lessThan(24576);
  });
});
