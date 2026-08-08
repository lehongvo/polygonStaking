// CHALLENGE-2701 re-review: listIdToken (the Gacha reward catalog) had no count bound, and
// every draw scans it in full (getRandomIndexReward's cumulative-bucket loop). This proves the
// new MAX_REWARD_COUNT bound is enforced, and measures worst-case draw gas at that bound against
// a documented ceiling.
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers.js';
import { expect } from 'chai';
import hre from 'hardhat';
import { deployGachaFixture, setRandomResult, TypeToken } from '../gacha/fixtures.ts';

const { ethers } = hre as any;

const MAX_REWARD_COUNT = 100;

// Documented ceiling: a worst-case draw (VRF result forced to land on the LAST of 100 catalog
// entries, so getRandomIndexReward's cumulative loop runs all 100 iterations) measures
// ~942,718 gas -- well under any realistic per-tx block gas limit (0.06x of a Kaia/Polygon-scale
// 30M-gas block). Ceiling set with ~1.6x headroom over the measured value so the test is not
// flaky on unrelated small opcode-cost changes, while still catching a real regression (e.g. an
// accidental O(n^2) reintroduction, which would blow past this by orders of magnitude) quickly.
const WORST_CASE_DRAW_GAS_CEILING = 1_500_000n;

async function addRewardAtIndex(gacha: any, owner: any, erc20Address: string) {
  await gacha
    .connect(owner)
    .addNewReward(erc20Address, 1, 1n, 0, TypeToken.ERC20, false, 1000, []);
}

describe('CHALLENGE-2701: Gacha reward catalog (listIdToken) is bounded and worst-case draw gas is documented', function () {
  it('addNewReward reverts with TooManyRewards once the catalog reaches MAX_REWARD_COUNT', async function () {
    const { gacha, owner, erc20Reward } = await loadFixture(deployGachaFixture);
    const erc20Address = await erc20Reward.getAddress();

    for (let i = 0; i < MAX_REWARD_COUNT; i++) {
      await addRewardAtIndex(gacha, owner, erc20Address);
    }
    expect(await gacha.getTotalNumberReward()).to.equal(MAX_REWARD_COUNT);

    await expect(
      addRewardAtIndex(gacha, owner, erc20Address)
    ).to.be.revertedWithCustomError(gacha, 'TooManyRewards');
  });

  it('a worst-case draw (full 100-entry catalog scan) stays under the documented gas ceiling', async function () {
    const { gacha, owner, challenger, challenge, erc20Reward, vrfClassic } =
      await loadFixture(deployGachaFixture);
    const erc20Address = await erc20Reward.getAddress();

    await gacha.connect(owner).updateRewardRateAndMaxAllowed(0, 0, 0);
    for (let i = 0; i < MAX_REWARD_COUNT; i++) {
      await addRewardAtIndex(gacha, owner, erc20Address);
    }
    // Enough balance to deliver whichever of the 100 equally-weighted rewards gets picked.
    await erc20Reward.mint(await gacha.getAddress(), 10_000n);

    // updateRewardRateAndMaxAllowed(0, 0, 0) zeroes slot 0's (rateOfLost) unlockRate, so
    // totalUnlockReward = 0 + 100 added rewards at unlockRate=1 each = 100. Forcing vrfResult=99
    // makes randomNumber = (99 % 100) + 1 = 100, which only satisfies the cumulative check on
    // the LAST loop iteration (bucket boundary == totalUnlockReward) -- the worst case for the
    // linear scan in getRandomIndexReward.
    await setRandomResult(vrfClassic, 99);

    const tx = await challenge.callRandomRewards(await gacha.getAddress(), [5000]);
    const receipt = await tx.wait();

    expect(await erc20Reward.balanceOf(challenger.address)).to.equal(1n);
    expect(receipt.gasUsed).to.be.lt(WORST_CASE_DRAW_GAS_CEILING);
  });
});
