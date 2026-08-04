import { loadFixture, time } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import hre from 'hardhat';
import { deployExerciseSupplementFixture } from './fixtures';

const { ethers } = hre as any;

// CHALLENGE-2673: keccak256(abi.encode()) with no arguments -- the fixed sentinel Detail/
// DetailV2 (and any caller with nothing variant-specific to bind) pass as _extraDataHash.
const NO_EXTRA_DATA = ethers.keccak256('0x');

/**
 * Build the digest matching `checkValidSignature` expectations:
 *   keccak256(abi.encode(msg.sender, _day, _stepIndex, _data, chainId, _extraDataHash))
 * then EIP-191 prefixed.
 *
 * CHALLENGE-2673: switched from abi.encodePacked to abi.encode (packed encoding of multiple
 * dynamic arrays back-to-back has no length delimiters between them -- distinct
 * (day, stepIndex) splits of the same flat word sequence could hash identically) and added
 * _extraDataHash, which binds every specialized achievement metric (HIIT/walking-speed/GCM)
 * this common signature previously left unsigned.
 */
async function buildDigest(
  callerAddress: string,
  day: number[],
  stepIndex: number[],
  data: [number, number],
  chainId: bigint,
  extraDataHash: string = NO_EXTRA_DATA
) {
  const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
    ['address', 'uint256[]', 'uint256[]', 'uint64[2]', 'uint256', 'bytes32'],
    [callerAddress, day, stepIndex, data, chainId, extraDataHash]
  );
  return ethers.keccak256(encoded);
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
      nft.connect(owner).checkValidSignature(day, stepIndex, data, NO_EXTRA_DATA, sig)
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
      nft.connect(owner).checkValidSignature(day, stepIndex, data, NO_EXTRA_DATA, sig)
    ).to.be.revertedWithCustomError(nft, 'InvalidSignature');
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
      nft.connect(owner).checkValidSignature(day, stepIndex, data, NO_EXTRA_DATA, sig)
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
      nft.connect(owner).checkValidSignature(day, stepIndex, data, NO_EXTRA_DATA, sig)
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

    await nft.connect(owner).checkValidSignature(day, stepIndex, data, NO_EXTRA_DATA, sig);
    await expect(
      nft.connect(owner).checkValidSignature(day, stepIndex, data, NO_EXTRA_DATA, sig)
    ).to.be.revertedWithCustomError(nft, 'HashUsed');
  });

  it('non-ALLOWED_CONTRACTS_CHALLENGE caller reverts', async function () {
    const { nft, attacker } = await setup();
    await expect(
      nft.connect(attacker).checkValidSignature([1], [1], [1, 1], NO_EXTRA_DATA, '0x')
    ).to.be.revertedWithCustomError(nft, 'AccessControlUnauthorizedAccount');
  });

  it('reverts SECURITY ADDR NOT SET when securityAddress uninitialized', async function () {
    // Deploy fresh proxy without calling updateSecurityAddress
    const { upgrades } = hre as any;
    const Factory = await ethers.getContractFactory('contracts/ExerciseSupplementNFT.sol:ExerciseSupplementNFT');
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
      fresh.connect(a).checkValidSignature([1], [1], [1, 1], NO_EXTRA_DATA, '0x')
    ).to.be.revertedWithCustomError(fresh, 'SecurityNotSet');
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
      nft.connect(owner).checkValidSignature(day, stepIndex, data, NO_EXTRA_DATA, sig)
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
      nft.connect(owner).checkValidSignature(day, stepIndex, data, NO_EXTRA_DATA, sig)
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
      nft.connect(owner).checkValidSignature(day, stepIndex, data, NO_EXTRA_DATA, sig)
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
      nft.connect(owner).checkValidSignature(day, stepIndex, data, NO_EXTRA_DATA, sig)
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
      nft.connect(attacker).checkValidSignature(day, stepIndex, data, NO_EXTRA_DATA, sig)
    ).to.be.revertedWithCustomError(nft, 'InvalidSignature');
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
      nft.connect(owner).checkValidSignature(day, stepIndex, data, NO_EXTRA_DATA, sig)
    ).to.be.revertedWithCustomError(nft, 'InvalidSignature');
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
      nft.connect(owner).checkValidSignature([11], stepIndex, data, NO_EXTRA_DATA, sig)
    ).to.be.revertedWithCustomError(nft, 'InvalidSignature');
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
      nft.connect(owner).checkValidSignature(day, [9999], data, NO_EXTRA_DATA, sig)
    ).to.be.revertedWithCustomError(nft, 'InvalidSignature');
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
      nft.connect(owner).checkValidSignature(day, stepIndex, data, NO_EXTRA_DATA, sigOld)
    ).to.be.revertedWithCustomError(nft, 'InvalidSignature');

    // Signature signed by new signer (attacker) passes
    const sigNew = await signMessage(attacker, hashOld);
    await expect(
      nft.connect(owner).checkValidSignature(day, stepIndex, data, NO_EXTRA_DATA, sigNew)
    ).to.not.be.reverted;
  });

  // CHALLENGE-2673: _extraDataHash coverage -- proves the new binding actually protects
  // whatever variant-specific fields it commits to (HIIT/walking-speed/GCM in the real
  // Challenge contracts), independent of the rest of the payload.
  describe('_extraDataHash binding (CHALLENGE-2673)', function () {
    it('a signature is only valid for the EXACT _extraDataHash it was signed for', async function () {
      const { nft, owner, signer } = await setup();
      const chainId = (await ethers.provider.getNetwork()).chainId;
      const now = await time.latest();
      const deadline = now + 60;
      const day = [10];
      const stepIndex = [1000];
      const data: [number, number] = [1, deadline];

      const realExtraDataHash = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(['uint256[]', 'uint256[]'], [[5, 60], [5, 60]])
      );
      const hash = await buildDigest(owner.address, day, stepIndex, data, chainId, realExtraDataHash);
      const sig = await signMessage(signer, hash);

      // Submitting with the SAME extraDataHash the backend actually signed for passes.
      await expect(
        nft.connect(owner).checkValidSignature(day, stepIndex, data, realExtraDataHash, sig)
      ).to.not.be.reverted;
    });

    it('tampering with the fields behind _extraDataHash (post-signing) invalidates the signature', async function () {
      const { nft, owner, signer } = await setup();
      const chainId = (await ethers.provider.getNetwork()).chainId;
      const now = await time.latest();
      const deadline = now + 60;
      const day = [10];
      const stepIndex = [1000];
      const data: [number, number] = [1, deadline];

      // Backend signs for intervals=[5], totalSeconds=[60] (e.g. a real HIIT submission).
      const signedExtraDataHash = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(['uint256[]', 'uint256[]'], [[5], [60]])
      );
      const hash = await buildDigest(owner.address, day, stepIndex, data, chainId, signedExtraDataHash);
      const sig = await signMessage(signer, hash);

      // Caller submits with DIFFERENT intervals=[999] post-signing -- recomputed
      // _extraDataHash no longer matches what was signed.
      const tamperedExtraDataHash = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(['uint256[]', 'uint256[]'], [[999], [60]])
      );
      await expect(
        nft.connect(owner).checkValidSignature(day, stepIndex, data, tamperedExtraDataHash, sig)
      ).to.be.revertedWithCustomError(nft, 'InvalidSignature');
    });

    it('a signature bound to NO_EXTRA_DATA cannot be reused with a non-empty _extraDataHash', async function () {
      const { nft, owner, signer } = await setup();
      const chainId = (await ethers.provider.getNetwork()).chainId;
      const now = await time.latest();
      const deadline = now + 60;
      const day = [10];
      const stepIndex = [1000];
      const data: [number, number] = [1, deadline];

      const hash = await buildDigest(owner.address, day, stepIndex, data, chainId, NO_EXTRA_DATA);
      const sig = await signMessage(signer, hash);

      const someExtraDataHash = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(['uint256[]'], [[1]])
      );
      await expect(
        nft.connect(owner).checkValidSignature(day, stepIndex, data, someExtraDataHash, sig)
      ).to.be.revertedWithCustomError(nft, 'InvalidSignature');
    });
  });
});
