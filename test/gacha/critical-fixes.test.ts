import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import hre from 'hardhat';
import { deployGachaFixture, addERC20Reward, TypeToken } from './fixtures';

const { ethers } = hre as any;

describe('Gacha — Critical fixes', function () {
  describe('C1 — withdrawBalances onlyRole(CLOSE_GACHA_ROLE)', function () {
    it('reverts when caller has no CLOSE_GACHA_ROLE', async function () {
      const { gacha, attacker, erc20Reward } =
        await loadFixture(deployGachaFixture);

      await expect(
        gacha
          .connect(attacker)
          .withdrawBalances(await erc20Reward.getAddress(), 0, TypeToken.ERC20)
      ).to.be.revertedWith(/AccessControl/);
    });

    it('succeeds when caller has CLOSE_GACHA_ROLE (granted to deployer)', async function () {
      const { gacha, owner, erc20Reward, returnedNFTWallet } =
        await loadFixture(deployGachaFixture);
      await erc20Reward.mint(await gacha.getAddress(), 100n);

      await expect(
        gacha
          .connect(owner)
          .withdrawBalances(await erc20Reward.getAddress(), 0, TypeToken.ERC20)
      ).to.not.be.reverted;

      expect(await erc20Reward.balanceOf(returnedNFTWallet.address)).to.equal(
        100n
      );
    });
  });

  describe('C2 — checkIndexOfTokenReward must revert on invalid index', function () {
    it('deleteReward(invalidIndex) reverts', async function () {
      const { gacha, owner } = await loadFixture(deployGachaFixture);

      await expect(gacha.connect(owner).deleteReward(999)).to.be.revertedWith(
        'INDEX OF TOKEN REWARD NOT EXIST.'
      );
    });

    it('updateRewardRateAndMaxAllowed(invalidIndex, ...) reverts', async function () {
      const { gacha, owner } = await loadFixture(deployGachaFixture);

      await expect(
        gacha.connect(owner).updateRewardRateAndMaxAllowed(999, 50, 5)
      ).to.be.revertedWith('INDEX OF TOKEN REWARD NOT EXIST.');
    });

    it('valid index passes through', async function () {
      const { gacha, owner, erc20Reward } =
        await loadFixture(deployGachaFixture);
      await addERC20Reward(gacha, owner, erc20Reward, 50, 100n, 5);

      await expect(
        gacha.connect(owner).updateRewardRateAndMaxAllowed(1, 80, 10)
      ).to.not.be.reverted;
    });
  });

  describe('C3 — deleteReward never pops a non-matching trailing entry', function () {
    it('deleteReward(notFound) reverts (does not silently pop last)', async function () {
      const { gacha, owner, erc20Reward } =
        await loadFixture(deployGachaFixture);
      // Add a single valid reward at index 1
      await addERC20Reward(gacha, owner, erc20Reward, 50, 100n, 5);

      const before = await gacha.getListIdToken();
      expect(before.length).to.equal(1);

      await expect(gacha.connect(owner).deleteReward(2)).to.be.revertedWith(
        'INDEX OF TOKEN REWARD NOT EXIST.'
      );

      const after = await gacha.getListIdToken();
      expect(after.length).to.equal(1);
      expect(after[0]).to.equal(1n);
    });

    it('deleteReward(valid) removes only that index', async function () {
      const { gacha, owner, erc20Reward } =
        await loadFixture(deployGachaFixture);
      const e2 = await (
        await ethers.getContractFactory('MockERC20')
      ).deploy('R2', 'R2');
      await e2.waitForDeployment();

      await addERC20Reward(gacha, owner, erc20Reward, 50, 100n, 5);
      await addERC20Reward(gacha, owner, e2, 30, 200n, 5);

      let list = await gacha.getListIdToken();
      expect(list.length).to.equal(2);

      await gacha.connect(owner).deleteReward(1);

      list = await gacha.getListIdToken();
      expect(list.length).to.equal(1);
      // Index 2 should still be there (swap-pop kept it)
      expect(list[0]).to.equal(2n);
    });
  });
});
