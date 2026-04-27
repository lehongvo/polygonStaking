import { expect } from 'chai';
import hre from 'hardhat';
import { time } from '@nomicfoundation/hardhat-toolbox/network-helpers.js';

const SUCCESS_FEE = 5;
const FAIL_FEE = 10;

describe('T6-C2 — F1-B range + N2 reset (ChallengeDetail)', function () {
  it('F1-B: success loop pays only [0..index-1]; recv2 (idx=2 fail-side) gets 0', async function () {
    const [, challenger, feeAddr, returnedNFTWallet, sponsor, recv0, recv1, recv2] = await hre.ethers.getSigners();
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
      [5, startTime, endTime, 1000, 2],
      [recv0.address, recv1.address, recv2.address],
      2,
      [true, true, false],
      [0, 0, 0],
      false,
      [30, 25, 35],
      hre.ethers.parseEther('10'),
      { value: hre.ethers.parseEther('10') }
    );

    await time.increaseTo(startTime + 100);
    const sig = '0x';
    const data: [number, number] = [0, 0];
    const broadRange: [number, number] = [0, endTime];
    const narrowRange: [number, number] = [0, 0];

    const recv0Before = await hre.ethers.provider.getBalance(recv0.address);
    const recv1Before = await hre.ethers.provider.getBalance(recv1.address);
    const recv2Before = await hre.ethers.provider.getBalance(recv2.address);

    await challenge.connect(challenger).sendDailyResult(
      [startTime + 200], [1500], data, sig, [], [], [], [], [], broadRange,
    );
    await time.increase(86400);
    await challenge.connect(challenger).sendDailyResult(
      [startTime + 86500], [2000], data, sig, [], [], [], [], [], narrowRange,
    );

    expect(await challenge.isSuccess()).to.be.true;

    expect((await hre.ethers.provider.getBalance(recv0.address)) - recv0Before).to.equal(hre.ethers.parseEther('3'));
    expect((await hre.ethers.provider.getBalance(recv1.address)) - recv1Before).to.equal(hre.ethers.parseEther('2.5'));
    expect((await hre.ethers.provider.getBalance(recv2.address)) - recv2Before).to.equal(0n);
  });

  it('N2 reset: getBalanceToken().length == 0 post-giveUp (no ERC20 in registry)', async function () {
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
      [5, startTime, endTime, 1000, 2],
      [recv1.address, recv2.address],
      1,
      [true, true, false],
      [0, 0, 0],
      true,
      [50, 40],
      hre.ethers.parseEther('10'),
      { value: hre.ethers.parseEther('10') }
    );

    await time.increaseTo(startTime + 100);
    await challenge.connect(challenger).giveUp([], [], [], []);

    const balances = await challenge.getBalanceToken();
    expect(balances.length).to.equal(0n);
  });
});
