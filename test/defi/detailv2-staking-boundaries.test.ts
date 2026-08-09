import { expect } from 'chai';
import hre from 'hardhat';
import { time } from '@nomicfoundation/hardhat-toolbox/network-helpers.js';

/**
 * CHALLENGE-2695 (TANIMOTO re-review): two further bugs survived the original fix
 * (test/defi/detailv2-staking-payout.test.ts).
 *
 * 1. The constructor never validated `_systemFeePercentForStaking <= 10000` (basis points).
 *    A value above 10000 makes `_withdrawFromStaking`'s `systemFeeAmount` exceed `rewards`,
 *    underflowing `remaining = rewards - systemFeeAmount` and reverting every settlement with
 *    positive yield. Fixed with an explicit constructor check.
 * 2. If `actualWithdrawn < totalReward` (an Aave principal loss, withdrawal fee, or partial
 *    liquidity), the native path still unwrapped the full original `totalReward` regardless of
 *    what was actually received, reverting every terminal settlement instead of paying out the
 *    recoverable amount. Fixed by unwrapping `min(actualWithdrawn, totalReward)`, mirroring the
 *    identical loss-aware fix already applied to PolygonDeFiAggregator (CHALLENGE-2697).
 */
describe('ChallengeDetailV2 — Aave withdrawal boundaries (CHALLENGE-2695 TANIMOTO re-review)', function () {
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

  async function deployBaseArgs() {
    const ethers = (hre as any).ethers;
    const [, challenger, feeAddr, returnedNFTWallet, sponsor, recv1, recv2] =
      await ethers.getSigners();

    const MockNFT = await ethers.getContractFactory('MockExerciseSupplementNFT');
    const nft = await MockNFT.deploy(returnedNFTWallet.address, 10, 10);
    const Factory = await ethers.getContractFactory('ChallengeDetailV2');
    const block = await ethers.provider.getBlock('latest');
    const startTime = block!.timestamp + 60;
    const duration = 5;
    const endTime = startTime + duration * 86400;
    const totalAmount = ethers.parseEther('10');

    return { ethers, Factory, nft, challenger, feeAddr, sponsor, recv1, recv2, startTime, endTime, duration, totalAmount };
  }

  describe('systemFeePercentForStaking constructor validation', function () {
    it('rejects a value above 10000 basis points (100%)', async function () {
      const { Factory, nft, challenger, feeAddr, sponsor, recv1, recv2, startTime, endTime, duration, totalAmount, ethers } =
        await deployBaseArgs();

      // Reverts before ever touching the hardcoded Aave/WMATIC addresses (validation runs
      // before any staking call), so no mock planting is needed for this test.
      await expect(
        Factory.deploy(
          [sponsor.address, challenger.address, feeAddr.address],
          ethers.ZeroAddress,
          [await nft.getAddress()],
          [duration, startTime, endTime, 1000, 4],
          [recv1.address, recv2.address],
          1,
          [true, true, false],
          [0, 0, 0],
          false,
          [50, 40],
          totalAmount,
          10001, // > 10000 basis points
          { value: totalAmount }
        )
      ).to.be.revertedWithCustomError(Factory, 'InvalidSystemFeePercentForStaking');
    });

    it('accepts exactly 10000 basis points (100%) as a boundary value', async function () {
      const { Factory, nft, challenger, feeAddr, sponsor, recv1, recv2, startTime, endTime, duration, totalAmount, ethers } =
        await deployBaseArgs();
      await plantMock(WMATIC_WPOC_ADDRESS, 'MockWMATIC');
      await plantMock(AAVE_POOL_ADDRESS, 'MockAavePoolForTest');

      await expect(
        Factory.deploy(
          [sponsor.address, challenger.address, feeAddr.address],
          ethers.ZeroAddress,
          [await nft.getAddress()],
          [duration, startTime, endTime, 1000, 4],
          [recv1.address, recv2.address],
          1,
          [true, true, false],
          [0, 0, 0],
          false,
          [50, 40],
          totalAmount,
          10000, // exactly 100%, must not revert
          { value: totalAmount }
        )
      ).to.not.be.reverted;
    });
  });

  describe('Aave principal loss no longer reverts terminal settlement', function () {
    it('give-up settles successfully when the Aave pool returns less than the original staked amount', async function () {
      const { ethers, Factory, nft, challenger, feeAddr, sponsor, recv1, recv2, startTime, endTime, duration, totalAmount } =
        await deployBaseArgs();

      const wmatic = await plantMock(WMATIC_WPOC_ADDRESS, 'MockWMATIC');
      await plantMock(AAVE_POOL_ADDRESS, 'MockAavePoolForTest');

      const challenge = await Factory.deploy(
        [sponsor.address, challenger.address, feeAddr.address],
        ethers.ZeroAddress,
        [await nft.getAddress()],
        [duration, startTime, endTime, 1000, 4],
        [recv1.address, recv2.address],
        1,
        [true, true, false],
        [0, 0, 0],
        false,
        [50, 40],
        totalAmount,
        0,
        { value: totalAmount }
      );
      await challenge.waitForDeployment();

      // Simulate an Aave principal loss: drain part of the pool's WMATIC balance (held on
      // behalf of this challenge) directly, by impersonating the pool and transferring some of
      // it away, so a later withdraw() returns less than the original totalReward.
      const lossAmount = ethers.parseEther('3');
      await hre.network.provider.request({ method: 'hardhat_impersonateAccount', params: [AAVE_POOL_ADDRESS] });
      await hre.network.provider.request({
        method: 'hardhat_setBalance',
        params: [AAVE_POOL_ADDRESS, '0x56BC75E2D63100000'],
      });
      const poolSigner = await ethers.getSigner(AAVE_POOL_ADDRESS);
      await (wmatic as any).connect(poolSigner).transfer(feeAddr.address, lossAmount);

      await time.increaseTo(startTime + 100);

      // Old (pre-fix) behavior: this would revert trying to unwrap the full original
      // totalReward when the pool only holds totalReward - lossAmount.
      await expect(challenge.connect(challenger).giveUp([], [], [], [])).to.not.be.reverted;
    });
  });
});
