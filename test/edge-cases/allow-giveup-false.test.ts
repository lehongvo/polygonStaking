// allowGiveUp[0]=false の場合、giveUp() がブロックされることを検証するテスト。
// 成功パス（success path）は通常どおり動作することも併せて確認する。
import { expect } from 'chai';
import hre from 'hardhat';
import {
  deployChallenge,
  moveToStart,
  sendStep,
} from '../helpers/deployHelpers.ts';

describe('T21 – ChallengeBaseStep: allowGiveUp[0]=false blocks giveUp', () => {
  const GOAL = 1000;
  const TOTAL_AMOUNT = hre.ethers.parseEther('1');
  // [false, true, false]: 先頭フラグが false のため giveUp は不可
  const ALLOW_GIVE_UP_BLOCKED = [false, true, false];

  // ギブアップ不許可の設定で giveUp() を呼ぶと revert することを確認
  it('giveUp reverts "Can not give up" when allowGiveUp[0]=false', async () => {
    const signers = await hre.ethers.getSigners();
    const recv0 = signers[4];
    const challenger = signers[1];

    const { challenge, startTime } = await deployChallenge(
      'ChallengeBaseStep',
      {
        awardReceiversPercent: [50, 50],
        receivers: [recv0.address, signers[5].address],
        index: 1,
        totalAmount: TOTAL_AMOUNT,
        goal: GOAL,
        dayRequired: 5,
        duration: 30,
        allowGiveUp: ALLOW_GIVE_UP_BLOCKED,
      }
    );

    await moveToStart(startTime);
    // allowGiveUp[0]=false のため、giveUp は "Can not give up" で revert する
    await expect(
      challenge.connect(challenger).giveUp([], [], [], [])
    ).to.be.revertedWith('Can not give up');
  });

  // ギブアップが不許可でも、目標達成による成功フローは正常に処理されることを確認
  it('success path works normally when allowGiveUp[0]=false', async () => {
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
        allowGiveUp: ALLOW_GIVE_UP_BLOCKED,
      }
    );

    await moveToStart(startTime);
    // 目標歩数に到達して isSuccess が true となること
    await sendStep(challenge, 'ChallengeBaseStep', challenger, {
      day: startTime + 200,
      steps: GOAL,
    });
    expect(await challenge.isSuccess()).to.equal(true);
  });
});
