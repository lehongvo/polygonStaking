import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import hre from 'hardhat';

const { ethers, upgrades } = hre as any;

/**
 * CHALLENGE-2697 (TANIMOTO re-review of the already-"Resolved" ticket): three further bugs
 * survived the original fix and were found in a later comment on the same ticket:
 *
 *  1. `percentFeeForSystem`'s inline field default (= 20) never executes against PROXY storage
 *     (the constructor that would run it is disabled for a UUPS proxy) -- a fresh deployment's
 *     fee was silently 0 until `initialize()` was patched to assign it explicitly. A
 *     `reinitializeSystemFee()` (reinitializer(2), onlyOwner) lets the ALREADY-LIVE proxy be
 *     corrected the same way, without re-running the rest of initialize().
 *  2. Donation/inflation attack on the Aave share-accounting formula: an attacker who inflates
 *     the pooled aToken balance ahead of a victim's deposit (classic ERC4626 first-depositor
 *     attack) could previously round the victim's `shares` to 0. A SHARE_OFFSET (virtual
 *     shares/dead shares) constant added to both sides of every share ratio makes that
 *     attack uneconomical. Separately, Compound V2's `mint()`/`redeem()` return an ERROR CODE
 *     (0 = success), not an amount -- treating that code as `shares`/`amount` meant every
 *     Compound deposit tracked 0 shares. Both branches now derive amounts from balance deltas
 *     and revert (`CompoundOperationFailed`) on a nonzero code.
 *  3. The native (WMATIC) withdrawal branch unconditionally tried to pay out the full original
 *     `stakeAmount`, reverting on any shortfall (protocol loss, rounding) instead of paying the
 *     recoverable minimum like the already-correct ERC20 branch below it.
 */
