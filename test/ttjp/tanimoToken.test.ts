import { expect } from 'chai';
import hre from 'hardhat';

/**
 * Module 1B rewrite — TanimoToken (TTJP) H4 fix.
 * Was: `burnToken(address _from, uint) onlyOwner` → owner could burn ANY holder's balance
 * (arbitrary confiscation). Now: any caller may burn ONLY their own tokens (`_from == msg.sender`),
 * owner gate removed. Signature preserved (was never invoked on-chain). `mintToken` unchanged
 * (onlyOwner, used by ADMIN) — centralization noted separately.
 *
 * CHALLENGE-2702 added `_disableInitializers()` to the implementation's constructor, so
 * calling `initialize()` directly on a bare `T.deploy()` instance (as this test used to do)
 * now correctly reverts. Deploy through `upgrades.deployProxy` instead, matching the real
 * production deployment (scripts/TTJP/deploy-tanimo-token-kaia.ts) -- proxy only needed for
 * upgradeability, not for mint/burn logic, but it's also now required to initialize at all.
 * sizeContract set non-zero so the challenge-finish hook in _beforeTokenTransfer is skipped
 * for EOA transfers.
 */
describe('TanimoToken — H4 burn confiscation fix', () => {
  async function deploy() {
    const [owner, alice, bob] = await hre.ethers.getSigners();
    const T = await hre.ethers.getContractFactory('TanimoToken');
    const t = await (hre as any).upgrades.deployProxy(
      T,
      [owner.address, 99999n], // (_ownerOfToken, _sizeCodeContract)
      { initializer: 'initialize', kind: 'uups' }
    );
    await t.waitForDeployment();
    return { t, owner, alice, bob };
  }

  it('owner can mint; non-owner mint reverts', async () => {
    const { t, owner, alice } = await deploy();
    await t.mintToken(alice.address, 1000n);
    expect(await t.balanceOf(alice.address)).to.equal(1000n);
    await expect(t.connect(alice).mintToken(alice.address, 1n)).to.be.reverted; // YouDoNotHaveRight
  });

  it('H4: owner CANNOT burn another holder tokens (confiscation removed)', async () => {
    const { t, owner, alice } = await deploy();
    await t.mintToken(alice.address, 1000n);
    // owner attempts to confiscate alice's tokens → now reverts (_from != msg.sender)
    await expect(t.burnToken(alice.address, 500n)).to.be.reverted;
    expect(await t.balanceOf(alice.address)).to.equal(1000n); // untouched
  });

  it('H4: a holder can burn their OWN tokens (self-burn works)', async () => {
    const { t, owner, alice } = await deploy();
    await t.mintToken(alice.address, 1000n);
    await t.connect(alice).burnToken(alice.address, 400n);
    expect(await t.balanceOf(alice.address)).to.equal(600n);
  });

  it('H4: cannot burn on behalf of someone else even as a normal user', async () => {
    const { t, owner, alice, bob } = await deploy();
    await t.mintToken(alice.address, 1000n);
    await expect(t.connect(bob).burnToken(alice.address, 100n)).to.be.reverted;
  });

  // CHALLENGE-2702: calling initialize() directly on a bare (non-proxy) implementation
  // instance must revert -- otherwise an attacker could take owner/admin roles on the
  // implementation address itself.
  it('CHALLENGE-2702: initialize() on the bare implementation reverts (initializers disabled)', async () => {
    const [attacker] = await hre.ethers.getSigners();
    const T = await hre.ethers.getContractFactory('TanimoToken');
    const implementation = await T.deploy();
    await implementation.waitForDeployment();
    await expect(implementation.initialize(attacker.address, 1n)).to.be.reverted;
  });
});
