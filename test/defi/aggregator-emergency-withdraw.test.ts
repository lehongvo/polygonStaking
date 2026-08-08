// CHALLENGE-2794: emergencyWithdraw let the owner sweep the contract's ENTIRE balance of any
// ERC20, without checking registered underlying assets or active liabilities -- an operational
// mistake or owner-key compromise could immediately remove assets backing active user stakes,
// making later withdrawals fail or lose principal. Now sweeps only the provable surplus above
// the sum of tokenProtocolTVL across every registered protocol for that token.
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import hre from 'hardhat';

const { ethers, upgrades } = hre as any;

describe('PolygonDeFiAggregator.emergencyWithdraw — CHALLENGE-2794', function () {
  const A_POL_WMATIC = '0x6d80113e533a2C0fe82EaBD35f1875DcEA89Ea97';

  async function plantAToken(poolAddr: string) {
    const Factory = await ethers.getContractFactory('MockAToken');
    const deployed = await Factory.deploy();
    await deployed.waitForDeployment();
    const code = await ethers.provider.getCode(await deployed.getAddress());
    await hre.network.provider.request({ method: 'hardhat_setCode', params: [A_POL_WMATIC, code] });
    const aToken = await ethers.getContractAt('MockAToken', A_POL_WMATIC);
    await aToken.setPool(poolAddr);
    return aToken;
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
    await pool.setAToken(wmaticAddr, A_POL_WMATIC);
    await plantAToken(poolAddr);

    const Factory = await ethers.getContractFactory('PolygonDeFiAggregator');
    const agg = await upgrades.deployProxy(Factory, [owner.address, wmaticAddr], {
      kind: 'uups',
      initializer: 'initialize',
      unsafeAllow: ['state-variable-assignment'],
    });
    await agg.waitForDeployment();
    const aggAddr = await agg.getAddress();

    await agg.connect(owner).addProtocol('aave_lending', poolAddr, 'lending', 0);

    // Unrelated ERC20 with no liability tracked at all -- e.g. an accidental/airdropped token.
    const dustFactory = await ethers.getContractFactory('MockERC20');
    const dust = await dustFactory.deploy('Dust', 'DUST');
    await dust.waitForDeployment();

    return { agg, aggAddr, owner, user, wmatic, wmaticAddr, poolAddr, dust };
  }

  it('sweeping a token with ZERO balance is a harmless no-op (not a revert)', async function () {
    const { agg, owner, dust } = await loadFixture(deployFixture);
    await expect(agg.connect(owner).emergencyWithdraw(await dust.getAddress())).to.not.be.reverted;
  });

  it('sweeping an unrelated token with balance but no tracked liability sweeps the full amount (pure surplus)', async function () {
    const { agg, aggAddr, owner, dust } = await loadFixture(deployFixture);
    await dust.mint(aggAddr, 1000n);
    const before = await dust.balanceOf(owner.address);
    await agg.connect(owner).emergencyWithdraw(await dust.getAddress());
    expect(await dust.balanceOf(owner.address)).to.equal(before + 1000n);
    expect(await dust.balanceOf(aggAddr)).to.equal(0n);
  });

  it('sweeping the staking token while a stake is outstanding and NO surplus exists reverts (the actual bug)', async function () {
    const { agg, aggAddr, owner, user, wmatic, wmaticAddr } = await loadFixture(deployFixture);
    await agg
      .connect(user)
      .createTimeLockedStake(wmaticAddr, 0, 'aave_lending', 86400, { value: ethers.parseEther('1') });
    // Staking moves the WMATIC on to the Aave pool -- the aggregator's own balance drops back
    // near 0, even though tokenProtocolTVL still tracks the full 1 ether liability. Credit a
    // SMALL leftover balance directly (e.g. dust/partial return) so balance > 0 but still <=
    // the tracked liability -- exactly the case that must stay blocked.
    await wmatic.mint(aggAddr, { value: ethers.parseEther('0.3') });
    expect(await wmatic.balanceOf(aggAddr)).to.be.lessThanOrEqual(ethers.parseEther('1'));

    await expect(
      agg.connect(owner).emergencyWithdraw(wmaticAddr)
    ).to.be.revertedWithCustomError(agg, 'NoSurplusToRecover');
  });

  it('sweeping the staking token with a surplus ABOVE tracked liabilities sweeps only the surplus, leaving the liability intact', async function () {
    const { agg, aggAddr, owner, user, wmatic, wmaticAddr } = await loadFixture(deployFixture);
    await agg
      .connect(user)
      .createTimeLockedStake(wmaticAddr, 0, 'aave_lending', 86400, { value: ethers.parseEther('1') });

    // Directly mint MORE than the 1-ether tracked liability into the aggregator's own balance
    // (staking already moved the staked 1 ether on to the pool) -- a genuine surplus above what
    // is owed (e.g. accidental direct transfer), separate from the tracked staking liability.
    const balanceBeforeSweep = await wmatic.balanceOf(aggAddr);
    const totalLiability = ethers.parseEther('1');
    const expectedSurplus = ethers.parseEther('0.5');
    await wmatic.mint(aggAddr, { value: totalLiability + expectedSurplus - balanceBeforeSweep });
    expect(await wmatic.balanceOf(aggAddr)).to.equal(totalLiability + expectedSurplus);

    const ownerBefore = await wmatic.balanceOf(owner.address);
    await agg.connect(owner).emergencyWithdraw(wmaticAddr);
    expect(await wmatic.balanceOf(owner.address)).to.equal(ownerBefore + expectedSurplus);
    // Exactly the liability amount must remain in the contract, untouched.
    expect(await wmatic.balanceOf(aggAddr)).to.equal(totalLiability);
  });
});
