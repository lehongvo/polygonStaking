// 複数の ERC20 トークン（5種）を保持する状態で giveUp を実行した場合の
// ガス消費上限と、N2 修正（残高記録の重複防止）を検証する。
import { expect } from 'chai';
import hre from 'hardhat';
import {
  deployChallenge,
  moveToStart,
  FAIL_FEE,
} from '../helpers/deployHelpers.ts';

// 5 トークン分のループでも 1.5M ガス未満に収まることを期待
const GAS_LIMIT_GIVEUP = 1_500_000n;
const TOKEN_MINT = hre.ethers.parseEther('1000');

describe('T27 – many ERC20 loop gas + N2 reset (5 tokens)', function () {
  async function setup() {
    const MockERC20 = await hre.ethers.getContractFactory('MockERC20');
    const tokens = await Promise.all([
      MockERC20.deploy('Token0', 'TK0'),
      MockERC20.deploy('Token1', 'TK1'),
      MockERC20.deploy('Token2', 'TK2'),
      MockERC20.deploy('Token3', 'TK3'),
      MockERC20.deploy('Token4', 'TK4'),
    ]);
    const tokenAddresses = await Promise.all(tokens.map(t => t.getAddress()));

    const { challenge, startTime, signers } = await deployChallenge(
      'ChallengeBaseStep',
      {
        awardReceiversPercent: [50, 50],
        index: 1,
        duration: 30,
        dayRequired: 20,
        goal: 1000,
        allowGiveUp: [true, true, false],
        allAwardToSponsor: true,
        totalAmount: hre.ethers.parseEther('10'),
        erc20List: tokenAddresses,
      }
    );

    const challengeAddress = await challenge.getAddress();
    for (const token of tokens) {
      await token.mint(challengeAddress, TOKEN_MINT);
    }

    return { challenge, startTime, signers, tokens };
  }

  // 5 トークン分の giveUp 処理が 1.5M ガス未満で完了すること
  it('giveUp with 5 ERC20 tokens completes under 1.5 M gas', async function () {
    const { challenge, startTime, signers } = await setup();

    await moveToStart(startTime);

    const tx = await challenge.connect(signers[0]).giveUp([], [], [], []);
    const receipt = await tx.wait();
    const gasUsed: bigint = receipt!.gasUsed;
    console.log(`  [T27] giveUp 5-ERC20 gas: ${gasUsed.toLocaleString()}`);

    expect(gasUsed).to.be.lt(GAS_LIMIT_GIVEUP);
  });

  // feeAddress が各 ERC20 から FAIL_FEE% を正確に受け取っていること
  it('feeAddress received exactly FAIL_FEE% of each ERC20 token', async function () {
    const { challenge, startTime, signers, tokens } = await setup();

    await moveToStart(startTime);
    const feeAddr = signers[2];
    await challenge.connect(signers[0]).giveUp([], [], [], []);

    const expectedFee = (TOKEN_MINT * BigInt(FAIL_FEE)) / 100n;
    for (let i = 0; i < tokens.length; i++) {
      const feeBalance = await tokens[i].balanceOf(feeAddr.address);
      expect(feeBalance).to.equal(expectedFee, `Token ${i} fee mismatch`);
    }
  });

  // N2 修正の確認: giveUp 後に登録トークンが 5 件のまま（重複なし）
  it('getBalanceToken().length == 5 after giveUp (N2 reset)', async function () {
    const { challenge, startTime, signers } = await setup();

    await moveToStart(startTime);
    await challenge.connect(signers[0]).giveUp([], [], [], []);

    const balanceTokens = await challenge.getBalanceToken();
    expect(balanceTokens.length).to.equal(5);
  });

  // giveUp 後はチャレンジ状態が GAVE_UP (=3) に遷移し isFinished=true
  it('challenge state == GAVE_UP (3) after giveUp', async function () {
    const { challenge, startTime, signers } = await setup();

    await moveToStart(startTime);
    await challenge.connect(signers[0]).giveUp([], [], [], []);

    expect(await challenge.getState()).to.equal(3n);
    expect(await challenge.isFinished()).to.be.true;
  });
});
