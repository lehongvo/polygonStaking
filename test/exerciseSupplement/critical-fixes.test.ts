import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import hre from 'hardhat';
import { deployExerciseSupplementFixture } from './fixtures';

const { ethers } = hre as any;

describe('ExerciseSupplementNFT — Critical fixes', function () {
  describe('C1 — updateGachaContractAddress access control', function () {
    it('reverts when caller has no UPDATER_ACTIVITIES_ROLE', async function () {
      const { nft, attacker, other } = await loadFixture(
        deployExerciseSupplementFixture
      );
      await expect(
        nft
          .connect(attacker)
          .updateGachaContractAddress(other.address, 0, true)
      ).to.be.revertedWith(/AccessControl/);
    });

    it('reverts on zero address even when caller has role', async function () {
      const { nft, owner } = await loadFixture(deployExerciseSupplementFixture);
      await expect(
        nft.connect(owner).updateGachaContractAddress(ethers.ZeroAddress, 0, true)
      ).to.be.revertedWith('INVALID GACHA ADDRESS');
    });

    it('admin with role can add gacha entry', async function () {
      const { nft, owner, other } = await loadFixture(
        deployExerciseSupplementFixture
      );
      await expect(
        nft.connect(owner).updateGachaContractAddress(other.address, 1, true)
      ).to.not.be.reverted;
    });
  });

  describe('SoulBound mint (V1 logic — balanceOf(msg.sender) check)', function () {
    async function setupSoulBound() {
      const ctx = await loadFixture(deployExerciseSupplementFixture);
      const { nft, owner, soulBoundNft, requiredNft, normalNft } = ctx;
      await nft
        .connect(owner)
        .updateSoulBoundAddress(await soulBoundNft.getAddress(), true);
      await nft
        .connect(owner)
        .addOrRemoveRequiredNftAddress(await requiredNft.getAddress(), true);
      // listNftAddress[0] needed for fallback path
      await nft
        .connect(owner)
        .updateNftListAddress(await normalNft.getAddress(), true, true);

      // Grant ALLOWED_CONTRACTS_CHALLENGE to owner so we can call safeMintNFT
      const ALLOWED_CONTRACTS_CHALLENGE = await nft.ALLOWED_CONTRACTS_CHALLENGE();
      await nft.connect(owner).batchGrantRole(ALLOWED_CONTRACTS_CHALLENGE, [
        owner.address,
      ]);
      return ctx;
    }

    it('mints SoulBound when msg.sender holds required NFT', async function () {
      const { nft, owner, soulBoundNft, requiredNft, challenger } =
        await setupSoulBound();

      // Seed msg.sender (owner = caller acting as challenge contract)
      await requiredNft.setBalance(owner.address, 1);

      const before = await soulBoundNft.balanceOf(challenger.address);
      await nft
        .connect(owner)
        .safeMintNFT(0, 0, 0, ethers.ZeroAddress, 0, 0, ethers.ZeroAddress, challenger.address);
      const after = await soulBoundNft.balanceOf(challenger.address);

      expect(after - before).to.equal(1n);
    });

    it('does NOT mint SoulBound when only _challenger holds required NFT (msg.sender does not)', async function () {
      const { nft, owner, soulBoundNft, requiredNft, challenger } =
        await setupSoulBound();

      // Only challenger has it; msg.sender (owner) does NOT
      await requiredNft.setBalance(challenger.address, 1);

      const before = await soulBoundNft.balanceOf(challenger.address);
      await nft
        .connect(owner)
        .safeMintNFT(0, 0, 0, ethers.ZeroAddress, 0, 0, ethers.ZeroAddress, challenger.address);
      const after = await soulBoundNft.balanceOf(challenger.address);

      expect(after - before).to.equal(0n);
    });

    it('mints SoulBound only ONCE even if msg.sender holds multiple required NFTs (break)', async function () {
      const { nft, owner, soulBoundNft, requiredNft, challenger } =
        await setupSoulBound();

      // Add a second required NFT
      const Target = await ethers.getContractFactory('MockTargetNFT');
      const required2 = await Target.deploy();
      await required2.waitForDeployment();
      await nft
        .connect(owner)
        .addOrRemoveRequiredNftAddress(await required2.getAddress(), true);

      // msg.sender (owner) holds BOTH required NFTs
      await requiredNft.setBalance(owner.address, 1);
      await required2.setBalance(owner.address, 1);

      const before = await soulBoundNft.balanceOf(challenger.address);
      await nft
        .connect(owner)
        .safeMintNFT(0, 0, 0, ethers.ZeroAddress, 0, 0, ethers.ZeroAddress, challenger.address);
      const after = await soulBoundNft.balanceOf(challenger.address);

      expect(after - before).to.equal(1n);
    });
  });

  describe('C3 — updateSecurityAddress', function () {
    it('reverts when non-admin calls', async function () {
      const { nft, attacker, other } = await loadFixture(
        deployExerciseSupplementFixture
      );
      await expect(
        nft.connect(attacker).updateSecurityAddress(other.address)
      ).to.be.revertedWith(/AccessControl/);
    });

    it('reverts on zero address', async function () {
      const { nft, owner } = await loadFixture(deployExerciseSupplementFixture);
      await expect(
        nft.connect(owner).updateSecurityAddress(ethers.ZeroAddress)
      ).to.be.revertedWith('INVALID SECURITY ADDRESS');
    });

    it('admin can set security address', async function () {
      const { nft, owner, other } = await loadFixture(
        deployExerciseSupplementFixture
      );
      await expect(nft.connect(owner).updateSecurityAddress(other.address)).to
        .not.be.reverted;
    });
  });

  describe('H2 — safeMintNFT bounds checks for at(0)/(1)', function () {
    it('reverts MISSING NFT ADDRESS when listNftAddress empty', async function () {
      const { nft, owner, challenger } = await loadFixture(
        deployExerciseSupplementFixture
      );
      const ALLOWED_CONTRACTS_CHALLENGE = await nft.ALLOWED_CONTRACTS_CHALLENGE();
      await nft.connect(owner).batchGrantRole(ALLOWED_CONTRACTS_CHALLENGE, [
        owner.address,
      ]);

      await expect(
        nft
          .connect(owner)
          .safeMintNFT(
            0,
            0,
            0,
            ethers.ZeroAddress,
            0,
            0,
            ethers.ZeroAddress,
            challenger.address
          )
      ).to.be.revertedWith('MISSING NFT ADDRESS');
    });
  });

  describe('safeMint', function () {
    it('mints normally when called without value', async function () {
      const { nft, owner, other } = await loadFixture(
        deployExerciseSupplementFixture
      );
      await expect(nft.connect(owner).safeMint(other.address)).to.not.be
        .reverted;
      expect(await nft.balanceOf(other.address)).to.equal(1n);
    });

    it('accepts value (payable preserved for ABI compatibility)', async function () {
      const { nft, owner, other } = await loadFixture(
        deployExerciseSupplementFixture
      );
      await expect(
        nft.connect(owner).safeMint(other.address, { value: 1n })
      ).to.not.be.reverted;
    });
  });

  describe('H7 — batchGrantRole validation', function () {
    it('reverts EMPTY ACCOUNTS', async function () {
      const { nft, owner } = await loadFixture(deployExerciseSupplementFixture);
      const ALLOWED = await nft.ALLOWED_CONTRACTS_CHALLENGE();
      await expect(
        nft.connect(owner).batchGrantRole(ALLOWED, [])
      ).to.be.revertedWith('EMPTY ACCOUNTS');
    });

    it('reverts TOO MANY ACCOUNTS when > 100', async function () {
      const { nft, owner } = await loadFixture(deployExerciseSupplementFixture);
      const ALLOWED = await nft.ALLOWED_CONTRACTS_CHALLENGE();
      const overflow = Array.from({ length: 101 }, (_, i) =>
        ethers.zeroPadValue(ethers.toBeHex(i + 1), 20)
      );
      await expect(
        nft.connect(owner).batchGrantRole(ALLOWED, overflow)
      ).to.be.revertedWith('TOO MANY ACCOUNTS');
    });

    it('reverts INVALID ACCOUNT when array contains zero address', async function () {
      const { nft, owner, other } = await loadFixture(
        deployExerciseSupplementFixture
      );
      const ALLOWED = await nft.ALLOWED_CONTRACTS_CHALLENGE();
      await expect(
        nft
          .connect(owner)
          .batchGrantRole(ALLOWED, [other.address, ethers.ZeroAddress])
      ).to.be.revertedWith('INVALID ACCOUNT');
    });

    it('grants role to all valid accounts', async function () {
      const { nft, owner, other, attacker } = await loadFixture(
        deployExerciseSupplementFixture
      );
      const ALLOWED = await nft.ALLOWED_CONTRACTS_CHALLENGE();
      await nft.connect(owner).batchGrantRole(ALLOWED, [
        other.address,
        attacker.address,
      ]);
      expect(await nft.hasRole(ALLOWED, other.address)).to.equal(true);
      expect(await nft.hasRole(ALLOWED, attacker.address)).to.equal(true);
    });
  });

  describe('M2 — wallet setters reject zero address', function () {
    it('updateDonationWalletAddress reverts on zero', async function () {
      const { nft, owner } = await loadFixture(deployExerciseSupplementFixture);
      await expect(
        nft.connect(owner).updateDonationWalletAddress(ethers.ZeroAddress)
      ).to.be.revertedWith('INVALID DONATION WALLET');
    });

    it('updateFeeSettingAddress reverts on zero', async function () {
      const { nft, owner } = await loadFixture(deployExerciseSupplementFixture);
      await expect(
        nft.connect(owner).updateFeeSettingAddress(ethers.ZeroAddress)
      ).to.be.revertedWith('INVALID FEE SETTING');
    });

    it('updateReturnedNFTWallet reverts on zero', async function () {
      const { nft, owner } = await loadFixture(deployExerciseSupplementFixture);
      await expect(
        nft.connect(owner).updateReturnedNFTWallet(ethers.ZeroAddress)
      ).to.be.revertedWith('INVALID RETURNED NFT WALLET');
    });
  });

  describe('M3 — updateNftListAddress: zero-check + delete typeNfts on remove', function () {
    it('reverts zero address on add', async function () {
      const { nft, owner } = await loadFixture(deployExerciseSupplementFixture);
      await expect(
        nft.connect(owner).updateNftListAddress(ethers.ZeroAddress, true, true)
      ).to.be.revertedWith('INVALID NFT ADDRESS');
    });

    it('sets typeNfts on add and clears on remove', async function () {
      const { nft, owner, normalNft } = await loadFixture(
        deployExerciseSupplementFixture
      );
      const addr = await normalNft.getAddress();
      await nft.connect(owner).updateNftListAddress(addr, true, true);
      expect(await nft.typeNfts(addr)).to.equal(true);

      // Now remove with arbitrary _isTypeErc721 — V1 bug would persist this; V2 deletes
      await nft.connect(owner).updateNftListAddress(addr, false, true);
      expect(await nft.typeNfts(addr)).to.equal(false);
    });
  });

  describe('M7 — updateToleranceAmount rejects zero', function () {
    it('reverts when success = 0', async function () {
      const { nft, owner } = await loadFixture(deployExerciseSupplementFixture);
      await expect(
        nft.connect(owner).updateToleranceAmount(0, 5)
      ).to.be.revertedWith('INVALID TOLERANCE');
    });

    it('reverts when failed = 0', async function () {
      const { nft, owner } = await loadFixture(deployExerciseSupplementFixture);
      await expect(
        nft.connect(owner).updateToleranceAmount(5, 0)
      ).to.be.revertedWith('INVALID TOLERANCE');
    });

    it('accepts both > 0', async function () {
      const { nft, owner } = await loadFixture(deployExerciseSupplementFixture);
      await expect(nft.connect(owner).updateToleranceAmount(2, 4)).to.not.be
        .reverted;
    });
  });

  describe('updateSpecialNftAddress — zero-check on add', function () {
    it('reverts zero address when adding', async function () {
      const { nft, owner } = await loadFixture(deployExerciseSupplementFixture);
      await expect(
        nft.connect(owner).updateSpecialNftAddress(ethers.ZeroAddress, true)
      ).to.be.revertedWith('INVALID SPECIAL NFT ADDRESS');
    });

    it('removing zero address does not revert (no-op)', async function () {
      const { nft, owner } = await loadFixture(deployExerciseSupplementFixture);
      await expect(
        nft.connect(owner).updateSpecialNftAddress(ethers.ZeroAddress, false)
      ).to.not.be.reverted;
    });
  });

  describe('updateListERC20Address — zero-check + delete typeTokenErc20 on remove', function () {
    it('reverts zero address', async function () {
      const { nft, owner } = await loadFixture(deployExerciseSupplementFixture);
      await expect(
        nft.connect(owner).updateListERC20Address(ethers.ZeroAddress, true)
      ).to.be.revertedWith('INVALID ERC20 ADDRESS');
    });

    it('clears typeTokenErc20 on remove', async function () {
      const { nft, owner } = await loadFixture(deployExerciseSupplementFixture);
      // Use existing MockERC20 with symbol that maps to type 3 (other)
      const ERC20 = await ethers.getContractFactory('MockERC20');
      const tok = await ERC20.deploy('TestToken', 'TST');
      await tok.waitForDeployment();
      const addr = await tok.getAddress();

      await nft.connect(owner).updateListERC20Address(addr, true);
      expect(await nft.getTypeTokenErc20(addr)).to.equal(3n);

      await nft.connect(owner).updateListERC20Address(addr, false);
      expect(await nft.getTypeTokenErc20(addr)).to.equal(0n);
    });
  });
});
