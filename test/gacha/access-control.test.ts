import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import hre from 'hardhat';
import {
  deployGachaFixture,
  defaultChallengeInfo,
  TypeRandomReward,
  TimeRandomReward,
  TypeToken,
} from './fixtures';

const { ethers } = hre as any;

describe('Gacha — access control & admin', function () {
  describe('Roles granted in initialize', function () {
    it('owner has all 5 roles after init', async function () {
      const { gacha, owner } = await loadFixture(deployGachaFixture);
      const DEFAULT_ADMIN = await gacha.DEFAULT_ADMIN_ROLE();
      const UPGRADER = await gacha.UPGRADER_ROLE();
      const UPDATER_REWARDS = await gacha.UPDATER_REWARDS_ROLE();
      const UPDATER_ACTIVITIES = await gacha.UPDATER_ACTIVITIES_ROLE();
      const CLOSE_GACHA = await gacha.CLOSE_GACHA_ROLE();

      expect(await gacha.hasRole(DEFAULT_ADMIN, owner.address)).to.equal(true);
      expect(await gacha.hasRole(UPGRADER, owner.address)).to.equal(true);
      expect(await gacha.hasRole(UPDATER_REWARDS, owner.address)).to.equal(
        true
      );
      expect(await gacha.hasRole(UPDATER_ACTIVITIES, owner.address)).to.equal(
        true
      );
      expect(await gacha.hasRole(CLOSE_GACHA, owner.address)).to.equal(true);
    });

    it('attacker has no roles', async function () {
      const { gacha, attacker } = await loadFixture(deployGachaFixture);
      const UPGRADER = await gacha.UPGRADER_ROLE();
      expect(await gacha.hasRole(UPGRADER, attacker.address)).to.equal(false);
    });
  });

  describe('updateChallengeInfor (UPDATER_ACTIVITIES_ROLE)', function () {
    it('updates challenge info', async function () {
      const { gacha, owner } = await loadFixture(deployGachaFixture);
      const newInfo = { ...defaultChallengeInfo, timeLimitActiveGacha: 50 };
      await gacha
        .connect(owner)
        .updateChallengeInfor(
          newInfo,
          false,
          owner.address,
          owner.address,
          'NewName',
          'NewSponsor'
        );

      expect(await gacha.gachaName()).to.equal('NewName');
      expect(await gacha.gachaSponsor()).to.equal('NewSponsor');
      expect(await gacha.isDefaultGachaContract()).to.equal(false);
      expect(await gacha.receiveAdminWallet()).to.equal(owner.address);
      expect(await gacha.returnedNFTWallet()).to.equal(owner.address);
    });

    it('rejects non-role caller', async function () {
      const { gacha, attacker, owner } = await loadFixture(deployGachaFixture);
      await expect(
        gacha
          .connect(attacker)
          .updateChallengeInfor(
            defaultChallengeInfo,
            true,
            owner.address,
            owner.address,
            'X',
            'Y'
          )
      ).to.be.revertedWith(/AccessControl/);
    });
  });

  describe('setVRFConsumerBaseInfos (UPDATER_ACTIVITIES_ROLE)', function () {
    it('updates VRF consumer addresses + types', async function () {
      const { gacha, owner, vrfMultiple, vrfOnly, vrfClassic } =
        await loadFixture(deployGachaFixture);
      await gacha
        .connect(owner)
        .setVRFConsumerBaseInfos(
          await vrfMultiple.getAddress(),
          await vrfOnly.getAddress(),
          await vrfClassic.getAddress(),
          TypeRandomReward.VRF_CHAINLINK,
          TimeRandomReward.MULTIPLE_TIME
        );

      expect(await gacha.VRFConsumerBaseMultipleTime()).to.equal(
        await vrfMultiple.getAddress()
      );
      expect(await gacha.VRFConsumerBaseOnlyTime()).to.equal(
        await vrfOnly.getAddress()
      );
      expect(await gacha.randomClassicAddress()).to.equal(
        await vrfClassic.getAddress()
      );
      expect(await gacha.typeRandomReward()).to.equal(
        TypeRandomReward.VRF_CHAINLINK
      );
      expect(await gacha.timeRandomReward()).to.equal(
        TimeRandomReward.MULTIPLE_TIME
      );
    });

    it('rejects non-role caller', async function () {
      const { gacha, attacker } = await loadFixture(deployGachaFixture);
      await expect(
        gacha
          .connect(attacker)
          .setVRFConsumerBaseInfos(
            attacker.address,
            attacker.address,
            attacker.address,
            0,
            0
          )
      ).to.be.revertedWith(/AccessControl/);
    });
  });

  describe('updateRequireBalanceNftAddress (UPDATER_ACTIVITIES_ROLE)', function () {
    it('adds nft address to required set', async function () {
      const { gacha, owner, erc721Reward } =
        await loadFixture(deployGachaFixture);
      await gacha
        .connect(owner)
        .updateRequireBalanceNftAddress(
          await erc721Reward.getAddress(),
          true,
          true
        );

      const list = await gacha.getRequireBalanceNftAddress();
      expect(list).to.include(await erc721Reward.getAddress());
      expect(await gacha.typeNfts(await erc721Reward.getAddress())).to.equal(
        true
      );
    });

    it('removes nft address when flag = false', async function () {
      const { gacha, owner, erc721Reward } =
        await loadFixture(deployGachaFixture);
      const addr = await erc721Reward.getAddress();
      await gacha
        .connect(owner)
        .updateRequireBalanceNftAddress(addr, true, true);
      await gacha
        .connect(owner)
        .updateRequireBalanceNftAddress(addr, false, true);
      const list = await gacha.getRequireBalanceNftAddress();
      expect(list).to.not.include(addr);
    });

    it('rejects non-role caller', async function () {
      const { gacha, attacker, erc721Reward } =
        await loadFixture(deployGachaFixture);
      await expect(
        gacha
          .connect(attacker)
          .updateRequireBalanceNftAddress(
            await erc721Reward.getAddress(),
            true,
            true
          )
      ).to.be.revertedWith(/AccessControl/);
    });
  });

  describe('setGachaTime (UPDATER_ACTIVITIES_ROLE)', function () {
    it('sets time window and checkExist follows it', async function () {
      const { gacha, owner } = await loadFixture(deployGachaFixture);
      await gacha.connect(owner).setGachaTime(1, 100); // past
      expect(await gacha.checkExist()).to.equal(false);

      await gacha.connect(owner).setGachaTime(0, 0xffffffff); // wide open
      expect(await gacha.checkExist()).to.equal(true);
    });

    it('rejects non-role caller', async function () {
      const { gacha, attacker } = await loadFixture(deployGachaFixture);
      await expect(
        gacha.connect(attacker).setGachaTime(0, 100)
      ).to.be.revertedWith(/AccessControl/);
    });
  });

  describe('withdrawBalances (CLOSE_GACHA_ROLE) — all token types', function () {
    it('withdraws ERC20 balance', async function () {
      const { gacha, owner, erc20Reward, returnedNFTWallet } =
        await loadFixture(deployGachaFixture);
      await erc20Reward.mint(await gacha.getAddress(), 500n);

      await gacha
        .connect(owner)
        .withdrawBalances(await erc20Reward.getAddress(), 0, TypeToken.ERC20);

      expect(await erc20Reward.balanceOf(returnedNFTWallet.address)).to.equal(
        500n
      );
    });

    it('withdraws ERC1155 balance', async function () {
      const { gacha, owner, erc1155Reward, returnedNFTWallet } =
        await loadFixture(deployGachaFixture);
      await erc1155Reward.mint(await gacha.getAddress(), 5, 200);

      await gacha
        .connect(owner)
        .withdrawBalances(
          await erc1155Reward.getAddress(),
          5,
          TypeToken.ERC1155
        );

      expect(
        await erc1155Reward.balanceOf(returnedNFTWallet.address, 5)
      ).to.equal(200n);
    });

    it('withdraws native ETH balance', async function () {
      const { gacha, owner, returnedNFTWallet } =
        await loadFixture(deployGachaFixture);
      await owner.sendTransaction({
        to: await gacha.getAddress(),
        value: ethers.parseEther('0.5'),
      });
      const beforeBal = await ethers.provider.getBalance(
        returnedNFTWallet.address
      );

      await gacha
        .connect(owner)
        .withdrawBalances(ethers.ZeroAddress, 0, TypeToken.NATIVE_TOKEN);

      const afterBal = await ethers.provider.getBalance(
        returnedNFTWallet.address
      );
      expect(afterBal - beforeBal).to.equal(ethers.parseEther('0.5'));
    });

    it('rejects caller without CLOSE_GACHA_ROLE', async function () {
      const { gacha, attacker, erc20Reward } =
        await loadFixture(deployGachaFixture);
      await expect(
        gacha
          .connect(attacker)
          .withdrawBalances(await erc20Reward.getAddress(), 0, TypeToken.ERC20)
      ).to.be.revertedWith(/AccessControl/);
    });
  });

  describe('Upgrade flow (UPGRADER_ROLE)', function () {
    it('owner can deploy new implementation and upgrade proxy', async function () {
      const { gacha, owner } = await loadFixture(deployGachaFixture);
      const GachaFactory = await ethers.getContractFactory('Gacha');
      const newImpl = await GachaFactory.deploy();
      await newImpl.waitForDeployment();

      // upgradeTo is provided by UUPSUpgradeable
      await expect(gacha.connect(owner).upgradeTo(await newImpl.getAddress()))
        .to.not.be.reverted;
    });

    it('non-upgrader cannot call upgradeTo', async function () {
      const { gacha, attacker } = await loadFixture(deployGachaFixture);
      const GachaFactory = await ethers.getContractFactory('Gacha');
      const newImpl = await GachaFactory.deploy();
      await newImpl.waitForDeployment();

      await expect(
        gacha.connect(attacker).upgradeTo(await newImpl.getAddress())
      ).to.be.revertedWith(/AccessControl/);
    });
  });

  describe('checkExist edge cases', function () {
    it('returns false when value[0]=value[1]=0 (uninit)', async function () {
      // Deploy without setGachaTime
      const [owner, , returnedNFTWallet, adminWallet] =
        await ethers.getSigners();
      const VRF = await ethers.getContractFactory('MockVRFConsumerBase');
      const v1 = await VRF.deploy();
      await v1.waitForDeployment();
      const v2 = await VRF.deploy();
      await v2.waitForDeployment();
      const Sup = await ethers.getContractFactory('MockGachaSupplement');
      const sup = await Sup.deploy();
      await sup.waitForDeployment();

      const { upgrades } = hre as any;
      const Gacha = await ethers.getContractFactory('Gacha');
      const init = [
        defaultChallengeInfo,
        [],
        [],
        100,
        true,
        TypeRandomReward.NORMAL,
        TimeRandomReward.ONLY_TIME,
        await v1.getAddress(),
        await v2.getAddress(),
        [returnedNFTWallet.address, adminWallet.address],
        'g',
        's',
      ];
      const gacha = await upgrades.deployProxy(Gacha, init, {
        kind: 'uups',
        initializer: 'initialize',
      });
      await gacha.waitForDeployment();

      // No setGachaTime call → both values default to 0
      expect(await gacha.checkExist()).to.equal(false);
    });
  });
});
