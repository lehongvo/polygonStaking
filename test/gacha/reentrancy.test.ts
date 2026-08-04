// CHALLENGE-2732: Gacha.randomRewards performed every reward transfer BEFORE updating the
// counters meant to bound those transfers (rewardActivationCount, the unlockRate
// redistribution, isSendDailyResultWithGacha), and Gacha inherited no reentrancy guard at all.
// A reentrant call arriving mid-transfer (e.g. from an ERC1155 receiver hook fired during the
// payout) could re-read the stale, not-yet-incremented rewardActivationCount and pass the same
// maxNumberAllowed cap check again within the same transaction.
//
// Fix: the bounding counters/flags are now written before any external transfer call (CEI), and
// randomRewards is now nonReentrant. This test proves the SECOND layer specifically -- a
// registered-but-compromised Challenge contract (already holding CHALLENGE_ROLE, i.e. CHALLENGE-
// 2672's gate is assumed already passed) that reenters from its own onERC1155Received hook is
// rejected by the guard, and the total reward payout never exceeds maxNumberAllowed.
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import hre from 'hardhat';
import {
  deployGachaFixture,
  addERC20Reward,
  setRandomResult,
  TypeToken,
} from './fixtures';

const { ethers } = hre as any;

describe('Gacha.randomRewards — reentrancy guard (CHALLENGE-2732)', function () {
  async function setupMalicious() {
    const ctx = await loadFixture(deployGachaFixture);
    const { gacha, owner, supplement, erc1155Reward, vrfClassic } = ctx;

    const MaliciousFactory = await ethers.getContractFactory('MockMaliciousGachaChallenge');
    const malicious = await MaliciousFactory.deploy(await supplement.getAddress());
    await malicious.waitForDeployment();
    const maliciousAddr = await malicious.getAddress();
    await malicious.setGacha(await gacha.getAddress());

    // Register the malicious contract as an "authorized" Challenge (CHALLENGE-2672's gate) --
    // this test specifically isolates the SEPARATE CHALLENGE-2732 reentrancy defect, assuming
    // the caller has already legitimately (or via a compromised admin key) obtained the role.
    const CHALLENGE_ROLE = await gacha.CHALLENGE_ROLE();
    await gacha.connect(owner).grantRole(CHALLENGE_ROLE, maliciousAddr);

    // Route the reward destination to the malicious contract itself, so IT receives the
    // ERC1155 payout and its onERC1155Received hook fires.
    await supplement.setDestinationAddress(maliciousAddr);

    await erc1155Reward.mint(await gacha.getAddress(), 9, 100);
    await gacha.connect(owner).updateRewardRateAndMaxAllowed(0, 0, 0);
    await gacha
      .connect(owner)
      .addNewReward(
        await erc1155Reward.getAddress(),
        100,
        25, // rewardValue
        9, // indexToken
        TypeToken.ERC1155,
        false, // isMintNft (transfer-existing path -- the one that actually calls the hook)
        1, // maxNumberAllowed -- exactly 1, so any bypass is immediately observable
        []
      );
    await setRandomResult(vrfClassic, 0);

    return { ...ctx, malicious, maliciousAddr };
  }

  it('a reentrant randomRewards call from the ERC1155 receiver hook is rejected', async function () {
    const { gacha, malicious, maliciousAddr } = await setupMalicious();

    // Trigger the outer, legitimate randomRewards() call AS the malicious contract (it must be
    // both msg.sender and _challengeAddress, matching CHALLENGE-2672's check) -- routed through
    // an impersonated signer since the contract itself has no external "call me" entrypoint
    // other than acting as msg.sender directly.
    await hre.network.provider.request({ method: 'hardhat_impersonateAccount', params: [maliciousAddr] });
    await hre.network.provider.request({
      method: 'hardhat_setBalance',
      params: [maliciousAddr, '0x56BC75E2D63100000'],
    });
    const maliciousSigner = await ethers.getSigner(maliciousAddr);

    await expect(gacha.connect(maliciousSigner).randomRewards(maliciousAddr, [5000])).not.to.be
      .reverted;

    expect(await malicious.reentryAttempted()).to.equal(true);
    expect(await malicious.reentrySucceeded()).to.equal(
      false,
      'the reentrant randomRewards() call must have been rejected by nonReentrant'
    );
  });

  it('total ERC1155 payout never exceeds maxNumberAllowed despite the reentrancy attempt', async function () {
    const { gacha, malicious, maliciousAddr, erc1155Reward } = await setupMalicious();

    await hre.network.provider.request({ method: 'hardhat_impersonateAccount', params: [maliciousAddr] });
    await hre.network.provider.request({
      method: 'hardhat_setBalance',
      params: [maliciousAddr, '0x56BC75E2D63100000'],
    });
    const maliciousSigner = await ethers.getSigner(maliciousAddr);

    await gacha.connect(maliciousSigner).randomRewards(maliciousAddr, [5000]);

    // Exactly ONE reward's worth (25), not 50 -- proves the reentrant attempt could not grant a
    // second payout beyond maxNumberAllowed=1.
    expect(await erc1155Reward.balanceOf(maliciousAddr, 9)).to.equal(25n);

    const rewardInfo = await gacha.rewardTokens(1);
    expect(rewardInfo.rewardActivationCount).to.equal(1n);
  });
});
