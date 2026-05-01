// isPassWalkingSpeed ゲートの動作検証。
// 歩数（GOAL）に到達しても、歩行分数が requiredMinutes 未満であれば
// 成功扱いにならず、両条件を満たした場合のみ isSuccess=true となる。
import { expect } from 'chai';
import {
  deployChallenge,
  sendStep,
  moveToStart,
} from '../helpers/deployHelpers.ts';

describe('T17 – ChallengeBaseStep: isPassWalkingSpeed blocks and gates success', function () {
  const GOAL = 1000;
  const DAY_REQUIRED = 2;
  const REQUIRED_MINUTES = 30;

  async function setup() {
    const ctx = await deployChallenge('ChallengeBaseStep', {
      awardReceiversPercent: [50, 40],
      walkingSpeedData: [10, REQUIRED_MINUTES, DAY_REQUIRED],
      hiitData: [],
      dayRequired: DAY_REQUIRED,
      goal: GOAL,
      duration: 30,
    });
    await moveToStart(ctx.startTime);
    return ctx;
  }

  // 歩数達成のみで歩行分数が 0 の場合は成功にならない（cs は増えるが isSuccess=false）
  it('does NOT trigger success when steps pass but walking minutes are 0 each day', async function () {
    const { challenge, signers, startTime } = await setup();
    const challenger = signers[1];

    await sendStep(challenge, 'ChallengeBaseStep', challenger, {
      day: startTime + 86400 * 1,
      steps: GOAL,
      minutes: 0,
      mets: 100,
    });
    await sendStep(challenge, 'ChallengeBaseStep', challenger, {
      day: startTime + 86400 * 2,
      steps: GOAL,
      minutes: 0,
      mets: 100,
    });

    expect(await challenge.currentStatus()).to.equal(2n);
    expect(await challenge.isFinished()).to.equal(false);
    expect(await challenge.isSuccess()).to.equal(false);
  });

  // 歩数達成 + 歩行分数 >= 30 を 2 日連続で満たすと isSuccess=true
  it('triggers success when steps pass AND walking minutes >= 30 on both days', async function () {
    const { challenge, signers, startTime } = await setup();
    const challenger = signers[1];

    await sendStep(challenge, 'ChallengeBaseStep', challenger, {
      day: startTime + 86400 * 1,
      steps: GOAL,
      minutes: REQUIRED_MINUTES,
      mets: 100,
    });
    await sendStep(challenge, 'ChallengeBaseStep', challenger, {
      day: startTime + 86400 * 2,
      steps: GOAL,
      minutes: REQUIRED_MINUTES + 5,
      mets: 100,
    });

    expect(await challenge.currentStatus()).to.equal(2n);
    expect(await challenge.isSuccess()).to.equal(true);
  });
});
