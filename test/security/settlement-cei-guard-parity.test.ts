// CHALLENGE-2733: ChallengeGCM, ChallengeGCMAndSpeed, and ChallengeDetailV2 wrote
// isSuccess/isFinished at the END of transferToListReceiverSuccess/Fail (after every external
// transfer) instead of before (CEI), and withdrawTokensOnCompletion had no nonReentrant guard at
// all -- unlike ChallengeDetail/ChallengeBaseStep/ChallengeHIIT, which already set these flags
// first. Fix: the flags are now written before any external interaction in all three private
// settlement functions, receive() skips its refund branch while a nonReentrant call is in
// progress, and withdrawTokensOnCompletion is now nonReentrant.
//
// These tests use the ticket's own probe configuration: the attacker contract is BOTH
// stakeHolders[0] (sponsor, so it passes the onlyStakeHolders gate on giveUp) AND
// awardReceivers[0] (so it receives the native payout mid-settlement and its receive() hook
// fires). Reusing the existing MockReentrancyAttacker (already proven against ChallengeGCM's
// giveUp()-guard in gcm-reentrancy.test.ts) rather than adding a new mock.
import { expect } from 'chai';
import hre from 'hardhat';
import { time } from '@nomicfoundation/hardhat-toolbox/network-helpers.js';

const SUCCESS_FEE = 10;
const FAIL_FEE = 10;

async function deployAttacker() {
  const Attacker = await hre.ethers.getContractFactory('MockReentrancyAttacker');
  const attacker = await Attacker.deploy();
  await attacker.waitForDeployment();
  return attacker;
}

async function armAttacker(attacker: any, target: string) {
  await attacker.setTarget(target);
  await attacker.arm();
}

function expectBlockedAndBounded(attacker: any, gained: bigint, cap: bigint) {
  return (async () => {
    expect(await attacker.reentryAttempts()).to.equal(1n);
    expect(await attacker.lastReentryReverted()).to.equal(true);
    // The reentrant giveUp() attempt moved zero additional funds -- the attacker's balance only
    // reflects the single, legitimate awardReceivers[0] payout, never a second one.
    expect(gained).to.be.greaterThan(0n);
    expect(gained).to.be.lessThan(cap);
  })();
}

