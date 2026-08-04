// チャレンジ成功時の ERC20 送金フロー検証。
// feeAddr / 受取人 recv0 への送金額、および getBalanceToken() の
// スナップショット値が想定通りかを確認する。
import { expect } from 'chai';
import hre from 'hardhat';
import {
  deployChallenge,
  moveToStart,
  sendStep,
} from '../helpers/deployHelpers.ts';

describe('T9 – ERC20 success payout (ChallengeBaseStep)', function () {
  async function setup() {
    const MockERC20 = await hre.ethers.getContractFactory('MockERC20');
    const tkn1 = await MockERC20.deploy('Token1', 'TKN1');
    const tknAddr = await tkn1.getAddress();

    const { challenge, signers, startTime, endTime } = await deployChallenge(
      'ChallengeBaseStep',
      {
        awardReceiversPercent: [50, 40],
        index: 1,
        dayRequired: 3,
        erc20List: [tknAddr],
      }
    );

    const challengeAddr = await challenge.getAddress();
    await tkn1.mint(challengeAddr, hre.ethers.parseEther('1000'));

    return {
      tkn1,
      tknAddr,
      challenge,
      challengeAddr,
      signers,
      startTime,
      endTime,
    };
  }

  // CHALLENGE-2696: on success, the fee must use amountSuccessFee (5%, 50 TKN1) -- before the
  // fix this unconditionally used amountFailFee (10%, 100 TKN1) even on a success settlement.
  it('feeAddr receives 5% of TKN1 on success (amountSuccessFee, not amountFailFee)', async function () {
    const { tkn1, challenge, signers, startTime } = await setup();
    const challenger = signers[1];
    const feeAddr = signers[2];

    await moveToStart(startTime);
    for (let day = 1; day <= 3; day++) {
      await sendStep(challenge, 'ChallengeBaseStep', challenger, {
        day,
        steps: 1000,
      });
    }
    expect(await tkn1.balanceOf(feeAddr.address)).to.equal(
      hre.ethers.parseEther('50')
    );
  });

  // CHALLENGE-2696: recv0's nominal share is 50% of gross (500 TKN1), but the actual payout is
  // scaled by the fee complement (100-5)/100 so fee(50) + receiver(475) never exceeds the gross
  // balance (1000) that both are paid from -- see the comment in transferToListReceiverSuccess.
  it('recv0 receives 50% of gross scaled by (100-fee)/100 = 475 TKN1 on success', async function () {
    const { tkn1, challenge, signers, startTime } = await setup();
    const challenger = signers[1];
    const recv0 = signers[4];

    await moveToStart(startTime);
    for (let day = 1; day <= 3; day++) {
      await sendStep(challenge, 'ChallengeBaseStep', challenger, {
        day,
        steps: 1000,
      });
    }
    expect(await tkn1.balanceOf(recv0.address)).to.equal(
      hre.ethers.parseEther('475')
    );
  });

  // getBalanceToken() は手数料控除前の元残高（1000 TKN1）を返すスナップショット
  it('getBalanceToken() returns pre-fee snapshot [1000 TKN1]', async function () {
    const { challenge, signers, startTime } = await setup();
    const challenger = signers[1];

    await moveToStart(startTime);
    for (let day = 1; day <= 3; day++) {
      await sendStep(challenge, 'ChallengeBaseStep', challenger, {
        day,
        steps: 1000,
      });
    }
    const balances = await challenge.getBalanceToken();
    expect(balances.length).to.equal(1);
    expect(balances[0]).to.equal(hre.ethers.parseEther('1000'));
  });
});
