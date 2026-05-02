import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import hre from 'hardhat';
import { deployExerciseSupplementFixture } from './fixtures';

const { ethers } = hre as any;

describe('ExerciseSupplementNFT — NFT registry', function () {
  describe('updateNftListAddress', function () {
    it('add: appends to list and sets typeNfts', async function () {
      const { nft, owner, normalNft } = await loadFixture(
        deployExerciseSupplementFixture
      );
      const addr = await normalNft.getAddress();
      await nft.connect(owner).updateNftListAddress(addr, true, true);
      const list = await nft.getNftListAddress();
      expect(list).to.include(addr);
      expect(await nft.typeNfts(addr)).to.equal(true);
    });

    it('remove: deletes from list and clears typeNfts', async function () {
      const { nft, owner, normalNft } = await loadFixture(
        deployExerciseSupplementFixture
      );
      const addr = await normalNft.getAddress();
      await nft.connect(owner).updateNftListAddress(addr, true, true);
      await nft.connect(owner).updateNftListAddress(addr, false, true);
      const list = await nft.getNftListAddress();
      expect(list).to.not.include(addr);
      expect(await nft.typeNfts(addr)).to.equal(false);
    });

    it('add ERC1155 (false flag) sets typeNfts=false', async function () {
      const { nft, owner, normalNft } = await loadFixture(
        deployExerciseSupplementFixture
      );
      const addr = await normalNft.getAddress();
      await nft.connect(owner).updateNftListAddress(addr, true, false);
      expect(await nft.typeNfts(addr)).to.equal(false);
    });
  });

  describe('updateSpecialNftAddress', function () {
    it('add to list', async function () {
      const { nft, owner, specialNft0 } = await loadFixture(
        deployExerciseSupplementFixture
      );
      const addr = await specialNft0.getAddress();
      await nft.connect(owner).updateSpecialNftAddress(addr, true);
      const list = await nft.getSpecialNftAddress();
      expect(list).to.include(addr);
    });

    it('remove from list', async function () {
      const { nft, owner, specialNft0 } = await loadFixture(
        deployExerciseSupplementFixture
      );
      const addr = await specialNft0.getAddress();
      await nft.connect(owner).updateSpecialNftAddress(addr, true);
      await nft.connect(owner).updateSpecialNftAddress(addr, false);
      const list = await nft.getSpecialNftAddress();
      expect(list).to.not.include(addr);
    });

    it('non-role caller reverts', async function () {
      const { nft, attacker, specialNft0 } = await loadFixture(
        deployExerciseSupplementFixture
      );
      await expect(
        nft
          .connect(attacker)
          .updateSpecialNftAddress(await specialNft0.getAddress(), true)
      ).to.be.revertedWith(/AccessControl/);
    });
  });

  describe('updateSoulBoundAddress', function () {
    it('enable: sets soulBoundNftAddress', async function () {
      const { nft, owner, soulBoundNft } = await loadFixture(
        deployExerciseSupplementFixture
      );
      const addr = await soulBoundNft.getAddress();
      await nft.connect(owner).updateSoulBoundAddress(addr, true);
      expect(await nft.soulBoundNftAddress()).to.equal(addr);
    });

    it('enable with zero address reverts', async function () {
      const { nft, owner } = await loadFixture(deployExerciseSupplementFixture);
      await expect(
        nft.connect(owner).updateSoulBoundAddress(ethers.ZeroAddress, true)
      ).to.be.revertedWith('INVALID ADDRESS');
    });

    it('disable: resets to zero', async function () {
      const { nft, owner, soulBoundNft } = await loadFixture(
        deployExerciseSupplementFixture
      );
      await nft
        .connect(owner)
        .updateSoulBoundAddress(await soulBoundNft.getAddress(), true);
      await nft
        .connect(owner)
        .updateSoulBoundAddress(ethers.ZeroAddress, false);
      expect(await nft.soulBoundNftAddress()).to.equal(ethers.ZeroAddress);
    });
  });

  describe('addOrRemoveRequiredNftAddress', function () {
    it('add: appends', async function () {
      const { nft, owner, requiredNft } = await loadFixture(
        deployExerciseSupplementFixture
      );
      const addr = await requiredNft.getAddress();
      await nft.connect(owner).addOrRemoveRequiredNftAddress(addr, true);
      const list = await nft.getRequiredNftAddresses();
      expect(list).to.include(addr);
    });

    it('add zero address reverts', async function () {
      const { nft, owner } = await loadFixture(deployExerciseSupplementFixture);
      await expect(
        nft
          .connect(owner)
          .addOrRemoveRequiredNftAddress(ethers.ZeroAddress, true)
      ).to.be.revertedWith('INVALID ADDRESS');
    });

    it('add duplicate reverts', async function () {
      const { nft, owner, requiredNft } = await loadFixture(
        deployExerciseSupplementFixture
      );
      const addr = await requiredNft.getAddress();
      await nft.connect(owner).addOrRemoveRequiredNftAddress(addr, true);
      await expect(
        nft.connect(owner).addOrRemoveRequiredNftAddress(addr, true)
      ).to.be.revertedWith('NFT ALREADY IN LIST');
    });

    it('remove: deletes from list', async function () {
      const { nft, owner, requiredNft } = await loadFixture(
        deployExerciseSupplementFixture
      );
      const addr = await requiredNft.getAddress();
      await nft.connect(owner).addOrRemoveRequiredNftAddress(addr, true);
      await nft.connect(owner).addOrRemoveRequiredNftAddress(addr, false);
      const list = await nft.getRequiredNftAddresses();
      expect(list).to.not.include(addr);
    });
  });

  describe('State cycles: add → remove → re-add', function () {
    it('NftListAddress cycle preserves typeNfts on re-add', async function () {
      const { nft, owner, normalNft } = await loadFixture(
        deployExerciseSupplementFixture
      );
      const addr = await normalNft.getAddress();
      await nft.connect(owner).updateNftListAddress(addr, true, true);
      await nft.connect(owner).updateNftListAddress(addr, false, true);
      // re-add with different type
      await nft.connect(owner).updateNftListAddress(addr, true, false);
      expect(await nft.typeNfts(addr)).to.equal(false);
      expect(await nft.getNftListAddress()).to.include(addr);
    });

    it('SpecialNft cycle: add, remove, re-add succeed', async function () {
      const { nft, owner, specialNft0 } = await loadFixture(
        deployExerciseSupplementFixture
      );
      const addr = await specialNft0.getAddress();
      await nft.connect(owner).updateSpecialNftAddress(addr, true);
      await nft.connect(owner).updateSpecialNftAddress(addr, false);
      await nft.connect(owner).updateSpecialNftAddress(addr, true);
      expect(await nft.getSpecialNftAddress()).to.include(addr);
    });

    it('SoulBound cycle: enable, disable, enable with same address', async function () {
      const { nft, owner, soulBoundNft } = await loadFixture(
        deployExerciseSupplementFixture
      );
      const addr = await soulBoundNft.getAddress();
      await nft.connect(owner).updateSoulBoundAddress(addr, true);
      await nft.connect(owner).updateSoulBoundAddress(ethers.ZeroAddress, false);
      expect(await nft.soulBoundNftAddress()).to.equal(ethers.ZeroAddress);
      await nft.connect(owner).updateSoulBoundAddress(addr, true);
      expect(await nft.soulBoundNftAddress()).to.equal(addr);
    });

    it('Required NFT cycle: add, remove, re-add', async function () {
      const { nft, owner, requiredNft } = await loadFixture(
        deployExerciseSupplementFixture
      );
      const addr = await requiredNft.getAddress();
      await nft.connect(owner).addOrRemoveRequiredNftAddress(addr, true);
      await nft.connect(owner).addOrRemoveRequiredNftAddress(addr, false);
      // re-add now allowed (since removed)
      await nft.connect(owner).addOrRemoveRequiredNftAddress(addr, true);
      expect(await nft.getRequiredNftAddresses()).to.include(addr);
    });
  });

  describe('Multi-address state', function () {
    it('NftList: add 3 addresses, list length = 3', async function () {
      const { nft, owner } = await loadFixture(deployExerciseSupplementFixture);
      const Target = await ethers.getContractFactory('MockTargetNFT');
      const a = await Target.deploy();
      const b = await Target.deploy();
      const c = await Target.deploy();
      await a.waitForDeployment();
      await b.waitForDeployment();
      await c.waitForDeployment();

      await nft
        .connect(owner)
        .updateNftListAddress(await a.getAddress(), true, true);
      await nft
        .connect(owner)
        .updateNftListAddress(await b.getAddress(), true, false);
      await nft
        .connect(owner)
        .updateNftListAddress(await c.getAddress(), true, true);

      expect((await nft.getNftListAddress()).length).to.equal(3);
      expect(await nft.typeNfts(await a.getAddress())).to.equal(true);
      expect(await nft.typeNfts(await b.getAddress())).to.equal(false);
      expect(await nft.typeNfts(await c.getAddress())).to.equal(true);
    });

    it('Required NFT: add 3, remove middle, list shrinks to 2', async function () {
      const { nft, owner } = await loadFixture(deployExerciseSupplementFixture);
      const Target = await ethers.getContractFactory('MockTargetNFT');
      const a = await Target.deploy();
      const b = await Target.deploy();
      const c = await Target.deploy();
      await a.waitForDeployment();
      await b.waitForDeployment();
      await c.waitForDeployment();

      await nft
        .connect(owner)
        .addOrRemoveRequiredNftAddress(await a.getAddress(), true);
      await nft
        .connect(owner)
        .addOrRemoveRequiredNftAddress(await b.getAddress(), true);
      await nft
        .connect(owner)
        .addOrRemoveRequiredNftAddress(await c.getAddress(), true);
      expect((await nft.getRequiredNftAddresses()).length).to.equal(3);

      // Remove middle (b)
      await nft
        .connect(owner)
        .addOrRemoveRequiredNftAddress(await b.getAddress(), false);
      const list = await nft.getRequiredNftAddresses();
      expect(list.length).to.equal(2);
      expect(list).to.not.include(await b.getAddress());
    });

    it('SpecialNft: at(0) and at(1) are stable until removed', async function () {
      const { nft, owner, specialNft0, specialNft1 } = await loadFixture(
        deployExerciseSupplementFixture
      );
      await nft
        .connect(owner)
        .updateSpecialNftAddress(await specialNft0.getAddress(), true);
      await nft
        .connect(owner)
        .updateSpecialNftAddress(await specialNft1.getAddress(), true);
      const list = await nft.getSpecialNftAddress();
      expect(list[0]).to.equal(await specialNft0.getAddress());
      expect(list[1]).to.equal(await specialNft1.getAddress());
    });

    it('Removing first SpecialNft makes last become at(0) (EnumerableSet swap-pop)', async function () {
      const { nft, owner, specialNft0, specialNft1 } = await loadFixture(
        deployExerciseSupplementFixture
      );
      await nft
        .connect(owner)
        .updateSpecialNftAddress(await specialNft0.getAddress(), true);
      await nft
        .connect(owner)
        .updateSpecialNftAddress(await specialNft1.getAddress(), true);
      // remove the first
      await nft
        .connect(owner)
        .updateSpecialNftAddress(await specialNft0.getAddress(), false);
      const list = await nft.getSpecialNftAddress();
      expect(list.length).to.equal(1);
      expect(list[0]).to.equal(await specialNft1.getAddress());
    });
  });
});
