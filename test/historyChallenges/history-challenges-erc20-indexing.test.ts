// CHALLENGE-2705: HistoryChallenges compared every ERC20 entry against index 0 instead of the
// current loop index, and left indexCreateToken at its default (0) when the creation token
// wasn't found -- silently indistinguishable from "found at index 0". Uses
// MockChallengeForHistory (a fully-settable IChallenge implementation) to exercise
// HistoryChallenges in isolation across zero/one/multiple tokens and creation-token
// first/middle/absent, independent of any real Challenge contract's settlement logic.
import { expect } from 'chai';
import hre from 'hardhat';

const { ethers } = hre as any;

async function deployHistory() {
  const Factory = await ethers.getContractFactory('HistoryChallenges');
  const history = await Factory.deploy();
  await history.waitForDeployment();
  return history;
}

async function deployMockChallenge() {
  const Factory = await ethers.getContractFactory('MockChallengeForHistory');
  const mock = await Factory.deploy();
  await mock.waitForDeployment();
  return mock;
}

async function deployErc20(name: string) {
  const Factory = await ethers.getContractFactory('MockERC20');
  const token = await Factory.deploy(name, name);
  await token.waitForDeployment();
  return token;
}

const TOTAL_REWARD = hre.ethers.parseEther('10');

describe('CHALLENGE-2705: HistoryChallenges ERC20 indexing', function () {
  describe('challengesInfo2 (isSuccess=true, non-coin path)', function () {
    async function setup(tokenAddrs: string[], createByToken: string) {
      const history = await deployHistory();
      const mock = await deployMockChallenge();
      await mock.setIsSuccess(true);
      await mock.setAllowGiveUp(1, false); // non-coin (ERC20-created) path
      await mock.setErc20List(tokenAddrs);
      await mock.setCreateByToken(createByToken);
      await mock.setTotalReward(TOTAL_REWARD);
      await mock.setIndexNft(1); // avoid the separate indexNft()-1 underflow path
      return { history, mock };
    }

    it('zero tokens: returns a valid empty result, does not revert', async function () {
      const { history, mock } = await setup([], ethers.ZeroAddress);
      const result = await history.challengesInfo2(await mock.getAddress());
      expect(result.amountDepositToken.length).to.equal(0);
    });

    it('creation token FIRST in the list: only index 0 credited', async function () {
      const t0 = await deployErc20('T0');
      const t1 = await deployErc20('T1');
      const { history, mock } = await setup(
        [await t0.getAddress(), await t1.getAddress()],
        await t0.getAddress()
      );
      const result = await history.challengesInfo2(await mock.getAddress());
      expect(result.amountDepositToken[0]).to.equal(TOTAL_REWARD);
      expect(result.amountDepositToken[1]).to.equal(0n);
    });

    it('creation token MIDDLE/LAST in the list: the correct index is credited, not index 0 (the actual bug)', async function () {
      const t0 = await deployErc20('T0');
      const t1 = await deployErc20('T1');
      const t2 = await deployErc20('T2');
      const { history, mock } = await setup(
        [await t0.getAddress(), await t1.getAddress(), await t2.getAddress()],
        await t2.getAddress() // creation token is the LAST entry, not index 0
      );
      const result = await history.challengesInfo2(await mock.getAddress());
      // Before the fix: every entry was compared against erc20ListAddress[0] (t0), which never
      // equals createByToken (t2) here, so ALL entries would read 0 -- t2 never credited.
      expect(result.amountDepositToken[0]).to.equal(0n);
      expect(result.amountDepositToken[1]).to.equal(0n);
      expect(result.amountDepositToken[2]).to.equal(TOTAL_REWARD);
    });

  });

  describe('getHistoryTokenAndCoinSendToContract (coin-based path, allowGiveUp(1)=true)', function () {
    it('unfinished coin challenge: returns contract balance, no revert', async function () {
      const history = await deployHistory();
      const mock = await deployMockChallenge();
      await mock.setAllowGiveUp(1, true);
      await mock.setTotalReward(TOTAL_REWARD);
      await mock.setContractBalance(TOTAL_REWARD + hre.ethers.parseEther('1'));
      await mock.setIsFinished(false);
      const result = await history.getHistoryTokenAndCoinSendToContract(await mock.getAddress());
      expect(result[1]).to.equal(hre.ethers.parseEther('1'));
    });
  });

  describe('getHistoryTokenAndCoinSendToContract (token-created path, allowGiveUp(1)=false)', function () {
    async function setup(tokenAddrs: string[], createByToken: string, balances: bigint[]) {
      const history = await deployHistory();
      const mock = await deployMockChallenge();
      await mock.setAllowGiveUp(1, false);
      await mock.setErc20List(tokenAddrs);
      await mock.setCreateByToken(createByToken);
      await mock.setTotalReward(TOTAL_REWARD);
      const tokens = [];
      for (let i = 0; i < tokenAddrs.length; i++) {
        const Erc20 = await ethers.getContractFactory('MockERC20');
        const token = Erc20.attach(tokenAddrs[i]);
        if (balances[i] > 0n) {
          await (token as any).mint(await mock.getAddress(), balances[i]);
        }
        tokens.push(token);
      }
      return { history, mock, tokens };
    }

    it('zero tokens: returns a valid empty result, does not revert (finished or not)', async function () {
      const history = await deployHistory();
      const mock = await deployMockChallenge();
      await mock.setAllowGiveUp(1, false);
      await mock.setErc20List([]);
      await mock.setCreateByToken(ethers.ZeroAddress);
      await mock.setTotalReward(TOTAL_REWARD);
      await mock.setBalanceToken([]);
      await mock.setIsFinished(true);
      const result = await history.getHistoryTokenAndCoinSendToContract(await mock.getAddress());
      expect(result[2].length).to.equal(0);
      expect(result[3].length).to.equal(0);
    });

    it('creation token ABSENT from the list, unfinished: no phantom debit, all balances read as-is', async function () {
      const t0 = await deployErc20('T0');
      const t1 = await deployErc20('T1');
      const { history, mock } = await setup(
        [await t0.getAddress(), await t1.getAddress()],
        ethers.ZeroAddress, // creation token not in the list at all
        [hre.ethers.parseEther('5'), hre.ethers.parseEther('3')]
      );
      await mock.setIsFinished(false);
      const result = await history.getHistoryTokenAndCoinSendToContract(await mock.getAddress());
      // tokenBalanceBefor must stay 0 for every entry -- none was ever "the" creation token.
      expect(result[2][0]).to.equal(0n);
      expect(result[2][1]).to.equal(0n);
      expect(result[3][0]).to.equal(hre.ethers.parseEther('5'));
      expect(result[3][1]).to.equal(hre.ethers.parseEther('3'));
    });

    it('creation token ABSENT from the list, FINISHED: does not silently debit balanceToken[0] or revert (the exact AC3/AC4 case)', async function () {
      const t0 = await deployErc20('T0');
      const t1 = await deployErc20('T1');
      const { history, mock } = await setup(
        [await t0.getAddress(), await t1.getAddress()],
        ethers.ZeroAddress,
        [hre.ethers.parseEther('5'), hre.ethers.parseEther('3')]
      );
      await mock.setIsFinished(true);
      // balanceToken[0] deliberately smaller than totalReward -- if the old code's
      // indexCreateToken=0 default fired, this subtraction would underflow-revert.
      await mock.setBalanceToken([hre.ethers.parseEther('2'), hre.ethers.parseEther('9')]);

      const result = await history.getHistoryTokenAndCoinSendToContract(await mock.getAddress());
      // Neither slot was touched -- the creation token was never found, so no debit happened.
      expect(result[3][0]).to.equal(hre.ethers.parseEther('2'));
      expect(result[3][1]).to.equal(hre.ethers.parseEther('9'));
    });

    it('creation token MIDDLE/LAST in the list, finished: debits the CORRECT index, not index 0', async function () {
      const t0 = await deployErc20('T0');
      const t1 = await deployErc20('T1');
      const { history, mock } = await setup(
        [await t0.getAddress(), await t1.getAddress()],
        await t1.getAddress(), // creation token is the SECOND entry
        [hre.ethers.parseEther('5'), hre.ethers.parseEther('20')]
      );
      await mock.setIsFinished(true);
      await mock.setBalanceToken([hre.ethers.parseEther('5'), hre.ethers.parseEther('20')]);

      const result = await history.getHistoryTokenAndCoinSendToContract(await mock.getAddress());
      // Index 0 (t0, not the creation token) must be untouched.
      expect(result[3][0]).to.equal(hre.ethers.parseEther('5'));
      // Index 1 (t1, the actual creation token) is the one debited by totalReward.
      expect(result[3][1]).to.equal(hre.ethers.parseEther('20') - TOTAL_REWARD);
    });
  });
});
