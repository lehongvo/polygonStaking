// 概要（JP）: ChallengeDetail（Detail コントラクト）の失敗確定フロー検証。
// (a) 期間終了 + 2 日後に closeChallenge を実行 → CLOSED 状態に遷移し
//     失敗側受取人と feeAddr に正しい比率で支払いが行われる。
// (b) 連続失敗の閾値超過後、最終日提出（narrowRange）で失敗確定する内部トリガを確認。
import { expect } from 'chai';
import hre from 'hardhat';
import { time } from '@nomicfoundation/hardhat-toolbox/network-helpers.js';

const SUCCESS_FEE = 5;
const FAIL_FEE = 10;

async function deploy() {
  const [, challenger, feeAddr, returnedNFTWallet, sponsor, recv1, recv2] = await hre.ethers.getSigners();
  const MockNFT = await hre.ethers.getContractFactory('MockExerciseSupplementNFT');
  const nft = await MockNFT.deploy(returnedNFTWallet.address, SUCCESS_FEE, FAIL_FEE);
  const Factory = await hre.ethers.getContractFactory('ChallengeDetail');
  const block = await hre.ethers.provider.getBlock('latest');
  const startTime = block!.timestamp + 60;
  const duration = 5;
  const endTime = startTime + duration * 86400;

  const challenge = await Factory.deploy(
    [sponsor.address, challenger.address, feeAddr.address],
    hre.ethers.ZeroAddress,
    [await nft.getAddress()],
    [duration, startTime, endTime, 1000, 4],
    [recv1.address, recv2.address],
    1,
    [true, true, false],
    [0, 0, 0],
    false,
    [50, 40],
    hre.ethers.parseEther('10'),
    { value: hre.ethers.parseEther('10') }
  );

  return { challenger, sponsor, feeAddr, recv2, challenge, startTime, endTime };
}

describe('T5-C2 — closeChallenge + fail trigger (ChallengeDetail)', function () {
  // (a) 終了 + 2 日後に closeChallenge → CLOSED(4) / recv2 = 4 ETH / fee = 1 ETH
  it('(a) closeChallenge after endTime+2days: state=CLOSED, recv2=4 ETH, fee=1 ETH', async function () {
    const { sponsor, feeAddr, recv2, challenge, endTime } = await deploy();

    await time.increaseTo(endTime + 2 * 86400 + 100);

    const recv2Before = await hre.ethers.provider.getBalance(recv2.address);
    const feeBefore = await hre.ethers.provider.getBalance(feeAddr.address);

    await challenge.connect(sponsor).closeChallenge([], [], [], []);

    expect(await challenge.isFinished()).to.be.true;
    expect(await challenge.getState()).to.equal(4n);
    expect((await hre.ethers.provider.getBalance(recv2.address)) - recv2Before).to.equal(hre.ethers.parseEther('4'));
    expect((await hre.ethers.provider.getBalance(feeAddr.address)) - feeBefore).to.equal(hre.ethers.parseEther('1'));
  });

  // (b) 失敗トリガ: 失敗4日 + 最終日 narrowRange で sendDailyResult 内に失敗確定
  it('(b) Fail trigger: 4 fail days (broadRange) + 1 pass (narrowRange)', async function () {
    const { challenger, feeAddr, recv2, challenge, startTime, endTime } = await deploy();
    await time.increaseTo(startTime + 100);

    const sig = '0x';
    const data: [number, number] = [0, 0];
    const broadRange: [number, number] = [0, endTime];
    const narrowRange: [number, number] = [0, 0];

    for (let i = 0; i < 4; i++) {
      await challenge.connect(challenger).sendDailyResult(
        [startTime + 200 + i * 86400], [500], data, sig, [], [], [], [], [], broadRange,
      );
      await time.increase(86400);
    }
    expect(await challenge.isFinished()).to.be.false;

    const recv2Before = await hre.ethers.provider.getBalance(recv2.address);
    const feeBefore = await hre.ethers.provider.getBalance(feeAddr.address);

    await challenge.connect(challenger).sendDailyResult(
      [startTime + 200 + 4 * 86400], [1500], data, sig, [], [], [], [], [], narrowRange,
    );

    expect(await challenge.isFinished()).to.be.true;
    expect(await challenge.getState()).to.equal(2n);
    expect((await hre.ethers.provider.getBalance(recv2.address)) - recv2Before).to.equal(hre.ethers.parseEther('4'));
    expect((await hre.ethers.provider.getBalance(feeAddr.address)) - feeBefore).to.equal(hre.ethers.parseEther('1'));
  });
});
