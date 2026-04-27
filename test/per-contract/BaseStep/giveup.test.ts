import { expect } from 'chai';
import hre from 'hardhat';
import { time } from '@nomicfoundation/hardhat-toolbox/network-helpers.js';

/**
 * T4 — Full giveUp flow (F-A4 nonReentrant + F-A5 CEI + F-A2 F4 + F-A8 += verification).
 *
 * Two paths tested:
 *   (a) choiceAwardToSponsor=true: all balance to sponsor
 *   (b) choiceAwardToSponsor=false: split sponsor + receivers proportionally
 *
 * Verifies for each:
 *   - giveUp returns successfully
 *   - isFinished, selectGiveUpStatus state observed via getState() / isFinished()
 *   - Sponsor receives the correct amount
 *   - feeAddr receives serverFailureFee
 *   - notSelectGiveUp blocks second call
 */

const SUCCESS_FEE = 5;
const FAIL_FEE = 10;

async function deploy(allAwardToSponsor: boolean) {
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
    [5, startTime, endTime, 1000, 4],
    [recv1.address, recv2.address],
    1,
    [true, true, false],
    [0, 0, 0],
    allAwardToSponsor,
    [50, 40],
    hre.ethers.parseEther('10'),
    [],
    [],
    { value: hre.ethers.parseEther('10') }
  );

  return { challenger, sponsor, feeAddr, recv1, recv2, challenge, startTime };
}

describe('T4 — giveUp flow', function () {
  it('(a) choiceAwardToSponsor=true: sponsor gets all (minus fee), CEI applied, second giveUp blocked', async function () {
    const { challenger, sponsor, feeAddr, challenge, startTime } = await deploy(true);

    await time.increaseTo(startTime + 100);

    const sponsorBefore = await hre.ethers.provider.getBalance(sponsor.address);
    const feeBefore = await hre.ethers.provider.getBalance(feeAddr.address);
    const balanceBefore = await hre.ethers.provider.getBalance(
      await challenge.getAddress()
    );

    expect(balanceBefore).to.equal(hre.ethers.parseEther('10'));

    // First giveUp succeeds
    const tx = await challenge.connect(challenger).giveUp([], [], [], []);
    const receipt = await tx.wait();
    expect(receipt!.status).to.equal(1);

    // Verify CEI flags set
    expect(await challenge.isFinished()).to.be.true;
    expect(await challenge.isSuccess()).to.be.false;
    expect(await challenge.getState()).to.equal(3n); // GAVE_UP enum index = 3

    // Sponsor gain = balance * (100 - failFee) / 100 = 10 * 90 / 100 = 9
    const sponsorAfter = await hre.ethers.provider.getBalance(sponsor.address);
    const sponsorGain = sponsorAfter - sponsorBefore;
    expect(sponsorGain).to.equal(
      hre.ethers.parseEther('9'),
      'sponsor receives balance * (100 - failFee) / 100 = 9 ETH'
    );

    // feeAddr gain = balance * failFee / 100 = 10 * 10 / 100 = 1
    const feeAfter = await hre.ethers.provider.getBalance(feeAddr.address);
    const feeGain = feeAfter - feeBefore;
    expect(feeGain).to.equal(
      hre.ethers.parseEther('1'),
      'feeAddr receives serverFailureFee = 1 ETH (F-A2 enforced exact)'
    );

    // Contract balance should be 0
    expect(
      await hre.ethers.provider.getBalance(await challenge.getAddress())
    ).to.equal(0n, 'no funds stranded');

    // Second giveUp should revert (notSelectGiveUp + available)
    await expect(
      challenge.connect(challenger).giveUp([], [], [], [])
    ).to.be.reverted;
  });

  it('(b) choiceAwardToSponsor=false: sponsor + receiver split based on currentStatus', async function () {
    const { challenger, sponsor, feeAddr, recv1, challenge, startTime } =
      await deploy(false);

    await time.increaseTo(startTime + 100);

    // Send 1 passing day to set currentStatus=1 (so receivers get partial)
    const sig = '0x';
    const data: [number, number] = [0, 0];
    const range: [number, number] = [0, startTime + 5 * 86400];

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

    expect(await challenge.currentStatus()).to.equal(1n);

    const sponsorBefore = await hre.ethers.provider.getBalance(sponsor.address);
    const recv1Before = await hre.ethers.provider.getBalance(recv1.address);
    const feeBefore = await hre.ethers.provider.getBalance(feeAddr.address);

    await time.increase(60);
    const tx = await challenge.connect(challenger).giveUp([], [], [], []);
    const receipt = await tx.wait();
    expect(receipt!.status).to.equal(1);

    // Verify CEI
    expect(await challenge.isFinished()).to.be.true;
    expect(await challenge.getState()).to.equal(3n); // GAVE_UP

    // Math:
    //   balance = 10
    //   amount = 10 * (100 - 10) / 100 = 9
    //   amountToReceiverList = amount * currentStatus / dayRequired = 9 * 1 / 4 = 2.25
    //   sponsor gets amount - amountToReceiverList = 9 - 2.25 = 6.75
    //   recv1 gets approvalSuccessOf[recv1] * amountToReceiverList / amount
    //     approvalSuccessOf[recv1] = balance * 50 / 100 = 5
    //     recv1 = 5 * 2.25 / 9 = 1.25
    //   serverFailureFee = balance * 10 / 100 = 1
    //
    // The contract balance flow:
    //   tranferCoinNative(sponsor, 6.75) → balance = 10 - 6.75 = 3.25
    //   tranferCoinNative(recv1, 1.25)   → balance = 3.25 - 1.25 = 2
    //   tranferCoinNative(feeAddr, 1)    → balance = 2 - 1 = 1 (residual stays in contract)

    const sponsorGain =
      (await hre.ethers.provider.getBalance(sponsor.address)) - sponsorBefore;
    const recv1Gain =
      (await hre.ethers.provider.getBalance(recv1.address)) - recv1Before;
    const feeGain =
      (await hre.ethers.provider.getBalance(feeAddr.address)) - feeBefore;

    expect(sponsorGain).to.equal(hre.ethers.parseEther('6.75'));
    expect(recv1Gain).to.equal(hre.ethers.parseEther('1.25'));
    expect(feeGain).to.equal(hre.ethers.parseEther('1'));
  });
});
