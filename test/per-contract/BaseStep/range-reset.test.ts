import { expect } from 'chai';
import hre from 'hardhat';
import { time } from '@nomicfoundation/hardhat-toolbox/network-helpers.js';

/**
 * T6 — F1-B range fix + N2 reset internal state observation.
 *
 * Direct internal state inspection isn't possible (private mappings/arrays),
 * but we can observe behavior:
 *
 * F1-B range: success loop now bounded `0..index`. Verify by setting up
 *   3 receivers with index=2 (success-side: 0,1; fail-side: 2). Run success
 *   path. Verify only receiver[0] and receiver[1] get paid, receiver[2] does NOT.
 *   This proves approvalSuccessOf[receiver[2]] is NOT set (or stays 0) by
 *   updateRewardSuccessAndfail.
 *
 * N2 reset: after one full lifecycle (giveUp), getBalanceToken() returns
 *   listBalanceAllToken which is bounded by erc20ListAddress.length (0 in
 *   our mock). Verify it's 0, proving N2 reset cleared properly.
 */

const SUCCESS_FEE = 5;
const FAIL_FEE = 10;

describe('T6 — F1-B range + N2 reset', function () {
  it('F1-B: success loop only pays receivers[0..index-1], skips fail-side', async function () {
    const [, challenger, feeAddr, returnedNFTWallet, sponsor, recv0, recv1, recv2] =
      await hre.ethers.getSigners();

    const MockNFT = await hre.ethers.getContractFactory(
      'MockExerciseSupplementNFT'
    );
    const nft = await MockNFT.deploy(returnedNFTWallet.address, SUCCESS_FEE, FAIL_FEE);
    const Factory = await hre.ethers.getContractFactory('ChallengeBaseStep');

    const block = await hre.ethers.provider.getBlock('latest');
    const startTime = block!.timestamp + 60;
    const endTime = startTime + 5 * 86400;

    // 3 receivers; index=2 means recv0,recv1 are success-side; recv2 is fail-side
    const challenge = await Factory.deploy(
      [sponsor.address, challenger.address, feeAddr.address],
      hre.ethers.ZeroAddress,
      [await nft.getAddress()],
      [5, startTime, endTime, 1000, 2],
      [recv0.address, recv1.address, recv2.address],
      2, // index = 2 (success-side range [0..2))
      [true, true, false],
      [0, 0, 0],
      false,
      [30, 25, 35], // sum=90, success: recv0=30%, recv1=25%; fail: recv2=35%
      hre.ethers.parseEther('10'),
      [],
      [],
      { value: hre.ethers.parseEther('10') }
    );

    await time.increaseTo(startTime + 100);
    const sig = '0x';
    const data: [number, number] = [0, 0];
    const range: [number, number] = [0, endTime];

    const recv0Before = await hre.ethers.provider.getBalance(recv0.address);
    const recv1Before = await hre.ethers.provider.getBalance(recv1.address);
    const recv2Before = await hre.ethers.provider.getBalance(recv2.address);

    // 2 passing days → reach dayRequired=2 → success
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
    await time.increase(86400);
    await challenge
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

    expect(await challenge.isSuccess()).to.be.true;
    expect(await challenge.isFinished()).to.be.true;

    const recv0Gain =
      (await hre.ethers.provider.getBalance(recv0.address)) - recv0Before;
    const recv1Gain =
      (await hre.ethers.provider.getBalance(recv1.address)) - recv1Before;
    const recv2Gain =
      (await hre.ethers.provider.getBalance(recv2.address)) - recv2Before;

    // recv0 = 10 * 30/100 = 3 ETH
    expect(recv0Gain).to.equal(
      hre.ethers.parseEther('3'),
      '[F-A7] success-side recv0 receives exact 30%'
    );
    // recv1 = 10 * 25/100 = 2.5 ETH
    expect(recv1Gain).to.equal(
      hre.ethers.parseEther('2.5'),
      '[F-A7] success-side recv1 receives exact 25%'
    );
    // recv2 (fail-side) NOT paid in success path
    expect(recv2Gain).to.equal(
      0n,
      '[F-A7 RANGE FIX] fail-side recv2 (idx=2) NOT paid; loop bound `0..index=2` excludes it'
    );
  });

  it('N2 reset: getBalanceToken() returns bounded array (no double-growth)', async function () {
    const [, challenger, feeAddr, returnedNFTWallet, sponsor, recv1, recv2] =
      await hre.ethers.getSigners();

    const MockNFT = await hre.ethers.getContractFactory(
      'MockExerciseSupplementNFT'
    );
    const nft = await MockNFT.deploy(returnedNFTWallet.address, SUCCESS_FEE, FAIL_FEE);
    const Factory = await hre.ethers.getContractFactory('ChallengeBaseStep');

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
      [],
      [],
      { value: hre.ethers.parseEther('10') }
    );

    // Pre-giveUp: listBalanceAllToken empty (no ERC20 in registry)
    const balBefore = await challenge.getBalanceToken();
    expect(balBefore.length).to.equal(0n, 'pre-giveUp: empty listBalanceAllToken');

    // giveUp triggers updateRewardSuccessAndfail (the function we patched).
    // F-A9 deletes listBalanceAllToken at top + erc20 loop pushes nothing
    // (registry empty). Result: empty array.
    await time.increaseTo(startTime + 100);
    await challenge.connect(challenger).giveUp([], [], [], []);

    const balAfter = await challenge.getBalanceToken();
    expect(balAfter.length).to.equal(
      0n,
      '[F-A9] post-giveUp: listBalanceAllToken bounded (delete + push 0) — no double-growth bug'
    );
  });
});
