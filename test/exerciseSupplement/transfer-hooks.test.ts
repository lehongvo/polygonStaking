import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import hre from 'hardhat';
import { deployExerciseSupplementFixture } from './fixtures';

const { ethers } = hre as any;

describe('ExerciseSupplementNFT — Transfer hooks (_beforeTokenTransfer)', function () {
  it('user → user transfer succeeds and updates balances', async function () {
    const { nft, owner, other, attacker } = await loadFixture(
      deployExerciseSupplementFixture
    );
    await nft.connect(owner).safeMint(other.address);
    await nft.connect(other).transferFrom(other.address, attacker.address, 0);
    expect(await nft.ownerOf(0)).to.equal(attacker.address);
    expect(await nft.balanceOf(other.address)).to.equal(0n);
    expect(await nft.balanceOf(attacker.address)).to.equal(1n);
  });

  it('mint (from=address(0)) skips _historySendNFT recording', async function () {
    const { nft, owner, other } = await loadFixture(
      deployExerciseSupplementFixture
    );
    await nft.connect(owner).safeMint(other.address);
    expect(await nft.getHistoryNFT(0, other.address)).to.equal(
      ethers.ZeroAddress
    );
  });

  it('transfer to ALLOWED_CONTRACTS_CHALLENGE records sender + reverts when challenge finished', async function () {
    const { nft, owner, other } = await loadFixture(
      deployExerciseSupplementFixture
    );
    // Deploy a mock challenge that returns isFinished=false initially
    const ChallengeFactory =
      await ethers.getContractFactory('MockGachaChallenge');
    const challenge = await ChallengeFactory.deploy(
      other.address,
      ethers.ZeroAddress
    );
    await challenge.waitForDeployment();
    await challenge.setIsFinished(false);

    // Grant ALLOWED_CONTRACTS_CHALLENGE to challenge
    const role = await nft.ALLOWED_CONTRACTS_CHALLENGE();
    await nft
      .connect(owner)
      .batchGrantRole(role, [await challenge.getAddress()]);

    await nft.connect(owner).safeMint(other.address);
    // user → challenge (not finished) — should succeed
    await nft
      .connect(other)
      .transferFrom(other.address, await challenge.getAddress(), 0);
    expect(await nft.ownerOf(0)).to.equal(await challenge.getAddress());
    // history recorded
    expect(
      await nft.getHistoryNFT(0, await challenge.getAddress())
    ).to.equal(other.address);
  });

  it('reverts when transferring to a finished challenge contract', async function () {
    const { nft, owner, other } = await loadFixture(
      deployExerciseSupplementFixture
    );
    const ChallengeFactory =
      await ethers.getContractFactory('MockGachaChallenge');
    const challenge = await ChallengeFactory.deploy(
      other.address,
      ethers.ZeroAddress
    );
    await challenge.waitForDeployment();
    await challenge.setIsFinished(true);

    const role = await nft.ALLOWED_CONTRACTS_CHALLENGE();
    await nft
      .connect(owner)
      .batchGrantRole(role, [await challenge.getAddress()]);

    await nft.connect(owner).safeMint(other.address);
    await expect(
      nft
        .connect(other)
        .transferFrom(other.address, await challenge.getAddress(), 0)
    ).to.be.revertedWith('ERC721: CHALLENGE WAS FINISHED');
  });

  it('multiple transfers user → user → user, ownership chain correct', async function () {
    const { nft, owner, other, attacker, challenger } = await loadFixture(
      deployExerciseSupplementFixture
    );
    await nft.connect(owner).safeMint(other.address);
    await nft.connect(other).transferFrom(other.address, attacker.address, 0);
    await nft
      .connect(attacker)
      .transferFrom(attacker.address, challenger.address, 0);
    expect(await nft.ownerOf(0)).to.equal(challenger.address);
  });

  it('approval workflow: approve → transferFrom by approved', async function () {
    const { nft, owner, other, attacker } = await loadFixture(
      deployExerciseSupplementFixture
    );
    await nft.connect(owner).safeMint(other.address);
    await nft.connect(other).approve(attacker.address, 0);
    await nft
      .connect(attacker)
      .transferFrom(other.address, attacker.address, 0);
    expect(await nft.ownerOf(0)).to.equal(attacker.address);
  });

  it('setApprovalForAll: operator can transfer all owner tokens', async function () {
    const { nft, owner, other, attacker } = await loadFixture(
      deployExerciseSupplementFixture
    );
    await nft.connect(owner).safeMint(other.address);
    await nft.connect(owner).safeMint(other.address);
    await nft.connect(other).setApprovalForAll(attacker.address, true);
    await nft
      .connect(attacker)
      .transferFrom(other.address, attacker.address, 0);
    await nft
      .connect(attacker)
      .transferFrom(other.address, attacker.address, 1);
    expect(await nft.balanceOf(attacker.address)).to.equal(2n);
  });

  it('burn (transfer to address(0)): allowed via burn function', async function () {
    const { nft, owner, other } = await loadFixture(
      deployExerciseSupplementFixture
    );
    await nft.connect(owner).safeMint(other.address);
    await nft.connect(other).burn(0);
    await expect(nft.ownerOf(0)).to.be.reverted;
  });

  it('_historySendNFT records sender for transfer to challenge', async function () {
    const { nft, owner, other, attacker } = await loadFixture(
      deployExerciseSupplementFixture
    );
    const Challenge = await ethers.getContractFactory('MockGachaChallenge');
    const ch = await Challenge.deploy(other.address, ethers.ZeroAddress);
    await ch.waitForDeployment();
    await ch.setIsFinished(false);

    const role = await nft.ALLOWED_CONTRACTS_CHALLENGE();
    await nft.connect(owner).batchGrantRole(role, [await ch.getAddress()]);

    await nft.connect(owner).safeMint(other.address);
    await nft.connect(other).transferFrom(other.address, await ch.getAddress(), 0);

    expect(await nft.getHistoryNFT(0, await ch.getAddress())).to.equal(
      other.address
    );
  });

  it('non-owner non-approved cannot transferFrom', async function () {
    const { nft, owner, other, attacker } = await loadFixture(
      deployExerciseSupplementFixture
    );
    await nft.connect(owner).safeMint(other.address);
    await expect(
      nft.connect(attacker).transferFrom(other.address, attacker.address, 0)
    ).to.be.reverted;
  });
});
