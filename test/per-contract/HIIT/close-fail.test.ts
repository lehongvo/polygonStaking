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
  const duration = 5;
  const endTime = startTime + duration * 86400;
  const primary = [duration, startTime, endTime, 5, 60, 2];

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
    hre.ethers.parseEther('10'),
    { value: hre.ethers.parseEther('10') }
  );

  return { challenger, sponsor, feeAddr, recv1, recv2, challenge, startTime, endTime };
}

describe('T5-C3 — closeChallenge + fail trigger (ChallengeHIIT)', function () {
  it('(a) closeChallenge after endTime+2days: state=CLOSED, recv2=4 ETH, fee=1 ETH', async function () {
    const { sponsor, feeAddr, recv2, challenge, endTime } = await deployHIIT();

    await time.increaseTo(endTime + 2 * 86400 + 100);

    const recv2Before = await hre.ethers.provider.getBalance(recv2.address);
    const feeBefore = await hre.ethers.provider.getBalance(feeAddr.address);

    const tx = await challenge.connect(sponsor).closeChallenge([], [], [], []);
    expect((await tx.wait())!.status).to.equal(1);

    expect(await challenge.isFinished()).to.be.true;
    expect(await challenge.isSuccess()).to.be.false;
    expect(await challenge.getState()).to.equal(4n);

    expect(
      (await hre.ethers.provider.getBalance(recv2.address)) - recv2Before
    ).to.equal(hre.ethers.parseEther('4'));

    expect(
      (await hre.ethers.provider.getBalance(feeAddr.address)) - feeBefore
    ).to.equal(hre.ethers.parseEther('1'));

    await expect(challenge.connect(sponsor).closeChallenge([], [], [], [])).to.be.reverted;
  });

  it('(b) Fail triggers from sendDailyResult: 4 failing HIIT days + 1 passing day', async function () {
    const { challenger, feeAddr, recv2, challenge, startTime, endTime } = await deployHIIT();

    await time.increaseTo(startTime + 100);

    const sig = '0x';
    const data: [number, number] = [0, 0];
    const range: [number, number] = [0, endTime];

    for (let i = 0; i < 4; i++) {
      await challenge.connect(challenger).sendDailyResult(
        [startTime + 200 + i * 86400], [1], [10], data, sig, [], [], [], [], [], range
      );
      await time.increase(86400);
    }

    expect(await challenge.isFinished()).to.be.false;
    expect(await challenge.currentStatus()).to.equal(0n);

    const recv2Before = await hre.ethers.provider.getBalance(recv2.address);
    const feeBefore = await hre.ethers.provider.getBalance(feeAddr.address);

    await challenge.connect(challenger).sendDailyResult(
      [startTime + 200 + 4 * 86400], [5], [60], data, sig, [], [], [], [], [], range
    );

    expect(await challenge.isFinished()).to.be.true;
    expect(await challenge.isSuccess()).to.be.false;
    expect(await challenge.getState()).to.equal(2n);

    expect(
      (await hre.ethers.provider.getBalance(recv2.address)) - recv2Before
    ).to.equal(hre.ethers.parseEther('4'));

    expect(
      (await hre.ethers.provider.getBalance(feeAddr.address)) - feeBefore
    ).to.equal(hre.ethers.parseEther('1'));
  });
});
