import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import hre from 'hardhat';
import { deployExerciseSupplementFixture } from './fixtures';

const { ethers } = hre as any;

/**
 * Tests cover all branches of safeMintNFT(...) plus the helpers.
 * Default fixture sets:
 *   listToleranceAmount = [2, 4]
 *   listNftSpecialConditionInfo.targetStepPerDay = 1   (rest 0)
 * which means inputs with `_goal=0` skip the special-NFT path and route to the
 * fallback else branch.
 */

async function setupAllowedChallenge(nft: any, ownerAcc: any) {
  const role = await nft.ALLOWED_CONTRACTS_CHALLENGE();
  await nft.connect(ownerAcc).batchGrantRole(role, [ownerAcc.address]);
}

describe('ExerciseSupplementNFT — safeMintNFT (reward distribution logic)', function () {
  describe('Access control', function () {
    it('non-ALLOWED_CONTRACTS_CHALLENGE caller reverts', async function () {
      const { nft, attacker, challenger } = await loadFixture(
        deployExerciseSupplementFixture
      );
      await expect(
        nft
          .connect(attacker)
          .safeMintNFT(
            0,
            0,
            0,
            ethers.ZeroAddress,
            0,
            0,
            ethers.ZeroAddress,
            challenger.address
          )
      ).to.be.revertedWith(/AccessControl/);
    });
  });

  describe('Fallback (normal NFT) branch', function () {
    it('mints from listNftAddress[0] when not eligible for special NFT', async function () {
      const { nft, owner, normalNft, challenger } = await loadFixture(
        deployExerciseSupplementFixture
      );
      await setupAllowedChallenge(nft, owner);
      await nft
        .connect(owner)
        .updateNftListAddress(await normalNft.getAddress(), true, true);

      const before = await normalNft.balanceOf(challenger.address);
      await nft
        .connect(owner)
        .safeMintNFT(
          0,
          0,
          0,
          ethers.ZeroAddress,
          0,
          0,
          ethers.ZeroAddress,
          challenger.address
        );
      expect(await normalNft.balanceOf(challenger.address)).to.equal(
        before + 1n
      );
    });

    it('returns (normalNft, nextId) tuple', async function () {
      const { nft, owner, normalNft, challenger } = await loadFixture(
        deployExerciseSupplementFixture
      );
      await setupAllowedChallenge(nft, owner);
      await nft
        .connect(owner)
        .updateNftListAddress(await normalNft.getAddress(), true, true);

      const result = await nft
        .connect(owner)
        .safeMintNFT.staticCall(
          0,
          0,
          0,
          ethers.ZeroAddress,
          0,
          0,
          ethers.ZeroAddress,
          challenger.address
        );
      expect(result[0]).to.equal(await normalNft.getAddress());
    });
  });

  describe('Special NFT tier 0 branch (qualifying without donation)', function () {
    it('mints listSpecialNftAddress[0] when conditions match', async function () {
      const { nft, owner, specialNft0, challenger } = await loadFixture(
        deployExerciseSupplementFixture
      );
      await setupAllowedChallenge(nft, owner);
      // Special condition: targetStepPerDay=10, challengeDuration=10, dividendSuccess=98
      await nft
        .connect(owner)
        .updateSpecialConditionInfo(10, 10, 0, 0, 0, 98);
      await nft
        .connect(owner)
        .updateSpecialNftAddress(await specialNft0.getAddress(), true);

      // _goal=10 ≥ 10, _duration=10 ≥ 10, depositCondition true (totalReward=0 ≥ 0)
      // _awardReceivers ≠ donation → else branch
      // _dayRequired=10 ≥ duration - duration/tolerance[0]=10-(10/2)=5 → tier 0 mint
      const before = await specialNft0.balanceOf(challenger.address);
      await nft
        .connect(owner)
        .safeMintNFT(
          10,
          10,
          10,
          ethers.ZeroAddress,
          0,
          50,
          challenger.address,
          challenger.address
        );
      expect(await specialNft0.balanceOf(challenger.address)).to.equal(
        before + 1n
      );
    });
  });

  describe('Special NFT tier 1 branch (qualifying donation receiver)', function () {
    it('mints listSpecialNftAddress[1] when receiver = donation + percent ≥ dividendSuccess', async function () {
      const { nft, owner, donation, specialNft0, specialNft1, challenger } =
        await loadFixture(deployExerciseSupplementFixture);
      await setupAllowedChallenge(nft, owner);
      await nft
        .connect(owner)
        .updateSpecialConditionInfo(10, 10, 0, 0, 0, 98);
      // Need at(0) AND at(1) populated
      await nft
        .connect(owner)
        .updateSpecialNftAddress(await specialNft0.getAddress(), true);
      await nft
        .connect(owner)
        .updateSpecialNftAddress(await specialNft1.getAddress(), true);

      // tolerance[1] = 4 → duration - duration/4 = 10 - 2 = 8 → _dayRequired ≥ 8
      const before = await specialNft1.balanceOf(challenger.address);
      await nft
        .connect(owner)
        .safeMintNFT(
          10,
          10,
          10,
          ethers.ZeroAddress,
          0,
          98,
          donation.address,
          challenger.address
        );
      const after = await specialNft1.balanceOf(challenger.address);
      // tier 1 receives the mint
      expect(after - before).to.equal(1n);
    });
  });

  describe('SoulBound interaction', function () {
    async function setupSoul(ctx: any) {
      const { nft, owner, soulBoundNft, requiredNft, normalNft } = ctx;
      await setupAllowedChallenge(nft, owner);
      await nft
        .connect(owner)
        .updateSoulBoundAddress(await soulBoundNft.getAddress(), true);
      await nft
        .connect(owner)
        .addOrRemoveRequiredNftAddress(await requiredNft.getAddress(), true);
      await nft
        .connect(owner)
        .updateNftListAddress(await normalNft.getAddress(), true, true);
    }

    it('mints SoulBound + skips normal mint when challenger eligible', async function () {
      const ctx = await loadFixture(deployExerciseSupplementFixture);
      await setupSoul(ctx);
      const { nft, owner, soulBoundNft, requiredNft, normalNft, challenger } =
        ctx;

      await requiredNft.setBalance(challenger.address, 1);

      const sBefore = await soulBoundNft.balanceOf(challenger.address);
      const nBefore = await normalNft.balanceOf(challenger.address);

      await nft
        .connect(owner)
        .safeMintNFT(
          0,
          0,
          0,
          ethers.ZeroAddress,
          0,
          0,
          ethers.ZeroAddress,
          challenger.address
        );

      expect(await soulBoundNft.balanceOf(challenger.address)).to.equal(
        sBefore + 1n
      );
      // Normal mint skipped because hasSoulBoundMinted = true
      expect(await normalNft.balanceOf(challenger.address)).to.equal(nBefore);
    });

    it('mints normal NFT when challenger NOT eligible for SoulBound', async function () {
      const ctx = await loadFixture(deployExerciseSupplementFixture);
      await setupSoul(ctx);
      const { nft, owner, soulBoundNft, normalNft, challenger } = ctx;

      // challenger does not hold any required NFT
      const sBefore = await soulBoundNft.balanceOf(challenger.address);
      const nBefore = await normalNft.balanceOf(challenger.address);

      await nft
        .connect(owner)
        .safeMintNFT(
          0,
          0,
          0,
          ethers.ZeroAddress,
          0,
          0,
          ethers.ZeroAddress,
          challenger.address
        );

      expect(await soulBoundNft.balanceOf(challenger.address)).to.equal(
        sBefore
      );
      expect(await normalNft.balanceOf(challenger.address)).to.equal(
        nBefore + 1n
      );
    });

    it('SoulBound mint happens regardless of special-NFT branch', async function () {
      const ctx = await loadFixture(deployExerciseSupplementFixture);
      await setupSoul(ctx);
      const { nft, owner, soulBoundNft, requiredNft, specialNft0, challenger } =
        ctx;

      // Challenger eligible for SoulBound + setup special NFT path
      await requiredNft.setBalance(challenger.address, 1);
      await nft
        .connect(owner)
        .updateSpecialConditionInfo(10, 10, 0, 0, 0, 98);
      await nft
        .connect(owner)
        .updateSpecialNftAddress(await specialNft0.getAddress(), true);

      const sBefore = await soulBoundNft.balanceOf(challenger.address);
      await nft
        .connect(owner)
        .safeMintNFT(
          10,
          10,
          10,
          ethers.ZeroAddress,
          0,
          50,
          challenger.address,
          challenger.address
        );
      // SoulBound minted
      expect(await soulBoundNft.balanceOf(challenger.address)).to.equal(
        sBefore + 1n
      );
      // Special tier 0 also minted
      expect(await specialNft0.balanceOf(challenger.address)).to.equal(1n);
    });
  });

  describe('checkAmountDepositCondition integration', function () {
    it('routes via MATIC deposit (createByToken=0x0)', async function () {
      const { nft, owner, normalNft, challenger } = await loadFixture(
        deployExerciseSupplementFixture
      );
      await setupAllowedChallenge(nft, owner);
      await nft.connect(owner).updateNftListAddress(
        await normalNft.getAddress(),
        true,
        true
      );
      // amountDepositMatic = 100; totalReward = 50 < 100 → returns false
      // → not eligible for special branch → fallback else → normal mint
      await nft
        .connect(owner)
        .updateSpecialConditionInfo(0, 0, 100, 0, 0, 0);
      const before = await normalNft.balanceOf(challenger.address);
      await nft
        .connect(owner)
        .safeMintNFT(
          0,
          0,
          0,
          ethers.ZeroAddress,
          50,
          0,
          ethers.ZeroAddress,
          challenger.address
        );
      expect(await normalNft.balanceOf(challenger.address)).to.equal(
        before + 1n
      );
    });
  });

  describe('safeMintNFT721Heper / safeMintNFT1155Heper', function () {
    it('Helper721 reverts for non-ALLOWED_CONTRACTS_GACHA caller', async function () {
      const { nft, attacker, normalNft, challenger } = await loadFixture(
        deployExerciseSupplementFixture
      );
      await expect(
        nft
          .connect(attacker)
          .safeMintNFT721Heper(
            await normalNft.getAddress(),
            challenger.address
          )
      ).to.be.revertedWith(/AccessControl/);
    });

    it('Helper721 mints when caller has ALLOWED_CONTRACTS_GACHA', async function () {
      const { nft, owner, normalNft, challenger } = await loadFixture(
        deployExerciseSupplementFixture
      );
      const role = await nft.ALLOWED_CONTRACTS_GACHA();
      await nft.connect(owner).grantRole(role, owner.address);
      const before = await normalNft.balanceOf(challenger.address);
      await nft
        .connect(owner)
        .safeMintNFT721Heper(await normalNft.getAddress(), challenger.address);
      expect(await normalNft.balanceOf(challenger.address)).to.equal(
        before + 1n
      );
    });
  });

  // -------------------------------------------------------------------
  // Comprehensive combinatorial branches for safeMintNFT.
  // Setup: special path triggered when _goal >= targetStepPerDay AND
  // _duration >= challengeDuration AND checkAmountDepositCondition passes.
  // Inner: tier 1 if (percent >= dividendSuccess && receivers == donation
  //                   && dayRequired >= duration - duration/tolerance[1])
  //        tier 0 if (dayRequired >= duration - duration/tolerance[0])
  // -------------------------------------------------------------------
  async function setupForSpecialMint(ctx: any) {
    const { nft, owner, specialNft0, specialNft1, normalNft } = ctx;
    // target=1000 step/day, duration=10, deposits all = 100, dividendSuccess=50
    await nft
      .connect(owner)
      .updateSpecialConditionInfo(1000, 10, 100, 100, 100, 50);
    // tolerance: success=2 → duration/2=5, dayRequired >= 5 for tier 0
    //            failed =4 → duration/4=2, dayRequired >= 8 for tier 1
    await nft.connect(owner).updateToleranceAmount(2, 4);
    await nft
      .connect(owner)
      .updateSpecialNftAddress(await specialNft0.getAddress(), true);
    await nft
      .connect(owner)
      .updateSpecialNftAddress(await specialNft1.getAddress(), true);
    await nft
      .connect(owner)
      .updateNftListAddress(await normalNft.getAddress(), true, true);
    const role = await nft.ALLOWED_CONTRACTS_CHALLENGE();
    await nft.connect(owner).batchGrantRole(role, [owner.address]);
  }

  describe('Special-mint combinatorial branches', function () {
    it('tier 1: percent>=dividendSuccess + receivers=donation + dayRequired>=8 → mint specialNft.at(1)', async function () {
      const ctx = await loadFixture(deployExerciseSupplementFixture);
      await setupForSpecialMint(ctx);
      const { nft, owner, donation, specialNft1, challenger } = ctx;
      await nft
        .connect(owner)
        .safeMintNFT(
          1000, // _goal = targetStepPerDay
          10, // _duration = challengeDuration
          8, // _dayRequired (>= 10 - 10/4 = 8)
          ethers.ZeroAddress, // MATIC
          100, // totalReward >= amountDepositMatic
          50, // percent = dividendSuccess
          donation.address, // receiver = donation
          challenger.address
        );
      expect(await specialNft1.balanceOf(challenger.address)).to.equal(1n);
    });

    it('tier 0: percent fails tier 1 but dayRequired>=5 → mint specialNft.at(0)', async function () {
      const ctx = await loadFixture(deployExerciseSupplementFixture);
      await setupForSpecialMint(ctx);
      const { nft, owner, specialNft0, challenger, other } = ctx;
      await nft
        .connect(owner)
        .safeMintNFT(
          1000,
          10,
          5, // dayRequired = boundary tier 0 (5 = 10 - 10/2)
          ethers.ZeroAddress,
          100,
          50,
          other.address, // receiver != donation → tier 1 fails
          challenger.address
        );
      expect(await specialNft0.balanceOf(challenger.address)).to.equal(1n);
    });

    it('special met but neither tier matches (dayRequired<5) → no mint via special, fall through', async function () {
      const ctx = await loadFixture(deployExerciseSupplementFixture);
      await setupForSpecialMint(ctx);
      const { nft, owner, specialNft0, specialNft1, normalNft, challenger } =
        ctx;
      await nft
        .connect(owner)
        .safeMintNFT(
          1000,
          10,
          4, // dayRequired = 4 < tier 0 boundary 5
          ethers.ZeroAddress,
          100,
          50,
          ethers.ZeroAddress,
          challenger.address
        );
      // Neither tier minted; outer if matched so fall through (no else branch)
      expect(await specialNft0.balanceOf(challenger.address)).to.equal(0n);
      expect(await specialNft1.balanceOf(challenger.address)).to.equal(0n);
      expect(await normalNft.balanceOf(challenger.address)).to.equal(0n);
    });

    it('amountDepositCondition MATIC fail → outer if false → mint normal', async function () {
      const ctx = await loadFixture(deployExerciseSupplementFixture);
      await setupForSpecialMint(ctx);
      const { nft, owner, normalNft, challenger } = ctx;
      await nft
        .connect(owner)
        .safeMintNFT(
          1000,
          10,
          8,
          ethers.ZeroAddress,
          50, // totalReward < amountDepositMatic (100)
          50,
          ethers.ZeroAddress,
          challenger.address
        );
      expect(await normalNft.balanceOf(challenger.address)).to.equal(1n);
    });

    it('amountDepositCondition TTJP pass → outer if true → tier 0 mints special', async function () {
      const ctx = await loadFixture(deployExerciseSupplementFixture);
      await setupForSpecialMint(ctx);
      const { nft, owner, specialNft0, challenger } = ctx;
      // Register a TTJP token (type=1)
      const ERC20 = await ethers.getContractFactory('MockERC20');
      const ttjp = await ERC20.deploy('TitanJP', 'TTJP');
      await ttjp.waitForDeployment();
      await nft
        .connect(owner)
        .updateListERC20Address(await ttjp.getAddress(), true);

      await nft
        .connect(owner)
        .safeMintNFT(
          1000,
          10,
          5,
          await ttjp.getAddress(),
          100, // >= amountDepositTTJP (100)
          50,
          ethers.ZeroAddress,
          challenger.address
        );
      expect(await specialNft0.balanceOf(challenger.address)).to.equal(1n);
    });

    it('amountDepositCondition TTJP fail → fall to normal mint', async function () {
      const ctx = await loadFixture(deployExerciseSupplementFixture);
      await setupForSpecialMint(ctx);
      const { nft, owner, normalNft, challenger } = ctx;
      const ERC20 = await ethers.getContractFactory('MockERC20');
      const ttjp = await ERC20.deploy('TitanJP', 'TTJP');
      await ttjp.waitForDeployment();
      await nft
        .connect(owner)
        .updateListERC20Address(await ttjp.getAddress(), true);

      await nft
        .connect(owner)
        .safeMintNFT(
          1000,
          10,
          5,
          await ttjp.getAddress(),
          50, // < 100
          50,
          ethers.ZeroAddress,
          challenger.address
        );
      expect(await normalNft.balanceOf(challenger.address)).to.equal(1n);
    });

    it('amountDepositCondition JPYC pass → tier 0 mint', async function () {
      const ctx = await loadFixture(deployExerciseSupplementFixture);
      await setupForSpecialMint(ctx);
      const { nft, owner, specialNft0, challenger } = ctx;
      const ERC20 = await ethers.getContractFactory('MockERC20');
      const jpyc = await ERC20.deploy('JPYCoin', 'JPYC');
      await jpyc.waitForDeployment();
      await nft
        .connect(owner)
        .updateListERC20Address(await jpyc.getAddress(), true);

      await nft
        .connect(owner)
        .safeMintNFT(
          1000,
          10,
          5,
          await jpyc.getAddress(),
          200,
          50,
          ethers.ZeroAddress,
          challenger.address
        );
      expect(await specialNft0.balanceOf(challenger.address)).to.equal(1n);
    });

    it('amountDepositCondition unknown token (type 3) → checkAmountDepositCondition false → normal mint', async function () {
      const ctx = await loadFixture(deployExerciseSupplementFixture);
      await setupForSpecialMint(ctx);
      const { nft, owner, normalNft, challenger } = ctx;
      const ERC20 = await ethers.getContractFactory('MockERC20');
      const random = await ERC20.deploy('RandomCoin', 'RND');
      await random.waitForDeployment();
      await nft
        .connect(owner)
        .updateListERC20Address(await random.getAddress(), true);

      await nft
        .connect(owner)
        .safeMintNFT(
          1000,
          10,
          5,
          await random.getAddress(),
          1000,
          50,
          ethers.ZeroAddress,
          challenger.address
        );
      expect(await normalNft.balanceOf(challenger.address)).to.equal(1n);
    });

    it('returns (currentAddressNftUse, indexNftAfterMint) for tier 1', async function () {
      const ctx = await loadFixture(deployExerciseSupplementFixture);
      await setupForSpecialMint(ctx);
      const { nft, owner, donation, specialNft1, challenger } = ctx;
      // Use staticCall to read return values without state modifications
      const ret = await nft
        .connect(owner)
        .safeMintNFT.staticCall(
          1000,
          10,
          8,
          ethers.ZeroAddress,
          100,
          50,
          donation.address,
          challenger.address
        );
      expect(ret[0]).to.equal(await specialNft1.getAddress());
      // indexNftAfterMint is nextTokenIdToMint() of specialNft1 AFTER mint
      // which equals 1 (one mint inside staticCall context)
      expect(ret[1]).to.equal(1n);
    });

    it('returns (0, 0) when no path mints (special met but no tier matches AND empty normal list)', async function () {
      const ctx = await loadFixture(deployExerciseSupplementFixture);
      const { nft, owner, donation, specialNft0, specialNft1, challenger } = ctx;
      await nft
        .connect(owner)
        .updateSpecialConditionInfo(1000, 10, 100, 100, 100, 50);
      await nft.connect(owner).updateToleranceAmount(2, 4);
      await nft
        .connect(owner)
        .updateSpecialNftAddress(await specialNft0.getAddress(), true);
      await nft
        .connect(owner)
        .updateSpecialNftAddress(await specialNft1.getAddress(), true);
      // intentionally NOT add normal — but special IS met, neither tier
      const role = await nft.ALLOWED_CONTRACTS_CHALLENGE();
      await nft.connect(owner).batchGrantRole(role, [owner.address]);

      const ret = await nft
        .connect(owner)
        .safeMintNFT.staticCall(
          1000,
          10,
          4, // dayRequired < 5 → no tier
          ethers.ZeroAddress,
          100,
          50,
          ethers.ZeroAddress,
          challenger.address
        );
      expect(ret[0]).to.equal(ethers.ZeroAddress);
      expect(ret[1]).to.equal(0n);
    });

    it('boundary: _goal exactly == targetStepPerDay → outer if true', async function () {
      const ctx = await loadFixture(deployExerciseSupplementFixture);
      await setupForSpecialMint(ctx);
      const { nft, owner, specialNft0, challenger } = ctx;
      await nft
        .connect(owner)
        .safeMintNFT(
          1000, // exactly equal
          10,
          5,
          ethers.ZeroAddress,
          100,
          50,
          ethers.ZeroAddress,
          challenger.address
        );
      expect(await specialNft0.balanceOf(challenger.address)).to.equal(1n);
    });

    it('boundary: _goal one less than targetStepPerDay → outer if false → normal', async function () {
      const ctx = await loadFixture(deployExerciseSupplementFixture);
      await setupForSpecialMint(ctx);
      const { nft, owner, normalNft, challenger } = ctx;
      await nft
        .connect(owner)
        .safeMintNFT(
          999, // one less
          10,
          5,
          ethers.ZeroAddress,
          100,
          50,
          ethers.ZeroAddress,
          challenger.address
        );
      expect(await normalNft.balanceOf(challenger.address)).to.equal(1n);
    });

    it('boundary: _duration exactly == challengeDuration → outer if true', async function () {
      const ctx = await loadFixture(deployExerciseSupplementFixture);
      await setupForSpecialMint(ctx);
      const { nft, owner, specialNft0, challenger } = ctx;
      await nft
        .connect(owner)
        .safeMintNFT(
          1000,
          10, // exactly equal
          5,
          ethers.ZeroAddress,
          100,
          50,
          ethers.ZeroAddress,
          challenger.address
        );
      expect(await specialNft0.balanceOf(challenger.address)).to.equal(1n);
    });

    it('boundary: _dayRequired exactly == tier 1 lower bound → tier 1', async function () {
      const ctx = await loadFixture(deployExerciseSupplementFixture);
      await setupForSpecialMint(ctx);
      const { nft, owner, donation, specialNft1, challenger } = ctx;
      // tier 1 boundary: _dayRequired >= duration - duration/tolerance[1] = 10 - 10/4 = 8
      await nft
        .connect(owner)
        .safeMintNFT(
          1000,
          10,
          8, // exactly == tier 1 boundary
          ethers.ZeroAddress,
          100,
          50,
          donation.address,
          challenger.address
        );
      expect(await specialNft1.balanceOf(challenger.address)).to.equal(1n);
    });

    it('boundary: percent < dividendSuccess → skip tier 1, fall to tier 0', async function () {
      const ctx = await loadFixture(deployExerciseSupplementFixture);
      await setupForSpecialMint(ctx);
      const { nft, owner, donation, specialNft0, specialNft1, challenger } =
        ctx;
      await nft
        .connect(owner)
        .safeMintNFT(
          1000,
          10,
          8,
          ethers.ZeroAddress,
          100,
          49, // percent < 50
          donation.address,
          challenger.address
        );
      expect(await specialNft1.balanceOf(challenger.address)).to.equal(0n);
      expect(await specialNft0.balanceOf(challenger.address)).to.equal(1n);
    });

    it('outer if true + missing specialNft list → revert MISSING SPECIAL NFT', async function () {
      const ctx = await loadFixture(deployExerciseSupplementFixture);
      const { nft, owner, donation, challenger } = ctx;
      // Set special conditions but DO NOT add specialNft addresses
      await nft
        .connect(owner)
        .updateSpecialConditionInfo(1000, 10, 100, 100, 100, 50);
      await nft.connect(owner).updateToleranceAmount(2, 4);
      const role = await nft.ALLOWED_CONTRACTS_CHALLENGE();
      await nft.connect(owner).batchGrantRole(role, [owner.address]);

      await expect(
        nft
          .connect(owner)
          .safeMintNFT(
            1000,
            10,
            8,
            ethers.ZeroAddress,
            100,
            50,
            donation.address,
            challenger.address
          )
      ).to.be.revertedWith('MISSING SPECIAL NFT');
    });

    it('combined: SoulBound + special tier 1 → both mint', async function () {
      const ctx = await loadFixture(deployExerciseSupplementFixture);
      await setupForSpecialMint(ctx);
      const {
        nft,
        owner,
        donation,
        soulBoundNft,
        requiredNft,
        specialNft1,
        challenger,
      } = ctx;
      await nft
        .connect(owner)
        .updateSoulBoundAddress(await soulBoundNft.getAddress(), true);
      await nft
        .connect(owner)
        .addOrRemoveRequiredNftAddress(await requiredNft.getAddress(), true);
      await requiredNft.setBalance(challenger.address, 1);

      await nft
        .connect(owner)
        .safeMintNFT(
          1000,
          10,
          8,
          ethers.ZeroAddress,
          100,
          50,
          donation.address,
          challenger.address
        );

      expect(await soulBoundNft.balanceOf(challenger.address)).to.equal(1n);
      expect(await specialNft1.balanceOf(challenger.address)).to.equal(1n);
    });

    it('combined: SoulBound only when special conditions fail → no normal mint', async function () {
      const ctx = await loadFixture(deployExerciseSupplementFixture);
      await setupForSpecialMint(ctx);
      const {
        nft,
        owner,
        soulBoundNft,
        requiredNft,
        normalNft,
        challenger,
      } = ctx;
      await nft
        .connect(owner)
        .updateSoulBoundAddress(await soulBoundNft.getAddress(), true);
      await nft
        .connect(owner)
        .addOrRemoveRequiredNftAddress(await requiredNft.getAddress(), true);
      await requiredNft.setBalance(challenger.address, 1);

      // Special conditions fail (totalReward < amountDepositMatic)
      await nft
        .connect(owner)
        .safeMintNFT(
          1000,
          10,
          8,
          ethers.ZeroAddress,
          50, // less than amountDepositMatic=100
          50,
          ethers.ZeroAddress,
          challenger.address
        );

      expect(await soulBoundNft.balanceOf(challenger.address)).to.equal(1n);
      expect(await normalNft.balanceOf(challenger.address)).to.equal(0n);
    });

    it('non-ALLOWED_CONTRACTS_CHALLENGE caller reverts even with valid params', async function () {
      const ctx = await loadFixture(deployExerciseSupplementFixture);
      await setupForSpecialMint(ctx);
      const { nft, donation, attacker, challenger } = ctx;
      await expect(
        nft
          .connect(attacker)
          .safeMintNFT(
            1000,
            10,
            8,
            ethers.ZeroAddress,
            100,
            50,
            donation.address,
            challenger.address
          )
      ).to.be.revertedWith(/AccessControl/);
    });
  });

  describe('safeMintNFT1155Heper', function () {
    it('non-ALLOWED_CONTRACTS_CHALLENGE caller reverts', async function () {
      const { nft, attacker, challenger } = await loadFixture(
        deployExerciseSupplementFixture
      );
      await expect(
        nft
          .connect(attacker)
          .safeMintNFT1155Heper(
            ethers.ZeroAddress,
            challenger.address,
            0,
            1
          )
      ).to.be.revertedWith(/AccessControl/);
    });
  });
});
