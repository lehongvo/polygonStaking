import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import hre from 'hardhat';

const { ethers, upgrades } = hre as any;

/**
 * CHALLENGE-2697: PolygonDeFiAggregator.withdrawTimeLockedStake previously (a) never checked
 * stake.isActive or block.timestamp >= stake.endTime, so a stake could be withdrawn early and
 * (via the missing isActive check) withdrawn a second time; (b) let the WITHDRAWER supply the
 * fee recipient address per call, redirecting the system fee anywhere; (c) called Aave's
 * supply() with onBehalfOf=msg.sender (the user), so this contract never actually custodied the
 * aTokens it later tried to withdraw with amount=type(uint256).max sent straight to the caller
 * -- which would also drain every other user's pooled position in the same token+protocol.
 *
 * Fix: active+maturity checks with state updated before any external interaction (CEI), a
 * governed systemFeeAddress (owner-only setter, no longer a withdraw parameter), and Aave
 * custody on address(this) with proportional (ERC4626-style) share accounting so each stake
 * can only ever claim its own slice of the pooled aToken balance.
 *
 * _getATokenAddress() is hardcoded to real mainnet aToken addresses (not injectable), so this
 * plants a mock aToken there via hardhat_setCode -- same technique already used for
 * CHALLENGE-2695 (test/defi/detailv2-staking-payout.test.ts). The "lending" protocol's pool
 * contractAddress itself IS owner-configurable (via addProtocol), so the mock Aave pool is
 * just deployed and registered normally.
 */
