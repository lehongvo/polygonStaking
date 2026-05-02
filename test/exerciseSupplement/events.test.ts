import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import hre from 'hardhat';
import { deployExerciseSupplementFixture } from './fixtures';

const { ethers } = hre as any;

describe('ExerciseSupplementNFT — Events', function () {
  it('safeMint emits Transfer(0, to, tokenId)', async function () {
    const { nft, owner, other } = await loadFixture(
      deployExerciseSupplementFixture
    );
    await expect(nft.connect(owner).safeMint(other.address))
      .to.emit(nft, 'Transfer')
      .withArgs(ethers.ZeroAddress, other.address, 0);
  });

  it('grantRole emits RoleGranted', async function () {
    const { nft, owner, other } = await loadFixture(
      deployExerciseSupplementFixture
    );
    const role = await nft.MINTER_ROLE();
    await expect(nft.connect(owner).grantRole(role, other.address))
      .to.emit(nft, 'RoleGranted')
      .withArgs(role, other.address, owner.address);
  });

  it('revokeRole emits RoleRevoked', async function () {
    const { nft, owner } = await loadFixture(deployExerciseSupplementFixture);
    const role = await nft.MINTER_ROLE();
    await expect(nft.connect(owner).revokeRole(role, owner.address))
      .to.emit(nft, 'RoleRevoked')
      .withArgs(role, owner.address, owner.address);
  });

  it('renounceRole emits RoleRevoked (sender = owner)', async function () {
    const { nft, owner } = await loadFixture(deployExerciseSupplementFixture);
    const role = await nft.MINTER_ROLE();
    await expect(nft.connect(owner).renounceRole(role, owner.address))
      .to.emit(nft, 'RoleRevoked')
      .withArgs(role, owner.address, owner.address);
  });

  it('batchGrantRole emits one RoleGranted per account', async function () {
    const { nft, owner, other, attacker } = await loadFixture(
      deployExerciseSupplementFixture
    );
    const role = await nft.ALLOWED_CONTRACTS_CHALLENGE();
    const tx = await nft
      .connect(owner)
      .batchGrantRole(role, [other.address, attacker.address]);
    const receipt = await tx.wait();
    const events = receipt!.logs.filter((l: any) =>
      l.topics[0] === ethers.id('RoleGranted(bytes32,address,address)')
    );
    expect(events.length).to.equal(2);
  });

  it('upgradeTo emits Upgraded(implementation)', async function () {
    const { nft, owner } = await loadFixture(deployExerciseSupplementFixture);
    const Factory = await ethers.getContractFactory('ExerciseSupplementNFT');
    const newImpl = await Factory.deploy();
    await newImpl.waitForDeployment();

    await expect(nft.connect(owner).upgradeTo(await newImpl.getAddress()))
      .to.emit(nft, 'Upgraded')
      .withArgs(await newImpl.getAddress());
  });

  it('transferFrom emits Transfer(from, to, tokenId)', async function () {
    const { nft, owner, other, attacker } = await loadFixture(
      deployExerciseSupplementFixture
    );
    await nft.connect(owner).safeMint(other.address);
    await expect(
      nft.connect(other).transferFrom(other.address, attacker.address, 0)
    )
      .to.emit(nft, 'Transfer')
      .withArgs(other.address, attacker.address, 0);
  });

  it('approve emits Approval', async function () {
    const { nft, owner, other, attacker } = await loadFixture(
      deployExerciseSupplementFixture
    );
    await nft.connect(owner).safeMint(other.address);
    await expect(nft.connect(other).approve(attacker.address, 0))
      .to.emit(nft, 'Approval')
      .withArgs(other.address, attacker.address, 0);
  });

  it('setApprovalForAll emits ApprovalForAll', async function () {
    const { nft, other, attacker } = await loadFixture(
      deployExerciseSupplementFixture
    );
    await expect(nft.connect(other).setApprovalForAll(attacker.address, true))
      .to.emit(nft, 'ApprovalForAll')
      .withArgs(other.address, attacker.address, true);
  });

  it('burn emits Transfer(owner, 0, tokenId)', async function () {
    const { nft, owner, other } = await loadFixture(
      deployExerciseSupplementFixture
    );
    await nft.connect(owner).safeMint(other.address);
    await expect(nft.connect(other).burn(0))
      .to.emit(nft, 'Transfer')
      .withArgs(other.address, ethers.ZeroAddress, 0);
  });
});
