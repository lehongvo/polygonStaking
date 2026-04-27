import { time } from '@nomicfoundation/hardhat-toolbox/network-helpers.js';
import { expect } from 'chai';
import hre from 'hardhat';

/**
 * Tests for the security fixes applied per REVIEW_REPORT_sun2642026.md.
 * Covers fixes that can be exercised without the full off-chain signing
 * infrastructure: N1 constructor sum-percent invariant and F6 onTimeSendResult
 * upper bound. F1/F2/F3 require additional mocking of the signature scheme
 * and are deferred to integration tests.
 */

const SUCCESS_FEE = 5;
const FAIL_FEE = 10;

async function deployMockNFT() {
  const [, , , wallet] = await hre.ethers.getSigners();
  const Mock = await hre.ethers.getContractFactory('MockExerciseSupplementNFT');
  return await Mock.deploy(wallet.address, SUCCESS_FEE, FAIL_FEE);
}

async function deployBaseStep(opts: {
  awardReceiversPercent: number[];
  index?: number;
  totalAmount?: bigint;
  goal?: number;
  duration?: number;
  dayRequired?: number;
  walkingSpeedData?: number[];
  hiitData?: number[];
  allowGiveUp?: boolean[];
  msgValue?: bigint;
}) {
  const [sponsor, challenger, feeAddr, , receiver1, receiver2] =
    await hre.ethers.getSigners();

  const mockNFT = await deployMockNFT();
  const Factory = await hre.ethers.getContractFactory('ChallengeBaseStep');

  const stakeHolders = [sponsor.address, challenger.address, feeAddr.address];
  const erc721Address = [await mockNFT.getAddress()];
  const now = await time.latest();
  const duration = opts.duration ?? 30;
  const startTime = now + 60;
  const endTime = startTime + duration * 86400;
  const goal = opts.goal ?? 1000;
  const dayRequired = opts.dayRequired ?? 20;
  const primaryRequired = [duration, startTime, endTime, goal, dayRequired];
  const awardReceivers = [receiver1.address, receiver2.address];
  const idx = opts.index ?? 1;
  const allowGiveUp = opts.allowGiveUp ?? [true, true, false];
  const gasData = [0, 0, 0];
  const totalAmount = opts.totalAmount ?? hre.ethers.parseEther('100');

  return await Factory.deploy(
    stakeHolders,
    hre.ethers.ZeroAddress,
    erc721Address,
    primaryRequired,
    awardReceivers,
    idx,
    allowGiveUp,
    gasData,
    false,
    opts.awardReceiversPercent,
    totalAmount,
    opts.walkingSpeedData ?? [],
    opts.hiitData ?? [],
    { value: opts.msgValue ?? totalAmount }
  );
}

describe('ChallengeBaseStep — security fixes', function () {
  describe('N1 — constructor enforces sum(awardReceiversPercent) <= 100', function () {
    it('reverts when sum of percents > 100', async function () {
      await expect(
        deployBaseStep({ awardReceiversPercent: [60, 50] })
      ).to.be.revertedWith('Sum of percents exceeds 100');
    });

    it('reverts when sum of percents = 110', async function () {
      await expect(
        deployBaseStep({ awardReceiversPercent: [50, 60] })
      ).to.be.revertedWith('Sum of percents exceeds 100');
    });

    it('accepts sum of percents = 100 exactly', async function () {
      await expect(deployBaseStep({ awardReceiversPercent: [60, 40] })).not.to
        .be.reverted;
    });

    it('accepts sum of percents < 100 (matches fee carve-out)', async function () {
      await expect(deployBaseStep({ awardReceiversPercent: [50, 40] })).not.to
        .be.reverted;
    });
  });

  describe('F6 — onTimeSendResult enforces endTime + 2 days upper bound', function () {
    it('reverts when sendDailyResult is called past endTime + 2 days', async function () {
      const [, challenger] = await hre.ethers.getSigners();
      const challenge = await deployBaseStep({
        awardReceiversPercent: [50, 40],
      });

      await time.increase(60 + 30 * 86400 + 3 * 86400);

      const sig = '0x';
      const data: [number, number] = [0, 0];
      const timeRange: [number, number] = [0, 0];
      await expect(
        challenge
          .connect(challenger)
          .sendDailyResult(
            [],
            [],
            data,
            sig,
            [],
            [],
            [],
            [],
            [],
            timeRange,
            [],
            [],
            [],
            []
          )
      ).to.be.revertedWith('Challenge was finished');
    });
  });

  describe('Deployment sanity', function () {
    it('deploys with the reentrancy state initialized (modifier compiles)', async function () {
      const challenge = await deployBaseStep({
        awardReceiversPercent: [50, 40],
      });
      expect(await challenge.getAddress()).to.properAddress;
    });
  });
});

