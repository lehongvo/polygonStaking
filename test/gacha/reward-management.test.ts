import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import hre from 'hardhat';
import { deployGachaFixture, addERC20Reward, TypeToken } from './fixtures';

const { ethers } = hre as any;

describe('Gacha — reward management', function () {
  describe('addNewReward', function () {
    it('reverts ZERO ADDRESS for non-native with zero token', async function () {
      const { gacha, owner } = await loadFixture(deployGachaFixture);
      await expect(
        gacha
          .connect(owner)
          .addNewReward(
            ethers.ZeroAddress,
            50,
            100,
            0,
            TypeToken.ERC20,
            false,
            5,
            []
          )
      ).to.be.revertedWith('ZERO ADDRESS.');
    });

    it('reverts ZERO ADDRESS for native with non-zero token', async function () {
      const { gacha, owner, erc20Reward } =
        await loadFixture(deployGachaFixture);
      await expect(
        gacha
          .connect(owner)
          .addNewReward(
            await erc20Reward.getAddress(),
            50,
            100,
            0,
            TypeToken.NATIVE_TOKEN,
            false,
            5,
            []
          )
      ).to.be.revertedWith('ZERO ADDRESS.');
    });

    it('reverts INVALID REWARD VALUE when value=0', async function () {
      const { gacha, owner, erc20Reward } =
        await loadFixture(deployGachaFixture);
      await expect(
        gacha
          .connect(owner)
          .addNewReward(
            await erc20Reward.getAddress(),
            50,
            0,
            0,
            TypeToken.ERC20,
            false,
            5,
            []
          )
      ).to.be.revertedWith('INVALID REWARD VALUE.');
    });

    it('reverts LIST NFT MUST BE EXIST for ERC721 transfer with empty list', async function () {
      const { gacha, owner, erc721Reward } =
        await loadFixture(deployGachaFixture);
      await expect(
        gacha
          .connect(owner)
          .addNewReward(
            await erc721Reward.getAddress(),
            50,
            1,
            0,
            TypeToken.ERC721,
            false,
            5,
            []
          )
      ).to.be.revertedWith('LIST NFT MUST BE EXIST');
    });

    it('emits AddNewReward event with token + rate + type + gacha address', async function () {
      const { gacha, owner, erc20Reward } =
        await loadFixture(deployGachaFixture);
      await expect(
        gacha
          .connect(owner)
          .addNewReward(
            await erc20Reward.getAddress(),
            50,
            100,
            0,
            TypeToken.ERC20,
            false,
            5,
            []
          )
      )
        .to.emit(gacha, 'AddNewReward')
        .withArgs(
          await erc20Reward.getAddress(),
          50,
          TypeToken.ERC20,
          await gacha.getAddress()
        );
    });

    it('reuses empty slot after deleteReward', async function () {
      const { gacha, owner, erc20Reward } =
        await loadFixture(deployGachaFixture);
      const e2 = await (
        await ethers.getContractFactory('MockERC20')
      ).deploy('R2', 'R2');
      await e2.waitForDeployment();

      await addERC20Reward(gacha, owner, erc20Reward, 50, 100n, 5);
      await addERC20Reward(gacha, owner, e2, 30, 200n, 5);

      // Delete index 1 → its slot is now empty
      await gacha.connect(owner).deleteReward(1);

      // Adding new reward should reuse index 1 (rewardTokens[1].addressToken == 0)
      const e3 = await (
        await ethers.getContractFactory('MockERC20')
      ).deploy('R3', 'R3');
      await e3.waitForDeployment();
      await addERC20Reward(gacha, owner, e3, 20, 300n, 5);

      const list = await gacha.getListIdToken();
      // Two rewards: original index 2 and reused index 1
      expect(list.length).to.equal(2);
      expect(await gacha.getTotalNumberReward()).to.equal(2n);
    });

    it('rejects caller without UPDATER_REWARDS_ROLE', async function () {
      const { gacha, attacker, erc20Reward } =
        await loadFixture(deployGachaFixture);
      await expect(
        gacha
          .connect(attacker)
          .addNewReward(
            await erc20Reward.getAddress(),
            50,
            100,
            0,
            TypeToken.ERC20,
            false,
            5,
            []
          )
      ).to.be.revertedWith(/AccessControl/);
    });
  });

  describe('deleteReward', function () {
    it('emits DeleteReward event', async function () {
      const { gacha, owner, erc20Reward } =
        await loadFixture(deployGachaFixture);
      await addERC20Reward(gacha, owner, erc20Reward, 50, 100n, 5);

      await expect(gacha.connect(owner).deleteReward(1))
        .to.emit(gacha, 'DeleteReward')
        .withArgs(owner.address, 1, await gacha.getAddress());
    });

    it('clears rewardTokens entry', async function () {
      const { gacha, owner, erc20Reward } =
        await loadFixture(deployGachaFixture);
      await addERC20Reward(gacha, owner, erc20Reward, 50, 100n, 5);
      await gacha.connect(owner).deleteReward(1);

      const slot = await gacha.rewardTokens(1);
      expect(slot.addressToken).to.equal(ethers.ZeroAddress);
      expect(slot.rewardValue).to.equal(0n);
    });

    it('rejects caller without UPDATER_REWARDS_ROLE', async function () {
      const { gacha, owner, attacker, erc20Reward } =
        await loadFixture(deployGachaFixture);
      await addERC20Reward(gacha, owner, erc20Reward, 50, 100n, 5);
      await expect(gacha.connect(attacker).deleteReward(1)).to.be.revertedWith(
        /AccessControl/
      );
    });
  });

  describe('updateRewardRateAndMaxAllowed', function () {
    it('updates unlockRate and maxNumberAllowed for valid index', async function () {
      const { gacha, owner, erc20Reward } =
        await loadFixture(deployGachaFixture);
      await addERC20Reward(gacha, owner, erc20Reward, 50, 100n, 5);

      await gacha.connect(owner).updateRewardRateAndMaxAllowed(1, 80, 10);

      const slot = await gacha.rewardTokens(1);
      expect(slot.unlockRate).to.equal(80n);
      expect(slot.maxNumberAllowed).to.equal(10n);
    });

    it('allows updating slot 0 (lost rate) when maxNumberAllowed = 0', async function () {
      const { gacha, owner } = await loadFixture(deployGachaFixture);
      await gacha.connect(owner).updateRewardRateAndMaxAllowed(0, 200, 0);
      const slot = await gacha.rewardTokens(0);
      expect(slot.unlockRate).to.equal(200n);
    });

    it('reverts setting slot 0 with non-zero maxNumberAllowed', async function () {
      const { gacha, owner } = await loadFixture(deployGachaFixture);
      await expect(
        gacha.connect(owner).updateRewardRateAndMaxAllowed(0, 200, 5)
      ).to.be.revertedWith('MAX NUMBER ALLOWED SHOULD BE EQUAL ZERO.');
    });

    it('rejects caller without UPDATER_ACTIVITIES_ROLE', async function () {
      const { gacha, attacker } = await loadFixture(deployGachaFixture);
      await expect(
        gacha.connect(attacker).updateRewardRateAndMaxAllowed(0, 50, 0)
      ).to.be.revertedWith(/AccessControl/);
    });
  });

  describe('getListIdToken / getListNftInReward / getTotalNumberReward', function () {
    it('returns correct list state', async function () {
      const { gacha, owner, erc20Reward, erc721Reward } =
        await loadFixture(deployGachaFixture);

      expect(await gacha.getTotalNumberReward()).to.equal(0n);

      await addERC20Reward(gacha, owner, erc20Reward, 50, 100n, 5);
      await gacha
        .connect(owner)
        .addNewReward(
          await erc721Reward.getAddress(),
          30,
          1,
          0,
          TypeToken.ERC721,
          false,
          5,
          [42, 84]
        );

      expect(await gacha.getTotalNumberReward()).to.equal(2n);
      const list = await gacha.getListIdToken();
      expect(list.length).to.equal(2);
      expect(list[0]).to.equal(1n);
      expect(list[1]).to.equal(2n);

      const listNft = await gacha.getListNftInReward(2);
      expect(listNft.length).to.equal(2);
      expect(listNft[0]).to.equal(42n);
      expect(listNft[1]).to.equal(84n);
    });
  });
});
