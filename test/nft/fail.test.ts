// 失敗ルート（giveUp）における ERC721 NFT の戻し処理を検証する。
// チャレンジコントラクトが保持していた NFT が、giveUp 経由で
// 指定アドレスへ正しく転送されるかを確認する。
import { expect } from 'chai';
import hre from 'hardhat';
import { deployChallenge, moveToStart } from '../helpers/deployHelpers.ts';

describe('T14 – NFT fail-path transfers via giveUp (ChallengeBaseStep)', function () {
  async function setup() {
    const signers = await hre.ethers.getSigners();
    const [, challenger] = signers;

    const { challenge, startTime } = await deployChallenge(
      'ChallengeBaseStep',
      {
        awardReceiversPercent: [50],
        index: 1,
        goal: 1000,
        dayRequired: 5,
        duration: 30,
        allowGiveUp: [true, true, false],
      }
    );

    const challengeAddr = await challenge.getAddress();

    const ERC721F = await hre.ethers.getContractFactory('MockERC721');
    const erc721 = await ERC721F.deploy('FailNFT', 'FNFT');
    await erc721.mint(challenger.address, 3);
    await erc721
      .connect(challenger)
      .transferFrom(challenger.address, challengeAddr, 3);

    return { challenge, erc721, challenger, challengeAddr, startTime };
  }

  // giveUp 時にトークン id=3 が challenger に返却され、コントラクト残高が 0 になる
  it('ERC721 token id=3 returned to challenger via giveUp', async function () {
    const { challenge, erc721, challenger, challengeAddr, startTime } =
      await setup();
    await moveToStart(startTime);

    await challenge
      .connect(challenger)
      .giveUp(
        [await erc721.getAddress()],
        [[3]],
        [[challenger.address]],
        [true]
      );

    expect(await erc721.ownerOf(3)).to.equal(challenger.address);
    expect(await erc721.balanceOf(challengeAddr)).to.equal(0n);
  });

  // NFT 配列が空でも giveUp は成立し、isFinished=true になる
  it('challenge isFinished=true after giveUp with empty NFT lists', async function () {
    const { challenge, challenger, startTime } = await setup();
    await moveToStart(startTime);
    await challenge.connect(challenger).giveUp([], [], [], []);
    expect(await challenge.isFinished()).to.be.true;
  });
});
