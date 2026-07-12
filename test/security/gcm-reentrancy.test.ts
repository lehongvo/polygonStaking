// H3 — reentrancy guard cho ChallengeGCM (đưa về NGANG HÀNG với Detail/BaseStep/HIIT vốn
// đã có nonReentrant). Trước đây GCM/GCMAndSpeed/DetailV2 KHÔNG có nonReentrant và set
// isFinished ở CUỐI settlement → về nguyên tắc một stakeholder độc (feeAddress) nhận native
// trong lúc payout có thể reenter settlement.
//
// GHI CHÚ TRUNG THỰC: qua đường giveUp cụ thể này, reentry hiện REVERT dù chưa có guard
// (state của lần settlement ngoài làm lần giveUp reentrant hỏng) → exploit-qua-giveUp KHÔNG
// sạch. Guard nonReentrant là **defense-in-depth**: biến "chặn tình cờ" thành "chặn tường
// minh, ổn định", và phủ cả vector reentry khác (ERC20 độc trong erc20List reenter lúc
// safeTransfer). Rủi ro thấp (chỉ thêm modifier, KHÔNG đổi logic settlement) — 411 test
// regression xác nhận không vỡ luồng hợp lệ.
//
// Test: attacker=feeAddress reenter giveUp trong success-settlement → reentry KHÔNG thành công
// (reentryAttempts=1, lastReentryReverted=true) và payout ngoài VẪN hoàn tất (isSuccess=true).
import { expect } from 'chai';
import hre from 'hardhat';
import { time } from '@nomicfoundation/hardhat-toolbox/network-helpers.js';

const SUCCESS_FEE = 10;
const FAIL_FEE = 10;

async function deployWithAttackerFee() {
  const [, challenger, , returnedNFTWallet, sponsor, recv1, recv2] = await hre.ethers.getSigners();
  const Attacker = await hre.ethers.getContractFactory('MockReentrancyAttacker');
  const attacker = await Attacker.deploy();
  const MockNFT = await hre.ethers.getContractFactory('MockExerciseSupplementNFT');
  const nft = await MockNFT.deploy(returnedNFTWallet.address, SUCCESS_FEE, FAIL_FEE);
  const Factory = await hre.ethers.getContractFactory('ChallengeGCM');
  const block = await hre.ethers.provider.getBlock('latest');
  const startTime = block!.timestamp + 60;
  const duration = 5;
  const endTime = startTime + duration * 86400;
  const challenge = await Factory.deploy(
    [sponsor.address, challenger.address, await attacker.getAddress()], // feeAddress = attacker
    hre.ethers.ZeroAddress,
    [await nft.getAddress()],
    [duration, startTime, endTime, 1000, 1], // dayRequired = 1 (1 ngày đạt → success)
    [recv1.address, recv2.address],
    1,
    [true, true, false],
    [0, 0, 0],
    false,
    [50, 40],
    hre.ethers.parseEther('10'),
    [70, 180, 1], // _gcmData: [minGlucose, maxGlucose, minSuccessDays=1]
    { value: hre.ethers.parseEther('10') }
  );
  return { challenger, challenge, startTime, attacker };
}

describe('ChallengeGCM — reentrancy guard (H3)', function () {
  it('reentrant giveUp từ feeAddress độc trong success-settlement bị chặn; payout vẫn xong', async function () {
    const { challenger, challenge, startTime, attacker } = await deployWithAttackerFee();
    await attacker.setTarget(await challenge.getAddress());
    await attacker.arm();

    await time.increaseTo(startTime + 100);

    // 1 ngày đạt goal + glucose trong khoảng → success → transferToListReceiverSuccess.
    await challenge
      .connect(challenger)
      .sendDailyResult(
        [startTime + 200], [1500], [0, 0], '0x', [], [], [], [], [], [0, startTime + 200 + 86400], [100]
      );

    // Settlement hoàn tất
    expect(await challenge.isSuccess()).to.equal(true);
    // Attacker ĐÃ thử reenter (receive fired) nhưng guard chặn
    expect(await attacker.reentryAttempts()).to.equal(1n);
    expect(await attacker.lastReentryReverted()).to.equal(true);
  });
});
