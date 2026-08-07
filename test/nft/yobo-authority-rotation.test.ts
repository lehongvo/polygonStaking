// CHALLENGE-2803: ownership transfer must rotate operational admin authority atomically.
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers.js';
import { expect } from 'chai';
import hre from 'hardhat';

const { ethers } = hre as any;

async function deployFixture() {
  const [owner, newOwner, outsider] = await ethers.getSigners();
  const Factory = await ethers.getContractFactory('YOBOWEB3WALK');
  const nft = await Factory.deploy('ipfs://test/');
  await nft.waitForDeployment();
  return { nft, owner, newOwner, outsider };
}

describe('CHALLENGE-2803: YOBOWEB3WALK ownership/admin rotation', () => {
  it('transferOwnership only proposes; owner unchanged until acceptOwnership', async () => {
    const { nft, owner, newOwner } = await loadFixture(deployFixture);
    await nft.connect(owner).transferOwnership(newOwner.address);
    expect(await nft.owner()).to.equal(owner.address);
    expect(await nft.pendingOwner()).to.equal(newOwner.address);
  });

  it('acceptOwnership rotates owner and admin set; old owner loses admin', async () => {
    const { nft, owner, newOwner } = await loadFixture(deployFixture);
    await nft.connect(owner).transferOwnership(newOwner.address);
    await nft.connect(newOwner).acceptOwnership();

    expect(await nft.owner()).to.equal(newOwner.address);
    const admins = await nft.getAdmins();
    expect(admins).to.include(newOwner.address);
    expect(admins).to.not.include(owner.address);
    await expect(nft.connect(owner).safeMint(owner.address)).to.be.revertedWithCustomError(
      nft,
      'OnlyAdminsCanCallThisFunction'
    );
    await nft.connect(newOwner).safeMint(newOwner.address);
    expect(await nft.balanceOf(newOwner.address)).to.equal(1n);
  });

  it('old owner cannot accept on behalf of pending owner', async () => {
    const { nft, owner, newOwner } = await loadFixture(deployFixture);
    await nft.connect(owner).transferOwnership(newOwner.address);
    await expect(nft.connect(owner).acceptOwnership()).to.be.revertedWithCustomError(
      nft,
      'OwnershipTransferUnauthorized'
    );
  });

  it('cancelOwnershipTransfer clears pending owner', async () => {
    const { nft, owner, newOwner } = await loadFixture(deployFixture);
    await nft.connect(owner).transferOwnership(newOwner.address);
    await nft.connect(owner).cancelOwnershipTransfer();
    expect(await nft.pendingOwner()).to.equal(ethers.ZeroAddress);
    expect(await nft.owner()).to.equal(owner.address);
  });

  it('updateAdmin cannot remove the last admin', async () => {
    const { nft, owner } = await loadFixture(deployFixture);
    const admins = await nft.getAdmins();
    expect(admins.length).to.equal(1);
    await expect(
      nft.connect(owner).updateAdmin(owner.address, false)
    ).to.be.revertedWithCustomError(nft, 'UpdateadminCannotRemoveLastAdmin');
  });
});
