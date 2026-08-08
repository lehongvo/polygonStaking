import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers.js';
import { expect } from 'chai';
import hre from 'hardhat';

const { ethers } = hre as any;

// CHALLENGE-2703: the one-SBT-per-participant invariant was previously enforced only in
// recordChallengeAndMint (balanceOf(participant)==0). safeMint and batchMint had no such check,
// so an address could receive a second SBT through either route -- including cross-route (mint
// via recordChallengeAndMint, then a second one via safeMint or batchMint, or vice versa).
// All three now share the internal _mintUniqueSbt guard.
async function deployFixture() {
  const [owner, user, other] = await ethers.getSigners();
  const Factory = await ethers.getContractFactory('YOBOWEB3WALK');
  const nft = await Factory.deploy('ipfs://test/');
  await nft.waitForDeployment();
  return { nft, owner, user, other };
}

describe('YOBOWEB3WALK — one-SBT-per-participant invariant across every mint route (CHALLENGE-2703)', () => {
  it('safeMint twice to the same address → second call reverts ParticipantAlreadyHasSbt (the actual bug)', async () => {
    const { nft, owner, user } = await loadFixture(deployFixture);
    await nft.connect(owner).safeMint(user.address);
    expect(await nft.balanceOf(user.address)).to.equal(1n);
    await expect(nft.connect(owner).safeMint(user.address)).to.be.revertedWithCustomError(
      nft,
      'ParticipantAlreadyHasSbt'
    );
    expect(await nft.balanceOf(user.address)).to.equal(1n);
  });

  it('batchMint with a duplicate recipient in the SAME batch → reverts, no partial mint persists', async () => {
    const { nft, owner, user, other } = await loadFixture(deployFixture);
    await expect(
      nft.connect(owner).batchMint([user.address, other.address, user.address])
    ).to.be.revertedWithCustomError(nft, 'ParticipantAlreadyHasSbt');
    // Atomic revert: even other.address's mint (which ran before the duplicate was hit) must not persist.
    expect(await nft.balanceOf(user.address)).to.equal(0n);
    expect(await nft.balanceOf(other.address)).to.equal(0n);
  });

  it('batchMint recipient who already holds an SBT (minted earlier via safeMint) → reverts', async () => {
    const { nft, owner, user, other } = await loadFixture(deployFixture);
    await nft.connect(owner).safeMint(user.address);
    await expect(
      nft.connect(owner).batchMint([other.address, user.address])
    ).to.be.revertedWithCustomError(nft, 'ParticipantAlreadyHasSbt');
    expect(await nft.balanceOf(other.address)).to.equal(0n); // atomic: earlier entry in the same batch also rolled back
  });

  it('cross-route: recordChallengeAndMint then safeMint to the SAME address → second call reverts', async () => {
    const { nft, owner, user } = await loadFixture(deployFixture);
    await nft.connect(owner).recordChallengeAndMint(user.address);
    await expect(nft.connect(owner).safeMint(user.address)).to.be.revertedWithCustomError(
      nft,
      'ParticipantAlreadyHasSbt'
    );
  });

  it('cross-route: safeMint then recordChallengeAndMint to the SAME address → second call reverts', async () => {
    const { nft, owner, user } = await loadFixture(deployFixture);
    await nft.connect(owner).safeMint(user.address);
    await expect(nft.connect(owner).recordChallengeAndMint(user.address)).to.be.revertedWithCustomError(
      nft,
      'ParticipantAlreadyHasSbt'
    );
  });

  it('batchMint with all-distinct, first-time recipients → succeeds, one SBT each', async () => {
    const { nft, owner, user, other } = await loadFixture(deployFixture);
    await nft.connect(owner).batchMint([user.address, other.address]);
    expect(await nft.balanceOf(user.address)).to.equal(1n);
    expect(await nft.balanceOf(other.address)).to.equal(1n);
  });
});
