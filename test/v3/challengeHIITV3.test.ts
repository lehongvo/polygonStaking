// ChallengeHIITV3: HIIT-only challenge storing the intervals / seconds of each exercise day and judging the day
// against the HIIT goal on chain (CHALLENGE-2650 / Timer Spec v1.0).
import { expect } from 'chai';
import hre from 'hardhat';
import { DAY, deployV3, hiitInput, moveTo, payloadHashHiit, sendHiit, signPayload } from './helpersV3.ts';
import { time } from '@nomicfoundation/hardhat-toolbox/network-helpers.js';

async function deployHiit(opts: Record<string, any> = {}) {
  const ctx = await deployV3('ChallengeHIITV3', { dayRequired: 2, ...opts });
  await moveTo(ctx.dayKey(5) + 3600);
  return ctx;
}

const status = async (c: any) => Number(await c.currentStatus());

describe('ChallengeHIITV3', () => {
  it('stores the required HIIT days, the HIIT goal and the version identifier', async () => {
    const { challenge } = await deployV3('ChallengeHIITV3', { dayRequired: 4, hiitGoal: [8, 90] });
    expect(await challenge.dayRequired()).to.equal(4n);
    expect([await challenge.hiitIntervalsRequired(), await challenge.hiitSecondsRequired()]).to.deep.equal([8n, 90n]);
    expect(await challenge.contractVersion()).to.equal(3n);
  });

  for (const goal of [[0, 60], [6, 0]]) {
    it(`reverts on the HIIT goal ${JSON.stringify(goal)}`, async () => {
      await expect(deployV3('ChallengeHIITV3', { hiitGoal: goal })).to.be.revertedWith('Invalid HIIT goal');
    });
  }

  for (const [label, days] of [
    ['0 days', 0],
    ['more days than the duration', 11],
  ] as const) {
    it(`reverts on ${label}`, async () => {
      await expect(deployV3('ChallengeHIITV3', { duration: 10, dayRequired: days })).to.be.revertedWith(
        'Invalid HIIT days'
      );
    });
  }

  it('rejects the previous 4-value layout without the HIIT goal [duration, start, end, days]', async () => {
    const [sponsor, challenger, fee, wallet] = await hre.ethers.getSigners();
    const Nft = await hre.ethers.getContractFactory('MockSignerExerciseSupplementNFT');
    const nft = await Nft.deploy(wallet.address, 5, 10, wallet.address);
    const start = (await time.latest()) + 60;
    const Factory = await hre.ethers.getContractFactory('ChallengeHIITV3');
    const amount = hre.ethers.parseEther('1');
    await expect(
      Factory.deploy(
        [sponsor.address, challenger.address, fee.address],
        hre.ethers.ZeroAddress,
        [await nft.getAddress()],
        [10, start, start + 10 * DAY, 5],
        [wallet.address],
        1,
        [true, true, false],
        [0, 0, 0],
        false,
        [90],
        amount,
        { value: amount }
      )
    ).to.be.revertedWith('Invalid HIIT data');
  });

  it('rejects a signature in the legacy format (contract nonce in _data[0])', async () => {
    const ctx = await deployHiit();
    const addr = await ctx.challenge.getAddress();
    const hiit = hiitInput([{ day: ctx.dayKey(1), success: 1 }]);
    const legacy = await signPayload(ctx.security, addr, payloadHashHiit(hiit), 300, 1n);
    await expect(
      ctx.challenge.connect(ctx.challenger).sendDailyResult(hiit, legacy.data, legacy.signature, [], [], [], [])
    ).to.be.revertedWith('Invalid signature domain');
  });

  it('calls the gacha only when the submission changes something', async () => {
    const ctx = await deployHiit({ dayRequired: 5 });
    const gacha = await (await hre.ethers.getContractFactory('MockCountingGacha')).deploy();
    const list = [await gacha.getAddress()];
    const d1 = ctx.dayKey(1);
    await sendHiit(ctx, hiitInput([{ day: d1, success: 1 }]), ctx.challenger, list);
    await sendHiit(ctx, hiitInput([{ day: d1, success: 1 }]), ctx.challenger, list);
    await sendHiit(ctx, hiitInput([{ day: d1, success: 0 }]), ctx.challenger, list);
    expect(await gacha.calls()).to.equal(1n);
    await sendHiit(ctx, hiitInput([{ day: ctx.dayKey(2), success: 0 }]), ctx.challenger, list);
    expect(await gacha.calls()).to.equal(2n);
  });

  it('counts a success day once and never lowers it (1 -> 0 -> 1)', async () => {
    const ctx = await deployHiit({ dayRequired: 3 });
    const d1 = ctx.dayKey(1);
    await sendHiit(ctx, hiitInput([{ day: d1, success: 1 }]));
    await sendHiit(ctx, hiitInput([{ day: d1, success: 0 }]));
    await sendHiit(ctx, hiitInput([{ day: d1, success: 1 }]));
    await sendHiit(ctx, hiitInput([
      { day: ctx.dayKey(0), success: 0 },
      { day: d1, success: 1 },
    ]));
    expect(await status(ctx.challenge)).to.equal(1);
    expect(await ctx.challenge.getHIITAchievedOn(d1)).to.equal(1n);
    const h = await ctx.challenge.getHistoryV3();
    expect(h.hiitDays.map(Number)).to.deep.equal([d1, ctx.dayKey(0)]);
    expect(h.hiitSuccess.map(Number)).to.deep.equal([1, 0]);
  });

  it('anchors the calendar: another time zone key is rejected, a DST key is the same day', async () => {
    const ctx = await deployHiit({ dayRequired: 3 });
    const d1 = ctx.dayKey(1);
    await sendHiit(ctx, hiitInput([{ day: d1, success: 1 }]));
    expect(await ctx.challenge.dayAnchor()).to.equal(BigInt(d1));
    const shifted = d1 + 9 * 3600;
    await expect(sendHiit(ctx, { day: [shifted], intervals: [6], totalSeconds: [60], timeRange: [shifted, shifted + DAY - 1] })).to.be.revertedWith(
      'Day not on the challenge calendar'
    );
    const dst = d1 - 3600;
    await sendHiit(ctx, { day: [dst], intervals: [6], totalSeconds: [60], timeRange: [dst, dst + DAY - 1] });
    expect(await status(ctx.challenge)).to.equal(1);
    expect((await ctx.challenge.getHistoryV3()).hiitDays.map(Number)).to.deep.equal([d1]);
    expect(await ctx.challenge.getHIITAchievedOn(d1 + 12 * 3600)).to.equal(0n); // off the calendar: 0, no revert
    expect(await ctx.challenge.getHIITAchievedOn(d1)).to.equal(1n);
  });

  it('a day succeeds only when both intervals and seconds reach the goal; the highest values are kept', async () => {
    const ctx = await deployHiit({ dayRequired: 3 });
    const d1 = ctx.dayKey(1);
    await sendHiit(ctx, hiitInput([{ day: d1, intervals: 6, totalSeconds: 59 }]));
    expect(await status(ctx.challenge)).to.equal(0);
    await sendHiit(ctx, hiitInput([{ day: d1, intervals: 5, totalSeconds: 75 }])); // highest: 6 / 75
    expect(await status(ctx.challenge)).to.equal(1);
    await sendHiit(ctx, hiitInput([{ day: d1, intervals: 3, totalSeconds: 30 }])); // lower: not lowered
    const h = await ctx.challenge.getHistoryV3();
    expect([h.hiitDays.map(Number), h.hiitIntervals.map(Number), h.hiitSeconds.map(Number), h.hiitSuccess.map(Number)]).to.deep.equal([
      [d1],
      [6],
      [75],
      [1],
    ]);
    expect(await status(ctx.challenge)).to.equal(1);
  });

  it('upgrades a past day from 0 to 1 when late data arrives', async () => {
    const ctx = await deployHiit({ dayRequired: 3 });
    const d0 = ctx.dayKey(0);
    await sendHiit(ctx, hiitInput([{ day: d0, success: 0 }]));
    expect(await status(ctx.challenge)).to.equal(0);
    await sendHiit(ctx, hiitInput([{ day: d0, success: 1 }]));
    expect(await status(ctx.challenge)).to.equal(1);
  });

  it('has no early failure and succeeds when the required days are reached', async () => {
    const ctx = await deployHiit({ dayRequired: 2, awardReceiversPercent: [90] });
    await sendHiit(ctx, hiitInput([0, 1, 2, 3].map(k => ({ day: ctx.dayKey(k), success: 0 }))));
    expect(await ctx.challenge.isFinished()).to.equal(false);
    const receiver = ctx.signers[4].address;
    const before = await hre.ethers.provider.getBalance(receiver);
    await sendHiit(ctx, hiitInput([
      { day: ctx.dayKey(2), success: 1 },
      { day: ctx.dayKey(4), success: 1 },
    ]));
    expect(await ctx.challenge.isSuccess()).to.equal(true);
    expect(await ctx.challenge.getState()).to.equal(1n);
    expect(await hre.ethers.provider.getBalance(receiver)).to.be.gt(before);
    await expect(sendHiit(ctx, hiitInput([{ day: ctx.dayKey(5), success: 1 }]))).to.be.revertedWith(
      'Challenge was finished'
    );
  });

  it('accepts late results after endTime + 2 days for days inside the period', async () => {
    const ctx = await deployHiit({ dayRequired: 1 });
    await moveTo(ctx.endTime + 4 * DAY);
    await sendHiit(ctx, hiitInput([{ day: ctx.dayKey(9), success: 1 }]));
    expect(await ctx.challenge.isSuccess()).to.equal(true);
  });

  it('rejects days outside the period, unstarted days, bad ranges and values above 1', async () => {
    const ctx = await deployHiit();
    await expect(sendHiit(ctx, hiitInput([{ day: ctx.dayKey(-1), success: 1 }]))).to.be.revertedWith(
      'Day outside challenge period'
    );
    await expect(sendHiit(ctx, hiitInput([{ day: ctx.dayKey(6), success: 1 }]))).to.be.revertedWith(
      'Day has not started'
    );
    const d1 = ctx.dayKey(1);
    await expect(
      sendHiit(ctx, { day: [d1 + 1], intervals: [6], totalSeconds: [60], timeRange: [d1, d1 + DAY - 1] })
    ).to.be.revertedWith('Invalid time range');
    await expect(sendHiit(ctx, { day: [d1], intervals: [6], totalSeconds: [], timeRange: [d1, d1 + DAY - 1] })).to.be.revertedWith(
      'Invalid HIIT results length'
    );
    await expect(sendHiit(ctx, { day: [], intervals: [], totalSeconds: [], timeRange: [] })).to.be.revertedWith(
      'Invalid HIIT results length'
    );
  });

  it('rejects a payload different from the signed one', async () => {
    const ctx = await deployHiit();
    const addr = await ctx.challenge.getAddress();
    const signed = hiitInput([{ day: ctx.dayKey(1), success: 0 }]);
    const forged = hiitInput([{ day: ctx.dayKey(1), success: 1 }]);
    const { data, signature } = await signPayload(ctx.security, addr, payloadHashHiit(signed));
    await expect(
      ctx.challenge.connect(ctx.challenger).sendDailyResult(forged, data, signature, [], [], [], [])
    ).to.be.revertedWith('InvalidSignature');
  });

  it('closeChallenge after endTime + 2 days settles as a failure', async () => {
    const ctx = await deployHiit();
    await moveTo(ctx.endTime + 2 * DAY + 1);
    await ctx.challenge.connect(ctx.sponsor).closeChallenge([], [], [], []);
    expect(await ctx.challenge.isFinished()).to.equal(true);
    expect(await ctx.challenge.isSuccess()).to.equal(false);
  });

  it('giveUp pays by HIIT progress (1 of 4 days -> sponsor keeps 3/4 after the fee)', async () => {
    const ctx = await deployHiit({ dayRequired: 4 });
    await sendHiit(ctx, hiitInput([{ day: ctx.dayKey(0), success: 1 }]));
    const before = await hre.ethers.provider.getBalance(ctx.sponsor.address);
    await ctx.challenge.connect(ctx.challenger).giveUp([], [], [], []);
    const amount = (hre.ethers.parseEther('1') * 90n) / 100n;
    expect((await hre.ethers.provider.getBalance(ctx.sponsor.address)) - before).to.equal(amount - amount / 4n);
    expect(await ctx.challenge.getState()).to.equal(3n); // GAVE_UP
  });

  it('giveUp splits a token that is not first in the NFT token list (Kaia: TTJP listed before JPYC)', async () => {
    const [sponsor] = await hre.ethers.getSigners();
    const Token = await hre.ethers.getContractFactory('MockERC20');
    const ttjp = await Token.deploy('TTJP', 'TTJP'); // listed first, no balance in this challenge
    const jpyc = await Token.deploy('Yen', 'JPYC');
    const amount = hre.ethers.parseEther('100');
    await jpyc.mint(sponsor.address, amount);
    const ctx = await deployV3('ChallengeHIITV3', {
      dayRequired: 4, awardReceiversPercent: [90], totalAmount: amount, msgValue: 0n, allowGiveUp: [true, false, false],
      erc20List: [await ttjp.getAddress(), await jpyc.getAddress()],
    });
    await jpyc.connect(sponsor).transfer(await ctx.challenge.getAddress(), amount);
    await moveTo(ctx.dayKey(0) + 3600);
    await sendHiit(ctx, hiitInput([{ day: ctx.dayKey(0), success: 1 }])); // progress 1/4
    await ctx.challenge.connect(ctx.challenger).giveUp([], [], [], []);
    const share = (((amount * 90n) / 100n) * 1n) / 4n;
    expect(await jpyc.balanceOf(ctx.signers[4].address)).to.equal(share);
    expect(await jpyc.balanceOf(sponsor.address)).to.equal((amount * 90n) / 100n - share);
    expect(await jpyc.balanceOf(ctx.signers[2].address)).to.equal((amount * 10n) / 100n);
    expect(await jpyc.balanceOf(await ctx.challenge.getAddress())).to.equal(0n);
  });

  it('a failing gacha emits GachaRewardFailed and does not block the result', async () => {
    const ctx = await deployHiit({ dayRequired: 3 });
    const gacha = await (await hre.ethers.getContractFactory('MockCountingGacha')).deploy();
    await gacha.setShouldRevert(true);
    await expect(sendHiit(ctx, hiitInput([{ day: ctx.dayKey(1), success: 1 }]), ctx.challenger, [await gacha.getAddress()]))
      .to.emit(ctx.challenge, 'GachaRewardFailed')
      .withArgs(await gacha.getAddress());
    expect(await status(ctx.challenge)).to.equal(1);
  });

  it('keeps getChallengeInfo compatible for CRON', async () => {
    const ctx = await deployHiit({ dayRequired: 3 });
    await sendHiit(ctx, hiitInput([{ day: ctx.dayKey(0), success: 1 }]));
    expect((await ctx.challenge.getChallengeInfo()).map(Number)).to.deep.equal([1, 3, 2]);
  });

  it('fits the EIP-170 contract size limit', async () => {
    const artifact = await hre.artifacts.readArtifact('ChallengeHIITV3');
    expect((artifact.deployedBytecode.length - 2) / 2).to.be.lessThan(24576);
  });
});
