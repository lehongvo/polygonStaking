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

// CHALLENGE-2694: transferNFTForSenderWhenFailed used to trust the caller-supplied
// _listSenderAddress array for WHO gets a deposited NFT back, with no check against who
// actually deposited it. Fixed to record custody in onERC721Received/onERC1155Received and
// use that authoritative record instead -- the array is still accepted (relayer signing
// already binds it, see CHALLENGE-2653) but its VALUES no longer pick the recipient.
describe('T14b – NFT custody is authoritative, not caller-supplied (fix CHALLENGE-2694)', function () {
  async function setupWithSafeDeposit() {
    const signers = await hre.ethers.getSigners();
    const [, challenger, , , depositor, attacker] = signers;

    const { challenge, startTime } = await deployChallenge('ChallengeBaseStep', {
      awardReceiversPercent: [50],
      index: 1,
      goal: 1000,
      dayRequired: 5,
      duration: 30,
      allowGiveUp: [true, true, false],
    });
    const challengeAddr = await challenge.getAddress();

    const ERC721F = await hre.ethers.getContractFactory('MockERC721');
    const erc721 = await ERC721F.deploy('DepositNFT', 'DNFT');
    await erc721.mint(depositor.address, 7);
    // Real safeTransferFrom -- triggers onERC721Received, recording `depositor` as owner.
    await erc721.connect(depositor)['safeTransferFrom(address,address,uint256)'](depositor.address, challengeAddr, 7);

    return { challenge, erc721, challenger, depositor, attacker, challengeAddr, startTime };
  }

  it('safeTransferFrom deposit is returned to the RECORDED depositor, ignoring a malicious _listSenderAddress', async function () {
    const { challenge, erc721, challenger, depositor, attacker, startTime } = await setupWithSafeDeposit();
    await moveToStart(startTime);

    // Attacker-controlled caller data claims the NFT should go to `attacker`, not `depositor`.
    await challenge
      .connect(challenger)
      .giveUp([await erc721.getAddress()], [[7]], [[attacker.address]], [true]);

    expect(await erc721.ownerOf(7)).to.equal(depositor.address); // NOT attacker
  });

  it('duplicate tokenId in the SAME call is a no-op the second time, not a double transfer or revert', async function () {
    const { challenge, erc721, challenger, depositor, startTime } = await setupWithSafeDeposit();
    await moveToStart(startTime);
    const nftAddr = await erc721.getAddress();

    // Same tokenId (7) listed twice in one call -- the custody mapping is cleared after the
    // first successful transfer, so the second occurrence must be silently skipped rather
    // than reverting (contract no longer owns it) or attempting a second transfer.
    await expect(
      challenge.connect(challenger).giveUp([nftAddr, nftAddr], [[7], [7]], [[depositor.address], [depositor.address]], [true, true])
    ).not.to.be.reverted;
    expect(await erc721.ownerOf(7)).to.equal(depositor.address);
  });

  it('a plain (non-safe) transferFrom deposit still falls back to the AUTHORITATIVE challenger address, never an arbitrary one', async function () {
    // Mirrors T14's setup (plain transferFrom -- no onERC721Received, no custody record).
    const signers = await hre.ethers.getSigners();
    const [, challenger, , , , attacker] = signers;
    const { challenge, startTime } = await deployChallenge('ChallengeBaseStep', {
      awardReceiversPercent: [50],
      index: 1,
      goal: 1000,
      dayRequired: 5,
      duration: 30,
      allowGiveUp: [true, true, false],
    });
    const challengeAddr = await challenge.getAddress();
    const ERC721F = await hre.ethers.getContractFactory('MockERC721');
    const erc721 = await ERC721F.deploy('PlainNFT', 'PNFT');
    await erc721.mint(challenger.address, 9);
    await erc721.connect(challenger).transferFrom(challenger.address, challengeAddr, 9);

    await moveToStart(startTime);
    // Attacker-supplied _listSenderAddress tries to redirect the untracked NFT to themselves.
    await challenge
      .connect(challenger)
      .giveUp([await erc721.getAddress()], [[9]], [[attacker.address]], [true]);

    expect(await erc721.ownerOf(9)).to.equal(challenger.address); // fell back to `challenger`, NOT attacker
  });
});
