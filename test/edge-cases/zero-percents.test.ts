import { expect } from 'chai';
import hre from 'hardhat';
import { deployChallenge, moveToStart, sendStep } from '../helpers/deployHelpers.ts';

describe('T22 – ChallengeBaseStep: zero-percent receiver validation', () => {
  const GOAL = 1000;
  const DURATION = 30;
  const DAY_REQUIRED = 1;

  it('all-zero percents [0, 0] → reverts "Invalid value0"', async () => {
    await expect(
      deployChallenge('ChallengeBaseStep', {
        awardReceiversPercent: [0, 0],
        index: 1, totalAmount: hre.ethers.parseEther('1'),
        goal: GOAL, dayRequired: DAY_REQUIRED, duration: DURATION,
      }),
    ).to.be.revertedWith('Invalid value0');
  });

  it('first percent zero [0, 50] with index=1 → reverts "Invalid value0"', async () => {
    await expect(
      deployChallenge('ChallengeBaseStep', {
        awardReceiversPercent: [0, 50],
        index: 1, totalAmount: hre.ethers.parseEther('1'),
        goal: GOAL, dayRequired: DAY_REQUIRED, duration: DURATION,
      }),
    ).to.be.revertedWith('Invalid value0');
  });

  it('fail-side zero percent [50, 0] with index=1 → reverts "Invalid value1"', async () => {
    await expect(
      deployChallenge('ChallengeBaseStep', {
        awardReceiversPercent: [50, 0],
        index: 1, totalAmount: hre.ethers.parseEther('1'),
        goal: GOAL, dayRequired: DAY_REQUIRED, duration: DURATION,
      }),
    ).to.be.revertedWith('Invalid value1');
  });

  it('[1, 1] percents with 10000 wei → deploys ok, recv0 paid on success', async () => {
    const signers = await hre.ethers.getSigners();
    const recv0 = signers[4];
    const recv1 = signers[5];
    const challenger = signers[1];
    const TINY = 10_000n;

    const { challenge, startTime } = await deployChallenge('ChallengeBaseStep', {
      awardReceiversPercent: [1, 1],
      receivers: [recv0.address, recv1.address],
      index: 1,
      totalAmount: TINY,
      msgValue: TINY,
      goal: GOAL, dayRequired: DAY_REQUIRED, duration: DURATION,
    });

    await moveToStart(startTime);
    const balBefore = await hre.ethers.provider.getBalance(recv0.address);
    await sendStep(challenge, 'ChallengeBaseStep', challenger, { day: startTime + 200, steps: GOAL });
    expect(await challenge.isSuccess()).to.equal(true);
    expect(await hre.ethers.provider.getBalance(recv0.address)).to.be.gt(balBefore);
  });
});
