import { expect } from 'chai';
import hre from 'hardhat';

/**
 * Module 1B rewrite — TanimoToken (TTJP) H4 fix.
 * Was: `burnToken(address _from, uint) onlyOwner` → owner could burn ANY holder's balance
 * (arbitrary confiscation). Now: any caller may burn ONLY their own tokens (`_from == msg.sender`),
 * owner gate removed. Signature preserved (was never invoked on-chain). `mintToken` unchanged
 * (onlyOwner, used by ADMIN) — centralization noted separately.
 *
 * UUPS logic tested on the implementation deployed + initialized directly (proxy only needed for
 * upgradeability, not for mint/burn logic). sizeContract set non-zero so the challenge-finish
 * hook in _beforeTokenTransfer is skipped for EOA transfers.
 */
describe('TanimoToken — H4 burn confiscation fix', () => {
  async function deploy() {
    const [owner, alice, bob] = await hre.ethers.getSigners();
    const T = await hre.ethers.getContractFactory('TanimoToken');
    const t = await T.deploy();
    await t.initialize(owner.address, 99999n); // (_ownerOfToken, _sizeCodeContract)
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
});
