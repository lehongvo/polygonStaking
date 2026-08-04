// CHALLENGE-2696: settlement accounting invariants.
//
// Bug (before fix): receiver shares and the server fee were both calculated independently
// from the SAME gross balance (percent[i]*gross/100 for shares, feePercent*gross/100 for the
// fee), so a config where a group's receiver percentages summed close to 100 could request
// more than the available balance -- ChallengeDetail/ChallengeHIIT/ChallengeBaseStep revert
// (bricking settlement forever, since the config can never change), while
// ChallengeDetailV2/ChallengeGCM/ChallengeGCMAndSpeed silently skipped the transfer and still
// marked the challenge finished/successful (receiver never paid, no way to detect or retry).
// Separately, the ERC20 fee was ALWAYS charged at amountFailFee, even on a success settlement.
//
// Fix: receiver payouts are now scaled by the fee's complement, (100-feePercent)/100, so
// fee + sum(receiver shares) can never exceed the gross balance they're both paid from, for
// ANY percent-sum <= 100 (already validated at construction) and any fee < 100 (already
// bounded by ChallengeFee.checkAmountFee). The ERC20 fee now uses the fee percent matching the
// ACTUAL outcome being settled. tranferCoinNative in the 3 previously-silent variants now
// reverts on shortfall instead of silently no-op'ing, matching the other 3 variants.
import { expect } from 'chai';
import hre from 'hardhat';
import {
  deployChallenge,
  deployMockNFT,
  sendStep,
  moveToStart,
  ContractName,
} from '../helpers/deployHelpers.ts';

async function deployERC20() {
  const F = await hre.ethers.getContractFactory('MockERC20');
  return F.deploy('Token', 'TKN');
}

const STEP_CONTRACTS: ContractName[] = ['ChallengeBaseStep', 'ChallengeDetail', 'ChallengeHIIT'];

