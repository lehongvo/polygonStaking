import { expect } from 'chai';
import hre from 'hardhat';
import { deployChallenge, moveToStart, sendStep } from '../helpers/deployHelpers.ts';

describe('T10 – ERC20 giveUp split', function () {
  describe('Scenario A – choiceAwardToSponsor=true', function () {
    async function setupA() {
      const MockERC20 = await hre.ethers.getContractFactory('MockERC20');
      const tkn1 = await MockERC20.deploy('Token1', 'TKN1');
      const tknAddr = await tkn1.getAddress();

      const { challenge, signers, startTime } = await deployChallenge('ChallengeBaseStep', {
        awardReceiversPercent: [50, 40],
        index: 1,
        dayRequired: 20,
        allAwardToSponsor: true,
        erc20List: [tknAddr],
      });

      const challengeAddr = await challenge.getAddress();
      await tkn1.mint(challengeAddr, hre.ethers.parseEther('1000'));
      return { tkn1, challenge, challengeAddr, signers, startTime };
    }

    it('sponsor receives 900 TKN1', async function () {
      const { tkn1, challenge, signers, startTime } = await setupA();
      await moveToStart(startTime);
      await challenge.connect(signers[1]).giveUp([], [], [], []);
      expect(await tkn1.balanceOf(signers[0].address)).to.equal(hre.ethers.parseEther('900'));
    });

    it('feeAddr receives 100 TKN1', async function () {
      const { tkn1, challenge, signers, startTime } = await setupA();
      await moveToStart(startTime);
      await challenge.connect(signers[1]).giveUp([], [], [], []);
      expect(await tkn1.balanceOf(signers[2].address)).to.equal(hre.ethers.parseEther('100'));
    });

    it('contract holds 0 TKN1 after giveUp', async function () {
      const { tkn1, challenge, challengeAddr, signers, startTime } = await setupA();
      await moveToStart(startTime);
      await challenge.connect(signers[1]).giveUp([], [], [], []);
      expect(await tkn1.balanceOf(challengeAddr)).to.equal(0n);
    });
  });

  describe('Scenario B – choiceAwardToSponsor=false, cs=1, dayRequired=20', function () {
    async function setupB() {
      const MockERC20 = await hre.ethers.getContractFactory('MockERC20');
      const tkn1 = await MockERC20.deploy('Token1', 'TKN1');
      const tknAddr = await tkn1.getAddress();

      const { challenge, signers, startTime } = await deployChallenge('ChallengeBaseStep', {
        awardReceiversPercent: [50, 40],
        index: 1,
        dayRequired: 20,
        allAwardToSponsor: false,
        erc20List: [tknAddr],
      });

      const challengeAddr = await challenge.getAddress();
      await tkn1.mint(challengeAddr, hre.ethers.parseEther('1000'));
      return { tkn1, challenge, signers, startTime };
    }

    it('sponsor receives 855 TKN1', async function () {
      const { tkn1, challenge, signers, startTime } = await setupB();
      await moveToStart(startTime);
      await sendStep(challenge, 'ChallengeBaseStep', signers[1], { day: 1, steps: 1000 });
      await challenge.connect(signers[1]).giveUp([], [], [], []);
      expect(await tkn1.balanceOf(signers[0].address)).to.equal(hre.ethers.parseEther('855'));
    });

    it('recv0 receives 25 TKN1', async function () {
      const { tkn1, challenge, signers, startTime } = await setupB();
      await moveToStart(startTime);
      await sendStep(challenge, 'ChallengeBaseStep', signers[1], { day: 1, steps: 1000 });
      await challenge.connect(signers[1]).giveUp([], [], [], []);
      expect(await tkn1.balanceOf(signers[4].address)).to.equal(hre.ethers.parseEther('25'));
    });
  });
});
