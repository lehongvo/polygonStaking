// walkingSpeedData（[targetSpeed, requiredMinutes, minAchievementDays]）の
// デプロイ時バリデーションを検証する。
// 空配列でのデプロイ可否、長さ不正、minAchievementDays > dayRequired での
// revert などを確認する。
import { expect } from 'chai';
import { deployChallenge } from '../helpers/deployHelpers.ts';

describe('T16 – ChallengeBaseStep: walkingSpeedData deploy validation', function () {
  // 空配列でも歩数のみモードでデプロイ可能、未設定インデックスは revert
  it('deploys in step-only mode and walkingSpeedData(0) reverts on out-of-bounds', async function () {
    const { challenge } = await deployChallenge('ChallengeBaseStep', {
      awardReceiversPercent: [50, 40],
      walkingSpeedData: [],
      hiitData: [],
    });

    await expect(challenge.walkingSpeedData(0)).to.be.reverted;
  });

  // 渡した配列がインデックス 0/1/2 にそれぞれ正しく格納される
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

  // 配列長が 3 でない場合は "Invalid walking speed data" で revert
  it('reverts "Invalid walking speed data" when walkingSpeedData length is 2', async function () {
    await expect(
      deployChallenge('ChallengeBaseStep', {
        awardReceiversPercent: [50, 40],
        walkingSpeedData: [10, 30],
        hiitData: [],
      })
    ).to.be.revertedWith('Invalid walking speed data');
  });

  // dayRequired < minAchievementDays は論理破綻 → "Invalid walking speed days" で revert
  it('reverts "Invalid walking speed days" when dayRequired(3) < minAchievementDays(5)', async function () {
    await expect(
      deployChallenge('ChallengeBaseStep', {
        awardReceiversPercent: [50, 40],
        walkingSpeedData: [10, 30, 5],
        hiitData: [],
        dayRequired: 3,
      })
    ).to.be.revertedWith('Invalid walking speed days');
  });
});
