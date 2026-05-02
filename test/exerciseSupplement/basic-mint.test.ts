import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import hre from 'hardhat';
import { deployExerciseSupplementFixture } from './fixtures';

const { ethers } = hre as any;

describe('ExerciseSupplementNFT — Basic mint', function () {
  it('reverts when caller has no MINTER_ROLE', async function () {
    const { nft, attacker, other } = await loadFixture(
      deployExerciseSupplementFixture
    );
    await expect(nft.connect(attacker).safeMint(other.address)).to.be
      .revertedWith(/AccessControl/);
  });

  it('mints sequential token ids starting from 0', async function () {
    const { nft, owner, other } = await loadFixture(
      deployExerciseSupplementFixture
    );
    await nft.connect(owner).safeMint(other.address);
    expect(await nft.ownerOf(0)).to.equal(other.address);
    await nft.connect(owner).safeMint(other.address);
    expect(await nft.ownerOf(1)).to.equal(other.address);
  });

  it('balanceOf increments per mint', async function () {
    const { nft, owner, other } = await loadFixture(
      deployExerciseSupplementFixture
    );
    expect(await nft.balanceOf(other.address)).to.equal(0n);
    await nft.connect(owner).safeMint(other.address);
    await nft.connect(owner).safeMint(other.address);
    await nft.connect(owner).safeMint(other.address);
    expect(await nft.balanceOf(other.address)).to.equal(3n);
  });

  it('emits Transfer event from address(0)', async function () {
    const { nft, owner, other } = await loadFixture(
      deployExerciseSupplementFixture
    );
    await expect(nft.connect(owner).safeMint(other.address))
      .to.emit(nft, 'Transfer')
      .withArgs(ethers.ZeroAddress, other.address, 0);
  });

  it('mint to zero address reverts (OZ guard)', async function () {
    const { nft, owner } = await loadFixture(deployExerciseSupplementFixture);
    await expect(nft.connect(owner).safeMint(ethers.ZeroAddress)).to.be
      .reverted;
  });
});
