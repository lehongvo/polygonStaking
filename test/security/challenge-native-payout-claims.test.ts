// CHALLENGE-2825: every Challenge variant pushed native payouts (fee/sponsor/award receiver)
// synchronously during terminal settlement via tranferCoinNative -> TransferHelper.saveTransferEth,
// which reverted the ENTIRE transaction if the recipient's receive/fallback rejected the funds.
// Since terminal state (isFinished/isSuccess/accounting) was set in the SAME transaction, one
// legitimate-but-rejecting recipient could permanently block success/fail/giveUp finalization for
// every other participant -- and every retry would hit the same rejecting recipient.
//
// Fix: tranferCoinNative now tries the push but, on failure, CREDITS the recipient's balance in
// a per-contract _pendingNativeClaims ledger and emits NativePayoutCredited instead of reverting.
// The credited recipient (or anyone acting on their behalf) can later pull the funds via
// claimPendingNative(), which follows checks-effects-interactions (zeroes the claim before the
// external call) so a still-failing claim leaves the balance retryable rather than lost, and a
// successful claim can never be replayed.
//
// This suite proves, for a representative spread of the six variants (the fix is a byte-identical
// diff to the single shared tranferCoinNative/claimPendingNative implementation in all six files):
//   - a rejecting fee/award-receiver/sponsor no longer blocks settlement (no revert, terminal
//     state IS committed);
//   - the exact amount owed is credited and later claimable;
//   - other (non-rejecting) recipients in the SAME settlement are paid immediately, unaffected;
//   - a claim that still fails (recipient still rejecting) reverts but leaves the balance
//     retryable -- never lost, never silently dropped;
//   - a successful claim zeroes the balance and cannot be claimed again;
//   - conservation holds: fee + receiver payouts + credited claims + remaining dust == gross.
import { expect } from 'chai';
import hre from 'hardhat';
import { time } from '@nomicfoundation/hardhat-toolbox/network-helpers.js';
import {
  deployChallenge,
  sendStep,
  moveToStart,
  moveAfterEnd,
} from '../helpers/deployHelpers.ts';

type ContractName = 'ChallengeBaseStep' | 'ChallengeDetail' | 'ChallengeHIIT';

async function deployRejectingReceiver() {
  const F = await hre.ethers.getContractFactory('MockRejectingReceiver');
  return F.deploy();
}

