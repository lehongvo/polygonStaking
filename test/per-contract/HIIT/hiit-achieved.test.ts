import { expect } from 'chai';
import hre from 'hardhat';
import { time } from '@nomicfoundation/hardhat-toolbox/network-helpers.js';

const SUCCESS_FEE = 5;
const FAIL_FEE = 10;

async function deployHIIT() {
  const [, challenger, feeAddr, returnedNFTWallet, sponsor, recv1, recv2] =
    await hre.ethers.getSigners();

  const MockNFT = await hre.ethers.getContractFactory('MockExerciseSupplementNFT');
  const nft = await MockNFT.deploy(returnedNFTWallet.address, SUCCESS_FEE, FAIL_FEE);

  const Factory = await hre.ethers.getContractFactory('ChallengeHIIT');
  const block = await hre.ethers.provider.getBlock('latest');
  const startTime = block!.timestamp + 60;
  const duration = 30;
  const endTime = startTime + duration * 86400;
  const primary = [duration, startTime, endTime, 5, 60, 20];

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

describe('T7-C3 — HIIT achieved logic: both thresholds required (ChallengeHIIT)', function () {
  it('currentStatus increments only when BOTH intervals AND totalSeconds >= their thresholds', async function () {
    const { challenger, challenge, startTime, endTime } = await deployHIIT();

    await time.increaseTo(startTime + 100);
    const sig = '0x';
    const data: [number, number] = [0, 0];
    const range: [number, number] = [0, endTime];

    const [hiIntervals, hiTime] = await challenge.getHIITConfig();
    expect(hiIntervals).to.equal(5n);
    expect(hiTime).to.equal(60n);

    const day1 = startTime + 200;
    await challenge.connect(challenger).sendDailyResult([day1], [5], [60], data, sig, [], [], [], [], [], range);
    expect(await challenge.currentStatus()).to.equal(1n);
    expect(await challenge.getHIITAchievedOn(day1)).to.equal(1n);

    await time.increase(86400);
    const day2 = startTime + 200 + 86400;
    await challenge.connect(challenger).sendDailyResult([day2], [10], [59], data, sig, [], [], [], [], [], range);
    expect(await challenge.currentStatus()).to.equal(1n);
    expect(await challenge.getHIITAchievedOn(day2)).to.equal(0n);

    await time.increase(86400);
    const day3 = startTime + 200 + 2 * 86400;
    await challenge.connect(challenger).sendDailyResult([day3], [4], [100], data, sig, [], [], [], [], [], range);
    expect(await challenge.currentStatus()).to.equal(1n);
    expect(await challenge.getHIITAchievedOn(day3)).to.equal(0n);

    await time.increase(86400);
    const day4 = startTime + 200 + 3 * 86400;
    await challenge.connect(challenger).sendDailyResult([day4], [4], [59], data, sig, [], [], [], [], [], range);
    expect(await challenge.currentStatus()).to.equal(1n);
    expect(await challenge.getHIITAchievedOn(day4)).to.equal(0n);
  });

  it('getHIITHistory records intervals and totalSeconds raw values per submission', async function () {
    const { challenger, challenge, startTime, endTime } = await deployHIIT();

    await time.increaseTo(startTime + 100);
    const sig = '0x';
    const data: [number, number] = [0, 0];
    const range: [number, number] = [0, endTime];

    const day1 = startTime + 200;
    await challenge.connect(challenger).sendDailyResult([day1], [7], [90], data, sig, [], [], [], [], [], range);

    const [dates, achieved, intervals, totalSecs] = await challenge.getHIITHistory();
    expect(dates.length).to.equal(1);
    expect(achieved[0]).to.equal(1n);
    expect(intervals[0]).to.equal(7n);
    expect(totalSecs[0]).to.equal(90n);
  });
});