describe('Settlement CEI + guard parity (CHALLENGE-2733)', function () {
  describe('ChallengeGCM', function () {
    async function deploy() {
      const [, challenger, feeAddr, returnedNFTWallet] = await hre.ethers.getSigners();
      const attacker = await deployAttacker();
      const attackerAddr = await attacker.getAddress();
      const MockNFT = await hre.ethers.getContractFactory('MockExerciseSupplementNFT');
      const nft = await MockNFT.deploy(returnedNFTWallet.address, SUCCESS_FEE, FAIL_FEE);
      const Factory = await hre.ethers.getContractFactory('ChallengeGCM');
      const block = await hre.ethers.provider.getBlock('latest');
      const startTime = block!.timestamp + 60;
      const duration = 30;
      const endTime = startTime + duration * 86400;
      const totalAmount = hre.ethers.parseEther('10');

      const challenge = await Factory.deploy(
        [attackerAddr, challenger.address, feeAddr.address], // sponsor (stakeHolders[0]) = attacker
        hre.ethers.ZeroAddress,
        [await nft.getAddress()],
        [duration, startTime, endTime, 1000, 1], // dayRequired = 1
        [attackerAddr], // awardReceivers[0] = attacker, single receiver, 100%
        1,
        [true, true, false],
        [0, 0, 0],
        false,
        [100],
        totalAmount,
        [0, 200, 1], // gcmData: wide glucose range, 1-day gate
        { value: totalAmount }
      );
      await armAttacker(attacker, await challenge.getAddress());
      return { challenger, challenge, startTime, attacker, attackerAddr, totalAmount };
    }

    it('reentrant giveUp from the award-receiving sponsor during success settlement is blocked', async function () {
      const { challenger, challenge, startTime, attacker, attackerAddr, totalAmount } = await deploy();
      const balanceBefore = await hre.ethers.provider.getBalance(attackerAddr);

      await time.increaseTo(startTime + 100);
      await challenge
        .connect(challenger)
        .sendDailyResult(
          [startTime + 300], [1001], [0, 0], '0x', [], [], [], [], [], [0, 2 ** 53 - 1], [100]
        );

      expect(await challenge.isSuccess()).to.equal(true);
      const balanceAfter = await hre.ethers.provider.getBalance(attackerAddr);
      await expectBlockedAndBounded(attacker, balanceAfter - balanceBefore, totalAmount);
    });
  });

  describe('ChallengeGCMAndSpeed', function () {
    async function deploy() {
      const [, challenger, feeAddr, returnedNFTWallet] = await hre.ethers.getSigners();
      const attacker = await deployAttacker();
      const attackerAddr = await attacker.getAddress();
      const MockNFT = await hre.ethers.getContractFactory('MockExerciseSupplementNFT');
      const nft = await MockNFT.deploy(returnedNFTWallet.address, SUCCESS_FEE, FAIL_FEE);
      const Factory = await hre.ethers.getContractFactory('ChallengeGCMAndSpeed');
      const block = await hre.ethers.provider.getBlock('latest');
      const startTime = block!.timestamp + 60;
      const duration = 30;
      const endTime = startTime + duration * 86400;
      const totalAmount = hre.ethers.parseEther('10');

      const challenge = await Factory.deploy(
        [attackerAddr, challenger.address, feeAddr.address],
        hre.ethers.ZeroAddress,
        [await nft.getAddress()],
        [duration, startTime, endTime, 1000, 1], // dayRequired = 1
        [attackerAddr],
        1,
        [true, true, false],
        [0, 0, 0],
        false,
        [100],
        totalAmount,
        [0, 0, 1], // walkingSpeedData: [minMets, minMinutes, minDays] -- wide open, 1-day gate
        [0, 200, 1], // gcmData: wide glucose range, 1-day gate
        { value: totalAmount }
      );
      await armAttacker(attacker, await challenge.getAddress());
      return { challenger, challenge, startTime, attacker, attackerAddr, totalAmount };
    }

    it('reentrant giveUp from the award-receiving sponsor during success settlement is blocked', async function () {
      const { challenger, challenge, startTime, attacker, attackerAddr, totalAmount } = await deploy();
      const balanceBefore = await hre.ethers.provider.getBalance(attackerAddr);

      await time.increaseTo(startTime + 100);
      await challenge
        .connect(challenger)
        .sendDailyResult(
          [startTime + 300], [1001], [0, 0], '0x', [], [], [], [], [], [0, 2 ** 53 - 1],
          [100], // minutesAtTargetSpeed
          [100], // metsWalkingSpeed
          [100] // glucoseLevels
        );

      expect(await challenge.isSuccess()).to.equal(true);
      const balanceAfter = await hre.ethers.provider.getBalance(attackerAddr);
      await expectBlockedAndBounded(attacker, balanceAfter - balanceBefore, totalAmount);
    });
  });

  describe('ChallengeDetailV2', function () {
    // Constructor calls the REAL, hardcoded Aave Pool / WMATIC addresses directly -- plant
    // minimal mocks at those exact addresses via hardhat_setCode (same technique as
    // test/defi/detailv2-staking-payout.test.ts) so this runs on a plain local network.
    const AAVE_POOL_ADDRESS = '0x794a61358D6845594F94dc1DB02A252b5b4814aD';
    const WMATIC_WPOC_ADDRESS = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270';

    async function plantMock(address: string, factoryName: string) {
      const Factory = await hre.ethers.getContractFactory(factoryName);
      const deployed = await Factory.deploy();
      await deployed.waitForDeployment();
      const code = await hre.ethers.provider.getCode(await deployed.getAddress());
      await hre.network.provider.request({ method: 'hardhat_setCode', params: [address, code] });
    }

    async function deploy() {
      const [, challenger, feeAddr, returnedNFTWallet] = await hre.ethers.getSigners();
      await plantMock(WMATIC_WPOC_ADDRESS, 'MockWMATIC');
      await plantMock(AAVE_POOL_ADDRESS, 'MockAavePoolForTest');

      const attacker = await deployAttacker();
      const attackerAddr = await attacker.getAddress();
      const MockNFT = await hre.ethers.getContractFactory('MockExerciseSupplementNFT');
      const nft = await MockNFT.deploy(returnedNFTWallet.address, SUCCESS_FEE, FAIL_FEE);
      const Factory = await hre.ethers.getContractFactory('ChallengeDetailV2');
      const block = await hre.ethers.provider.getBlock('latest');
      const startTime = block!.timestamp + 60;
      const duration = 30;
      const endTime = startTime + duration * 86400;
      const totalAmount = hre.ethers.parseEther('10');

      const challenge = await Factory.deploy(
        [attackerAddr, challenger.address, feeAddr.address],
        hre.ethers.ZeroAddress, // native flow -> triggers WMATIC/Aave staking
        [await nft.getAddress()],
        [duration, startTime, endTime, 1000, 1], // dayRequired = 1
        [attackerAddr],
        1,
        [true, true, false],
        [0, 0, 0],
        false,
        [100],
        totalAmount,
        0, // systemFeePercentForStaking
        { value: totalAmount }
      );
      await challenge.waitForDeployment();
      await armAttacker(attacker, await challenge.getAddress());
      return { challenger, challenge, startTime, attacker, attackerAddr, totalAmount };
    }

    it('reentrant giveUp from the award-receiving sponsor during success settlement is blocked', async function () {
      const { challenger, challenge, startTime, attacker, attackerAddr, totalAmount } = await deploy();
      const balanceBefore = await hre.ethers.provider.getBalance(attackerAddr);

      await time.increaseTo(startTime + 100);
      await challenge
        .connect(challenger)
        .sendDailyResult([startTime + 300], [1001], [0, 0], '0x', [], [], [], [], [], [0, 2 ** 53 - 1]);

      expect(await challenge.isSuccess()).to.equal(true);
      const balanceAfter = await hre.ethers.provider.getBalance(attackerAddr);
      await expectBlockedAndBounded(attacker, balanceAfter - balanceBefore, totalAmount);
    });
  });
});