describe('CHALLENGE-2696: settlement fee/receiver accounting invariants', function () {
  // ---- Native + ERC20, success/failure: the core ERC20 wrong-fee bug ----
  describe('ERC20 fee uses the outcome-specific percent (was always amountFailFee)', function () {
    for (const name of STEP_CONTRACTS) {
      it(`${name}: SUCCESS settlement charges amountSuccessFee (5%), not amountFailFee (10%)`, async function () {
        const tkn = await deployERC20();
        const tknAddr = await tkn.getAddress();
        const opts: any = {
          awardReceiversPercent: [100],
          index: 1,
          goal: 1000,
          dayRequired: 1,
          erc20List: [tknAddr],
        };
        if (name === 'ChallengeHIIT') {
          opts.highIntensityIntervals = 5;
          opts.totalHighIntensityTime = 60;
        }
        const { challenge, signers, startTime } = await deployChallenge(name, opts);
        const challengeAddr = await challenge.getAddress();
        await tkn.mint(challengeAddr, hre.ethers.parseEther('1000'));
        await moveToStart(startTime);

        const feeAddr = signers[2];
        await sendStep(challenge, name, signers[1], {
          day: startTime + 300,
          steps: 1001,
          intervals: name === 'ChallengeHIIT' ? 5 : undefined,
          totalSeconds: name === 'ChallengeHIIT' ? 60 : undefined,
        });

        expect(await challenge.isSuccess()).to.equal(true);
        expect(await tkn.balanceOf(feeAddr.address)).to.equal(
          hre.ethers.parseEther('50'), // 1000 * SUCCESS_FEE(5)/100 -- NOT FAIL_FEE(10)% = 100
          `${name}: success settlement must use amountSuccessFee`
        );
      });
    }
  });

  // ---- GCM: prove the fix applies to the previously silent-skip variants too ----
  describe('ChallengeGCM (previously silent-skip on shortfall): same ERC20 fee fix', function () {
    it('SUCCESS settlement charges amountSuccessFee (5%), not amountFailFee (10%)', async function () {
      const [sponsor, challenger, feeAddr, , recv0] = await hre.ethers.getSigners();
      const tkn = await deployERC20();
      const tknAddr = await tkn.getAddress();
      const nft = await deployMockNFT({ erc20List: [tknAddr] });

      const Factory = await hre.ethers.getContractFactory('ChallengeGCM');
      const block = await hre.ethers.provider.getBlock('latest');
      const startTime = block!.timestamp + 60;
      const duration = 30;
      const endTime = startTime + duration * 86400;
      const totalAmount = hre.ethers.parseEther('100');

      const challenge = await Factory.deploy(
        [sponsor.address, challenger.address, feeAddr.address],
        hre.ethers.ZeroAddress,
        [await nft.getAddress()],
        [duration, startTime, endTime, 1000, 1], // dayRequired=1
        [recv0.address],
        1, // index
        [true, true, false],
        [0, 0, 0],
        false,
        [100], // single success-side receiver, 100%
        totalAmount,
        [0, 200, 1], // gcmData: [minGlucose, maxGlucose, minSuccessDays] -- wide range, 1-day gate
        { value: totalAmount }
      );

      const challengeAddr = await challenge.getAddress();
      await tkn.mint(challengeAddr, hre.ethers.parseEther('1000'));
      await moveToStart(startTime);

      await challenge.connect(challenger).sendDailyResult(
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
        [100] // glucoseLevels within [0,200]
      );

      expect(await challenge.isSuccess()).to.equal(true);
      expect(await tkn.balanceOf(feeAddr.address)).to.equal(
        hre.ethers.parseEther('50'),
        'ChallengeGCM: success settlement must use amountSuccessFee, not amountFailFee'
      );
    });
  });

  // ---- Boundary percentage: the real prod pattern (100% receiver + nonzero fee) ----
  describe('Boundary: receiver percent = 100 combined with a nonzero fee', function () {
    it('ChallengeBaseStep success: 100% receiver + 5% fee settles exactly (fee 5 + receiver 95 = gross 100), no revert', async function () {
      const { challenge, signers, startTime } = await deployChallenge('ChallengeBaseStep', {
        awardReceiversPercent: [100],
        index: 1,
        goal: 1000,
        dayRequired: 1,
        totalAmount: hre.ethers.parseEther('100'),
      });
      const feeAddr = signers[2];
      const recv0 = signers[4];
      const feeBefore = await hre.ethers.provider.getBalance(feeAddr.address);
      const recvBefore = await hre.ethers.provider.getBalance(recv0.address);

      await moveToStart(startTime);
      await expect(
        sendStep(challenge, 'ChallengeBaseStep', signers[1], {
          day: startTime + 300,
          steps: 1001,
        })
      ).not.to.be.reverted;

      expect(await challenge.isSuccess()).to.equal(true);
      const feeGain = (await hre.ethers.provider.getBalance(feeAddr.address)) - feeBefore;
      const recvGain = (await hre.ethers.provider.getBalance(recv0.address)) - recvBefore;
      expect(feeGain).to.equal(hre.ethers.parseEther('5'));
      expect(recvGain).to.equal(hre.ethers.parseEther('95'));
      expect(feeGain + recvGain).to.equal(hre.ethers.parseEther('100')); // exactly the gross, no overflow
    });

    it('ChallengeBaseStep failure (closeChallenge): 100% fail-side receiver + 10% fee settles exactly (fee 10 + receiver 90 = gross 100)', async function () {
      // The constructor requires _index > 0, so a lone fail-side receiver still needs a
      // (unused, since the challenge never succeeds) dummy success-side entry ahead of it.
      const { challenge, signers, startTime, endTime } = await deployChallenge('ChallengeBaseStep', {
        awardReceiversPercent: [1, 100], // [0]=dummy success-side (never paid), [1]=100% fail-side
        index: 1,
        goal: 1000,
        dayRequired: 20,
        duration: 5,
        totalAmount: hre.ethers.parseEther('100'),
      });
      const feeAddr = signers[2];
      const recvFail = signers[5]; // awardReceiversPercent[1] -> signers[4+1]
      const sponsor = signers[0];
      const feeBefore = await hre.ethers.provider.getBalance(feeAddr.address);
      const recvBefore = await hre.ethers.provider.getBalance(recvFail.address);

      const { time } = await import('@nomicfoundation/hardhat-toolbox/network-helpers.js');
      await time.increaseTo(endTime + 2 * 86400 + 100);

      await expect(challenge.connect(sponsor).closeChallenge([], [], [], [])).not.to.be.reverted;

      expect(await challenge.isSuccess()).to.equal(false);
      const feeGain = (await hre.ethers.provider.getBalance(feeAddr.address)) - feeBefore;
      const recvGain = (await hre.ethers.provider.getBalance(recvFail.address)) - recvBefore;
      expect(feeGain).to.equal(hre.ethers.parseEther('10'));
      expect(recvGain).to.equal(hre.ethers.parseEther('90'));
      expect(feeGain + recvGain).to.equal(hre.ethers.parseEther('100'));
    });
  });

  // ---- Multi-receiver: proportional split within a group still sums correctly ----
  describe('Multi-receiver: proportional shares within the success group', function () {
    it('ChallengeBaseStep: 2 receivers (60/30 of net) + fee never exceed gross, split stays proportional', async function () {
      const { challenge, signers, startTime } = await deployChallenge('ChallengeBaseStep', {
        awardReceiversPercent: [60, 30], // sums to 90 <= 100, both success-side (index=2)
        index: 2,
        goal: 1000,
        dayRequired: 1,
        totalAmount: hre.ethers.parseEther('100'),
      });
      const feeAddr = signers[2];
      const recv0 = signers[4];
      const recv1 = signers[5];
      const before = await Promise.all(
        [feeAddr, recv0, recv1].map(s => hre.ethers.provider.getBalance(s.address))
      );

      await moveToStart(startTime);
      await sendStep(challenge, 'ChallengeBaseStep', signers[1], {
        day: startTime + 300,
        steps: 1001,
      });
      expect(await challenge.isSuccess()).to.equal(true);

      const [feeGain, recv0Gain, recv1Gain] = await Promise.all(
        [feeAddr, recv0, recv1].map(async (s, i) => (await hre.ethers.provider.getBalance(s.address)) - before[i])
      );

      // fee = 100 * 5/100 = 5; net = 95; recv0 = 60*95/100 = 57; recv1 = 30*95/100 = 28.5
      expect(feeGain).to.equal(hre.ethers.parseEther('5'));
      expect(recv0Gain).to.equal(hre.ethers.parseEther('57'));
      expect(recv1Gain).to.equal(hre.ethers.parseEther('28.5'));
      // Invariant: fee + all receiver shares never exceed the gross balance settled.
      expect(feeGain + recv0Gain + recv1Gain).to.be.lte(hre.ethers.parseEther('100'));
      // Relative proportion between receivers matches their configured percent (60:30 = 2:1).
      expect(recv0Gain).to.equal(recv1Gain * 2n);
    });
  });

  // ---- Rounding / dust: odd amounts must never push total spend over gross ----
  describe('Rounding / dust invariant', function () {
    it('ChallengeBaseStep: odd gross balance settles without revert; fee + receiver <= gross (dust may remain, never oversent)', async function () {
      // 7 wei-ETH + an awkward remainder to force integer-division rounding at every step.
      const oddTotal = hre.ethers.parseEther('7') + 13n;
      const { challenge, signers, startTime } = await deployChallenge('ChallengeBaseStep', {
        awardReceiversPercent: [33, 29], // odd, non-round percentages, sum=62 <=100
        index: 2,
        goal: 1000,
        dayRequired: 1,
        totalAmount: oddTotal,
      });
      const feeAddr = signers[2];
      const recv0 = signers[4];
      const recv1 = signers[5];
      const contractAddr = await challenge.getAddress();
      const before = await Promise.all(
        [feeAddr, recv0, recv1].map(s => hre.ethers.provider.getBalance(s.address))
      );

      await moveToStart(startTime);
      await expect(
        sendStep(challenge, 'ChallengeBaseStep', signers[1], {
          day: startTime + 300,
          steps: 1001,
        })
      ).not.to.be.reverted;
      expect(await challenge.isSuccess()).to.equal(true);

      const [feeGain, recv0Gain, recv1Gain] = await Promise.all(
        [feeAddr, recv0, recv1].map(async (s, i) => (await hre.ethers.provider.getBalance(s.address)) - before[i])
      );
      const totalSpent = feeGain + recv0Gain + recv1Gain;
      const dustRemaining = await hre.ethers.provider.getBalance(contractAddr);

      // Never overspend the gross balance -- the whole point of the invariant.
      expect(totalSpent).to.be.lte(oddTotal);
      // Whatever wasn't spent due to floor-rounding stays in the contract as dust (not lost,
      // not double-spent) -- accounts for every wei of the original gross balance.
      expect(totalSpent + dustRemaining).to.equal(oddTotal);
    });
  });

  // ---- Sanity: FAIL_FEE constant still applies unchanged on the fail path ----
  describe('Regression: fail-path fee percent unchanged (FAIL_FEE, not SUCCESS_FEE)', function () {
    it('ChallengeDetail closeChallenge (fail): ERC20 fee uses amountFailFee (10%)', async function () {
      const tkn = await deployERC20();
      const tknAddr = await tkn.getAddress();
      const { challenge, signers, endTime } = await deployChallenge('ChallengeDetail', {
        // The constructor requires _index > 0, so a lone fail-side receiver still needs a
        // (unused, since the challenge never succeeds) dummy success-side entry ahead of it.
        awardReceiversPercent: [1, 100],
        index: 1,
        goal: 1000,
        dayRequired: 20,
        duration: 5,
        erc20List: [tknAddr],
      });
      const challengeAddr = await challenge.getAddress();
      await tkn.mint(challengeAddr, hre.ethers.parseEther('1000'));

      const { time } = await import('@nomicfoundation/hardhat-toolbox/network-helpers.js');
      await time.increaseTo(endTime + 2 * 86400 + 100);

      const feeAddr = signers[2];
      await challenge.connect(signers[0]).closeChallenge([], [], [], []);

      expect(await challenge.isSuccess()).to.equal(false);
      expect(await tkn.balanceOf(feeAddr.address)).to.equal(hre.ethers.parseEther('100')); // 1000 * FAIL_FEE(10)/100
    });
  });
});
