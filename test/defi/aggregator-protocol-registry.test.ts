// CHALLENGE-2793: addProtocol only rejected re-registering an ACTIVE record -- a deactivated
// protocol with live liabilities (totalDeposited > 0, i.e. stakes still referencing it by name)
// could be silently overwritten (new contractAddress/type, totalDeposited reset to 0), corrupting
// withdrawal accounting for those existing stakes (subtract from a reset total -> underflow
// revert, or route redemption through a completely different adapter). Separately,
// setProtocolStatus could activate a name that was never registered via addProtocol at all,
// leaving createTimeLockedStake to approve/stake against address(0).
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import hre from 'hardhat';

const { ethers, upgrades } = hre as any;

describe('PolygonDeFiAggregator protocol registry integrity — CHALLENGE-2793', function () {
  // _getATokenAddress() is hardcoded to a real mainnet aToken address (not injectable) -- plant a
  // mock there via hardhat_setCode, same technique as test/defi/aggregator-withdraw.test.ts, so a
  // real WMATIC/aave_lending stake can actually be created to produce totalDeposited > 0.
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

    const pool2 = await poolFactory.deploy();
    await pool2.waitForDeployment();
    const pool2Addr = await pool2.getAddress();

    const Factory = await ethers.getContractFactory('PolygonDeFiAggregator');
    const agg = await upgrades.deployProxy(Factory, [owner.address, wmaticAddr], {
      kind: 'uups',
      initializer: 'initialize',
      unsafeAllow: ['state-variable-assignment'],
    });
    await agg.waitForDeployment();

    return { agg, owner, user, wmatic, wmaticAddr, poolAddr, pool2Addr };
  }

  it('addProtocol on a never-registered name succeeds (baseline)', async function () {
    const { agg, owner, poolAddr } = await loadFixture(deployFixture);
    await expect(agg.connect(owner).addProtocol('aave_lending', poolAddr, 'lending', 0)).to.not.be
      .reverted;
  });

  it('addProtocol re-registering a DEACTIVATED, fully-drained (totalDeposited==0) name succeeds -- legitimate protocol rotation', async function () {
    const { agg, owner, poolAddr, pool2Addr } = await loadFixture(deployFixture);
    await agg.connect(owner).addProtocol('aave_lending', poolAddr, 'lending', 0);
    await agg.connect(owner).setProtocolStatus('aave_lending', false);

    await expect(agg.connect(owner).addProtocol('aave_lending', pool2Addr, 'lending', 0)).to.not
      .be.reverted;
    const info = await agg.protocols('aave_lending');
    expect(info.contractAddress).to.equal(pool2Addr);
  });

  it('addProtocol re-registering a DEACTIVATED name with OUTSTANDING liabilities (totalDeposited>0) reverts (the actual bug)', async function () {
    const { agg, owner, user, wmaticAddr, poolAddr, pool2Addr } = await loadFixture(deployFixture);
    await agg.connect(owner).addProtocol('aave_lending', poolAddr, 'lending', 0);

    // Create a real stake so totalDeposited > 0.
    await agg
      .connect(user)
      .createTimeLockedStake(wmaticAddr, 0, 'aave_lending', 86400, { value: ethers.parseEther('1') });
    const before = await agg.protocols('aave_lending');
    expect(before.totalDeposited).to.be.greaterThan(0n);

    await agg.connect(owner).setProtocolStatus('aave_lending', false);

    await expect(
      agg.connect(owner).addProtocol('aave_lending', pool2Addr, 'lending', 0)
    ).to.be.revertedWithCustomError(agg, 'ProtocolHasOutstandingLiabilities');

    // Record must be UNCHANGED -- the old bug's danger was exactly that this silently succeeded
    // and corrupted contractAddress/totalDeposited for the still-outstanding stake.
    const after = await agg.protocols('aave_lending');
    expect(after.contractAddress).to.equal(poolAddr);
    expect(after.totalDeposited).to.equal(before.totalDeposited);
  });

  it('setProtocolStatus(unknownName, true) reverts (ProtocolNotFound) -- was previously silently activating an empty record', async function () {
    const { agg, owner } = await loadFixture(deployFixture);
    await expect(
      agg.connect(owner).setProtocolStatus('never_registered', true)
    ).to.be.revertedWithCustomError(agg, 'ProtocolNotFound');
  });

  it('setProtocolStatus(unknownName, false) does not revert -- deactivating a no-op name is harmless and stays unconditional', async function () {
    const { agg, owner } = await loadFixture(deployFixture);
    await expect(agg.connect(owner).setProtocolStatus('never_registered', false)).to.not.be
      .reverted;
  });

  it('setProtocolStatus(knownName, true) reactivation still works normally', async function () {
    const { agg, owner, poolAddr } = await loadFixture(deployFixture);
    await agg.connect(owner).addProtocol('aave_lending', poolAddr, 'lending', 0);
    await agg.connect(owner).setProtocolStatus('aave_lending', false);
    await expect(agg.connect(owner).setProtocolStatus('aave_lending', true)).to.not.be.reverted;
    const info = await agg.protocols('aave_lending');
    expect(info.isActive).to.equal(true);
  });
});
