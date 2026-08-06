// CHALLENGE-2734: the prior fixture used feeAddress as the attacker, so the reentrant giveUp()
// was rejected by onlyStakeHolders before it ever reached nonReentrant — the test passed even
// with every guard removed. This file now mirrors settlement-cei-guard-parity.test.ts: the
// attacker is BOTH sponsor (stakeHolders[0]) AND awardReceivers[0], so reentry reaches the guard.
import { expect } from 'chai';
import hre from 'hardhat';
import { time } from '@nomicfoundation/hardhat-toolbox/network-helpers.js';

const SUCCESS_FEE = 10;
const FAIL_FEE = 10;

async function deployWithAttackerSponsorReceiver() {
  const [, challenger, feeAddr, returnedNFTWallet] = await hre.ethers.getSigners();
  const Attacker = await hre.ethers.getContractFactory('MockReentrancyAttacker');
  const attacker = await Attacker.deploy();
  const attackerAddr = await attacker.getAddress();
  const MockNFT = await hre.ethers.getContractFactory('MockExerciseSupplementNFT');
  const nft = await MockNFT.deploy(returnedNFTWallet.address, SUCCESS_FEE, FAIL_FEE);
  const Factory = await hre.ethers.getContractFactory('ChallengeGCM');
  const block = await hre.ethers.provider.getBlock('latest');
  const startTime = block!.timestamp + 60;
  const duration = 5;
  const endTime = startTime + duration * 86400;
  const totalAmount = hre.ethers.parseEther('10');
  const challenge = await Factory.deploy(
    [attackerAddr, challenger.address, feeAddr.address],
    hre.ethers.ZeroAddress,
    [await nft.getAddress()],
    [duration, startTime, endTime, 1000, 1],
    [attackerAddr],
    1,
    [true, true, false],
    [0, 0, 0],
    false,
    [100],
    totalAmount,
    [70, 180, 1],
    { value: totalAmount }
  );
  await attacker.setTarget(await challenge.getAddress());
  await attacker.arm();
  return { challenger, challenge, startTime, attacker, attackerAddr, totalAmount };
}

describe('ChallengeGCM — reentrancy guard regression (CHALLENGE-2734)', function () {
  it('blocks reentrant giveUp from the award-receiving sponsor during success settlement', async function () {
    const { challenger, challenge, startTime, attacker, attackerAddr, totalAmount } =
      await deployWithAttackerSponsorReceiver();
    const balanceBefore = await hre.ethers.provider.getBalance(attackerAddr);

    await time.increaseTo(startTime + 100);
    await challenge
      .connect(challenger)
      .sendDailyResult(
        [startTime + 200], [1500], [0, 0], '0x', [], [], [], [], [], [0, startTime + 200 + 86400], [100]
      );

    expect(await challenge.isSuccess()).to.equal(true);
    expect(await attacker.reentryAttempts()).to.equal(1n);
    expect(await attacker.lastReentryReverted()).to.equal(true);

    const balanceAfter = await hre.ethers.provider.getBalance(attackerAddr);
    const gained = balanceAfter - balanceBefore;
    expect(gained).to.be.greaterThan(0n);
    expect(gained).to.be.lessThan(totalAmount);
  });
});
