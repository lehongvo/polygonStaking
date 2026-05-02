import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import hre from 'hardhat';
import { deployExerciseSupplementFixture } from './fixtures';

const { ethers, upgrades } = hre as any;

describe('ExerciseSupplementNFT — UUPS upgrade', function () {
  it('owner with UPGRADER_ROLE can call upgradeTo', async function () {
    const { nft, owner } = await loadFixture(deployExerciseSupplementFixture);
    const Factory = await ethers.getContractFactory('ExerciseSupplementNFT');
    const newImpl = await Factory.deploy();
    await newImpl.waitForDeployment();
    await expect(nft.connect(owner).upgradeTo(await newImpl.getAddress())).to
      .not.be.reverted;
  });

  it('non-UPGRADER_ROLE cannot call upgradeTo', async function () {
    const { nft, attacker } = await loadFixture(
      deployExerciseSupplementFixture
    );
    const Factory = await ethers.getContractFactory('ExerciseSupplementNFT');
    const newImpl = await Factory.deploy();
    await newImpl.waitForDeployment();
    await expect(
      nft.connect(attacker).upgradeTo(await newImpl.getAddress())
    ).to.be.revertedWith(/AccessControl/);
  });

  it('upgradeToAndCall also gated by UPGRADER_ROLE', async function () {
    const { nft, attacker } = await loadFixture(
      deployExerciseSupplementFixture
    );
    const Factory = await ethers.getContractFactory('ExerciseSupplementNFT');
    const newImpl = await Factory.deploy();
    await newImpl.waitForDeployment();
    await expect(
      nft.connect(attacker).upgradeToAndCall(await newImpl.getAddress(), '0x')
    ).to.be.revertedWith(/AccessControl/);
  });

  it('state preserved after upgrade', async function () {
    const { nft, owner, other } = await loadFixture(
      deployExerciseSupplementFixture
    );
    await nft.connect(owner).safeMint(other.address);
    const balanceBefore = await nft.balanceOf(other.address);

    const Factory = await ethers.getContractFactory('ExerciseSupplementNFT');
    const newImpl = await Factory.deploy();
    await newImpl.waitForDeployment();
    await nft.connect(owner).upgradeTo(await newImpl.getAddress());

    expect(await nft.balanceOf(other.address)).to.equal(balanceBefore);
  });

  it('roles preserved after upgrade', async function () {
    const { nft, owner } = await loadFixture(deployExerciseSupplementFixture);
    const adminRole = await nft.DEFAULT_ADMIN_ROLE();
    const minterRole = await nft.MINTER_ROLE();

    const Factory = await ethers.getContractFactory('ExerciseSupplementNFT');
    const newImpl = await Factory.deploy();
    await newImpl.waitForDeployment();
    await nft.connect(owner).upgradeTo(await newImpl.getAddress());

    expect(await nft.hasRole(adminRole, owner.address)).to.equal(true);
    expect(await nft.hasRole(minterRole, owner.address)).to.equal(true);
  });

  it('config (donation/fee/returned) preserved after upgrade', async function () {
    const { nft, owner, donation, feeSetting, returned } =
      await loadFixture(deployExerciseSupplementFixture);

    const Factory = await ethers.getContractFactory('ExerciseSupplementNFT');
    const newImpl = await Factory.deploy();
    await newImpl.waitForDeployment();
    await nft.connect(owner).upgradeTo(await newImpl.getAddress());

    expect(await nft.donationWalletAddress()).to.equal(donation.address);
    expect(await nft.feeSettingAddress()).to.equal(feeSetting.address);
    expect(await nft.returnedNFTWallet()).to.equal(returned.address);
  });

  it('upgrade chain: V1 → V2 → V3 (each step preserves state)', async function () {
    const { nft, owner, other } = await loadFixture(
      deployExerciseSupplementFixture
    );
    await nft.connect(owner).safeMint(other.address);

    const Factory = await ethers.getContractFactory('ExerciseSupplementNFT');
    const v2 = await Factory.deploy();
    await v2.waitForDeployment();
    await nft.connect(owner).upgradeTo(await v2.getAddress());
    expect(await nft.balanceOf(other.address)).to.equal(1n);

    const v3 = await Factory.deploy();
    await v3.waitForDeployment();
    await nft.connect(owner).upgradeTo(await v3.getAddress());
    expect(await nft.balanceOf(other.address)).to.equal(1n);
  });

  it('renounced UPGRADER_ROLE prevents future upgrades', async function () {
    const { nft, owner } = await loadFixture(deployExerciseSupplementFixture);
    const role = await nft.UPGRADER_ROLE();
    await nft.connect(owner).renounceRole(role, owner.address);

    const Factory = await ethers.getContractFactory('ExerciseSupplementNFT');
    const newImpl = await Factory.deploy();
    await newImpl.waitForDeployment();
    await expect(
      nft.connect(owner).upgradeTo(await newImpl.getAddress())
    ).to.be.revertedWith(/AccessControl/);
  });
});