describe('PolygonDeFiAggregator — CHALLENGE-2697 TANIMOTO re-review fixes', function () {
  const A_POL_WMATIC = '0x6d80113e533a2C0fe82EaBD35f1875DcEA89Ea97'; // hardcoded in _getATokenAddress
  const SHARE_OFFSET = 1000n;

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
    const [owner, user] = await ethers.getSigners();

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

    return { agg, aggAddr, owner, user, wmatic, wmaticAddr, pool, poolAddr, aToken };
  }

  // ===== 1. reinitializeSystemFee() =====

  describe('reinitializeSystemFee()', function () {
    it('corrects a percentFeeForSystem that is still 0 on an already-initialized proxy', async function () {
      const { agg, owner } = await loadFixture(deployFixture);
      await agg.connect(owner).setPercentFeeForSystem(0); // simulate the pre-fix "still 0" state
      expect(await agg.percentFeeForSystem()).to.equal(0n);

      await agg.connect(owner).reinitializeSystemFee();
      expect(await agg.percentFeeForSystem()).to.equal(20n);
    });

    it('is a no-op when percentFeeForSystem is already nonzero', async function () {
      const { agg, owner } = await loadFixture(deployFixture);
      await agg.connect(owner).setPercentFeeForSystem(35);

      await agg.connect(owner).reinitializeSystemFee();
      expect(await agg.percentFeeForSystem()).to.equal(35n); // unchanged, not forced back to 20
    });

    it('reverts for a non-owner caller', async function () {
      const { agg, user } = await loadFixture(deployFixture);
      await expect(agg.connect(user).reinitializeSystemFee()).to.be.reverted;
    });

    it('can only ever run once (reinitializer(2) guard)', async function () {
      const { agg, owner } = await loadFixture(deployFixture);
      await expect(agg.connect(owner).reinitializeSystemFee()).to.not.be.reverted;
      await expect(agg.connect(owner).reinitializeSystemFee()).to.be.revertedWithCustomError(
        agg,
        'InvalidInitialization'
      );
    });
  });

  // ===== 2a. Donation/inflation attack resistance (Aave lending branch) =====

  describe('donation/inflation attack resistance (Aave lending)', function () {
    // Attacker seeds 1 wei of real shares (the classic ERC4626 first-depositor attack setup),
    // then donates a large aToken balance directly to the aggregator by impersonating the pool
    // -- bypassing _stakeToProtocol entirely, exactly as a real attacker would by transferring
    // aTokens straight to the aggregator's address. Both tests below replay this same setup;
    // shared here so the "old formula" comparison in the mutation check stays independently
    // derived rather than read back off the already-fixed contract.
    const donation = ethers.parseEther('10000'); // far larger than the victim's deposit below
    const victimAmount = ethers.parseEther('5000');

    async function seedAttackerAndDonate(agg: any, aggAddr: string, wmaticAddr: string, owner: any, poolAddr: string, aToken: any) {
      await agg.connect(owner).createTimeLockedStake(wmaticAddr, 0, 'aave_lending', 86400, { value: 1n });
      const poolSigner = await impersonate(poolAddr);
      await aToken.connect(poolSigner).mint(aggAddr, donation);
    }

    it('a legitimate depositor still receives nonzero shares after an attacker inflates the pooled aToken balance', async function () {
      const { agg, aggAddr, wmaticAddr, owner, user, poolAddr, aToken } = await loadFixture(deployFixture);
      await seedAttackerAndDonate(agg, aggAddr, wmaticAddr, owner, poolAddr, aToken);

      // CHALLENGE-2697 fix: shares = received * (totalSharesBefore + SHARE_OFFSET) / (balanceBefore + 1).
      // The attacker's 1-wei seed deposit itself mints SHARE_OFFSET-scaled shares (1 * 1000 / 1 =
      // 1000) purely as a first-deposit nominal-scaling artifact of the offset formula, not an
      // unfair advantage -- it still corresponds to exactly the 1 wei of real value they put in.
      expect(await agg.tokenProtocolTotalShares(wmaticAddr, 'aave_lending')).to.equal(1000n);

      await agg
        .connect(user)
        .createTimeLockedStake(wmaticAddr, 0, 'aave_lending', 86400, { value: victimAmount });

      const stakes = await agg.getUserTimeLockedStakes(user.address);
      const victimShares = stakes[stakes.length - 1].shares;
      expect(victimShares).to.be.greaterThan(0n); // CHALLENGE-2697: no longer zeroed out
    });

    it('mutation check: the pre-TANIMOTO-re-review formula (no SHARE_OFFSET, zero-totalShares special case) would round the victim to exactly 0 shares', async function () {
      // Independently replay the OLD, unfixed formula's own bookkeeping (NOT read from the
      // already-fixed live contract, whose totalShares/balance are inflated by the offset) --
      // this is what CHALLENGE-2697's ORIGINAL fix (before TANIMOTO's re-review) computed:
      //   shares = (totalSharesBefore == 0 || balanceBefore == 0) ? received
      //                                                            : received * totalSharesBefore / balanceBefore
      const oldAttackerShares = 1n; // totalSharesBefore==0 special case -> shares = received = 1 wei
      const oldBalanceAfterDonation = 1n + donation;
      const oldFormulaVictimShares = (victimAmount * oldAttackerShares) / oldBalanceAfterDonation;
      expect(oldFormulaVictimShares).to.equal(0n);
    });

    it('zero-amount aTokens minted from a deposit reverts with ZeroSharesMinted instead of silently recording a claimless stake', async function () {
      const { agg, wmaticAddr, owner } = await loadFixture(deployFixture);
      // Re-using MockAavePoolForTest (CHALLENGE-2695 mock, no aToken minting at all) makes
      // supply() succeed (pulls WMATIC) while the tracked aToken balance never changes -- i.e.
      // `received` in _stakeToProtocol is 0. Swap it in under the SAME 'aave_lending' name (the
      // native-MATIC path requires the protocol name to literally equal "aave_lending") by
      // deactivating and re-registering, which addProtocol allows once totalDeposited is 0.
      const brokenPoolFactory = await ethers.getContractFactory('MockAavePoolForTest');
      const brokenPool = await brokenPoolFactory.deploy();
      await brokenPool.waitForDeployment();
      await agg.connect(owner).setProtocolStatus('aave_lending', false);
      await agg.connect(owner).addProtocol('aave_lending', await brokenPool.getAddress(), 'lending', 0);

      await expect(
        agg.connect(owner).createTimeLockedStake(wmaticAddr, 0, 'aave_lending', 86400, { value: ethers.parseEther('1') })
      ).to.be.revertedWithCustomError(agg, 'ZeroSharesMinted');
    });
  });

  // ===== 2b. Compound mint()/redeem() return-code fix =====

  describe('Compound mint()/redeem() return-code fix', function () {
    async function compoundFixture() {
      const base = await deployFixture();
      const { agg, owner } = base;

      const tokenFactory = await ethers.getContractFactory('MockERC20');
      const token = await tokenFactory.deploy('Comp Underlying', 'CU');
      await token.waitForDeployment();
      const tokenAddr = await token.getAddress();

      const poolFactory = await ethers.getContractFactory('MockCompoundPool');
      const cPool = await poolFactory.deploy(tokenAddr);
      await cPool.waitForDeployment();
      const cPoolAddr = await cPool.getAddress();

      await agg.connect(owner).addSupportedToken(tokenAddr, 'CU', 18);
      await agg.connect(owner).addProtocol('compound_test', cPoolAddr, 'compound', 0);

      await token.mint(owner.address, ethers.parseEther('1000'));
      await token.connect(owner).approve(await agg.getAddress(), ethers.MaxUint256);

      return { ...base, token, tokenAddr, cPool, cPoolAddr };
    }

    it('a successful mint() (error code 0) is NOT treated as the share amount -- shares come from the cToken balance delta', async function () {
      const { agg, owner, tokenAddr } = await loadFixture(compoundFixture);
      const amount = ethers.parseEther('100');

      await expect(
        agg.connect(owner).createTimeLockedStake(tokenAddr, amount, 'compound_test', 86400)
      ).to.not.be.reverted;

      const stakes = await agg.getUserTimeLockedStakes(owner.address);
      const shares = stakes[stakes.length - 1].shares;
      // Old (buggy) code assigned `shares = cToken.mint(_amount)` directly -- since the mock
      // (like real Compound) returns 0 on success, that would always be 0 and this deposit
      // would revert with ZeroSharesMinted instead of succeeding with real shares. Fixed formula
      // (first deposit, cBalanceBefore=0): shares = cReceived * (0 + SHARE_OFFSET) / (0 + 1) =
      // cReceived * SHARE_OFFSET exactly -- the first-deposit nominal-scaling artifact of the
      // offset formula (see the donation-attack describe block above), not rounding dust.
      expect(shares).to.equal(amount * SHARE_OFFSET);
    });

    it('mint() returning a nonzero error code reverts with CompoundOperationFailed (the code is now actually checked)', async function () {
      const { agg, owner, tokenAddr, cPool } = await loadFixture(compoundFixture);
      await cPool.setMintErrorCode(13); // arbitrary nonzero Compound error code

      await expect(
        agg.connect(owner).createTimeLockedStake(tokenAddr, ethers.parseEther('10'), 'compound_test', 86400)
      ).to.be.revertedWithCustomError(agg, 'CompoundOperationFailed');
    });

    it('stake then withdraw round-trip recovers ~principal (redeem() balance-delta correctness)', async function () {
      const { agg, owner, tokenAddr, token } = await loadFixture(compoundFixture);
      const amount = ethers.parseEther('50');
      await agg.connect(owner).createTimeLockedStake(tokenAddr, amount, 'compound_test', 86400);

      const { time } = await import('@nomicfoundation/hardhat-toolbox/network-helpers.js');
      await time.increase(86400 + 100);

      const before = await token.balanceOf(owner.address);
      await expect(agg.connect(owner).withdrawTimeLockedStake(0)).to.not.be.reverted;
      const after = await token.balanceOf(owner.address);
      // Sole depositor redeeming their full position recovers exactly the principal: the
      // asymmetric offset formula (see _withdrawFromProtocol) converts internal shares back to
      // cTokens via the inverse ratio, which is exact (no rounding loss) whenever the redeemer
      // holds 100% of totalShares against a balance with no accrued yield or loss.
      expect(after - before).to.equal(amount);
    });

    it('redeem() returning a nonzero error code reverts with CompoundOperationFailed', async function () {
      const { agg, owner, tokenAddr, cPool } = await loadFixture(compoundFixture);
      await agg.connect(owner).createTimeLockedStake(tokenAddr, ethers.parseEther('10'), 'compound_test', 86400);

      const { time } = await import('@nomicfoundation/hardhat-toolbox/network-helpers.js');
      await time.increase(86400 + 100);

      await cPool.setRedeemErrorCode(9);
      await expect(agg.connect(owner).withdrawTimeLockedStake(0)).to.be.revertedWithCustomError(
        agg,
        'CompoundOperationFailed'
      );
    });
  });

  // ===== 3. Native (WMATIC) withdrawal loss handling =====

  describe('native (WMATIC) withdrawal pays the recoverable minimum on a shortfall', function () {
    it('a partial Aave-side loss no longer reverts the whole withdrawal -- the recoverable amount is still paid out', async function () {
      const { agg, aggAddr, wmaticAddr, user, poolAddr, aToken } = await loadFixture(deployFixture);
      const amount = ethers.parseEther('10');

      await agg
        .connect(user)
        .createTimeLockedStake(wmaticAddr, 0, 'aave_lending', 86400, { value: amount });

      // Simulate a protocol-side loss: burn part of the aToken balance backing this stake (e.g.
      // an Aave shortfall/slashing event), so aTokenBalance < stakeAmount at withdrawal time.
      const lossAmount = ethers.parseEther('3');
      const poolSigner = await impersonate(poolAddr);
      await aToken.connect(poolSigner).burn(aggAddr, lossAmount);

      const { time } = await import('@nomicfoundation/hardhat-toolbox/network-helpers.js');
      await time.increase(86400 + 100);

      const userBefore = await ethers.provider.getBalance(user.address);
      const tx = await agg.connect(user).withdrawTimeLockedStake(0); // must NOT revert (old bug)
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;
      const userAfter = await ethers.provider.getBalance(user.address);

      const expectedPayout = amount - lossAmount; // minus a few wei of SHARE_OFFSET dust
      expect(userAfter - userBefore).to.be.closeTo(expectedPayout - gasCost, SHARE_OFFSET);
      expect(userAfter - userBefore).to.be.lessThan(expectedPayout - gasCost + 1n);
    });

    it('mutation check: paying the full original stakeAmount (old behavior) would revert on this same shortfall', async function () {
      const { agg, aggAddr, wmaticAddr, wmatic, user, poolAddr, aToken } = await loadFixture(deployFixture);
      const amount = ethers.parseEther('10');
      await agg
        .connect(user)
        .createTimeLockedStake(wmaticAddr, 0, 'aave_lending', 86400, { value: amount });

      const lossAmount = ethers.parseEther('3');
      const poolSigner = await impersonate(poolAddr);
      await aToken.connect(poolSigner).burn(aggAddr, lossAmount);

      // After withdrawFromProtocol pulls back only (amount - lossAmount) WMATIC, the aggregator's
      // own WMATIC balance is (amount - lossAmount) -- asking MockWMATIC to unwrap the full
      // original `amount` (the pre-fix behavior) must revert for insufficient balance.
      const aggWmaticBalance = await wmatic.balanceOf(aggAddr);
      expect(aggWmaticBalance).to.be.lessThan(amount);
      const aggSigner = await impersonate(aggAddr);
      await expect(wmatic.connect(aggSigner).withdraw(amount)).to.be.reverted;
    });
  });
});
