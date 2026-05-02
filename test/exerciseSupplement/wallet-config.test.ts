import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import hre from 'hardhat';
import { deployExerciseSupplementFixture } from './fixtures';

const { ethers } = hre as any;

describe('ExerciseSupplementNFT — Wallet & config setters', function () {
  describe('setBaseURI', function () {
    it('reverts for non-UPDATER_ACTIVITIES_ROLE caller', async function () {
      const { nft, attacker } = await loadFixture(
        deployExerciseSupplementFixture
      );
      await expect(nft.connect(attacker).setBaseURI('new')).to.be.revertedWith(
        /AccessControl/
      );
    });
    it('updates base URI', async function () {
      const { nft, owner } = await loadFixture(deployExerciseSupplementFixture);
      await nft.connect(owner).setBaseURI('ipfs://new/');
      // tokenURI of a minted token includes baseURI
      await nft.connect(owner).safeMint(owner.address);
      expect(await nft.tokenURI(0)).to.equal('ipfs://new/0.json');
    });
  });

  describe('setBaseExtension', function () {
    it('updates extension', async function () {
      const { nft, owner } = await loadFixture(deployExerciseSupplementFixture);
      await nft.connect(owner).setBaseExtension('.png');
      await nft.connect(owner).safeMint(owner.address);
      expect(await nft.tokenURI(0)).to.match(/\.png$/);
    });
  });

  describe('updateSpecialConditionInfo', function () {
    it('updates struct fields', async function () {
      const { nft, owner } = await loadFixture(deployExerciseSupplementFixture);
      await nft
        .connect(owner)
        .updateSpecialConditionInfo(5000, 30, 100, 200, 300, 50);
      const info = await nft.listNftSpecialConditionInfo();
      expect(info.targetStepPerDay).to.equal(5000n);
      expect(info.challengeDuration).to.equal(30n);
      expect(info.amountDepositMatic).to.equal(100n);
      expect(info.amountDepositTTJP).to.equal(200n);
      expect(info.amountDepositJPYC).to.equal(300n);
      expect(info.dividendSuccess).to.equal(50n);
    });

    it('reverts for non-role caller', async function () {
      const { nft, attacker } = await loadFixture(
        deployExerciseSupplementFixture
      );
      await expect(
        nft.connect(attacker).updateSpecialConditionInfo(1, 1, 1, 1, 1, 1)
      ).to.be.revertedWith(/AccessControl/);
    });
  });

  describe('updateDonationWalletAddress', function () {
    it('updates state', async function () {
      const { nft, owner, other } = await loadFixture(
        deployExerciseSupplementFixture
      );
      await nft.connect(owner).updateDonationWalletAddress(other.address);
      expect(await nft.donationWalletAddress()).to.equal(other.address);
    });
  });

  describe('updateFeeSettingAddress', function () {
    it('updates state', async function () {
      const { nft, owner, other } = await loadFixture(
        deployExerciseSupplementFixture
      );
      await nft.connect(owner).updateFeeSettingAddress(other.address);
      expect(await nft.feeSettingAddress()).to.equal(other.address);
    });
  });

  describe('updateReturnedNFTWallet', function () {
    it('updates state', async function () {
      const { nft, owner, other } = await loadFixture(
        deployExerciseSupplementFixture
      );
      await nft.connect(owner).updateReturnedNFTWallet(other.address);
      expect(await nft.returnedNFTWallet()).to.equal(other.address);
    });
  });

  describe('updateSecurityAddress', function () {
    it('updates state', async function () {
      const { nft, owner, other } = await loadFixture(
        deployExerciseSupplementFixture
      );
      await expect(nft.connect(owner).updateSecurityAddress(other.address)).to
        .not.be.reverted;
    });
  });

  describe('updateToleranceAmount', function () {
    it('updates state', async function () {
      const { nft, owner } = await loadFixture(deployExerciseSupplementFixture);
      await nft.connect(owner).updateToleranceAmount(5, 7);
      const list = await nft.getListToleranceAmount();
      expect(list[0]).to.equal(5n);
      expect(list[1]).to.equal(7n);
    });
  });
});
