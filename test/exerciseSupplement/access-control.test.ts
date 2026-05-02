import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import hre from 'hardhat';
import { deployExerciseSupplementFixture } from './fixtures';

const { ethers } = hre as any;

describe('ExerciseSupplementNFT — Access control & roles', function () {
  it('all 5 roles (+ DEFAULT_ADMIN) declared as constants', async function () {
    const { nft } = await loadFixture(deployExerciseSupplementFixture);
    expect(await nft.UPGRADER_ROLE()).to.equal(ethers.id('UPGRADER_ROLE'));
    expect(await nft.UPDATER_ACTIVITIES_ROLE()).to.equal(
      ethers.id('UPDATER_ACTIVITIES_ROLE')
    );
    expect(await nft.MINTER_ROLE()).to.equal(ethers.id('MINTER_ROLE'));
    expect(await nft.ALLOWED_CONTRACTS_GACHA()).to.equal(
      ethers.id('ALLOWED_CONTRACTS_GACHA')
    );
    expect(await nft.ALLOWED_CONTRACTS_CHALLENGE()).to.equal(
      ethers.id('ALLOWED_CONTRACTS_CHALLENGE')
    );
  });

  it('admin can grant and revoke roles via standard AccessControl', async function () {
    const { nft, owner, other } = await loadFixture(
      deployExerciseSupplementFixture
    );
    const role = await nft.MINTER_ROLE();
    await nft.connect(owner).grantRole(role, other.address);
    expect(await nft.hasRole(role, other.address)).to.equal(true);
    await nft.connect(owner).revokeRole(role, other.address);
    expect(await nft.hasRole(role, other.address)).to.equal(false);
  });

  it('non-admin cannot grant a role', async function () {
    const { nft, attacker, other } = await loadFixture(
      deployExerciseSupplementFixture
    );
    const role = await nft.MINTER_ROLE();
    await expect(
      nft.connect(attacker).grantRole(role, other.address)
    ).to.be.revertedWith(/AccessControl/);
  });

  it('non-admin cannot revoke a role', async function () {
    const { nft, attacker, owner } = await loadFixture(
      deployExerciseSupplementFixture
    );
    const role = await nft.MINTER_ROLE();
    await expect(
      nft.connect(attacker).revokeRole(role, owner.address)
    ).to.be.revertedWith(/AccessControl/);
  });

  it('account can renounce its own role', async function () {
    const { nft, owner } = await loadFixture(deployExerciseSupplementFixture);
    const role = await nft.MINTER_ROLE();
    expect(await nft.hasRole(role, owner.address)).to.equal(true);
    await nft.connect(owner).renounceRole(role, owner.address);
    expect(await nft.hasRole(role, owner.address)).to.equal(false);
  });

  describe('batchGrantRole', function () {
    it('grants ALLOWED_CONTRACTS_CHALLENGE to multiple accounts', async function () {
      const { nft, owner, other, attacker } = await loadFixture(
        deployExerciseSupplementFixture
      );
      const role = await nft.ALLOWED_CONTRACTS_CHALLENGE();
      await nft
        .connect(owner)
        .batchGrantRole(role, [other.address, attacker.address]);
      expect(await nft.hasRole(role, other.address)).to.equal(true);
      expect(await nft.hasRole(role, attacker.address)).to.equal(true);
    });

    it('rejects roles other than ALLOWED_CONTRACTS_CHALLENGE', async function () {
      const { nft, owner, other } = await loadFixture(
        deployExerciseSupplementFixture
      );
      const role = await nft.MINTER_ROLE();
      await expect(
        nft.connect(owner).batchGrantRole(role, [other.address])
      ).to.be.revertedWith('DO NOT HAVE PERMISSION TO GRANT THIS ROLE');
    });

    it('rejects empty accounts', async function () {
      const { nft, owner } = await loadFixture(deployExerciseSupplementFixture);
      const role = await nft.ALLOWED_CONTRACTS_CHALLENGE();
      await expect(
        nft.connect(owner).batchGrantRole(role, [])
      ).to.be.revertedWith('EMPTY ACCOUNTS');
    });

    it('rejects > 100 accounts', async function () {
      const { nft, owner } = await loadFixture(deployExerciseSupplementFixture);
      const role = await nft.ALLOWED_CONTRACTS_CHALLENGE();
      const accs = Array.from({ length: 101 }, (_, i) =>
        ethers.zeroPadValue(ethers.toBeHex(i + 1), 20)
      );
      await expect(
        nft.connect(owner).batchGrantRole(role, accs)
      ).to.be.revertedWith('TOO MANY ACCOUNTS');
    });

    it('rejects zero address in array', async function () {
      const { nft, owner, other } = await loadFixture(
        deployExerciseSupplementFixture
      );
      const role = await nft.ALLOWED_CONTRACTS_CHALLENGE();
      await expect(
        nft
          .connect(owner)
          .batchGrantRole(role, [other.address, ethers.ZeroAddress])
      ).to.be.revertedWith('INVALID ACCOUNT');
    });

    it('non-UPDATER_ACTIVITIES_ROLE caller reverts', async function () {
      const { nft, attacker, other } = await loadFixture(
        deployExerciseSupplementFixture
      );
      const role = await nft.ALLOWED_CONTRACTS_CHALLENGE();
      await expect(
        nft.connect(attacker).batchGrantRole(role, [other.address])
      ).to.be.revertedWith(/AccessControl/);
    });

    it('boundary: exactly 50 accounts → succeeds', async function () {
      const { nft, owner } = await loadFixture(deployExerciseSupplementFixture);
      const role = await nft.ALLOWED_CONTRACTS_CHALLENGE();
      const accs = Array.from({ length: 50 }, (_, i) =>
        ethers.zeroPadValue(ethers.toBeHex(i + 1), 20)
      );
      await expect(nft.connect(owner).batchGrantRole(role, accs)).to.not.be
        .reverted;
    });

    it('granting same role twice is no-op (idempotent)', async function () {
      const { nft, owner, other } = await loadFixture(
        deployExerciseSupplementFixture
      );
      const role = await nft.ALLOWED_CONTRACTS_CHALLENGE();
      await nft.connect(owner).batchGrantRole(role, [other.address]);
      await expect(nft.connect(owner).batchGrantRole(role, [other.address])).to
        .not.be.reverted;
      expect(await nft.hasRole(role, other.address)).to.equal(true);
    });
  });

  describe('Role admin hierarchy', function () {
    it('all custom roles default to DEFAULT_ADMIN_ROLE as admin', async function () {
      const { nft } = await loadFixture(deployExerciseSupplementFixture);
      const adminRole = await nft.DEFAULT_ADMIN_ROLE();
      expect(await nft.getRoleAdmin(await nft.UPGRADER_ROLE())).to.equal(
        adminRole
      );
      expect(
        await nft.getRoleAdmin(await nft.UPDATER_ACTIVITIES_ROLE())
      ).to.equal(adminRole);
      expect(await nft.getRoleAdmin(await nft.MINTER_ROLE())).to.equal(
        adminRole
      );
      expect(
        await nft.getRoleAdmin(await nft.ALLOWED_CONTRACTS_GACHA())
      ).to.equal(adminRole);
      expect(
        await nft.getRoleAdmin(await nft.ALLOWED_CONTRACTS_CHALLENGE())
      ).to.equal(adminRole);
    });

    it('admin self-revoke locks them out (no recover possible)', async function () {
      const { nft, owner } = await loadFixture(deployExerciseSupplementFixture);
      const adminRole = await nft.DEFAULT_ADMIN_ROLE();
      const minterRole = await nft.MINTER_ROLE();
      // owner self-revoke admin
      await nft.connect(owner).revokeRole(adminRole, owner.address);
      expect(await nft.hasRole(adminRole, owner.address)).to.equal(false);
      // owner can no longer grant
      await expect(
        nft.connect(owner).grantRole(minterRole, owner.address)
      ).to.be.revertedWith(/AccessControl/);
    });

    it('renounce on behalf of another reverts', async function () {
      const { nft, attacker, owner } = await loadFixture(
        deployExerciseSupplementFixture
      );
      const role = await nft.MINTER_ROLE();
      await expect(
        nft.connect(attacker).renounceRole(role, owner.address)
      ).to.be.revertedWith(/AccessControl/);
    });
  });
});
