import { expect } from 'chai';
import { deployChallenge } from '../helpers/deployHelpers.ts';

describe('T16 – ChallengeBaseStep: walkingSpeedData deploy validation', function () {
  it('deploys in step-only mode and walkingSpeedData(0) reverts on out-of-bounds', async function () {
    const { challenge } = await deployChallenge('ChallengeBaseStep', {
      awardReceiversPercent: [50, 40],
      walkingSpeedData: [],
      hiitData: [],
    });

    await expect(challenge.walkingSpeedData(0)).to.be.reverted;
  });

  it('stores walkingSpeedData=[10,30,5] at indices 0,1,2 after deploy', async function () {
    const { challenge } = await deployChallenge('ChallengeBaseStep', {
      awardReceiversPercent: [50, 40],
      walkingSpeedData: [10, 30, 5],
      hiitData: [],
      dayRequired: 20,
    });

    expect(await challenge.walkingSpeedData(0)).to.equal(10n);
    expect(await challenge.walkingSpeedData(1)).to.equal(30n);
    expect(await challenge.walkingSpeedData(2)).to.equal(5n);
  });

  it('reverts "Invalid walking speed data" when walkingSpeedData length is 2', async function () {
    await expect(
      deployChallenge('ChallengeBaseStep', {
        awardReceiversPercent: [50, 40],
        walkingSpeedData: [10, 30],
        hiitData: [],
      }),
    ).to.be.revertedWith('Invalid walking speed data');
  });

  it('reverts "Invalid walking speed days" when dayRequired(3) < minAchievementDays(5)', async function () {
    await expect(
      deployChallenge('ChallengeBaseStep', {
        awardReceiversPercent: [50, 40],
        walkingSpeedData: [10, 30, 5],
        hiitData: [],
        dayRequired: 3,
      }),
    ).to.be.revertedWith('Invalid walking speed days');
  });
});