describe('ChallengeDetail — security fixes', function () {
  async function deployDetail(percents: number[]) {
    const [sponsor, challenger, feeAddr, , receiver1, receiver2] =
      await hre.ethers.getSigners();
    const mockNFT = await deployMockNFT();
    const Factory = await hre.ethers.getContractFactory('ChallengeDetail');

    const now = await time.latest();
    const duration = 30;
    const startTime = now + 60;
    const endTime = startTime + duration * 86400;

    return Factory.deploy(
      [sponsor.address, challenger.address, feeAddr.address],
      hre.ethers.ZeroAddress,
      [await mockNFT.getAddress()],
      [duration, startTime, endTime, 1000, 20],
      [receiver1.address, receiver2.address],
      1,
      [true, true, false],
      [0, 0, 0],
      false,
      percents,
      hre.ethers.parseEther('100'),
      { value: hre.ethers.parseEther('100') }
    );
  }

  it('N1: reverts with sum of percents > 100', async function () {
    await expect(deployDetail([60, 60])).to.be.revertedWith(
      'Sum of percents exceeds 100'
    );
  });

  it('N1: accepts sum of percents = 100', async function () {
    await expect(deployDetail([50, 50])).not.to.be.reverted;
  });
});

describe('ChallengeHIIT — security fixes', function () {
  async function deployHIIT(percents: number[]) {
    const [sponsor, challenger, feeAddr, , receiver1, receiver2] =
      await hre.ethers.getSigners();
    const mockNFT = await deployMockNFT();
    const Factory = await hre.ethers.getContractFactory('ChallengeHIIT');

    const now = await time.latest();
    const duration = 30;
    const startTime = now + 60;
    const endTime = startTime + duration * 86400;

    return Factory.deploy(
      [sponsor.address, challenger.address, feeAddr.address],
      hre.ethers.ZeroAddress,
      [await mockNFT.getAddress()],
      [duration, startTime, endTime, 0, 5, 20],
      [receiver1.address, receiver2.address],
      1,
      [true, true, false],
      [0, 0, 0],
      false,
      percents,
      hre.ethers.parseEther('100'),
      { value: hre.ethers.parseEther('100') }
    );
  }

  it('N1: reverts with sum of percents > 100', async function () {
    await expect(deployHIIT([60, 60])).to.be.revertedWith(
      'Sum of percents exceeds 100'
    );
  });

  it('N1: accepts sum of percents = 100', async function () {
    await expect(deployHIIT([50, 50])).not.to.be.reverted;
  });

  it('F6: onTimeSendResult upper bound now enforced (was missing entirely)', async function () {
    const [, challenger] = await hre.ethers.getSigners();
    const challenge = await deployHIIT([50, 40]);

    await time.increase(60 + 30 * 86400 + 3 * 86400);
    const sig = '0x';
    const data: [number, number] = [0, 0];
    const timeRange: [number, number] = [0, 0];
    await expect(
      challenge
        .connect(challenger)
        .sendDailyResult([], [], [], data, sig, [], [], [], [], [], timeRange)
    ).to.be.revertedWith('Challenge was finished');
  });
});
