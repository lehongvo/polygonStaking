import { expect } from 'chai';
import hre from 'hardhat';
import { time } from '@nomicfoundation/hardhat-toolbox/network-helpers.js';
import { deployChallenge, sendStep, moveToStart } from '../helpers/deployHelpers.ts';

describe('T26 – historyData growth bounded: 1 push per unique day', function () {
  it('history length increments by exactly 1 for each unique day, final length == 10', async function () {
    const { challenge, startTime } = await deployChallenge('ChallengeBaseStep', {
      awardReceiversPercent: [50, 50],
      index: 1,
      duration: 10,
      dayRequired: 10,
      goal: 1000,
      allowGiveUp: [true, true, false],
      totalAmount: hre.ethers.parseEther('10'),
    });

    const signers = await hre.ethers.getSigners();
    const challenger = signers[1];

    await moveToStart(startTime);

    for (let day = 1; day <= 10; day++) {
      const dayTs = startTime + day * 86_400;
      await time.increaseTo(startTime + day * 86_400 + 30);

      await sendStep(challenge, 'ChallengeBaseStep', challenger, {
        day: dayTs,
        steps: 1000,
      });

      const [dates] = await challenge.getChallengeHistory();
      expect(dates.length).to.equal(day);
    }

    const [dates, data] = await challenge.getChallengeHistory();
    expect(dates.length).to.equal(10);
    expect(data.length).to.equal(10);

    expect(await challenge.isFinished()).to.be.true;
    expect(await challenge.isSuccess()).to.be.true;
  });

  it('sendDailyResult after success reverts "Challenge was finished"', async function () {
    const { challenge, startTime } = await deployChallenge('ChallengeBaseStep', {
      awardReceiversPercent: [50, 50],
      index: 1,
      duration: 10,
      dayRequired: 10,
      goal: 1000,
      allowGiveUp: [true, true, false],
      totalAmount: hre.ethers.parseEther('10'),
    });

    const signers = await hre.ethers.getSigners();
    const challenger = signers[1];

    await moveToStart(startTime);

    for (let day = 1; day <= 10; day++) {
      const dayTs = startTime + day * 86_400;
      await time.increaseTo(startTime + day * 86_400 + 30);
      await sendStep(challenge, 'ChallengeBaseStep', challenger, { day: dayTs, steps: 1000 });
    }

    expect(await challenge.isFinished()).to.be.true;

    const extraDayTs = startTime + 11 * 86_400;
    await expect(
      sendStep(challenge, 'ChallengeBaseStep', challenger, { day: extraDayTs, steps: 1000 }),
    ).to.be.revertedWith('Challenge was finished');
  });
});
