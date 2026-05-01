// N2 修正: 実際の ERC20 を使った場合、listBalanceAllToken が二重登録されない
// ことを保証する回帰テスト。
import { expect } from 'chai';
import hre from 'hardhat';
import { deployChallenge, moveToStart } from '../helpers/deployHelpers.ts';

describe('T12 – N2 fix: listBalanceAllToken not doubled with real ERC20', function () {
  async function setup() {
    const MockERC20 = await hre.ethers.getContractFactory('MockERC20');
    const tkn1 = await MockERC20.deploy('Token1', 'TKN1');
    const tknAddr = await tkn1.getAddress();

    const { challenge, signers, startTime } = await deployChallenge(
      'ChallengeBaseStep',
      {
        awardReceiversPercent: [50, 40],
        index: 1,
        dayRequired: 20,
        allAwardToSponsor: true,
        erc20List: [tknAddr],
      }
    );

    const challengeAddr = await challenge.getAddress();
    await tkn1.mint(challengeAddr, hre.ethers.parseEther('100'));
    return { tkn1, tknAddr, challenge, challengeAddr, signers, startTime };
  }

  // giveUp 後でも、登録済みトークンが二重に積まれずちょうど 1 件になる
  it('getBalanceToken().length == 1 after giveUp (no doubling)', async function () {
    const { challenge, signers, startTime } = await setup();
    await moveToStart(startTime);
    await challenge.connect(signers[1]).giveUp([], [], [], []);
    const balances = await challenge.getBalanceToken();
    expect(balances.length).to.equal(1);
  });

  // 残高記録は手数料控除前のスナップショット（100 TKN1）であることを確認
  it('getBalanceToken()[0] == 100 TKN1 (pre-fee snapshot)', async function () {
    const { challenge, signers, startTime } = await setup();
    await moveToStart(startTime);
    await challenge.connect(signers[1]).giveUp([], [], [], []);
    const balances = await challenge.getBalanceToken();
    expect(balances[0]).to.equal(hre.ethers.parseEther('100'));
  });

  // レジストリ側にも 1 件のみ登録されていること（重複登録の防止確認）
  it('allContractERC20() returns the 1 ERC20 from registry', async function () {
    const { tknAddr, challenge } = await setup();
    const list = await challenge.allContractERC20();
    expect(list.length).to.equal(1);
    expect(list[0].toLowerCase()).to.equal(tknAddr.toLowerCase());
  });
});
