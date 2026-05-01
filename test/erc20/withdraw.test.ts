// 終了後に追加で送られた ERC20 を returnedNFTWallet にスイープする
// withdrawTokensOnCompletion の動作確認。アクセス制御も併せて検証する。
import { expect } from 'chai';
import hre from 'hardhat';
import { deployChallenge, moveToStart } from '../helpers/deployHelpers.ts';

describe('T11 – withdrawTokensOnCompletion ERC20 sweep', function () {
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
    await tkn1.mint(challengeAddr, hre.ethers.parseEther('1000'));
    await moveToStart(startTime);
    await challenge.connect(signers[1]).giveUp([], [], [], []);

    const returnedNFTWallet = signers[3];
    return {
      tkn1,
      tknAddr,
      challenge,
      challengeAddr,
      signers,
      returnedNFTWallet,
    };
  }

  // 前提条件: giveUp 後はコントラクト残高がクリアされていること
  it('contract TKN1 == 0 after giveUp (precondition)', async function () {
    const { tkn1, challengeAddr } = await setup();
    expect(await tkn1.balanceOf(challengeAddr)).to.equal(0n);
  });

  // 終了後に追加で mint されたトークンを returnedNFTWallet が回収できることを確認
  it('extra TKN1 minted after finish swept to returnedNFTWallet', async function () {
    const { tkn1, tknAddr, challenge, challengeAddr, returnedNFTWallet } =
      await setup();
    const extra = hre.ethers.parseEther('500');
    await tkn1.mint(challengeAddr, extra);

    const before = await tkn1.balanceOf(returnedNFTWallet.address);
    await challenge
      .connect(returnedNFTWallet)
      .withdrawTokensOnCompletion([tknAddr], [], [], []);

    expect(await tkn1.balanceOf(challengeAddr)).to.equal(0n);
    expect(await tkn1.balanceOf(returnedNFTWallet.address)).to.equal(
      before + extra
    );
  });

  // returnedNFTWallet 以外の呼び出しは権限エラーで revert する
  it('reverts when caller is not returnedNFTWallet', async function () {
    const { tknAddr, challenge, signers } = await setup();
    await expect(
      challenge
        .connect(signers[0])
        .withdrawTokensOnCompletion([tknAddr], [], [], [])
    ).to.be.revertedWith('Only returned nft wallet address');
  });
});
