// 成功ルートにおける ERC721 NFT 転送の検証。
// 成功時にコントラクトが保持していた NFT が challenger に
// 正しく送られること、および safeMintNFT による配列拡張を確認する。
import { expect } from 'chai';
import hre from 'hardhat';
import { deployChallenge, moveToStart } from '../helpers/deployHelpers.ts';

// 時間範囲（timeRange）の上限値として使用する uint53 相当の最大値
const MAX64 = BigInt(2 ** 53 - 1);

describe('T13 – NFT success-path transfers (ChallengeBaseStep)', function () {
  async function setup() {
    const signers = await hre.ethers.getSigners();
    const [, challenger] = signers;

    const { challenge, nft, startTime } = await deployChallenge(
      'ChallengeBaseStep',
      {
        awardReceiversPercent: [50],
        index: 1,
        goal: 1000,
        dayRequired: 1,
        duration: 30,
        allowGiveUp: [true, true, true],
      }
    );

    const challengeAddr = await challenge.getAddress();

    const ERC721F = await hre.ethers.getContractFactory('MockERC721');
    const erc721 = await ERC721F.deploy('TestNFT', 'TNFT');
    await erc721.mint(challenger.address, 1);
    await erc721
      .connect(challenger)
      .transferFrom(challenger.address, challengeAddr, 1);

    return { challenge, nft, erc721, challenger, challengeAddr, startTime };
  }

  // 成功確定で id=1 の NFT が challenge → challenger へ転送される
  it('ERC721 token id=1 transfers from challenge to challenger on success', async function () {
    const { challenge, erc721, challenger, challengeAddr, startTime } =
      await setup();
    expect(await erc721.ownerOf(1)).to.equal(challengeAddr);

    await moveToStart(startTime);
    await challenge
      .connect(challenger)
      .sendDailyResult(
        [startTime + 300],
        [1001],
        [0, 0],
        '0x',
        [],
        [await erc721.getAddress()],
        [[1]],
        [[]],
        [true],
        [0, MAX64],
        [],
        [],
        [],
        []
      );

    expect(await challenge.isSuccess()).to.be.true;
    expect(await erc721.ownerOf(1)).to.equal(challenger.address);
    expect(await erc721.balanceOf(challengeAddr)).to.equal(0n);
  });

  // allowGiveUp[2]=true 設定では成功時に safeMintNFT が走り、
  // erc721Address 配列が 2 要素まで拡張されることを確認
  it('erc721Address grows to length 2 after safeMintNFT fires (allowGiveUp[2]=true)', async function () {
    const { challenge, nft, challenger, startTime } = await setup();
    const nftAddr = await nft.getAddress();

    await nft.setSafeMintReturn(nftAddr, 99n);
    await moveToStart(startTime);

    await challenge
      .connect(challenger)
      .sendDailyResult(
        [startTime + 300],
        [1001],
        [0, 0],
        '0x',
        [],
        [],
        [],
        [],
        [],
        [0, MAX64],
        [],
        [],
        [],
        []
      );

    expect(await challenge.isSuccess()).to.be.true;
    expect(await challenge.erc721Address(1)).to.equal(nftAddr);
  });
});
