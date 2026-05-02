import { loadFixture, time } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import hre from 'hardhat';
import { deployExerciseSupplementFixture } from './fixtures';

const { ethers } = hre as any;

/**
 * Build the digest matching `checkValidSignature` expectations:
 *   keccak256(abi.encodePacked(msg.sender, _day, _stepIndex, _data, chainId))
 * then EIP-191 prefixed.
 */
async function buildDigest(
  callerAddress: string,
  day: number[],
  stepIndex: number[],
  data: [number, number],
  chainId: bigint
) {
  const packed = ethers.solidityPacked(
    ['address', 'uint256[]', 'uint256[]', 'uint64[2]', 'uint256'],
    [callerAddress, day, stepIndex, data, chainId]
  );
  const hash = ethers.keccak256(packed);
  return hash;
}

async function signMessage(signer: any, hash: string) {
  // ethers v6: signMessage takes raw bytes; we pass arrayified hash so it
  // applies EIP-191 prefix internally — matching toEthSignedMessageHash on-chain.
  return signer.signMessage(ethers.getBytes(hash));
}

describe('ExerciseSupplementNFT — checkValidSignature', function () {
  async function setup() {
    const ctx = await loadFixture(deployExerciseSupplementFixture);
    const { nft, owner, other } = ctx;
    // 'other' = security signer
    await nft.connect(owner).updateSecurityAddress(other.address);
    // owner gets ALLOWED_CONTRACTS_CHALLENGE so it can call checkValidSignature
    const role = await nft.ALLOWED_CONTRACTS_CHALLENGE();
    await nft.connect(owner).batchGrantRole(role, [owner.address]);
    return { ...ctx, signer: other };
  }

  it('valid signature passes', async function () {
    const { nft, owner, signer } = await setup();
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const now = await time.latest();
    const deadline = now + 60;
    const day = [10];
    const stepIndex = [1000];
    const data: [number, number] = [1, deadline];

    const hash = await buildDigest(owner.address, day, stepIndex, data, chainId);
    const sig = await signMessage(signer, hash);

    await expect(
      nft.connect(owner).checkValidSignature(day, stepIndex, data, sig)
    ).to.not.be.reverted;
  });

  it('reverts when signer is wrong', async function () {
    const { nft, owner, attacker } = await setup();
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const now = await time.latest();
    const deadline = now + 60;
    const day = [10];
    const stepIndex = [1000];
    const data: [number, number] = [1, deadline];

    const hash = await buildDigest(owner.address, day, stepIndex, data, chainId);
    // sign with attacker, not security address
    const sig = await signMessage(attacker, hash);

    await expect(
      nft.connect(owner).checkValidSignature(day, stepIndex, data, sig)
    ).to.be.revertedWith('Invalid signature');
  });

  it('reverts when deadline has passed', async function () {
    const { nft, owner, signer } = await setup();
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const now = await time.latest();
    const deadline = now - 1; // already past
    const day = [10];
    const stepIndex = [1000];
    const data: [number, number] = [1, deadline];

    const hash = await buildDigest(owner.address, day, stepIndex, data, chainId);
    const sig = await signMessage(signer, hash);

    await expect(
      nft.connect(owner).checkValidSignature(day, stepIndex, data, sig)
    ).to.be.revertedWith('Signature is inaccessible');
  });

  it('reverts when deadline is more than 10 minutes in the future', async function () {
    const { nft, owner, signer } = await setup();
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const now = await time.latest();
    const deadline = now + 11 * 60; // 11 min in future
    const day = [10];
    const stepIndex = [1000];
    const data: [number, number] = [1, deadline];

    const hash = await buildDigest(owner.address, day, stepIndex, data, chainId);
    const sig = await signMessage(signer, hash);

    await expect(
      nft.connect(owner).checkValidSignature(day, stepIndex, data, sig)
    ).to.be.revertedWith('Signature is inaccessible');
  });

  it('replay (same signature 2nd time) reverts', async function () {
    const { nft, owner, signer } = await setup();
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const now = await time.latest();
    const deadline = now + 60;
    const day = [10];
    const stepIndex = [1000];
    const data: [number, number] = [1, deadline];

    const hash = await buildDigest(owner.address, day, stepIndex, data, chainId);
    const sig = await signMessage(signer, hash);

    await nft.connect(owner).checkValidSignature(day, stepIndex, data, sig);
    await expect(
      nft.connect(owner).checkValidSignature(day, stepIndex, data, sig)
    ).to.be.revertedWith('Hash was used');
  });

  it('non-ALLOWED_CONTRACTS_CHALLENGE caller reverts', async function () {
    const { nft, attacker } = await setup();
    await expect(
      nft.connect(attacker).checkValidSignature([1], [1], [1, 1], '0x')
    ).to.be.revertedWith(/AccessControl/);
  });

  it('reverts SECURITY ADDR NOT SET when securityAddress uninitialized', async function () {
    // Deploy fresh proxy without calling updateSecurityAddress
    const { upgrades } = hre as any;
    const Factory = await ethers.getContractFactory('ExerciseSupplementNFT');
    const [a, b, c, d] = await ethers.getSigners();
    const fresh = await upgrades.deployProxy(
      Factory,
      ['ipfs://test/', a.address, b.address, c.address],
      { kind: 'uups', initializer: 'initialize' }
    );
    await fresh.waitForDeployment();
    // grant ALLOWED_CONTRACTS_CHALLENGE so AccessControl passes
    const role = await fresh.ALLOWED_CONTRACTS_CHALLENGE();
    await fresh.connect(a).batchGrantRole(role, [a.address]);

    await expect(
      fresh.connect(a).checkValidSignature([1], [1], [1, 1], '0x')
    ).to.be.revertedWith('SECURITY ADDR NOT SET');
  });

  it('boundary: deadline exactly == block.timestamp + 10 minutes (max valid)', async function () {
    const { nft, owner, signer } = await setup();
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const now = await time.latest();
    const deadline = now + 10 * 60; // exactly at 10 min boundary
    const day = [10];
    const stepIndex = [1000];
    const data: [number, number] = [1, deadline];

    const hash = await buildDigest(owner.address, day, stepIndex, data, chainId);
    const sig = await signMessage(signer, hash);

    await expect(
      nft.connect(owner).checkValidSignature(day, stepIndex, data, sig)
    ).to.not.be.reverted;
  });

  it('boundary: deadline exactly == block.timestamp (no future) → passes', async function () {
    const { nft, owner, signer } = await setup();
    const chainId = (await ethers.provider.getNetwork()).chainId;
    // We need deadline == block.timestamp at execution, but tx executes at next block.
    // Use deadline = current+1 to align with next-block timestamp
    const now = await time.latest();
    const deadline = now + 1;
    const day = [10];
    const stepIndex = [1000];
    const data: [number, number] = [1, deadline];

    const hash = await buildDigest(owner.address, day, stepIndex, data, chainId);
    const sig = await signMessage(signer, hash);

    await expect(
      nft.connect(owner).checkValidSignature(day, stepIndex, data, sig)
    ).to.not.be.reverted;
  });

  it('handles multiple-element day array', async function () {
    const { nft, owner, signer } = await setup();
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const now = await time.latest();
    const deadline = now + 60;
    const day = [10, 20, 30];
    const stepIndex = [100, 200, 300];
    const data: [number, number] = [1, deadline];

    const hash = await buildDigest(owner.address, day, stepIndex, data, chainId);
    const sig = await signMessage(signer, hash);

    await expect(
      nft.connect(owner).checkValidSignature(day, stepIndex, data, sig)
    ).to.not.be.reverted;
  });

  it('handles empty arrays', async function () {
    const { nft, owner, signer } = await setup();
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const now = await time.latest();
    const deadline = now + 60;
    const day: number[] = [];
    const stepIndex: number[] = [];
    const data: [number, number] = [1, deadline];

    const hash = await buildDigest(owner.address, day, stepIndex, data, chainId);
    const sig = await signMessage(signer, hash);

    await expect(
      nft.connect(owner).checkValidSignature(day, stepIndex, data, sig)
    ).to.not.be.reverted;
  });

  it('different msg.sender produces different hash → reverts', async function () {
    const { nft, owner, attacker, signer } = await setup();
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const now = await time.latest();
    const deadline = now + 60;
    const day = [10];
    const stepIndex = [1000];
    const data: [number, number] = [1, deadline];

    // Sign for owner.address
    const hash = await buildDigest(owner.address, day, stepIndex, data, chainId);
    const sig = await signMessage(signer, hash);

    // Grant role to attacker too so AccessControl passes
    const role = await nft.ALLOWED_CONTRACTS_CHALLENGE();
    await nft.connect(owner).batchGrantRole(role, [attacker.address]);

    // Now attacker tries to use owner's signature → fails
    await expect(
      nft.connect(attacker).checkValidSignature(day, stepIndex, data, sig)
    ).to.be.revertedWith('Invalid signature');
  });

  it('different chainId in digest → reverts', async function () {
    const { nft, owner, signer } = await setup();
    const wrongChainId = 999n; // not actual chain
    const now = await time.latest();
    const deadline = now + 60;
    const day = [10];
    const stepIndex = [1000];
    const data: [number, number] = [1, deadline];

    const hash = await buildDigest(
      owner.address,
      day,
      stepIndex,
      data,
      wrongChainId
    );
    const sig = await signMessage(signer, hash);

    await expect(
      nft.connect(owner).checkValidSignature(day, stepIndex, data, sig)
    ).to.be.revertedWith('Invalid signature');
  });

  it('different day array values produce different hash → reverts', async function () {
    const { nft, owner, signer } = await setup();
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const now = await time.latest();
    const deadline = now + 60;
    const day = [10];
    const stepIndex = [1000];
    const data: [number, number] = [1, deadline];

    const hash = await buildDigest(owner.address, day, stepIndex, data, chainId);
    const sig = await signMessage(signer, hash);

    // Submit with tampered day array
    await expect(
      nft.connect(owner).checkValidSignature([11], stepIndex, data, sig)
    ).to.be.revertedWith('Invalid signature');
  });

  it('different stepIndex array values → reverts', async function () {
    const { nft, owner, signer } = await setup();
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const now = await time.latest();
    const deadline = now + 60;
    const day = [10];
    const stepIndex = [1000];
    const data: [number, number] = [1, deadline];

    const hash = await buildDigest(owner.address, day, stepIndex, data, chainId);
    const sig = await signMessage(signer, hash);

    await expect(
      nft.connect(owner).checkValidSignature(day, [9999], data, sig)
    ).to.be.revertedWith('Invalid signature');
  });

  it('updateSecurityAddress switches accepted signer', async function () {
    const { nft, owner, attacker, signer } = await setup();
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const now = await time.latest();
    const deadline = now + 60;
    const day = [10];
    const stepIndex = [1000];
    const data: [number, number] = [1, deadline];

    // Switch security address to attacker
    await nft.connect(owner).updateSecurityAddress(attacker.address);

    // Signature signed by old signer (signer) is now invalid
    const hashOld = await buildDigest(
      owner.address,
      day,
      stepIndex,
      data,
      chainId
    );
    const sigOld = await signMessage(signer, hashOld);
    await expect(
      nft.connect(owner).checkValidSignature(day, stepIndex, data, sigOld)
    ).to.be.revertedWith('Invalid signature');

    // Signature signed by new signer (attacker) passes
    const sigNew = await signMessage(attacker, hashOld);
    await expect(
      nft.connect(owner).checkValidSignature(day, stepIndex, data, sigNew)
    ).to.not.be.reverted;
  });
});
