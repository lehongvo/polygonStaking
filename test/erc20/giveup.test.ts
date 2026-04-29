// giveUp() 実行時の ERC20 配分ロジックを検証するテスト。
// シナリオA: 全額スポンサー返還、シナリオB: 達成日数に応じた按分。
import { expect } from 'chai';
import hre from 'hardhat';
import { deployChallenge, moveToStart, sendStep } from '../helpers/deployHelpers.ts';

describe('T10 – ERC20 giveUp split', function () {
  // シナリオA: choiceAwardToSponsor=true → スポンサーへ大部分、feeAddr へ手数料
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

    // 1000 TKN1 のうち、スポンサーは 900 TKN1（90%）を受け取る
    it('sponsor receives 900 TKN1', async function () {
      const { tkn1, challenge, signers, startTime } = await setupA();
      await moveToStart(startTime);
      await challenge.connect(signers[1]).giveUp([], [], [], []);
      expect(await tkn1.balanceOf(signers[0].address)).to.equal(hre.ethers.parseEther('900'));
    });

    // feeAddr は手数料として 100 TKN1（10%）を受け取る
    it('feeAddr receives 100 TKN1', async function () {
      const { tkn1, challenge, signers, startTime } = await setupA();
      await moveToStart(startTime);
      await challenge.connect(signers[1]).giveUp([], [], [], []);
      expect(await tkn1.balanceOf(signers[2].address)).to.equal(hre.ethers.parseEther('100'));
    });

    // giveUp 後はコントラクト残高が 0 になり、トークンが取り残されない
    it('contract holds 0 TKN1 after giveUp', async function () {
      const { tkn1, challenge, challengeAddr, signers, startTime } = await setupA();
      await moveToStart(startTime);
      await challenge.connect(signers[1]).giveUp([], [], [], []);
      expect(await tkn1.balanceOf(challengeAddr)).to.equal(0n);
    });
  });

  // シナリオB: スポンサーへ全額返還しない設定。1日達成（cs=1）/必要20日 → 比率に応じて按分
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

    // 達成1日のみ → スポンサーは残りの 855 TKN1 を受け取る
    it('sponsor receives 855 TKN1', async function () {
      const { tkn1, challenge, signers, startTime } = await setupB();
      await moveToStart(startTime);
      await sendStep(challenge, 'ChallengeBaseStep', signers[1], { day: 1, steps: 1000 });
      await challenge.connect(signers[1]).giveUp([], [], [], []);
      expect(await tkn1.balanceOf(signers[0].address)).to.equal(hre.ethers.parseEther('855'));
    });

    // 成功側受取人 recv0 は達成日数比例で 25 TKN1 を受け取る
    it('recv0 receives 25 TKN1', async function () {
      const { tkn1, challenge, signers, startTime } = await setupB();
      await moveToStart(startTime);
      await sendStep(challenge, 'ChallengeBaseStep', signers[1], { day: 1, steps: 1000 });
      await challenge.connect(signers[1]).giveUp([], [], [], []);
      expect(await tkn1.balanceOf(signers[4].address)).to.equal(hre.ethers.parseEther('25'));
    });
  });
});
