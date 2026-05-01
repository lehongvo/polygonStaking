// 成功時に呼ばれる safeMintNFT コールバックの結果（NFT アドレス・tokenId）が
// チャレンジ側のストレージに正しく保存されることを検証する。
import { expect } from 'chai';
import hre from 'hardhat';
import { deployChallenge, moveToStart } from '../helpers/deployHelpers.ts';

// 時間範囲（timeRange）の上限値として使用する uint53 相当の最大値
const MAX64 = BigInt(2 ** 53 - 1);

describe('T15 – safeMintNFT callback stores address and tokenId on success', function () {
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

    return { challenge, nft, challenger, startTime };
  }

  async function triggerSuccess(
    challenge: any,
    challenger: any,
    startTime: number
  ) {
    await moveToStart(startTime);
    return challenge
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
  }

  // モックが返した NFT アドレスが erc721Address[1] に格納される
  it('erc721Address[1] equals address returned by safeMintNFT mock', async function () {
    const { challenge, nft, challenger, startTime } = await setup();

    const ERC721F = await hre.ethers.getContractFactory('MockERC721');
    const dummy = await ERC721F.deploy('Dummy', 'DUM');
    const dummyAddr = await dummy.getAddress();

    await nft.setSafeMintReturn(dummyAddr, 7n);
    await triggerSuccess(challenge, challenger, startTime);

    expect(await challenge.isSuccess()).to.be.true;
    expect(await challenge.erc721Address(1)).to.equal(dummyAddr);
  });

  // モックが返した tokenId が indexNft に保存される
  it('indexNft equals tokenId returned by safeMintNFT mock', async function () {
    const { challenge, nft, challenger, startTime } = await setup();
    const nftAddr = await nft.getAddress();

    await nft.setSafeMintReturn(nftAddr, 123n);
    await triggerSuccess(challenge, challenger, startTime);

    expect(await challenge.indexNft()).to.equal(123n);
  });

  // 成功後に erc721Address[1] が読み取れる = 配列が拡張されたことの確認
  it('erc721Address[1] is accessible after success (proves array grew)', async function () {
    const { challenge, nft, challenger, startTime } = await setup();
    const nftAddr = await nft.getAddress();

    await nft.setSafeMintReturn(nftAddr, 1n);
    await triggerSuccess(challenge, challenger, startTime);
    expect(await challenge.erc721Address(1)).to.equal(nftAddr);
  });
});
