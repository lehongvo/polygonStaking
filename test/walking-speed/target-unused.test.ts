// F5: walkingSpeedData[0]（目標速度）はオンチェーンでは検証されない仕様の検証。
// 値が極端に大きくても小さくても判定結果に影響せず、いずれの場合も
// 歩数 + 歩行分数の条件のみで成功判定が行われる。
import { expect } from 'chai';
import { deployChallenge, sendStep, moveToStart } from '../helpers/deployHelpers.ts';

describe('T18 – F5: walkingSpeedData[0] (target speed) is not enforced on-chain', function () {
  const GOAL = 1000;
  const DAY_REQUIRED = 2;
  const REQUIRED_MINUTES = 30;

  async function setupWith(targetSpeed: number) {
    const ctx = await deployChallenge('ChallengeBaseStep', {
      awardReceiversPercent: [50, 40],
      walkingSpeedData: [targetSpeed, REQUIRED_MINUTES, DAY_REQUIRED],
      hiitData: [],
      dayRequired: DAY_REQUIRED,
      goal: GOAL,
      duration: 30,
    });
    await moveToStart(ctx.startTime);
    return ctx;
  }

  async function sendTwoPassingDays(challenge: any, challenger: any, startTime: number) {
    await sendStep(challenge, 'ChallengeBaseStep', challenger, {
      day: startTime + 86400 * 1, steps: GOAL, minutes: REQUIRED_MINUTES, mets: 100,
    });
    await sendStep(challenge, 'ChallengeBaseStep', challenger, {
      day: startTime + 86400 * 2, steps: GOAL, minutes: REQUIRED_MINUTES, mets: 100,
    });
  }

  // 目標速度 999（非現実的に大きい値）でも、歩数+分数の条件を満たせば成功する
  it('succeeds when walkingSpeedData[0]=999 (absurd target) and minutes >= required', async function () {
    const { challenge, signers, startTime } = await setupWith(999);
    expect(await challenge.walkingSpeedData(0)).to.equal(999n);
    await sendTwoPassingDays(challenge, signers[1], startTime);
    expect(await challenge.isSuccess()).to.equal(true);
  });

  // 目標速度 1（極端に小さい値）でも同様に成功する → ターゲットは判定に未使用
  it('succeeds when walkingSpeedData[0]=1 (trivial target) and minutes >= required', async function () {
    const { challenge, signers, startTime } = await setupWith(1);
    expect(await challenge.walkingSpeedData(0)).to.equal(1n);
    await sendTwoPassingDays(challenge, signers[1], startTime);
    expect(await challenge.isSuccess()).to.equal(true);
  });

  // 高い目標速度と低い目標速度で結果が同一 → ターゲット値が無効であることの最終確認
  it('walkingSpeedData[0]=999 and walkingSpeedData[0]=1 yield identical isSuccess=true', async function () {
    const high = await setupWith(999);
    const low = await setupWith(1);
    await sendTwoPassingDays(high.challenge, high.signers[1], high.startTime);
    await sendTwoPassingDays(low.challenge, low.signers[1], low.startTime);
    expect(await high.challenge.isSuccess()).to.equal(true);
    expect(await low.challenge.isSuccess()).to.equal(true);
  });
});
