// 概要（JP）: ChallengeHIIT の giveUp フロー検証。
// (a) allAwardToSponsor=true: sponsor +9 / fee +1、二重 giveUp は revert。
// (b) HIIT 1 日達成（cs=1）/ 必要 4 日 → sponsor 6.75 / recv1 1.25 / fee 1。
import { expect } from 'chai';
import hre from 'hardhat';
import { time } from '@nomicfoundation/hardhat-toolbox/network-helpers.js';

const SUCCESS_FEE = 5;
const FAIL_FEE = 10;

async function deployHIIT(allAwardToSponsor: boolean, dayRequired = 4) {
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
  const duration = 5;
  const endTime = startTime + duration * 86400;
  const primary = [duration, startTime, endTime, 5, 60, dayRequired];

  const challenge = await Factory.deploy(
    [sponsor.address, challenger.address, feeAddr.address],
    hre.ethers.ZeroAddress,
    [await nft.getAddress()],
    primary,
    [recv1.address, recv2.address],
    1,
    [true, true, false],
    [0, 0, 0],
    allAwardToSponsor,
    [50, 40],
    hre.ethers.parseEther('10'),
    { value: hre.ethers.parseEther('10') }
  );

  return {
    challenger,
    sponsor,
    feeAddr,
    recv1,
    recv2,
    challenge,
    startTime,
    endTime,
  };
}

describe('T4-C3 — giveUp flow (ChallengeHIIT)', function () {
  // (a) sponsor +9 / fee +1、GAVE_UP(3) へ遷移、再 giveUp は revert
  it('(a) choiceAwardToSponsor=true: sponsor=9 ETH, fee=1 ETH, second giveUp blocked', async function () {
    const { challenger, sponsor, feeAddr, challenge, startTime } =
      await deployHIIT(true);

    await time.increaseTo(startTime + 100);

    const sponsorBefore = await hre.ethers.provider.getBalance(sponsor.address);
    const feeBefore = await hre.ethers.provider.getBalance(feeAddr.address);

    const tx = await challenge.connect(challenger).giveUp([], [], [], []);
    expect((await tx.wait())!.status).to.equal(1);

    expect(await challenge.isFinished()).to.be.true;
    expect(await challenge.isSuccess()).to.be.false;
    expect(await challenge.getState()).to.equal(3n);

    expect(
      (await hre.ethers.provider.getBalance(sponsor.address)) - sponsorBefore
    ).to.equal(hre.ethers.parseEther('9'));

    expect(
      (await hre.ethers.provider.getBalance(feeAddr.address)) - feeBefore
    ).to.equal(hre.ethers.parseEther('1'));

    await expect(challenge.connect(challenger).giveUp([], [], [], [])).to.be
      .reverted;
  });

  // (b) HIIT 1 日達成 / 必要 4 日 → 比率に応じて sponsor 6.75 / recv1 1.25 / fee 1
  it('(b) choiceAwardToSponsor=false: cs=1 / dayRequired=4 → sponsor=6.75, recv1=1.25, fee=1', async function () {
    const {
      challenger,
      sponsor,
      feeAddr,
      recv1,
      challenge,
      startTime,
      endTime,
    } = await deployHIIT(false, 4);

    await time.increaseTo(startTime + 100);

    const sig = '0x';
    const data: [number, number] = [0, 0];
    const range: [number, number] = [0, endTime];

    await challenge
      .connect(challenger)
      .sendDailyResult(
        [startTime + 200],
        [5],
        [60],
        data,
        sig,
        [],
        [],
        [],
        [],
        [],
        range
      );
    expect(await challenge.currentStatus()).to.equal(1n);

    const sponsorBefore = await hre.ethers.provider.getBalance(sponsor.address);
    const recv1Before = await hre.ethers.provider.getBalance(recv1.address);
    const feeBefore = await hre.ethers.provider.getBalance(feeAddr.address);

    await time.increase(60);
    const tx = await challenge.connect(challenger).giveUp([], [], [], []);
    expect((await tx.wait())!.status).to.equal(1);

    expect(await challenge.isFinished()).to.be.true;

    expect(
      (await hre.ethers.provider.getBalance(sponsor.address)) - sponsorBefore
    ).to.equal(hre.ethers.parseEther('6.75'));

    expect(
      (await hre.ethers.provider.getBalance(recv1.address)) - recv1Before
    ).to.equal(hre.ethers.parseEther('1.25'));

    expect(
      (await hre.ethers.provider.getBalance(feeAddr.address)) - feeBefore
    ).to.equal(hre.ethers.parseEther('1'));
  });
});
