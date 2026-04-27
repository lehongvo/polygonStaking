import { expect } from 'chai';
import hre from 'hardhat';
import { deployChallenge, moveToStart, sendStep } from '../helpers/deployHelpers.ts';

describe('T19 – ChallengeBaseStep: index boundary cases', () => {
  const GOAL = 1000;
  const DAY_REQUIRED = 1;
  const DURATION = 30;
  const TOTAL_AMOUNT = hre.ethers.parseEther('1');

  it('index=0 reverts "Invalid value" (pre-existing guard)', async () => {
    await expect(
      deployChallenge('ChallengeBaseStep', {
        awardReceiversPercent: [50, 50],
        index: 0,
        totalAmount: TOTAL_AMOUNT,
        goal: GOAL,
        dayRequired: DAY_REQUIRED,
        duration: DURATION,
      }),
    ).to.be.revertedWith('Invalid value');
  });

  it('index=2 with 2 receivers (all success-side): both receivers paid on success', async () => {
    const signers = await hre.ethers.getSigners();
    const recv0 = signers[4];
    const recv1 = signers[5];
    const challenger = signers[1];

    const { challenge, startTime } = await deployChallenge('ChallengeBaseStep', {
      awardReceiversPercent: [40, 40],
      receivers: [recv0.address, recv1.address],
      index: 2,
      totalAmount: TOTAL_AMOUNT,
      goal: GOAL,
      dayRequired: DAY_REQUIRED,
      duration: DURATION,
    });

    await moveToStart(startTime);

    const balBefore0 = await hre.ethers.provider.getBalance(recv0.address);
    const balBefore1 = await hre.ethers.provider.getBalance(recv1.address);

    await sendStep(challenge, 'ChallengeBaseStep', challenger, {
      day: startTime + 200, steps: GOAL,
    });

    expect(await challenge.isSuccess()).to.equal(true);
    expect(await hre.ethers.provider.getBalance(recv0.address)).to.be.gt(balBefore0);
    expect(await hre.ethers.provider.getBalance(recv1.address)).to.be.gt(balBefore1);
  });

  it('index=1 with 1 receiver (fail loop empty): recv0 paid on success', async () => {
    const signers = await hre.ethers.getSigners();
    const recv0 = signers[4];
    const challenger = signers[1];

    const { challenge, startTime } = await deployChallenge('ChallengeBaseStep', {
      awardReceiversPercent: [80],
      receivers: [recv0.address],
      index: 1,
      totalAmount: TOTAL_AMOUNT,
      goal: GOAL,
      dayRequired: DAY_REQUIRED,
      duration: DURATION,
    });

    await moveToStart(startTime);

    const balBefore = await hre.ethers.provider.getBalance(recv0.address);

    await sendStep(challenge, 'ChallengeBaseStep', challenger, {
      day: startTime + 200, steps: GOAL,
    });

    expect(await challenge.isSuccess()).to.equal(true);
    expect(await hre.ethers.provider.getBalance(recv0.address)).to.be.gt(balBefore);
  });
});
