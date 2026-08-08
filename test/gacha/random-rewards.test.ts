import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import hre from 'hardhat';
import {
  deployGachaFixture,
  addERC20Reward,
  callRandomRewards,
  setRandomResult,
  TypeToken,
  TypeRandomReward,
  TimeRandomReward,
} from './fixtures';

const { ethers } = hre as any;

describe('Gacha — randomRewards full coverage', function () {
  describe('Eligibility checks', function () {
    // CHALLENGE-2672: randomRewards now requires the caller to hold CHALLENGE_ROLE (admin-
    // governed, never self-grantable). An arbitrary/unregistered caller -- the old attack this
    // ticket closes -- is rejected by that gate before it can even reach the internal
    // _challengeAddress == msg.sender check.
    it('reverts for an unregistered (no CHALLENGE_ROLE) caller, regardless of _challengeAddress', async function () {
      const { gacha, attacker, other } = await loadFixture(deployGachaFixture);
      await expect(
        gacha.connect(attacker).randomRewards(other.address, [5000])
      ).to.be.revertedWithCustomError(gacha, 'AccessControlUnauthorizedAccount');

      // Even calling "as itself" (the old, sole check) is rejected without the role.
      await expect(
        gacha.connect(attacker).randomRewards(attacker.address, [5000])
      ).to.be.revertedWithCustomError(gacha, 'AccessControlUnauthorizedAccount');
    });

    it('reverts if msg.sender != _challengeAddress, even for a CHALLENGE_ROLE holder', async function () {
      const { gacha, owner, attacker, other } = await loadFixture(deployGachaFixture);
      const CHALLENGE_ROLE = await gacha.CHALLENGE_ROLE();
      // Grant the role to `attacker` directly to isolate the internal self-consistency check
      // from the role gate -- a REGISTERED caller still cannot claim to be a different address.
      await gacha.connect(owner).grantRole(CHALLENGE_ROLE, attacker.address);

      await expect(
        gacha.connect(attacker).randomRewards(other.address, [5000])
      ).to.be.revertedWithCustomError(gacha, 'OnlyChallengeCanCallSendDailyResultWithGacha');
    });

    it('CHALLENGE_ROLE cannot be self-granted by an arbitrary caller (role admin is DEFAULT_ADMIN_ROLE)', async function () {
      const { gacha, attacker } = await loadFixture(deployGachaFixture);
      const CHALLENGE_ROLE = await gacha.CHALLENGE_ROLE();
      await expect(gacha.connect(attacker).grantRole(CHALLENGE_ROLE, attacker.address)).to.be
        .reverted;
    });

    it('reverts if isSendDailyResultWithGacha already set', async function () {
      const { gacha, owner, challenge, erc20Reward, vrfClassic } =
        await loadFixture(deployGachaFixture);

      await gacha.connect(owner).updateRewardRateAndMaxAllowed(0, 0, 0);
      await addERC20Reward(gacha, owner, erc20Reward, 100, 50n, 10);
      await erc20Reward.mint(await gacha.getAddress(), 1000n);
      await setRandomResult(vrfClassic, 0);

      await callRandomRewards(challenge, gacha);

      // Second call should revert because isFinished=true → flag set
      await expect(
        challenge.callRandomRewards(await gacha.getAddress(), [5000])
      ).to.be.revertedWithCustomError(gacha, 'AlreadySendDailyResultWithGacha');
    });

    it('returns false when checkRequireBalanceNft fails (e.g. low step)', async function () {
      const { gacha, owner, challenger, challenge, erc20Reward } =
        await loadFixture(deployGachaFixture);

      await gacha.connect(owner).updateRewardRateAndMaxAllowed(0, 0, 0);
      await addERC20Reward(gacha, owner, erc20Reward, 100, 50n, 5);
      await erc20Reward.mint(await gacha.getAddress(), 1000n);

      // dataStep below stepDataToSend (5000) → eligibility fails
      await callRandomRewards(challenge, gacha, [100]);

      const info = await gacha.userInfor(challenger.address);
      expect(info.statusRandom).to.equal(false);
    });

    it('respects timeLimitActiveGacha within same UTC day', async function () {
      const { gacha, owner, challenge, erc20Reward, vrfClassic } =
        await loadFixture(deployGachaFixture);

      // Very low limit
      await gacha.connect(owner).updateChallengeInfor(
        {
          targetStepPerDay: 5000,
          challengeDuration: 30,
          stepDataToSend: 5000,
          toleranceAmount: 4,
          dividendStatus: 0,
          amountBaseDeposit: 1n,
          amountTokenDeposit: 0n,
          timeLimitActiveGacha: 1,
          typeRequireBalanceNft: 0,
        },
        true,
        owner.address,
        owner.address,
        'g',
        's'
      );

      await gacha.connect(owner).updateRewardRateAndMaxAllowed(0, 100, 0); // 50% lose
      await addERC20Reward(gacha, owner, erc20Reward, 100, 50n, 100);
      await erc20Reward.mint(await gacha.getAddress(), 10000n);
      await setRandomResult(vrfClassic, 0);

      // First call uses up the single allowed slot. Set isFinished=false so flag isn't set.
      await challenge.setIsFinished(false);
      await callRandomRewards(challenge, gacha);

      // Second call should revert on timeLimit
      await expect(
        challenge.callRandomRewards(await gacha.getAddress(), [5000])
      ).to.be.revertedWithCustomError(gacha, 'ActiveGachaLimitExceeded');
    });
  });

  describe('Reward distribution by token type', function () {
    it('ERC20: transfers rewardValue tokens', async function () {
      const { gacha, owner, challenger, challenge, erc20Reward, vrfClassic } =
        await loadFixture(deployGachaFixture);
      await gacha.connect(owner).updateRewardRateAndMaxAllowed(0, 0, 0);
      await addERC20Reward(gacha, owner, erc20Reward, 100, 75n, 3);
      await erc20Reward.mint(await gacha.getAddress(), 500n);
      await setRandomResult(vrfClassic, 0);

      await callRandomRewards(challenge, gacha);
      expect(await erc20Reward.balanceOf(challenger.address)).to.equal(75n);
    });

    it('ERC721 mint: mints rewardValue NFTs and records first id', async function () {
      const { gacha, owner, challenger, challenge, erc721Reward, vrfClassic } =
        await loadFixture(deployGachaFixture);
      await gacha.connect(owner).updateRewardRateAndMaxAllowed(0, 0, 0);
      await gacha.connect(owner).addNewReward(
        await erc721Reward.getAddress(),
        100,
        3, // mint 3 NFTs
        0,
        TypeToken.ERC721,
        true,
        5,
        []
      );
      await setRandomResult(vrfClassic, 0);

      const beforeId = await erc721Reward.nextTokenIdToMint();
      await callRandomRewards(challenge, gacha);

      // Challenger received 3 NFTs starting at beforeId
      expect(await erc721Reward.balanceOf(challenger.address)).to.equal(3n);
      expect(await erc721Reward.ownerOf(beforeId)).to.equal(challenger.address);
      expect(await erc721Reward.ownerOf(beforeId + 1n)).to.equal(
        challenger.address
      );
      expect(await erc721Reward.ownerOf(beforeId + 2n)).to.equal(
        challenger.address
      );

      // userInfor records the FIRST id (fixes off-by-one)
      const info = await gacha.userInfor(challenger.address);
      expect(info.indexToken).to.equal(beforeId);
    });

    it('ERC721 transfer-existing: transfers from listNft and pops entry', async function () {
      const { gacha, owner, challenger, challenge, erc721Reward, vrfClassic } =
        await loadFixture(deployGachaFixture);
      const gachaAddr = await gacha.getAddress();
      await erc721Reward.mint(gachaAddr, 100);
      await erc721Reward.mint(gachaAddr, 200);

      await gacha.connect(owner).updateRewardRateAndMaxAllowed(0, 0, 0);
      await gacha
        .connect(owner)
        .addNewReward(
          await erc721Reward.getAddress(),
          100,
          1,
          0,
          TypeToken.ERC721,
          false,
          5,
          [100, 200]
        );
      await setRandomResult(vrfClassic, 0);
      await callRandomRewards(challenge, gacha);

      // One of the 100/200 should now belong to challenger
      const challengerBalance = await erc721Reward.balanceOf(
        challenger.address
      );
      expect(challengerBalance).to.equal(1n);

      const remaining = await gacha.getListNftInReward(1);
      expect(remaining.length).to.equal(1);
    });

    // CHALLENGE-2796: tokenId 0 is a real, valid delivered token -- not a "delivery failed"
    // sentinel. Before this fix, `indexTokenReward == 0` was used as the delivery-failure
    // guard, so a correctly-delivered tokenId 0 was indistinguishable from "nothing was
    // transferred" and the whole settlement reverted with Erc721DeliveryFailed(), even though
    // the NFT had already reached the challenger.
    it('ERC721 transfer-existing tokenId 0: delivers successfully, does NOT revert Erc721DeliveryFailed', async function () {
      const { gacha, owner, challenger, challenge, erc721Reward, vrfClassic } =
        await loadFixture(deployGachaFixture);
      const gachaAddr = await gacha.getAddress();
      // Mint the FIRST token this collection ever mints -- tokenId 0 (CountersUpgradeable
      // starts at 0) -- directly to the gacha contract, and configure it as the ONLY entry in
      // listNft so the reward can only ever deliver tokenId 0.
      await erc721Reward.mint(gachaAddr, 0);

      await gacha.connect(owner).updateRewardRateAndMaxAllowed(0, 0, 0);
      await gacha
        .connect(owner)
        .addNewReward(
          await erc721Reward.getAddress(),
          100,
          1,
          0,
          TypeToken.ERC721,
          false,
          5,
          [0]
        );
      await setRandomResult(vrfClassic, 0);

      // Must NOT revert -- tokenId 0 delivered successfully is a success, not a failure.
      await callRandomRewards(challenge, gacha);

      expect(await erc721Reward.ownerOf(0)).to.equal(challenger.address);
      expect(await erc721Reward.balanceOf(challenger.address)).to.equal(1n);

      const info = await gacha.userInfor(challenger.address);
      expect(info.indexToken).to.equal(0n);
    });

    it('ERC1155 mint: mints amount tokens at indexToken', async function () {
      const { gacha, owner, challenger, challenge, erc1155Reward, vrfClassic } =
        await loadFixture(deployGachaFixture);
      await gacha.connect(owner).updateRewardRateAndMaxAllowed(0, 0, 0);
      await gacha.connect(owner).addNewReward(
        await erc1155Reward.getAddress(),
        100,
        50, // amount
        7, // indexToken
        TypeToken.ERC1155,
        true,
        5,
        []
      );
      await setRandomResult(vrfClassic, 0);
      await callRandomRewards(challenge, gacha);

      expect(await erc1155Reward.balanceOf(challenger.address, 7)).to.equal(
        50n
      );
    });

    it('ERC1155 transfer-existing: transfers from gacha balance', async function () {
      const { gacha, owner, challenger, challenge, erc1155Reward, vrfClassic } =
        await loadFixture(deployGachaFixture);
      await erc1155Reward.mint(await gacha.getAddress(), 9, 100);

      await gacha.connect(owner).updateRewardRateAndMaxAllowed(0, 0, 0);
      await gacha
        .connect(owner)
        .addNewReward(
          await erc1155Reward.getAddress(),
          100,
          25,
          9,
          TypeToken.ERC1155,
          false,
          5,
          []
        );
      await setRandomResult(vrfClassic, 0);
      await callRandomRewards(challenge, gacha);

      expect(await erc1155Reward.balanceOf(challenger.address, 9)).to.equal(
        25n
      );
    });

    it('NATIVE_TOKEN: transfers ETH from contract balance', async function () {
      const { gacha, owner, challenger, challenge, vrfClassic } =
        await loadFixture(deployGachaFixture);
      await gacha.connect(owner).updateRewardRateAndMaxAllowed(0, 0, 0);
      await gacha
        .connect(owner)
        .addNewReward(
          ethers.ZeroAddress,
          100,
          ethers.parseEther('0.1'),
          0,
          TypeToken.NATIVE_TOKEN,
          false,
          5,
          []
        );

      // Fund contract via low-level send
      await owner.sendTransaction({
        to: await gacha.getAddress(),
        value: ethers.parseEther('1'),
      });

      const before = await ethers.provider.getBalance(challenger.address);
      await setRandomResult(vrfClassic, 0);
      await callRandomRewards(challenge, gacha);
      const after = await ethers.provider.getBalance(challenger.address);

      expect(after - before).to.equal(ethers.parseEther('0.1'));
    });
  });

  describe('Lost slot (no reward) handling', function () {
    it('returns no win when randomIndexReward == 0 (lost bucket)', async function () {
      const { gacha, owner, challenger, challenge, erc20Reward, vrfClassic } =
        await loadFixture(deployGachaFixture);

      // 100 lose, 50 win → range [1..150]; randomNumber 50 → lose (1..100)
      await addERC20Reward(gacha, owner, erc20Reward, 50, 25n, 5);
      await erc20Reward.mint(await gacha.getAddress(), 1000n);
      await setRandomResult(vrfClassic, 49); // 49 % 150 = 49, +1 = 50 → lose bucket

      await callRandomRewards(challenge, gacha);

      const info = await gacha.userInfor(challenger.address);
      expect(info.statusRandom).to.equal(false);
      expect(await erc20Reward.balanceOf(challenger.address)).to.equal(0n);
    });
  });

  describe('Max activation logic', function () {
    it('refunds unlockRate to slot 0 when reward hits max', async function () {
      const { gacha, owner, challenge, erc20Reward, vrfClassic } =
        await loadFixture(deployGachaFixture);

      await gacha.connect(owner).updateRewardRateAndMaxAllowed(0, 0, 0);
      await addERC20Reward(gacha, owner, erc20Reward, 100, 10n, 1); // max=1
      await erc20Reward.mint(await gacha.getAddress(), 1000n);
      await setRandomResult(vrfClassic, 0);

      await callRandomRewards(challenge, gacha);

      const slotZero = await gacha.rewardTokens(0);
      const slotOne = await gacha.rewardTokens(1);
      expect(slotZero.unlockRate).to.equal(100n); // refunded
      expect(slotOne.unlockRate).to.equal(0n); // zeroed
      expect(slotOne.rewardActivationCount).to.equal(1n);
    });
  });

  describe('VRF mode integration', function () {
    it('NORMAL mode reads from randomClassicAddress', async function () {
      const { gacha, owner, challenger, challenge, erc20Reward, vrfClassic } =
        await loadFixture(deployGachaFixture);
      await gacha.connect(owner).updateRewardRateAndMaxAllowed(0, 0, 0);
      await addERC20Reward(gacha, owner, erc20Reward, 100, 50n, 3);
      await erc20Reward.mint(await gacha.getAddress(), 1000n);
      await setRandomResult(vrfClassic, 0);

      await callRandomRewards(challenge, gacha);
      const info = await gacha.userInfor(challenger.address);
      expect(info.statusRandom).to.equal(true);
    });

    it('VRF_CHAINLINK + ONLY_TIME mode reads from VRFConsumerBaseOnlyTime', async function () {
      const { gacha, owner, challenger, challenge, erc20Reward, vrfOnly } =
        await loadFixture(deployGachaFixture);

      await gacha.connect(owner).setVRFConsumerBaseInfos(
        ethers.ZeroAddress, // unused for ONLY_TIME path
        await vrfOnly.getAddress(),
        ethers.ZeroAddress,
        TypeRandomReward.VRF_CHAINLINK,
        TimeRandomReward.ONLY_TIME
      );
      await gacha.connect(owner).updateRewardRateAndMaxAllowed(0, 0, 0);
      await addERC20Reward(gacha, owner, erc20Reward, 100, 50n, 3);
      await erc20Reward.mint(await gacha.getAddress(), 1000n);

      await vrfOnly.setRandomResult(0);
      await callRandomRewards(challenge, gacha);

      const info = await gacha.userInfor(challenger.address);
      expect(info.statusRandom).to.equal(true);
    });

    it('VRF_CHAINLINK + MULTIPLE_TIME mode reads from VRFConsumerBaseMultipleTime', async function () {
      const { gacha, owner, challenger, challenge, erc20Reward, vrfMultiple } =
        await loadFixture(deployGachaFixture);

      await gacha
        .connect(owner)
        .setVRFConsumerBaseInfos(
          await vrfMultiple.getAddress(),
          ethers.ZeroAddress,
          ethers.ZeroAddress,
          TypeRandomReward.VRF_CHAINLINK,
          TimeRandomReward.MULTIPLE_TIME
        );
      await gacha.connect(owner).updateRewardRateAndMaxAllowed(0, 0, 0);
      await addERC20Reward(gacha, owner, erc20Reward, 100, 50n, 3);
      await erc20Reward.mint(await gacha.getAddress(), 1000n);

      await vrfMultiple.setRandomResult(0);
      await callRandomRewards(challenge, gacha);

      const info = await gacha.userInfor(challenger.address);
      expect(info.statusRandom).to.equal(true);
    });
  });

  describe('Gacha time window (checkExist)', function () {
    it('returns no win when current time is outside window', async function () {
      const { gacha, owner, challenger, challenge, erc20Reward, vrfClassic } =
        await loadFixture(deployGachaFixture);

      // Set gacha time window to PAST (already over)
      await gacha.connect(owner).setGachaTime(1, 100);

      await gacha.connect(owner).updateRewardRateAndMaxAllowed(0, 0, 0);
      await addERC20Reward(gacha, owner, erc20Reward, 100, 50n, 3);
      await erc20Reward.mint(await gacha.getAddress(), 1000n);
      await setRandomResult(vrfClassic, 0);

      await callRandomRewards(challenge, gacha);

      const info = await gacha.userInfor(challenger.address);
      expect(info.statusRandom).to.equal(false);
    });
  });

  // CHALLENGE-2672: an unregistered ("arbitrary") Challenge-shaped contract -- exactly the
  // MockGachaChallenge used by the positive-path tests above, just NOT granted CHALLENGE_ROLE
  // -- must be rejected before any reward transfer happens, for every reward type. Deploys a
  // SEPARATE, unregistered instance per test (the fixture's own `challenge` IS granted the
  // role, so it can't demonstrate this).
  describe('Unregistered caller rejected for every reward type (negative, CHALLENGE-2672)', function () {
    async function deployUnregisteredChallenge(challenger: any, supplement: any) {
      const Factory = await ethers.getContractFactory('MockGachaChallenge');
      const unregistered = await Factory.deploy(challenger.address, await supplement.getAddress());
      await unregistered.waitForDeployment();
      return unregistered;
    }

    it('NATIVE_TOKEN reward: reverts, contract balance untouched', async function () {
      const { gacha, owner, challenger, supplement, vrfClassic } =
        await loadFixture(deployGachaFixture);
      const unregistered = await deployUnregisteredChallenge(challenger, supplement);

      await gacha.connect(owner).updateRewardRateAndMaxAllowed(0, 0, 0);
      await gacha
        .connect(owner)
        .addNewReward(ethers.ZeroAddress, 100, ethers.parseEther('0.1'), 0, TypeToken.NATIVE_TOKEN, false, 5, []);
      await owner.sendTransaction({ to: await gacha.getAddress(), value: ethers.parseEther('1') });
      await setRandomResult(vrfClassic, 0);

      const gachaBalanceBefore = await ethers.provider.getBalance(await gacha.getAddress());
      await expect(callRandomRewards(unregistered, gacha)).to.be.revertedWithCustomError(
        gacha,
        'AccessControlUnauthorizedAccount'
      );
      expect(await ethers.provider.getBalance(await gacha.getAddress())).to.equal(gachaBalanceBefore);
    });

    it('ERC20 reward: reverts, gacha token balance untouched, challenger receives nothing', async function () {
      const { gacha, owner, challenger, supplement, erc20Reward, vrfClassic } =
        await loadFixture(deployGachaFixture);
      const unregistered = await deployUnregisteredChallenge(challenger, supplement);

      await gacha.connect(owner).updateRewardRateAndMaxAllowed(0, 0, 0);
      await addERC20Reward(gacha, owner, erc20Reward, 100, 75n, 3);
      await erc20Reward.mint(await gacha.getAddress(), 500n);
      await setRandomResult(vrfClassic, 0);

      await expect(callRandomRewards(unregistered, gacha)).to.be.revertedWithCustomError(
        gacha,
        'AccessControlUnauthorizedAccount'
      );
      expect(await erc20Reward.balanceOf(await gacha.getAddress())).to.equal(500n);
      expect(await erc20Reward.balanceOf(challenger.address)).to.equal(0n);
    });

    it('ERC721 reward: reverts, no NFT minted or transferred', async function () {
      const { gacha, owner, challenger, supplement, erc721Reward, vrfClassic } =
        await loadFixture(deployGachaFixture);
      const unregistered = await deployUnregisteredChallenge(challenger, supplement);

      await gacha.connect(owner).updateRewardRateAndMaxAllowed(0, 0, 0);
      await gacha
        .connect(owner)
        .addNewReward(await erc721Reward.getAddress(), 100, 3, 0, TypeToken.ERC721, true, 5, []);
      await setRandomResult(vrfClassic, 0);

      await expect(callRandomRewards(unregistered, gacha)).to.be.revertedWithCustomError(
        gacha,
        'AccessControlUnauthorizedAccount'
      );
      expect(await erc721Reward.balanceOf(challenger.address)).to.equal(0n);
    });

    it('ERC1155 reward: reverts, gacha token balance untouched', async function () {
      const { gacha, owner, challenger, supplement, erc1155Reward, vrfClassic } =
        await loadFixture(deployGachaFixture);
      const unregistered = await deployUnregisteredChallenge(challenger, supplement);
      const gachaAddr = await gacha.getAddress();
      const indexToken = 7;
      await erc1155Reward.mint(gachaAddr, indexToken, 50);

      await gacha.connect(owner).updateRewardRateAndMaxAllowed(0, 0, 0);
      await gacha
        .connect(owner)
        .addNewReward(await erc1155Reward.getAddress(), 100, 5, indexToken, TypeToken.ERC1155, false, 3, []);
      await setRandomResult(vrfClassic, 0);

      await expect(callRandomRewards(unregistered, gacha)).to.be.revertedWithCustomError(
        gacha,
        'AccessControlUnauthorizedAccount'
      );
      expect(await erc1155Reward.balanceOf(gachaAddr, indexToken)).to.equal(50n);
      expect(await erc1155Reward.balanceOf(challenger.address, indexToken)).to.equal(0n);
    });
  });
});
