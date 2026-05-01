// dayRequired（必要達成日数）の境界値テスト。
// dayRequired=1（最小値）と dayRequired=duration（最大値）を中心に、
// 成功・失敗の両ルートを検証する。
import { expect } from 'chai';
import hre from 'hardhat';
import {
  deployChallenge,
  moveToStart,
  moveAfterEnd,
  sendStep,
} from '../helpers/deployHelpers.ts';

describe('T20 – ChallengeBaseStep: dayRequired boundary cases', () => {
  const GOAL = 1000;
  const TOTAL_AMOUNT = hre.ethers.parseEther('1');

  // dayRequired=1: 1日でも目標達成すれば成功と判定される
  it('dayRequired=1: one passing day triggers success', async () => {
    const signers = await hre.ethers.getSigners();
    const recv0 = signers[4];
    const challenger = signers[1];

    const { challenge, startTime } = await deployChallenge(
      'ChallengeBaseStep',
      {
        awardReceiversPercent: [70],
        receivers: [recv0.address],
        index: 1,
        totalAmount: TOTAL_AMOUNT,
        goal: GOAL,
        dayRequired: 1,
        duration: 30,
      }
    );

    await moveToStart(startTime);
    await sendStep(challenge, 'ChallengeBaseStep', challenger, {
      day: startTime + 200,
      steps: GOAL,
    });
    expect(await challenge.isSuccess()).to.equal(true);
  });

  // dayRequired=duration=3: 3日連続で目標達成 → 成功となるケース
  it('dayRequired=duration=3: three consecutive passing days → success', async () => {
    const signers = await hre.ethers.getSigners();
    const recv0 = signers[4];
    const challenger = signers[1];

    const { challenge, startTime } = await deployChallenge(
      'ChallengeBaseStep',
      {
        awardReceiversPercent: [70],
        receivers: [recv0.address],
        index: 1,
        totalAmount: TOTAL_AMOUNT,
        goal: GOAL,
        dayRequired: 3,
        duration: 3,
      }
    );

    await moveToStart(startTime);
    const DAY = 86400; // 1日 = 86400秒
    // 3日間それぞれで目標歩数を送信し、連続達成を再現する
    await sendStep(challenge, 'ChallengeBaseStep', challenger, {
      day: startTime + 200,
      steps: GOAL,
    });
    await sendStep(challenge, 'ChallengeBaseStep', challenger, {
      day: startTime + DAY + 200,
      steps: GOAL,
    });
    await sendStep(challenge, 'ChallengeBaseStep', challenger, {
      day: startTime + 2 * DAY + 200,
      steps: GOAL,
    });
    expect(await challenge.isSuccess()).to.equal(true);
  });

  // 達成日が0日のまま終了 → closeChallenge により失敗確定となるケース
  it('dayRequired=duration=3: no passing days submitted → closeChallenge marks not-success', async () => {
    const signers = await hre.ethers.getSigners();
    const recv0 = signers[4];
    const recv1 = signers[5];
    const sponsor = signers[0];

    const { challenge, endTime } = await deployChallenge('ChallengeBaseStep', {
      awardReceiversPercent: [50, 50],
      receivers: [recv0.address, recv1.address],
      index: 1,
      totalAmount: TOTAL_AMOUNT,
      goal: GOAL,
      dayRequired: 3,
      duration: 3,
    });

    await moveAfterEnd(endTime);
    // 期間終了後にスポンサーが closeChallenge を実行 → 失敗側の精算が走る
    await challenge.connect(sponsor).closeChallenge([], [], [], []);
    expect(await challenge.isFinished()).to.equal(true);
    expect(await challenge.isSuccess()).to.equal(false);
  });
});
