// 概要（JP）: 受取人が ETH を送り返してくる悪意あるコントラクトであっても、
// F-A10 ガード（_reentrancyStatus チェック）により無限ループ DoS が
// 起きずに送金処理が完了することを検証する。
import { expect } from 'chai';
import hre from 'hardhat';
import { time } from '@nomicfoundation/hardhat-toolbox/network-helpers.js';

/**
 * T3 — DoS via bouncing receiver (F-A10 guard verification).
 *
 * Setup:
 *   - MockBouncingReceiver as award receiver. On receive(), bounces ETH back
 *     to sender (up to maxBounces=3 in mock).
 *   - With F-A10 guard `_reentrancyStatus != 2`:
 *       During transferToListReceiverSuccess, isFinished=true (CEI), but
 *       _reentrancyStatus=2 (inside nonReentrant). When BR bounces ETH back,
 *       challenge.receive() sees `_reentrancyStatus != 2` is FALSE → silent
 *       accept (no refund). No infinite loop. Outer payout completes.
 *
 * Without F-A10 (hypothetical): challenge.receive() would call
 * tranferCoinNative back, BR fallback bounces again, infinite loop → OOG →
 * entire transferToListReceiverSuccess reverts.
 */

const SUCCESS_FEE = 5;
const FAIL_FEE = 10;

describe('T3 — DoS via bouncing receiver (F-A10)', function () {
  // 修正済み: バウンス（送り返し）受取人がいても成功フローが完走し、
  // バウンス分は challenge コントラクトに静かに保持される（DoS 不可）
  it('Patched: success path completes despite bouncing receiver (no DoS)', async function () {
    const [, challenger, feeAddr, returnedNFTWallet, sponsor, , recv2] =
      await hre.ethers.getSigners();

    const MockNFT = await hre.ethers.getContractFactory(
      'MockExerciseSupplementNFT'
    );
    const nft = await MockNFT.deploy(
      returnedNFTWallet.address,
      SUCCESS_FEE,
      FAIL_FEE
    );

    const Bouncer = await hre.ethers.getContractFactory('MockBouncingReceiver');
    const bouncer = await Bouncer.deploy();
    await bouncer.setEnabled(true); // arm bouncing

    const Factory = await hre.ethers.getContractFactory('ChallengeBaseStep');
    const block = await hre.ethers.provider.getBlock('latest');
    const startTime = block!.timestamp + 60;
    const endTime = startTime + 5 * 86400;

    const challenge = await Factory.deploy(
      [sponsor.address, challenger.address, feeAddr.address],
      hre.ethers.ZeroAddress,
      [await nft.getAddress()],
      [5, startTime, endTime, 1000, 2],
      [await bouncer.getAddress(), recv2.address], // bouncer as success-side receiver
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

    await time.increaseTo(startTime + 100);

    const sig = '0x';
    const data: [number, number] = [0, 0];
    const range: [number, number] = [0, endTime];

    // Day 1 pass
    await challenge
      .connect(challenger)
      .sendDailyResult(
        [startTime + 200],
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

    // Day 2 pass — triggers transferToListReceiverSuccess; bouncer is awardReceivers[0]
    await time.increase(86400);

    const tx = await challenge
      .connect(challenger)
      .sendDailyResult(
        [startTime + 86500],
        [2000],
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
    const receipt = await tx.wait();

    expect(receipt!.status).to.equal(
      1,
      'Outer payout MUST succeed despite bouncing receiver (F-A10 prevents loop)'
    );
    expect(await challenge.isFinished()).to.be.true;
    expect(await challenge.isSuccess()).to.be.true;

    // Bouncer should have attempted at least 1 bounce
    const bounceCount = await bouncer.bounceCount();
    expect(bounceCount).to.be.gte(
      1n,
      'BouncingReceiver should have attempted at least one bounce on receipt'
    );

    // Bouncer's final balance should be 0 (it bounced everything back)
    // The bounced ETH is now in challenge contract (silent accept by receive)
    const bouncerBal = await hre.ethers.provider.getBalance(
      await bouncer.getAddress()
    );
    expect(bouncerBal).to.equal(
      0n,
      'Bouncer ends with 0 ETH (all bounced back); ETH retained in challenge contract'
    );
  });
});
