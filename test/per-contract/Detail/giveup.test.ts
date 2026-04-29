// 概要（JP）: ChallengeDetail コントラクトの giveUp フロー検証。
// (a) 全額スポンサー返還: sponsor 9 ETH / fee 1 ETH、二重 giveUp は revert。
// (b) 1日達成（cs=1）/ 必要4日: sponsor 6.75 / recv1 1.25 / fee 1 に按分される。
import { expect } from 'chai';
import hre from 'hardhat';
import { time } from '@nomicfoundation/hardhat-toolbox/network-helpers.js';

const SUCCESS_FEE = 5;
const FAIL_FEE = 10;

async function deploy(allAwardToSponsor: boolean) {
  const [, challenger, feeAddr, returnedNFTWallet, sponsor, recv1, recv2] = await hre.ethers.getSigners();
  const MockNFT = await hre.ethers.getContractFactory('MockExerciseSupplementNFT');
  const nft = await MockNFT.deploy(returnedNFTWallet.address, SUCCESS_FEE, FAIL_FEE);
  const Factory = await hre.ethers.getContractFactory('ChallengeDetail');
  const block = await hre.ethers.provider.getBlock('latest');
  const startTime = block!.timestamp + 60;
  const endTime = startTime + 5 * 86400;

  const challenge = await Factory.deploy(
    [sponsor.address, challenger.address, feeAddr.address],
    hre.ethers.ZeroAddress,
    [await nft.getAddress()],
    [5, startTime, endTime, 1000, 4],
    [recv1.address, recv2.address],
    1,
    [true, true, false],
    [0, 0, 0],
    allAwardToSponsor,
    [50, 40],
    hre.ethers.parseEther('10'),
    { value: hre.ethers.parseEther('10') }
  );

  return { challenger, sponsor, feeAddr, recv1, challenge, startTime };
}

describe('T4-C2 — giveUp flow (ChallengeDetail)', function () {
  // (a) allAwardToSponsor=true: sponsor +9 / fee +1、再 giveUp は revert
  it('(a) sponsor=9 ETH, fee=1 ETH', async function () {
    const { challenger, sponsor, feeAddr, challenge, startTime } = await deploy(true);
    await time.increaseTo(startTime + 100);

    const sponsorBefore = await hre.ethers.provider.getBalance(sponsor.address);
    const feeBefore = await hre.ethers.provider.getBalance(feeAddr.address);

    await challenge.connect(challenger).giveUp([], [], [], []);

    expect(await challenge.isFinished()).to.be.true;
    expect(await challenge.getState()).to.equal(3n);
    expect((await hre.ethers.provider.getBalance(sponsor.address)) - sponsorBefore).to.equal(hre.ethers.parseEther('9'));
    expect((await hre.ethers.provider.getBalance(feeAddr.address)) - feeBefore).to.equal(hre.ethers.parseEther('1'));

    await expect(challenge.connect(challenger).giveUp([], [], [], [])).to.be.reverted;
  });

  // (b) 達成1日 / 必要4日 → 比率に応じて sponsor 6.75 / recv1 1.25 / fee 1
  it('(b) cs=1, dayRequired=4: sponsor=6.75, recv1=1.25, fee=1', async function () {
    const { challenger, sponsor, feeAddr, recv1, challenge, startTime } = await deploy(false);
    await time.increaseTo(startTime + 100);

    const sig = '0x';
    const data: [number, number] = [0, 0];
    const range: [number, number] = [0, startTime + 5 * 86400];
    await challenge.connect(challenger).sendDailyResult(
      [startTime + 200], [1500], data, sig, [], [], [], [], [], range,
    );
    expect(await challenge.currentStatus()).to.equal(1n);

    const sponsorBefore = await hre.ethers.provider.getBalance(sponsor.address);
    const recv1Before = await hre.ethers.provider.getBalance(recv1.address);
    const feeBefore = await hre.ethers.provider.getBalance(feeAddr.address);

    await time.increase(60);
    await challenge.connect(challenger).giveUp([], [], [], []);

    expect((await hre.ethers.provider.getBalance(sponsor.address)) - sponsorBefore).to.equal(hre.ethers.parseEther('6.75'));
    expect((await hre.ethers.provider.getBalance(recv1.address)) - recv1Before).to.equal(hre.ethers.parseEther('1.25'));
    expect((await hre.ethers.provider.getBalance(feeAddr.address)) - feeBefore).to.equal(hre.ethers.parseEther('1'));
  });
});