describe('CHALLENGE-2825: reverting native payout receivers cannot block challenge finalization', () => {
  const HELPER_CONTRACTS: ContractName[] = ['ChallengeBaseStep', 'ChallengeDetail', 'ChallengeHIIT'];

  for (const name of HELPER_CONTRACTS) {
    describe(name, () => {
      it('SUCCESS settlement does not revert when the fee AND an award receiver both reject ETH; both are credited, a non-rejecting receiver is paid immediately', async function () {
        const rejectingFee = await deployRejectingReceiver();
        const rejectingRecv = await deployRejectingReceiver();
        const signers = await hre.ethers.getSigners();
        const normalRecv = signers[6];

        const opts: any = {
          awardReceiversPercent: [70, 30], // sums to 100% of net -- no dust, simplifies conservation check
          receivers: [await rejectingRecv.getAddress(), normalRecv.address],
          index: 2,
          goal: 1000,
          dayRequired: 1,
          feeAddr: await rejectingFee.getAddress(),
          totalAmount: hre.ethers.parseEther('100'),
        };
        if (name === 'ChallengeHIIT') {
          opts.highIntensityIntervals = 5;
          opts.totalHighIntensityTime = 60;
        }
        const { challenge, signers: s, startTime } = await deployChallenge(name, opts);
        const challengeAddr = await challenge.getAddress();
        const normalBefore = await hre.ethers.provider.getBalance(normalRecv.address);

        await moveToStart(startTime);
        await expect(
          sendStep(challenge, name, s[1], {
            day: startTime + 300,
            steps: 1001,
            intervals: name === 'ChallengeHIIT' ? 5 : undefined,
            totalSeconds: name === 'ChallengeHIIT' ? 60 : undefined,
          })
        ).to.not.be.reverted; // core assertion: a rejecting fee/receiver must NOT block settlement

        expect(await challenge.isSuccess()).to.equal(true);
        expect(await challenge.isFinished()).to.equal(true);

        // fee = 100 * 5/100 = 5; net = 95; recv0(70%) = 66.5 (rejecting); recv1(30%) = 28.5 (normal, paid)
        const feeCredited = await challenge.pendingNativeClaim(await rejectingFee.getAddress());
        const recvCredited = await challenge.pendingNativeClaim(await rejectingRecv.getAddress());
        expect(feeCredited).to.equal(hre.ethers.parseEther('5'));
        expect(recvCredited).to.equal(hre.ethers.parseEther('66.5'));

        const normalGain = (await hre.ethers.provider.getBalance(normalRecv.address)) - normalBefore;
        expect(normalGain).to.equal(hre.ethers.parseEther('28.5'));

        // Conservation: nothing lost or double-spent -- the contract still holds exactly the
        // credited-but-unclaimed amounts.
        expect(await hre.ethers.provider.getBalance(challengeAddr)).to.equal(feeCredited + recvCredited);
      });

      it('claimPendingNative delivers the credited amount once the recipient stops rejecting, and zeroes the claim (no double payment)', async function () {
        const rejectingFee = await deployRejectingReceiver();
        const opts: any = {
          awardReceiversPercent: [100],
          index: 1,
          goal: 1000,
          dayRequired: 1,
          feeAddr: await rejectingFee.getAddress(),
          totalAmount: hre.ethers.parseEther('100'),
        };
        if (name === 'ChallengeHIIT') {
          opts.highIntensityIntervals = 5;
          opts.totalHighIntensityTime = 60;
        }
        const { challenge, signers: s, startTime } = await deployChallenge(name, opts);
        const challengeAddr = await challenge.getAddress();

        await moveToStart(startTime);
        await sendStep(challenge, name, s[1], {
          day: startTime + 300,
          steps: 1001,
          intervals: name === 'ChallengeHIIT' ? 5 : undefined,
          totalSeconds: name === 'ChallengeHIIT' ? 60 : undefined,
        });

        const feeAddr = await rejectingFee.getAddress();
        const credited = await challenge.pendingNativeClaim(feeAddr);
        expect(credited).to.equal(hre.ethers.parseEther('5'));

        // Still rejecting: claim must fail-safe, leaving the balance retryable (not lost).
        const claimData = challenge.interface.encodeFunctionData('claimPendingNative');
        await expect(rejectingFee.call(challengeAddr, claimData)).to.be.reverted;
        expect(await challenge.pendingNativeClaim(feeAddr)).to.equal(credited);

        // Now accept ETH and retry: the exact credited amount is delivered and zeroed.
        await rejectingFee.setReject(false);
        const balBefore = await hre.ethers.provider.getBalance(feeAddr);
        const tx = await rejectingFee.call(challengeAddr, claimData);
        await tx.wait();
        const balAfter = await hre.ethers.provider.getBalance(feeAddr);
        expect(balAfter - balBefore).to.equal(credited);
        expect(await challenge.pendingNativeClaim(feeAddr)).to.equal(0n);
        expect(await hre.ethers.provider.getBalance(challengeAddr)).to.equal(0n);

        // Cannot be claimed again -- reverts with NoPendingNativeClaim (no pending balance).
        await expect(rejectingFee.call(challengeAddr, claimData)).to.be.reverted;
      });

      it('claimPendingNative reverts with no state change when there is nothing pending for the caller', async () => {
        const opts: any = {
          awardReceiversPercent: [100],
          index: 1,
          goal: 1000,
          dayRequired: 1,
        };
        if (name === 'ChallengeHIIT') {
          opts.highIntensityIntervals = 5;
          opts.totalHighIntensityTime = 60;
        }
        const { challenge } = await deployChallenge(name, opts);
        const [someone] = await hre.ethers.getSigners();
        await expect(challenge.connect(someone).claimPendingNative()).to.be.reverted;
      });
    });
  }

  describe('ChallengeBaseStep: FAIL (closeChallenge) and GIVE_UP paths', () => {
    it('FAIL settlement (closeChallenge) does not revert when the fee rejects ETH; it is credited instead', async function () {
      const rejectingFee = await deployRejectingReceiver();
      const { challenge, signers, endTime } = await deployChallenge('ChallengeBaseStep', {
        awardReceiversPercent: [1, 100], // [0]=dummy success-side (never paid), [1]=100% fail-side
        index: 1,
        goal: 1000,
        dayRequired: 5,
        duration: 5,
        feeAddr: await rejectingFee.getAddress(),
        totalAmount: hre.ethers.parseEther('100'),
      });
      await time.increaseTo(endTime + 2 * 86400 + 100);

      await expect(challenge.connect(signers[0]).closeChallenge([], [], [], [])).to.not.be.reverted;

      expect(await challenge.isSuccess()).to.equal(false);
      expect(await challenge.isFinished()).to.equal(true);
      expect(await challenge.pendingNativeClaim(await rejectingFee.getAddress())).to.equal(
        hre.ethers.parseEther('10') // FAIL_FEE 10% of 100
      );
    });

    it('GIVE_UP does not revert when the sponsor (choiceAwardToSponsor=true) rejects ETH; credited for later claim', async function () {
      const rejectingSponsor = await deployRejectingReceiver();
      const sponsorAddr = await rejectingSponsor.getAddress();
      const { challenge, signers, startTime } = await deployChallenge('ChallengeBaseStep', {
        awardReceiversPercent: [100],
        index: 1,
        goal: 1000,
        dayRequired: 20,
        duration: 30,
        sponsor: sponsorAddr,
        allAwardToSponsor: true, // choiceAwardToSponsor branch: tranferCoinNative(sponsor, amount) directly
        totalAmount: hre.ethers.parseEther('100'),
      });
      const challengeAddr = await challenge.getAddress();
      const challenger = signers[1];

      await moveToStart(startTime);
      await expect(challenge.connect(challenger).giveUp([], [], [], [])).to.not.be.reverted;

      expect(await challenge.isFinished()).to.equal(true);
      const credited = await challenge.pendingNativeClaim(sponsorAddr);
      expect(credited).to.be.gt(0n); // remainingAmountFee% of gross, credited instead of lost/reverted

      // Retrievable once the sponsor stops rejecting.
      await rejectingSponsor.setReject(false);
      const before = await hre.ethers.provider.getBalance(sponsorAddr);
      const claimData = challenge.interface.encodeFunctionData('claimPendingNative');
      await rejectingSponsor.call(challengeAddr, claimData);
      expect((await hre.ethers.provider.getBalance(sponsorAddr)) - before).to.equal(credited);
    });
  });

  // GCM / GCMAndSpeed have different constructor shapes (glucose / walking-speed data); confirm
  // the same fix (identical tranferCoinNative/claimPendingNative body) also holds there.
  describe('ChallengeGCM: SUCCESS settlement with a rejecting fee receiver', () => {
    it('does not revert; fee is credited instead of blocking settlement', async () => {
      const rejectingFee = await deployRejectingReceiver();
      const [sponsor, challenger, , , recv0] = await hre.ethers.getSigners();
      const Mock = await hre.ethers.getContractFactory('MockExerciseSupplementNFT');
      const nft = await Mock.deploy(challenger.address, 5, 10);

      const Factory = await hre.ethers.getContractFactory('ChallengeGCM');
      const block = await hre.ethers.provider.getBlock('latest');
      const startTime = block!.timestamp + 60;
      const duration = 30;
      const endTime = startTime + duration * 86400;
      const totalAmount = hre.ethers.parseEther('100');

      const challenge = await Factory.deploy(
        [sponsor.address, challenger.address, await rejectingFee.getAddress()],
        hre.ethers.ZeroAddress,
        [await nft.getAddress()],
        [duration, startTime, endTime, 1000, 1],
        [recv0.address],
        1,
        [true, true, false],
        [0, 0, 0],
        false,
        [100],
        totalAmount,
        [0, 200, 1],
        { value: totalAmount }
      );
      const challengeAddr = await challenge.getAddress();
      await time.increaseTo(startTime + 100);

      await expect(
        challenge.connect(challenger).sendDailyResult(
          [startTime + 300],
          [1001],
          [0, 0],
          '0x',
          [],
          [],
          [],
          [],
          [],
          [0, 2 ** 53 - 1],
          [100]
        )
      ).to.not.be.reverted;

      expect(await challenge.isSuccess()).to.equal(true);
      const credited = await challenge.pendingNativeClaim(await rejectingFee.getAddress());
      expect(credited).to.equal(hre.ethers.parseEther('5'));
      expect(await hre.ethers.provider.getBalance(challengeAddr)).to.be.gte(credited);
    });
  });

  describe('ChallengeGCMAndSpeed: SUCCESS settlement with a rejecting award receiver', () => {
    it('does not revert; the rejecting receiver is credited, does not block finalization', async () => {
      const rejectingRecv = await deployRejectingReceiver();
      const [sponsor, challenger, feeAddr] = await hre.ethers.getSigners();
      const Mock = await hre.ethers.getContractFactory('MockExerciseSupplementNFT');
      const nft = await Mock.deploy(feeAddr.address, 5, 10);

      const Factory = await hre.ethers.getContractFactory('ChallengeGCMAndSpeed');
      const block = await hre.ethers.provider.getBlock('latest');
      const startTime = block!.timestamp + 60;
      const duration = 30;
      const endTime = startTime + duration * 86400;
      const totalAmount = hre.ethers.parseEther('100');

      const challenge = await Factory.deploy(
        [sponsor.address, challenger.address, feeAddr.address],
        hre.ethers.ZeroAddress,
        [await nft.getAddress()],
        [duration, startTime, endTime, 1000, 1],
        [await rejectingRecv.getAddress()],
        1,
        [true, true, false],
        [0, 0, 0],
        false,
        [100],
        totalAmount,
        [0, 0, 0], // walkingSpeedData: disabled (step-only gate)
        [0, 200, 1], // gcmData: [minGlucose, maxGlucose, minSuccessDays]
        { value: totalAmount }
      );
      const challengeAddr = await challenge.getAddress();
      await time.increaseTo(startTime + 100);

      await expect(
        challenge.connect(challenger).sendDailyResult(
          [startTime + 300],
          [1001],
          [0, 0],
          '0x',
          [],
          [],
          [],
          [],
          [],
          [0, 2 ** 53 - 1],
          [0], // walking speed minutes (walkingSpeedData all-zero -> gate disabled, but history array must still match _day length)
          [0], // walking speed METs
          [100] // glucoseLevels within [0,200]
        )
      ).to.not.be.reverted;

      expect(await challenge.isSuccess()).to.equal(true);
      const credited = await challenge.pendingNativeClaim(await rejectingRecv.getAddress());
      expect(credited).to.equal(hre.ethers.parseEther('95')); // 100% receiver share of net (100 - 5% fee)
    });
  });

  // ChallengeDetailV2 requires a Polygon-mainnet fork (Aave/WMATIC dependency, see
  // test/fork/detailv2-fork.test.ts) that this sandbox cannot provide, so its settlement flow
  // cannot be exercised directly here (same limitation as CHALLENGE-2792/2811/2817's DetailV2
  // sub-tests). Confirm at the source/ABI level that the identical fix was applied there too.
  describe('ChallengeDetailV2 (fork-dependent -- ABI-level confirmation only)', () => {
    it('exposes claimPendingNative/pendingNativeClaim and the NativePayoutCredited/Claimed events', async () => {
      const Factory = await hre.ethers.getContractFactory('ChallengeDetailV2');
      const fragmentNames = Factory.interface.fragments.map((f: any) => f.name).filter(Boolean);
      expect(fragmentNames).to.include('claimPendingNative');
      expect(fragmentNames).to.include('pendingNativeClaim');
      expect(fragmentNames).to.include('NativePayoutCredited');
      expect(fragmentNames).to.include('NativePayoutClaimed');
    });
  });
});
