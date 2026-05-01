// 受取人を10名に増やしたときの成功時送金処理が、ガス上限内で
// 完了することを保証するテスト（DoS 防止のための上界確認）。
import { expect } from 'chai';
import hre from 'hardhat';
import { time } from '@nomicfoundation/hardhat-toolbox/network-helpers.js';
import {
  deployChallenge,
  sendStep,
  moveToStart,
} from '../helpers/deployHelpers.ts';

// 受取人10名でも 2M ガス未満に収まることを期待
const GAS_LIMIT_SUCCESS_PAYOUT = 2_000_000n;

describe('T25 – large awardReceivers gas bounds (10 receivers)', function () {
  // 10 名への一括送金が 2M ガス未満で完了し、成功フラグが立つこと
  it('transferToListReceiverSuccess with 10 receivers uses < 2 M gas', async function () {
    const { challenge, startTime } = await deployChallenge(
      'ChallengeBaseStep',
      {
        awardReceiversPercent: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
        index: 5,
        duration: 30,
        dayRequired: 5,
        goal: 1000,
        allowGiveUp: [true, true, false],
        totalAmount: hre.ethers.parseEther('100'),
      }
    );

    const signers = await hre.ethers.getSigners();
    const challenger = signers[1];

    await moveToStart(startTime);

    let successTx: any;
    for (let day = 1; day <= 5; day++) {
      const dayTs = startTime + day * 86_400;
      await time.increaseTo(startTime + day * 86_400 + 10);
      successTx = await sendStep(challenge, 'ChallengeBaseStep', challenger, {
        day: dayTs,
        steps: 1000,
      });
    }

    const receipt = await successTx.wait();
    const gasUsed: bigint = receipt.gasUsed;
    console.log(
      `  [T25] success payout (10 receivers, no ERC20) gas: ${gasUsed.toLocaleString()}`
    );

    expect(gasUsed).to.be.lt(GAS_LIMIT_SUCCESS_PAYOUT);
    expect(await challenge.isFinished()).to.be.true;
    expect(await challenge.isSuccess()).to.be.true;
  });
});
