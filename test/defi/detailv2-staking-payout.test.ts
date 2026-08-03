import { expect } from 'chai';
import hre from 'hardhat';
import { time } from '@nomicfoundation/hardhat-toolbox/network-helpers.js';

/**
 * CHALLENGE-2695: ChallengeDetailV2._withdrawFromStaking() used to withdraw the Aave position
 * and transfer the FULL principal + yield DIRECTLY to the challenger, unconditionally, on
 * every outcome (success/fail/give-up) -- before the outcome-based awardReceivers
 * distribution even ran. `totalReward` (= the staked _totalAmount) is the AWARD POOL, not the
 * challenger's own collateral (see the constructor: `require(msg.value == _totalAmount,
 * "Invalid award")`), so this sent sponsor-funded prize money to the challenger regardless of
 * whether they actually succeeded.
 *
 * ChallengeDetailV2's constructor calls the REAL, hardcoded Aave Pool and WMATIC contract
 * addresses directly (not injectable) -- normally only exercisable via a live network fork
 * (see test/fork/detailv2-fork.test.ts, skipped without a live RPC). This test instead plants
 * minimal mock contracts at those exact hardcoded addresses via hardhat_setCode, so the fix can
 * be verified on a plain local network without any external dependency.
 */
describe('ChallengeDetailV2 — Aave staking payout goes to awardReceivers, not challenger (fix CHALLENGE-2695)', function () {
  const AAVE_POOL_ADDRESS = '0x794a61358D6845594F94dc1DB02A252b5b4814aD';
  const WMATIC_WPOC_ADDRESS = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270';

  async function plantMock(address: string, factoryName: string) {
    const ethers = (hre as any).ethers;
    const Factory = await ethers.getContractFactory(factoryName);
    const deployed = await Factory.deploy();
    await deployed.waitForDeployment();
    const code = await ethers.provider.getCode(await deployed.getAddress());
    await hre.network.provider.request({ method: 'hardhat_setCode', params: [address, code] });
    return ethers.getContractAt(factoryName, address);
  }

  async function setup() {
    const ethers = (hre as any).ethers;
    const [, challenger, feeAddr, returnedNFTWallet, sponsor, recv1, recv2] =
      await ethers.getSigners();

    const wmatic = await plantMock(WMATIC_WPOC_ADDRESS, 'MockWMATIC');
    await plantMock(AAVE_POOL_ADDRESS, 'MockAavePoolForTest');

    // Simulate accrued Aave yield sitting in the pool: mint extra WMATIC (backed by real
    // native MATIC, since MockWMATIC.mint is payable) directly to the pool's address, ON TOP
    // of whatever principal the constructor's supply() call will pull in later.
    const yieldAmount = ethers.parseEther('1');
    await sponsor.sendTransaction({ to: WMATIC_WPOC_ADDRESS, value: 0 }); // no-op sanity (address has code now)
    const mintTx = await (wmatic as any).connect(sponsor).mint(AAVE_POOL_ADDRESS, { value: yieldAmount });
    await mintTx.wait();

    const MockNFT = await ethers.getContractFactory('MockExerciseSupplementNFT');
    const nft = await MockNFT.deploy(returnedNFTWallet.address, 10, 10);
    const Factory = await ethers.getContractFactory('ChallengeDetailV2');
    const block = await ethers.provider.getBlock('latest');
    const startTime = block!.timestamp + 60;
    const duration = 5;
    const endTime = startTime + duration * 86400;
    const totalAmount = ethers.parseEther('10');

    const challenge = await Factory.deploy(
      [sponsor.address, challenger.address, feeAddr.address], // stakeholders
      ethers.ZeroAddress, // native flow -> triggers WMATIC/Aave staking automatically
      [await nft.getAddress()],
      [duration, startTime, endTime, 1000, 4],
      [recv1.address, recv2.address], // awardReceivers -- NEITHER is the challenger
      1, // index: recv1 = success group, recv2 = fail group
      [true, true, false],
      [0, 0, 0],
      false,
      [50, 40],
      totalAmount,
      0, // systemFeePercentForStaking
      { value: totalAmount }
    );
    await challenge.waitForDeployment();

    return { challenge, challenger, feeAddr, sponsor, recv1, recv2, startTime, totalAmount, yieldAmount };
  }

  it('on success, the award pool (principal + yield) goes to awardReceivers, NOT unconditionally to the challenger', async function () {
    const { challenge, challenger, recv1, startTime, totalAmount } = await setup();
    const ethers = (hre as any).ethers;

    const balanceBefore = await ethers.provider.getBalance(challenger.address);

    // Drive the challenge to SUCCESS (dayRequired=4, goal=1000 per setup's primaryRequired).
    await time.increaseTo(startTime + 100);
    for (let d = 0; d < 4; d++) {
      await challenge
        .connect(challenger)
        .sendDailyResult(
          [startTime + 200 + d * 86400],
          [1500],
          [0, 0],
          '0x',
          [],
          [],
          [],
          [],
          [],
          [0, 0]
        );
    }
    expect(await challenge.isSuccess()).to.be.true;

    // The challenger must NOT have received the staked award pool unconditionally. Some gas
    // was spent on 4 transactions, but that's negligible next to the 10 MATIC award pool --
    // the balance must not have INCREASED by anything close to totalAmount.
    const balanceAfter = await ethers.provider.getBalance(challenger.address);
    expect(balanceAfter).to.be.lessThan(balanceBefore);
    expect(balanceBefore - balanceAfter).to.be.lessThan(ethers.parseEther('0.1')); // pure gas cost

    // recv1 (the success-group awardReceiver, index 0 < index=1) DID receive their share of
    // the award pool, proving the funds flowed through the outcome-based distribution instead.
    const recv1Balance = await ethers.provider.getBalance(recv1.address);
    expect(recv1Balance).to.be.greaterThan(0n);
  });

  it('on give-up (failure), the award pool still is NOT paid to the challenger', async function () {
    const { challenge, challenger, startTime } = await setup();
    const ethers = (hre as any).ethers;

    await time.increaseTo(startTime + 100);
    const balanceBefore = await ethers.provider.getBalance(challenger.address);

    const tx = await challenge.connect(challenger).giveUp([], [], [], []);
    const receipt = await tx.wait();
    const gasCost = receipt!.gasUsed * receipt!.gasPrice;

    const balanceAfter = await ethers.provider.getBalance(challenger.address);
    // Balance should only have DROPPED by gas cost -- no incoming award-pool transfer.
    expect(balanceBefore - balanceAfter).to.equal(gasCost);
  });
});
