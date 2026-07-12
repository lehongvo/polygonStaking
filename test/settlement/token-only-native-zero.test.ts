// Regression cho bug "stuck-JPYC native=0" (đã làm kẹt ~1700 JPYC trên Kaia).
//
// Bug: challenge fund bằng ERC20 (JPYC) với native balance = 0. Constructor seed
// approvalSuccessOf/FailOf = (percent*totalAmount)/100 (native-denominated).
// `updateRewardSuccessAndfail()` chỉ recompute khi coinNativeBalance>0 → với native=0
// các approval giữ giá trị seed >0, rồi `transferToListReceiverSuccess` gọi
// `tranferCoinNative(receiver, approvalSuccessOf[receiver] > 0)` → revert
// InsufficientContractBalance → settlement brick, token kẹt vĩnh viễn.
//
// Fix: nhánh `else` (native==0) zero-out serverSuccessFee/FailureFee + approvalSuccessOf/FailOf,
// nên native transfer thành no-op và phần ERC20 distribution trả token cho receiver.
//
// Test dưới đây: deploy token-only (msgValue=0) + fund JPYC + đạt success → settlement
// KHÔNG revert (isSuccess=true) và receiver NHẬN token. Trước fix, các test này revert.
import { expect } from 'chai';
import hre from 'hardhat';
import { deployChallenge, sendStep, moveToStart, ContractName } from '../helpers/deployHelpers.ts';

const MAX = 2 ** 53 - 1;

async function deployJPYC() {
  const F = await hre.ethers.getContractFactory('MockERC20');
  const t = await F.deploy('JPY Coin', 'JPYC');
  return t;
}

const CASES: { name: ContractName; steps: number }[] = [
  { name: 'ChallengeDetail', steps: 1001 },
  { name: 'ChallengeBaseStep', steps: 1001 },
  { name: 'ChallengeHIIT', steps: 0 }, // HIIT dùng intervals/totalSeconds, không dùng steps
];

describe('Settlement — token-only (native=0) không brick (regression stuck-JPYC)', function () {
  for (const c of CASES) {
    it(`${c.name}: token-funded, native=0 → success settle + receiver nhận JPYC`, async function () {
      const signers = await hre.ethers.getSigners();
      const receiver = signers[4]; // deployChallenge mặc định receivers = signers[4..]
      const challengerSigner = signers[1];

      const jpyc = await deployJPYC();
      const jpycAddr = await jpyc.getAddress();
      const totalAmount = hre.ethers.parseEther('100');

      const opts: any = {
        awardReceiversPercent: [50],
        index: 1,
        goal: 1000,
        dayRequired: 1,
        duration: 30,
        allowGiveUp: [true, false, false], // [1]=false ⇒ constructor KHÔNG require msg.value
        msgValue: 0n, // native = 0
        totalAmount,
        erc20List: [jpycAddr], // registry ERC20 = JPYC
      };
      if (c.name === 'ChallengeHIIT') {
        opts.highIntensityIntervals = 5;
        opts.totalHighIntensityTime = 60;
      }

      const { challenge, startTime } = await deployChallenge(c.name, opts);
      const challengeAddr = await challenge.getAddress();

      // Fund challenge bằng JPYC (thay cho native).
      await jpyc.mint(challengeAddr, totalAmount);
      expect(await jpyc.balanceOf(challengeAddr)).to.equal(totalAmount);

      await moveToStart(startTime);

      const before = await jpyc.balanceOf(receiver.address);

      // Đạt success trong 1 ngày. Trước fix: revert InsufficientContractBalance.
      await sendStep(challenge, c.name, challengerSigner, {
        day: startTime + 300,
        steps: c.steps,
        intervals: c.name === 'ChallengeHIIT' ? 5 : undefined,
        totalSeconds: c.name === 'ChallengeHIIT' ? 60 : undefined,
        timeRange: [0, MAX],
      });

      expect(await challenge.isSuccess()).to.equal(true); // settlement KHÔNG revert
      const after = await jpyc.balanceOf(receiver.address);
      expect(after).to.be.greaterThan(before); // receiver nhận JPYC (không kẹt)
    });
  }
});