describe('PolygonDeFiAggregator.withdrawTimeLockedStake — CHALLENGE-2697', function () {
  const A_POL_WMATIC = '0x6d80113e533a2C0fe82EaBD35f1875DcEA89Ea97'; // hardcoded in _getATokenAddress

  async function plantAToken() {
    const Factory = await ethers.getContractFactory('MockAToken');
    const deployed = await Factory.deploy();
    await deployed.waitForDeployment();
    const code = await ethers.provider.getCode(await deployed.getAddress());
    await hre.network.provider.request({ method: 'hardhat_setCode', params: [A_POL_WMATIC, code] });
    return ethers.getContractAt('MockAToken', A_POL_WMATIC);
  }

  async function impersonate(address: string) {
    await hre.network.provider.request({ method: 'hardhat_impersonateAccount', params: [address] });
    await hre.network.provider.request({
      method: 'hardhat_setBalance',
      params: [address, '0x56BC75E2D63100000'], // 100 ETH, for gas
    });
    return ethers.getSigner(address);
  }

  async function deployFixture() {
    const [owner, user, user2] = await ethers.getSigners();

    const wmaticFactory = await ethers.getContractFactory('MockWMATIC');
    const wmatic = await wmaticFactory.deploy();
    await wmatic.waitForDeployment();
    const wmaticAddr = await wmatic.getAddress();

    const poolFactory = await ethers.getContractFactory('MockAavePoolWithAToken');
    const pool = await poolFactory.deploy();
    await pool.waitForDeployment();
    const poolAddr = await pool.getAddress();

    const aToken = await plantAToken();
    await aToken.setPool(poolAddr);
    await pool.setAToken(wmaticAddr, A_POL_WMATIC);

    const Factory = await ethers.getContractFactory('PolygonDeFiAggregator');
    const agg = await upgrades.deployProxy(Factory, [owner.address, wmaticAddr], {
      kind: 'uups',
      initializer: 'initialize',
      unsafeAllow: ['state-variable-assignment'],
    });
    await agg.waitForDeployment();
    const aggAddr = await agg.getAddress();

    await agg.connect(owner).addProtocol('aave_lending', poolAddr, 'lending', 0);

    return { agg, aggAddr, owner, user, user2, wmatic, wmaticAddr, pool, poolAddr, aToken };
  }

  async function stake(agg: any, wmaticAddr: string, signer: any, amount: bigint, lockDays = 1) {
    const tx = await agg
      .connect(signer)
      .createTimeLockedStake(wmaticAddr, 0, 'aave_lending', lockDays * 86400, { value: amount });
    await tx.wait();
    const position = await agg.getUserTimeLockedStakes(signer.address);
    return position.length - 1; // stakeId
  }

  async function seedYield(pool: any, poolAddr: string, aToken: any, aggAddr: string, wmatic: any, wmaticAddr: string, amount: bigint) {
    // Mint extra aToken to the Aggregator (simulating accrued Aave interest) and back it with
    // matching extra WMATIC held by the pool, so a subsequent withdraw() can actually pay it out.
    const poolSigner = await impersonate(poolAddr);
    await (aToken as any).connect(poolSigner).mint(aggAddr, amount);
    await (wmatic as any).mint(poolAddr, { value: amount });
  }

  it('withdraw before endTime reverts (StakeNotMatured)', async function () {
    const { agg, wmaticAddr, user } = await loadFixture(deployFixture);
    const amount = ethers.parseEther('10');
    const stakeId = await stake(agg, wmaticAddr, user, amount, 5);

    await expect(agg.connect(user).withdrawTimeLockedStake(stakeId)).to.be.revertedWithCustomError(
      agg,
      'StakeNotMatured'
    );
  });

  it('double withdrawal reverts (StakeNotActive) on the second call', async function () {
    const { agg, wmaticAddr, user } = await loadFixture(deployFixture);
    const amount = ethers.parseEther('10');
    const stakeId = await stake(agg, wmaticAddr, user, amount, 1);

    const { time } = await import('@nomicfoundation/hardhat-toolbox/network-helpers.js');
    await time.increase(1 * 86400 + 100);

    await expect(agg.connect(user).withdrawTimeLockedStake(stakeId)).not.to.be.reverted;
    await expect(agg.connect(user).withdrawTimeLockedStake(stakeId)).to.be.revertedWithCustomError(
      agg,
      'StakeNotActive'
    );
  });

  it('withdrawTimeLockedStake no longer accepts a fee-recipient parameter (ABI change)', async function () {
    const { agg } = await loadFixture(deployFixture);
    // Only one argument in the fragment now.
    const fn = agg.interface.getFunction('withdrawTimeLockedStake');
    expect(fn.inputs.length).to.equal(1);
  });

  it('fee always goes to the governed systemFeeAddress; owner can repoint it, withdrawer cannot choose it', async function () {
    const { agg, wmaticAddr, owner, user } = await loadFixture(deployFixture);
    const [, , , , newFeeRecipient] = await ethers.getSigners();

    expect(await agg.systemFeeAddress()).to.equal(owner.address); // default set in initialize()

    await agg.connect(owner).setSystemFeeAddress(newFeeRecipient.address);
    expect(await agg.systemFeeAddress()).to.equal(newFeeRecipient.address);

    await expect(agg.connect(owner).setSystemFeeAddress(ethers.ZeroAddress)).to.be.revertedWithCustomError(
      agg,
      'InvalidFeeRecipient'
    );
    await expect(agg.connect(user).setSystemFeeAddress(user.address)).to.be.reverted; // onlyOwner
  });

  it('Aave custody: aTokens are minted to the Aggregator contract, not to the staking user', async function () {
    const { agg, aggAddr, wmaticAddr, user, aToken } = await loadFixture(deployFixture);
    const amount = ethers.parseEther('10');
    await stake(agg, wmaticAddr, user, amount, 1);

    expect(await aToken.balanceOf(aggAddr)).to.equal(amount);
    expect(await aToken.balanceOf(user.address)).to.equal(0n); // NOT held by the user (old bug)
  });

  it('single user: principal + yield paid out, fee taken only from yield, matches percentFeeForSystem', async function () {
    const { agg, aggAddr, wmaticAddr, owner, user, wmatic, pool, poolAddr, aToken } =
      await loadFixture(deployFixture);
    const amount = ethers.parseEther('10');
    const yieldAmount = ethers.parseEther('1');
    const stakeId = await stake(agg, wmaticAddr, user, amount, 1);
    await seedYield(pool, poolAddr, aToken, aggAddr, wmatic, wmaticAddr, yieldAmount);

    const { time } = await import('@nomicfoundation/hardhat-toolbox/network-helpers.js');
    await time.increase(1 * 86400 + 100);

    // CHALLENGE-2697 (TANIMOTO re-review): withdrawal now prices shares via
    // (shares * (aTokenBalance + 1)) / (totalShares + SHARE_OFFSET) -- an asymmetric,
    // ERC4626-style offset (SHARE_OFFSET only on the shares term) that resists a
    // donation/inflation attack while still guaranteeing the withdrawn amount never exceeds the
    // actual pooled balance. That offset intentionally leaves a little dust in the contract on
    // every withdrawal, so the actual amount recovered is no longer bit-for-bit identical to the
    // raw aTokenBalance. Mirror the exact on-chain formula here instead of assuming zero
    // rounding loss.
    const SHARE_OFFSET = 1000n;
    const stakeBefore = (await agg.getUserTimeLockedStakes(user.address))[stakeId];
    const stakeShares = stakeBefore.shares;
    const totalSharesBefore = await agg.tokenProtocolTotalShares(wmaticAddr, 'aave_lending');
    const aTokenBalanceBeforeWithdraw = await aToken.balanceOf(aggAddr);
    const actualWithdrawn =
      (stakeShares * (aTokenBalanceBeforeWithdraw + 1n)) / (totalSharesBefore + SHARE_OFFSET);
    const expectedRewards = actualWithdrawn > amount ? actualWithdrawn - amount : 0n;

    const userBefore = await ethers.provider.getBalance(user.address);
    const feeBefore = await ethers.provider.getBalance(owner.address); // default fee recipient

    const tx = await agg.connect(user).withdrawTimeLockedStake(stakeId);
    const receipt = await tx.wait();
    const gasCost = receipt.gasUsed * receipt.gasPrice;

    const userAfter = await ethers.provider.getBalance(user.address);
    const feeAfter = await ethers.provider.getBalance(owner.address);

    const percentFee = await agg.percentFeeForSystem(); // default 20%, now set by initialize()
    expect(percentFee).to.equal(20n); // CHALLENGE-2697: no longer silently 0 on a fresh proxy
    const expectedFee = (expectedRewards * percentFee) / 100n;
    const expectedUserGain = amount + (expectedRewards - expectedFee) - gasCost;

    expect(feeAfter - feeBefore).to.equal(expectedFee);
    expect(userAfter - userBefore).to.equal(expectedUserGain);
  });

  it('multi-user isolation: withdrawing one user does not touch the other user\'s pooled position', async function () {
    const { agg, aggAddr, wmaticAddr, user, user2, aToken } = await loadFixture(deployFixture);
    const amount1 = ethers.parseEther('10');
    const amount2 = ethers.parseEther('5');
    const stakeId1 = await stake(agg, wmaticAddr, user, amount1, 1);
    await stake(agg, wmaticAddr, user2, amount2, 1);

    // Pool aToken balance is POOLED across both users; the pool already holds enough
    // underlying to cover both principals (transferred in via supply() during stake()).
    expect(await aToken.balanceOf(aggAddr)).to.equal(amount1 + amount2);

    const { time } = await import('@nomicfoundation/hardhat-toolbox/network-helpers.js');
    await time.increase(1 * 86400 + 100);

    await agg.connect(user).withdrawTimeLockedStake(stakeId1);

    // User1's withdrawal must NOT have touched user2's aToken claim: the pool's remaining
    // aToken balance for the Aggregator equals exactly user2's untouched principal.
    expect(await aToken.balanceOf(aggAddr)).to.equal(amount2);

    // user2 can still withdraw their own full amount afterward, unaffected.
    const user2Before = await ethers.provider.getBalance(user2.address);
    const tx2 = await agg.connect(user2).withdrawTimeLockedStake(0);
    const receipt2 = await tx2.wait();
    const gasCost2 = receipt2.gasUsed * receipt2.gasPrice;
    const user2After = await ethers.provider.getBalance(user2.address);
    expect(user2After - user2Before).to.equal(amount2 - gasCost2); // no yield seeded -> exact principal back
  });

  it('rounding: fee + user payout never exceed the actual withdrawn amount (no over-mint)', async function () {
    const { agg, aggAddr, wmaticAddr, user, wmatic, pool, poolAddr, aToken } = await loadFixture(deployFixture);
    // Odd amount to force integer-division rounding on the fee calculation.
    const amount = ethers.parseEther('7') + 13n;
    const yieldAmount = 777n; // tiny, odd yield -> (yield * 20)/100 floors
    const stakeId = await stake(agg, wmaticAddr, user, amount, 1);
    await seedYield(pool, poolAddr, aToken, aggAddr, wmatic, wmaticAddr, yieldAmount);

    const { time } = await import('@nomicfoundation/hardhat-toolbox/network-helpers.js');
    await time.increase(1 * 86400 + 100);

    await expect(agg.connect(user).withdrawTimeLockedStake(stakeId)).not.to.be.reverted;
    // Contract should hold no leftover WMATIC/native dust tied to this stake beyond rounding.
    expect(await wmatic.balanceOf(await agg.getAddress())).to.equal(0n);
  });
});
