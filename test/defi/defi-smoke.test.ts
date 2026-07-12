import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import hre from 'hardhat';

const { ethers, upgrades } = hre as any;

/**
 * Smoke/characterization test cho PolygonDeFiAggregator (trước đây 0 test).
 * Mục đích: verify deploy + init + custom error runtime SAU khi convert require→custom error.
 * (require(cond,"msg") → if(!(cond)) revert Err() — behavior-preserving, đây là bằng chứng runtime.)
 */
async function deployFixture() {
  const [owner, wmatic, user] = await ethers.getSigners();
  const Factory = await ethers.getContractFactory('PolygonDeFiAggregator');
  const agg = await upgrades.deployProxy(Factory, [owner.address, wmatic.address], {
    kind: 'uups',
    initializer: 'initialize',
    // Finding (pre-existing, KHÔNG do custom-error): state var `percentFeeForSystem` gán initial value
    // ở L137 — upgradeable contract nên set trong initialize() (initial value bị bỏ qua trong proxy storage).
    unsafeAllow: ['state-variable-assignment'],
  });
  await agg.waitForDeployment();
  return { agg, owner, wmatic, user };
}

describe('PolygonDeFiAggregator — smoke + custom error runtime', () => {
  it('deploy + init: owner được set đúng', async () => {
    const { agg, owner } = await loadFixture(deployFixture);
    expect(await agg.owner()).to.equal(owner.address);
  });

  it('addSupportedToken(address(0)) → revert InvalidTokenAddress (custom error runtime)', async () => {
    const { agg, owner } = await loadFixture(deployFixture);
    await expect(
      agg.connect(owner).addSupportedToken(ethers.ZeroAddress, 'X', 18)
    ).to.be.revertedWithCustomError(agg, 'InvalidTokenAddress');
  });

  it('addSupportedToken bởi non-owner → revert (Ownable giữ nguyên)', async () => {
    const { agg, user } = await loadFixture(deployFixture);
    await expect(
      agg.connect(user).addSupportedToken(user.address, 'X', 18)
    ).to.be.reverted;
  });

  it('addSupportedToken hợp lệ (owner, address != 0) → không revert', async () => {
    const { agg, owner, user } = await loadFixture(deployFixture);
    await expect(agg.connect(owner).addSupportedToken(user.address, 'TKN', 18)).to.not.be
      .reverted;
  });
});
