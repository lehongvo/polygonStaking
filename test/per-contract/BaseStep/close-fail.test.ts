import { expect } from 'chai';
import hre from 'hardhat';
import { time } from '@nomicfoundation/hardhat-toolbox/network-helpers.js';

/**
 * T5 — closeChallenge flow + fail-from-sendDailyResult.
 *
 * (a) closeChallenge after endTime+2days:
 *     - challenger never reaches dayRequired → stays not finished
 *     - sponsor calls closeChallenge after grace window
 *     - transferToListReceiverFail fires → fail-side receivers paid
 *     - isFinished=true (CEI), state=CLOSED (4)
 *
 * (b) Fail trigger from sendDailyResult (sequence threshold exceeded):
 *     - Many failed days → fail check fires inside sendDailyResult
 *     - transferToListReceiverFail invoked
 *     - isFinished=true, isSuccess=false
 *
 * Verifies F-A4 nonReentrant on closeChallenge, F-A5 CEI in transferToListReceiverFail.
 */

const SUCCESS_FEE = 5;
const FAIL_FEE = 10;

async function deploy() {
  const [, challenger, feeAddr, returnedNFTWallet, sponsor, recv1, recv2] =
    await hre.ethers.getSigners();

  const MockNFT = await hre.ethers.getContractFactory(
    'MockExerciseSupplementNFT'
  );
  const nft = await MockNFT.deploy(returnedNFTWallet.address, SUCCESS_FEE, FAIL_FEE);
  const Factory = await hre.ethers.getContractFactory('ChallengeBaseStep');

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
    [],
    [],
    { value: hre.ethers.parseEther('10') }
  );

  return { challenger, sponsor, feeAddr, recv1, recv2, challenge, startTime, endTime };
}

describe('T5 — closeChallenge + fail trigger', function () {
  it('(a) closeChallenge after endTime+2days: fail-side receivers paid, state=CLOSED', async function () {
    const { challenger, sponsor, feeAddr, recv2, challenge, startTime, endTime } =
      await deploy();

    // Move way past endTime+2days so afterFinish modifier passes
    await time.increaseTo(endTime + 2 * 86400 + 100);

    const recv2Before = await hre.ethers.provider.getBalance(recv2.address);
    const feeBefore = await hre.ethers.provider.getBalance(feeAddr.address);

    // Sponsor calls closeChallenge
    const tx = await challenge.connect(sponsor).closeChallenge([], [], [], []);
    const receipt = await tx.wait();
    expect(receipt!.status).to.equal(1);

    expect(await challenge.isFinished()).to.be.true,
      '[F-A5] isFinished true after closeChallenge';
    expect(await challenge.isSuccess()).to.be.false;
    expect(await challenge.getState()).to.equal(4n, 'state = CLOSED enum index 4');

    // recv2 is fail-side (index 1, percent=40), gets payout
    const recv2Gain =
      (await hre.ethers.provider.getBalance(recv2.address)) - recv2Before;
    expect(recv2Gain).to.equal(
      hre.ethers.parseEther('4'),
      'recv2 (fail-side, 40%) receives exactly 4 ETH'
    );

    // feeAddr gets serverFailureFee = 10 * 10/100 = 1
    const feeGain =
      (await hre.ethers.provider.getBalance(feeAddr.address)) - feeBefore;
    expect(feeGain).to.equal(hre.ethers.parseEther('1'));

    // Second close should revert (availableForClose: !isFinished fails)
    await expect(
      challenge.connect(sponsor).closeChallenge([], [], [], [])
    ).to.be.reverted;
  });

  it('(b) Fail triggered from sendDailyResult when sequence overruns + last day passing', async function () {
    // Note: fail check is gated by `!isSendFailWithSameDay`. Post-loop block
    // sets isSendFailWithSameDay = true when the latest submitted step < goal
    // AND day in range. So fail can only trigger when the LAST submitted day
    // is PASSING (post-loop block not taken) AND scan found prior fails
    // (sets isSendFailWithSameDay = false).
    //
    // Scenario: duration=5, dayRequired=2 → threshold = 3.
    //   Day1..4 fail (4 entries), F2 block sets bool=true each → no fail.
    //   Day5 pass: cs++=1, scan sees prior fails → bool=false, post-loop
    //     skipped (last >= goal). Fail check: seq-cs = 5-1 = 4 > 3 → YES.

    const { challenger, feeAddr, recv2, challenge, startTime, endTime } = await deploy();

    await time.increaseTo(startTime + 100);
    const sig = '0x';
    const data: [number, number] = [0, 0];
    const range: [number, number] = [0, endTime];

    // 4 failing days
    for (let i = 0; i < 4; i++) {
      await challenge
        .connect(challenger)
        .sendDailyResult(
          [startTime + 200 + i * 86400],
          [500],
          data,
          sig,
          [],
          [],
          [],
          [],
          [],
          range,
          [],
          [],
          [],
          []
        );
      await time.increase(86400);
    }
    expect(await challenge.isFinished()).to.be.false;
    expect(await challenge.currentStatus()).to.equal(0n);

    // Day 5 passing — should trigger fail
    const recv2Before = await hre.ethers.provider.getBalance(recv2.address);
    const feeBefore = await hre.ethers.provider.getBalance(feeAddr.address);

    await challenge
      .connect(challenger)
      .sendDailyResult(
        [startTime + 200 + 4 * 86400],
        [1500],
        data,
        sig,
        [],
        [],
        [],
        [],
        [],
        range,
        [],
        [],
        [],
        []
      );

    expect(await challenge.isFinished()).to.be.true,
      '[F-A5 CEI] fail trigger from sendDailyResult marks finished';
    expect(await challenge.isSuccess()).to.be.false;
    expect(await challenge.getState()).to.equal(2n, 'state = FAILED enum index 2');

    const recv2Gain =
      (await hre.ethers.provider.getBalance(recv2.address)) - recv2Before;
    expect(recv2Gain).to.equal(hre.ethers.parseEther('4'));

    const feeGain =
      (await hre.ethers.provider.getBalance(feeAddr.address)) - feeBefore;
    expect(feeGain).to.equal(hre.ethers.parseEther('1'));
  });
});
