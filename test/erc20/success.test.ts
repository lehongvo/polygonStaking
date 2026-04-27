import { expect } from 'chai';
import hre from 'hardhat';
import { deployChallenge, moveToStart, sendStep } from '../helpers/deployHelpers.ts';

describe('T9 – ERC20 success payout (ChallengeBaseStep)', function () {
  async function setup() {
    const MockERC20 = await hre.ethers.getContractFactory('MockERC20');
    const tkn1 = await MockERC20.deploy('Token1', 'TKN1');
    const tknAddr = await tkn1.getAddress();

    const { challenge, signers, startTime, endTime } = await deployChallenge('ChallengeBaseStep', {
      awardReceiversPercent: [50, 40],
      index: 1,
      dayRequired: 3,
      erc20List: [tknAddr],
    });

    const challengeAddr = await challenge.getAddress();
    await tkn1.mint(challengeAddr, hre.ethers.parseEther('1000'));

    return { tkn1, tknAddr, challenge, challengeAddr, signers, startTime, endTime };
  }

  it('feeAddr receives 10% of TKN1 on success', async function () {
    const { tkn1, challenge, signers, startTime } = await setup();
    const challenger = signers[1];
    const feeAddr = signers[2];

    await moveToStart(startTime);
    for (let day = 1; day <= 3; day++) {
      await sendStep(challenge, 'ChallengeBaseStep', challenger, { day, steps: 1000 });
    }
    expect(await tkn1.balanceOf(feeAddr.address)).to.equal(hre.ethers.parseEther('100'));
  });

  it('recv0 receives 50% of TKN1 on success', async function () {
    const { tkn1, challenge, signers, startTime } = await setup();
    const challenger = signers[1];
    const recv0 = signers[4];

    await moveToStart(startTime);
    for (let day = 1; day <= 3; day++) {
      await sendStep(challenge, 'ChallengeBaseStep', challenger, { day, steps: 1000 });
    }
    expect(await tkn1.balanceOf(recv0.address)).to.equal(hre.ethers.parseEther('500'));
  });

  it('getBalanceToken() returns pre-fee snapshot [1000 TKN1]', async function () {
    const { challenge, signers, startTime } = await setup();
    const challenger = signers[1];

    await moveToStart(startTime);
    for (let day = 1; day <= 3; day++) {
      await sendStep(challenge, 'ChallengeBaseStep', challenger, { day, steps: 1000 });
    }
    const balances = await challenge.getBalanceToken();
    expect(balances.length).to.equal(1);
    expect(balances[0]).to.equal(hre.ethers.parseEther('1000'));
  });
});
