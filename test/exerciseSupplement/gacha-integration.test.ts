import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import hre from 'hardhat';
import { deployExerciseSupplementFixture } from './fixtures';

const { ethers } = hre as any;

// GachaRewardDestination enum
const SEND_TO_CHALLENGER = 0;
const SEND_TO_CHALLENGE_CONTRACT = 1;
const SEND_TO_SPONSOR = 2;

async function deployChallenge(challenger: string) {
  const Factory = await ethers.getContractFactory('MockGachaChallenge');
  const ch = await Factory.deploy(challenger, ethers.ZeroAddress);
  await ch.waitForDeployment();
  return ch;
}

describe('ExerciseSupplementNFT — Gacha integration', function () {
  describe('updateGachaContractAddress', function () {
    it('add new gacha entry appears in getListGachaAddress', async function () {
      const { nft, owner, other } = await loadFixture(
        deployExerciseSupplementFixture
      );
      await nft
        .connect(owner)
        .updateGachaContractAddress(other.address, SEND_TO_SPONSOR, true);
      const list = await nft.getListGachaAddress();
      expect(list).to.include(other.address);
    });

    it('updating existing entry changes destination', async function () {
      const { nft, owner, other } = await loadFixture(
        deployExerciseSupplementFixture
      );
      await nft
        .connect(owner)
        .updateGachaContractAddress(other.address, SEND_TO_SPONSOR, true);
      // call again with different destination → updates
      await nft
        .connect(owner)
        .updateGachaContractAddress(
          other.address,
          SEND_TO_CHALLENGE_CONTRACT,
          true
        );
      // getListGachaAddress still has 1 entry
      const list = await nft.getListGachaAddress();
      expect(list.length).to.equal(1);
    });

    it('remove entry shrinks the list', async function () {
      const { nft, owner, other } = await loadFixture(
        deployExerciseSupplementFixture
      );
      await nft
        .connect(owner)
        .updateGachaContractAddress(other.address, SEND_TO_SPONSOR, true);
      await nft
        .connect(owner)
        .updateGachaContractAddress(other.address, SEND_TO_SPONSOR, false);
      const list = await nft.getListGachaAddress();
      expect(list).to.not.include(other.address);
    });
  });

  describe('getDestinationAddress', function () {
    it('returns challengerAddress when gacha not registered (fallback)', async function () {
      const { nft, owner, other, challenger } = await loadFixture(
        deployExerciseSupplementFixture
      );
      const challenge = await deployChallenge(challenger.address);
      await challenge.setIsFinished(false);
      await challenge.setIsSuccess(true);

      // gacha NOT registered
      const dest = await nft.getDestinationAddress(
        await challenge.getAddress(),
        other.address
      );
      expect(dest).to.equal(challenger.address);
    });

    it('SEND_TO_CHALLENGE_CONTRACT + isSuccess → returns challenger', async function () {
      const { nft, owner, other, challenger } = await loadFixture(
        deployExerciseSupplementFixture
      );
      const challenge = await deployChallenge(challenger.address);
      await challenge.setIsFinished(true);
      await challenge.setIsSuccess(true);

      await nft
        .connect(owner)
        .updateGachaContractAddress(
          other.address,
          SEND_TO_CHALLENGE_CONTRACT,
          true
        );

      const dest = await nft.getDestinationAddress(
        await challenge.getAddress(),
        other.address
      );
      expect(dest).to.equal(challenger.address);
    });

    it('SEND_TO_CHALLENGE_CONTRACT + !isSuccess + isFinished → returns sponsor', async function () {
      const { nft, owner, other, challenger } = await loadFixture(
        deployExerciseSupplementFixture
      );
      const challenge = await deployChallenge(challenger.address);
      await challenge.setIsFinished(true);
      await challenge.setIsSuccess(false);

      await nft
        .connect(owner)
        .updateGachaContractAddress(
          other.address,
          SEND_TO_CHALLENGE_CONTRACT,
          true
        );

      const sponsor = await challenge.sponsor();
      const dest = await nft.getDestinationAddress(
        await challenge.getAddress(),
        other.address
      );
      expect(dest).to.equal(sponsor);
    });

    it('SEND_TO_CHALLENGE_CONTRACT + !isSuccess + !isFinished → returns _gachaAddress', async function () {
      const { nft, owner, other, challenger } = await loadFixture(
        deployExerciseSupplementFixture
      );
      const challenge = await deployChallenge(challenger.address);
      await challenge.setIsFinished(false);
      await challenge.setIsSuccess(false);

      await nft
        .connect(owner)
        .updateGachaContractAddress(
          other.address,
          SEND_TO_CHALLENGE_CONTRACT,
          true
        );

      const dest = await nft.getDestinationAddress(
        await challenge.getAddress(),
        other.address
      );
      expect(dest).to.equal(other.address);
    });

    it('SEND_TO_SPONSOR → always returns sponsor', async function () {
      const { nft, owner, other, challenger } = await loadFixture(
        deployExerciseSupplementFixture
      );
      const challenge = await deployChallenge(challenger.address);
      await challenge.setIsFinished(true);
      await challenge.setIsSuccess(true);
      const sponsor = await challenge.sponsor();

      await nft
        .connect(owner)
        .updateGachaContractAddress(other.address, SEND_TO_SPONSOR, true);

      const dest = await nft.getDestinationAddress(
        await challenge.getAddress(),
        other.address
      );
      expect(dest).to.equal(sponsor);
    });

    it('SEND_TO_CHALLENGER → falls through to challenger fallback', async function () {
      const { nft, owner, other, challenger } = await loadFixture(
        deployExerciseSupplementFixture
      );
      const challenge = await deployChallenge(challenger.address);

      // SEND_TO_CHALLENGER has no explicit branch → falls through to default
      await nft
        .connect(owner)
        .updateGachaContractAddress(other.address, SEND_TO_CHALLENGER, true);

      const dest = await nft.getDestinationAddress(
        await challenge.getAddress(),
        other.address
      );
      expect(dest).to.equal(challenger.address);
    });
  });

  describe('Multiple gacha entries + ordering', function () {
    it('two distinct gacha addresses → both stored independently', async function () {
      const { nft, owner, other, attacker } = await loadFixture(
        deployExerciseSupplementFixture
      );
      await nft
        .connect(owner)
        .updateGachaContractAddress(other.address, SEND_TO_SPONSOR, true);
      await nft
        .connect(owner)
        .updateGachaContractAddress(
          attacker.address,
          SEND_TO_CHALLENGE_CONTRACT,
          true
        );
      const list = await nft.getListGachaAddress();
      expect(list.length).to.equal(2);
      expect(list).to.include(other.address);
      expect(list).to.include(attacker.address);
    });

    it('updating one entry does not affect another', async function () {
      const { nft, owner, other, attacker, challenger } = await loadFixture(
        deployExerciseSupplementFixture
      );
      const challenge = await deployChallenge(challenger.address);

      await nft
        .connect(owner)
        .updateGachaContractAddress(other.address, SEND_TO_SPONSOR, true);
      await nft
        .connect(owner)
        .updateGachaContractAddress(
          attacker.address,
          SEND_TO_CHALLENGE_CONTRACT,
          true
        );

      // Update other's destination
      await nft
        .connect(owner)
        .updateGachaContractAddress(
          other.address,
          SEND_TO_CHALLENGE_CONTRACT,
          true
        );

      // attacker entry still SEND_TO_CHALLENGE_CONTRACT — verify via getDestinationAddress
      await challenge.setIsSuccess(true);
      const destAttacker = await nft.getDestinationAddress(
        await challenge.getAddress(),
        attacker.address
      );
      expect(destAttacker).to.equal(challenger.address); // SEND_TO_CHALLENGE_CONTRACT + isSuccess
    });

    it('removing middle entry: swap-pop pattern preserves remaining', async function () {
      const { nft, owner, other, attacker, donation } = await loadFixture(
        deployExerciseSupplementFixture
      );
      // Add 3 entries
      await nft
        .connect(owner)
        .updateGachaContractAddress(other.address, SEND_TO_SPONSOR, true);
      await nft
        .connect(owner)
        .updateGachaContractAddress(
          attacker.address,
          SEND_TO_CHALLENGE_CONTRACT,
          true
        );
      await nft
        .connect(owner)
        .updateGachaContractAddress(donation.address, SEND_TO_CHALLENGER, true);

      // Remove middle (attacker)
      await nft
        .connect(owner)
        .updateGachaContractAddress(
          attacker.address,
          SEND_TO_CHALLENGE_CONTRACT,
          false
        );

      const list = await nft.getListGachaAddress();
      expect(list.length).to.equal(2);
      expect(list).to.include(other.address);
      expect(list).to.include(donation.address);
      expect(list).to.not.include(attacker.address);
    });

    it('remove non-existing entry → no-op (does not revert)', async function () {
      const { nft, owner, other } = await loadFixture(
        deployExerciseSupplementFixture
      );
      // Remove without prior add
      await expect(
        nft
          .connect(owner)
          .updateGachaContractAddress(other.address, SEND_TO_SPONSOR, false)
      ).to.not.be.reverted;
      expect((await nft.getListGachaAddress()).length).to.equal(0);
    });

    it('non-role caller reverts updateGachaContractAddress', async function () {
      const { nft, attacker, other } = await loadFixture(
        deployExerciseSupplementFixture
      );
      await expect(
        nft
          .connect(attacker)
          .updateGachaContractAddress(other.address, SEND_TO_SPONSOR, true)
      ).to.be.revertedWith(/AccessControl/);
    });
  });

  describe('getDestinationAddress edge cases', function () {
    it('SEND_TO_CHALLENGE_CONTRACT + isSuccess=false + isFinished=false → returns _gachaAddress', async function () {
      const { nft, owner, other, challenger } = await loadFixture(
        deployExerciseSupplementFixture
      );
      const challenge = await deployChallenge(challenger.address);
      await challenge.setIsSuccess(false);
      await challenge.setIsFinished(false);

      await nft
        .connect(owner)
        .updateGachaContractAddress(
          other.address,
          SEND_TO_CHALLENGE_CONTRACT,
          true
        );

      const dest = await nft.getDestinationAddress(
        await challenge.getAddress(),
        other.address
      );
      expect(dest).to.equal(other.address);
    });

    it('SEND_TO_SPONSOR + isSuccess + sponsor = challenger (default mock) → returns sponsor', async function () {
      const { nft, owner, other, challenger } = await loadFixture(
        deployExerciseSupplementFixture
      );
      const challenge = await deployChallenge(challenger.address);
      await challenge.setIsSuccess(true);

      await nft
        .connect(owner)
        .updateGachaContractAddress(other.address, SEND_TO_SPONSOR, true);

      const dest = await nft.getDestinationAddress(
        await challenge.getAddress(),
        other.address
      );
      // sponsor == challenger (mock constructor)
      expect(dest).to.equal(challenger.address);
    });

    it('SEND_TO_SPONSOR with custom sponsor → returns sponsor', async function () {
      const { nft, owner, other, challenger, attacker } = await loadFixture(
        deployExerciseSupplementFixture
      );
      const challenge = await deployChallenge(challenger.address);
      await challenge.setSponsor(attacker.address);

      await nft
        .connect(owner)
        .updateGachaContractAddress(other.address, SEND_TO_SPONSOR, true);

      const dest = await nft.getDestinationAddress(
        await challenge.getAddress(),
        other.address
      );
      expect(dest).to.equal(attacker.address);
    });

    it('non-registered _gachaAddress → fallback challenger', async function () {
      const { nft, owner, other, attacker, challenger } = await loadFixture(
        deployExerciseSupplementFixture
      );
      const challenge = await deployChallenge(challenger.address);
      // Register only `other`
      await nft
        .connect(owner)
        .updateGachaContractAddress(other.address, SEND_TO_SPONSOR, true);
      // Query with `attacker` (not registered)
      const dest = await nft.getDestinationAddress(
        await challenge.getAddress(),
        attacker.address
      );
      expect(dest).to.equal(challenger.address); // fallback
    });

    it('multiple gachas with different destinations: each returns correct', async function () {
      const { nft, owner, other, attacker, donation, challenger } =
        await loadFixture(deployExerciseSupplementFixture);
      const challenge = await deployChallenge(challenger.address);
      await challenge.setIsSuccess(true);

      await nft
        .connect(owner)
        .updateGachaContractAddress(other.address, SEND_TO_SPONSOR, true);
      await nft
        .connect(owner)
        .updateGachaContractAddress(
          attacker.address,
          SEND_TO_CHALLENGE_CONTRACT,
          true
        );
      await nft
        .connect(owner)
        .updateGachaContractAddress(donation.address, SEND_TO_CHALLENGER, true);

      const sponsor = await challenge.sponsor();
      expect(
        await nft.getDestinationAddress(
          await challenge.getAddress(),
          other.address
        )
      ).to.equal(sponsor); // SEND_TO_SPONSOR
      expect(
        await nft.getDestinationAddress(
          await challenge.getAddress(),
          attacker.address
        )
      ).to.equal(challenger.address); // SEND_TO_CHALLENGE_CONTRACT + isSuccess
      expect(
        await nft.getDestinationAddress(
          await challenge.getAddress(),
          donation.address
        )
      ).to.equal(challenger.address); // SEND_TO_CHALLENGER fallback
    });
  });
});
