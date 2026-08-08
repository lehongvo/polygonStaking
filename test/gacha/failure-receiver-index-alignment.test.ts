// CHALLENGE-2798: checkRewardConditions' DIVIDEND_FAIL loop iterated
// awardReceiversPercent[i] for i starting at 1 (the first failure-side entry), but always called
// getAwardReceiversAtIndex(0, false) -- hardcoded, never advancing with i. With more than one
// failure receiver, a LATER entry's 98% match got checked against the FIRST failure receiver's
// identity instead of its own. Fixed to use `i - 1` (the failure-relative index
// getAwardReceiversAtIndex expects) for both.
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers.js';
import { expect } from 'chai';
import hre from 'hardhat';
import { deployGachaFixture, defaultChallengeInfo, DividendStatus } from './fixtures';

const { ethers } = hre as any;

async function setupDividendFail(overrides: { percents: number[]; failReceivers: [string, string] }) {
  const { gacha, owner, challenge, adminWallet, other } = await loadFixture(deployGachaFixture);

  await gacha.connect(owner).updateChallengeInfor(
    { ...defaultChallengeInfo, dividendStatus: DividendStatus.FAIL },
    true, // isDefaultGachaContract -- checkExist()+this short-circuits to true, no NFT setup needed
    adminWallet.address, // receiveAdminWallet
    (await ethers.getSigners())[2].address, // returnedNFTWallet (unused here, just non-zero)
    'TestGacha',
    'TestSponsor'
  );

  await challenge.setAwardReceiversPercent(overrides.percents);
  await challenge.setAwardReceiversAtIndex(0, false, overrides.failReceivers[0]);
  await challenge.setAwardReceiversAtIndex(1, false, overrides.failReceivers[1]);

  return { gacha, challenge, adminWallet, other };
}

describe('CHALLENGE-2798: Gacha failure-receiver percent/index alignment', function () {
  it('98% entry NOT first (2nd failure receiver): matches the CORRECT receiver, not the first one (the actual bug)', async function () {
    const [, , , , , someoneElse] = await ethers.getSigners();
    const { gacha, challenge, adminWallet } = await setupDividendFail({
      // index 0 = success-side (never read by this loop), 1 = first failure (50%, not 98), 2 = second failure (98%)
      percents: [10, 50, 98],
      failReceivers: [someoneElse.address, ethers.ZeroAddress], // placeholder, overwritten below
    });
    // Overwrite explicitly so the two fail-slots are unambiguous: slot 0 = unrelated address,
    // slot 1 (the ACTUAL 98% receiver) = the admin wallet gacha is configured to recognize.
    await challenge.setAwardReceiversAtIndex(0, false, someoneElse.address);
    await challenge.setAwardReceiversAtIndex(1, false, adminWallet.address);

    const result = await gacha.checkRequireBalanceNft(
      await challenge.getAddress(),
      [5000],
      0
    );
    // Pre-fix: checked getAwardReceiversAtIndex(0,false) = someoneElse != adminWallet -> false
    // (wrong -- the real 98% receiver, at fail-index 1, WAS the admin wallet).
    expect(result).to.equal(true);
  });

  it('98% entry NOT first, and the first failure receiver happens to BE the admin wallet: does not false-positive on the wrong index', async function () {
    const [, , , , , someoneElse] = await ethers.getSigners();
    const { gacha, challenge, adminWallet } = await setupDividendFail({
      percents: [10, 50, 98],
      failReceivers: [ethers.ZeroAddress, ethers.ZeroAddress],
    });
    // Slot 0 (NOT the 98% receiver) is the admin wallet; slot 1 (the ACTUAL 98% receiver) is not.
    await challenge.setAwardReceiversAtIndex(0, false, adminWallet.address);
    await challenge.setAwardReceiversAtIndex(1, false, someoneElse.address);

    const result = await gacha.checkRequireBalanceNft(
      await challenge.getAddress(),
      [5000],
      0
    );
    // Pre-fix: getAwardReceiversAtIndex(0,false) = adminWallet -> WRONGLY true (index 0 isn't the
    // 98% receiver at all). Post-fix: getAwardReceiversAtIndex(1,false) = someoneElse -> false.
    expect(result).to.equal(false);
  });

  it('no matching admin receiver anywhere in the failure partition: correctly false', async function () {
    const [, , , , , someoneElse, anotherOne] = await ethers.getSigners();
    const { gacha, challenge } = await setupDividendFail({
      percents: [10, 50, 98],
      failReceivers: [ethers.ZeroAddress, ethers.ZeroAddress],
    });
    await challenge.setAwardReceiversAtIndex(0, false, someoneElse.address);
    await challenge.setAwardReceiversAtIndex(1, false, anotherOne.address);

    const result = await gacha.checkRequireBalanceNft(
      await challenge.getAddress(),
      [5000],
      0
    );
    expect(result).to.equal(false);
  });

  it('98% entry IS first (i=1, the pre-existing correctly-handled case): still matches correctly', async function () {
    const { gacha, challenge, adminWallet } = await setupDividendFail({
      percents: [10, 98],
      failReceivers: [ethers.ZeroAddress, ethers.ZeroAddress],
    });
    await challenge.setAwardReceiversAtIndex(0, false, adminWallet.address);

    const result = await gacha.checkRequireBalanceNft(
      await challenge.getAddress(),
      [5000],
      0
    );
    expect(result).to.equal(true);
  });
});
