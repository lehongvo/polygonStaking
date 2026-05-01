// 概要（JP）: ChallengeHIIT の閾値境界テスト（intervals=HI, totalSeconds=HT）。
// 閾値ぴったり / 片方-1 / 両方-1 / 両方+1 の 5 ケースを検証し、
// 達成判定が "≥" の AND 条件で動作することを確認する。
import { expect } from 'chai';
import hre from 'hardhat';
import { time } from '@nomicfoundation/hardhat-toolbox/network-helpers.js';

const SUCCESS_FEE = 5;
const FAIL_FEE = 10;
// HI = highIntensityIntervals 閾値, HT = totalHighIntensityTime 閾値（秒）
const HI = 5;
const HT = 60;

async function deployHIIT() {
  const [, challenger, feeAddr, returnedNFTWallet, sponsor, recv1, recv2] =
    await hre.ethers.getSigners();

  const MockNFT = await hre.ethers.getContractFactory(
    'MockExerciseSupplementNFT'
  );
  const nft = await MockNFT.deploy(
    returnedNFTWallet.address,
    SUCCESS_FEE,
    FAIL_FEE
  );

  const Factory = await hre.ethers.getContractFactory('ChallengeHIIT');
  const block = await hre.ethers.provider.getBlock('latest');
  const startTime = block!.timestamp + 60;
  const duration = 30;
  const endTime = startTime + duration * 86400;
  const primary = [duration, startTime, endTime, HI, HT, 20];

  const challenge = await Factory.deploy(
    [sponsor.address, challenger.address, feeAddr.address],
    hre.ethers.ZeroAddress,
    [await nft.getAddress()],
    primary,
    [recv1.address, recv2.address],
    1,
    [true, true, false],
    [0, 0, 0],
    false,
    [50, 40],
    hre.ethers.parseEther('100'),
    { value: hre.ethers.parseEther('100') }
  );

  return { challenger, challenge, startTime, endTime };
}

describe('T8-C3 — Boundary tests: intervals/totalSeconds thresholds (ChallengeHIIT)', function () {
  // ケース1: 両方ぴったり閾値 → 達成（=1）
  it('Case 1: intervals=5 (exact), totalSeconds=60 (exact) → PASS', async function () {
    const { challenger, challenge, startTime, endTime } = await deployHIIT();
    await time.increaseTo(startTime + 100);
    const day = startTime + 200;
    await challenge
      .connect(challenger)
      .sendDailyResult(
        [day],
        [HI],
        [HT],
        [0, 0],
        '0x',
        [],
        [],
        [],
        [],
        [],
        [0, endTime]
      );
    expect(await challenge.currentStatus()).to.equal(1n);
    expect(await challenge.getHIITAchievedOn(day)).to.equal(1n);
  });

  // ケース2: intervals だけ閾値未満 → 不達成（AND 条件）
  it('Case 2: intervals=4 (-1), totalSeconds=60 → FAIL', async function () {
    const { challenger, challenge, startTime, endTime } = await deployHIIT();
    await time.increaseTo(startTime + 100);
    const day = startTime + 200;
    await challenge
      .connect(challenger)
      .sendDailyResult(
        [day],
        [HI - 1],
        [HT],
        [0, 0],
        '0x',
        [],
        [],
        [],
        [],
        [],
        [0, endTime]
      );
    expect(await challenge.currentStatus()).to.equal(0n);
    expect(await challenge.getHIITAchievedOn(day)).to.equal(0n);
  });

  // ケース3: totalSeconds だけ閾値未満 → 不達成
  it('Case 3: intervals=5, totalSeconds=59 (-1) → FAIL', async function () {
    const { challenger, challenge, startTime, endTime } = await deployHIIT();
    await time.increaseTo(startTime + 100);
    const day = startTime + 200;
    await challenge
      .connect(challenger)
      .sendDailyResult(
        [day],
        [HI],
        [HT - 1],
        [0, 0],
        '0x',
        [],
        [],
        [],
        [],
        [],
        [0, endTime]
      );
    expect(await challenge.currentStatus()).to.equal(0n);
    expect(await challenge.getHIITAchievedOn(day)).to.equal(0n);
  });

  // ケース4: 両方とも閾値未満 → 不達成
  it('Case 4: both -1 → FAIL', async function () {
    const { challenger, challenge, startTime, endTime } = await deployHIIT();
    await time.increaseTo(startTime + 100);
    const day = startTime + 200;
    await challenge
      .connect(challenger)
      .sendDailyResult(
        [day],
        [HI - 1],
        [HT - 1],
        [0, 0],
        '0x',
        [],
        [],
        [],
        [],
        [],
        [0, endTime]
      );
    expect(await challenge.currentStatus()).to.equal(0n);
    expect(await challenge.getHIITAchievedOn(day)).to.equal(0n);
  });

  // ケース5: 両方とも閾値超過 → 達成
  it('Case 5: both +1 → PASS', async function () {
    const { challenger, challenge, startTime, endTime } = await deployHIIT();
    await time.increaseTo(startTime + 100);
    const day = startTime + 200;
    await challenge
      .connect(challenger)
      .sendDailyResult(
        [day],
        [HI + 1],
        [HT + 1],
        [0, 0],
        '0x',
        [],
        [],
        [],
        [],
        [],
        [0, endTime]
      );
    expect(await challenge.currentStatus()).to.equal(1n);
    expect(await challenge.getHIITAchievedOn(day)).to.equal(1n);
  });
});
