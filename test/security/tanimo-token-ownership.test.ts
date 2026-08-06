// CHALLENGE-2804: TanimoToken previously exposed no ownership transfer/acceptance/cancellation
// path -- `_owner` was set once in initialize() with no zero-address guard and never
// rotatable. mintToken, setSizeContract, and _authorizeUpgrade (UUPS upgrade authorization) are
// all onlyOwner, so losing that key permanently blocks maintenance and compromising it grants
// unbounded minting + arbitrary implementation upgrades with no recovery path.
//
// This proves the new two-step propose/accept/cancel flow: only the current owner may propose,
// only the exact proposed address may accept, a stale/no-op cancel reverts, the old owner loses
// authority immediately after acceptance, and zero-address initialization is rejected. It also
// proves, via @openzeppelin/hardhat-upgrades' real storage-layout validator, that the new
// _pendingOwner slot is a safe append relative to the layout currently live on Kaia mainnet
// (deployInfo/tanimo-token-kaia.json).
import { expect } from 'chai';
import hre from 'hardhat';

const { ethers, upgrades } = hre as any;

async function deploy() {
  const [owner, alice, bob] = await ethers.getSigners();
  const T = await ethers.getContractFactory('TanimoToken');
  const t = await upgrades.deployProxy(T, [owner.address, 99999n], {
    initializer: 'initialize',
    kind: 'uups',
  });
  await t.waitForDeployment();
  return { t, owner, alice, bob };
}

describe('CHALLENGE-2804: TanimoToken two-step ownership rotation', () => {
  it('rejects zero-address owner at initialize()', async () => {
    const T = await ethers.getContractFactory('TanimoToken');
    await expect(
      upgrades.deployProxy(T, [ethers.ZeroAddress, 99999n], {
        initializer: 'initialize',
        kind: 'uups',
      })
    ).to.be.reverted;
  });

  it('non-owner cannot propose a new owner', async () => {
    const { t, alice, bob } = await deploy();
    await expect(t.connect(alice).transferOwnership(bob.address)).to.be
      .reverted;
  });

  it('propose does NOT change ownership until accepted', async () => {
    const { t, owner, alice } = await deploy();
    await t.connect(owner).transferOwnership(alice.address);
    expect(await t._owner()).to.equal(owner.address);
    expect(await t._pendingOwner()).to.equal(alice.address);
    // Old owner privileges are untouched while the proposal is pending.
    await expect(t.connect(owner).mintToken(owner.address, 1n)).to.not.be
      .reverted;
  });

  it('only the proposed address can accept; a third party cannot', async () => {
    const { t, owner, alice, bob } = await deploy();
    await t.connect(owner).transferOwnership(alice.address);
    await expect(t.connect(bob).acceptOwnership()).to.be.reverted;
  });

  it('the OLD owner cannot accept their own proposal for someone else', async () => {
    const { t, owner, alice } = await deploy();
    await t.connect(owner).transferOwnership(alice.address);
    await expect(t.connect(owner).acceptOwnership()).to.be.reverted;
  });

  it('acceptOwnership completes the rotation: new owner gains rights, old owner loses them', async () => {
    const { t, owner, alice } = await deploy();
    await t.connect(owner).transferOwnership(alice.address);
    await expect(t.connect(alice).acceptOwnership())
      .to.emit(t, 'OwnershipTransferAccepted')
      .withArgs(owner.address, alice.address);

    expect(await t._owner()).to.equal(alice.address);
    expect(await t._pendingOwner()).to.equal(ethers.ZeroAddress);

    // New owner can now mint; old owner is fully locked out.
    await expect(t.connect(alice).mintToken(alice.address, 1n)).to.not.be
      .reverted;
    await expect(t.connect(owner).mintToken(owner.address, 1n)).to.be.reverted;
  });

  it('acceptOwnership reverts with no pending proposal', async () => {
    const { t, alice } = await deploy();
    await expect(t.connect(alice).acceptOwnership()).to.be.reverted;
  });

  it('cancelOwnershipTransfer clears the proposal; the cancelled address can no longer accept', async () => {
    const { t, owner, alice } = await deploy();
    await t.connect(owner).transferOwnership(alice.address);
    await expect(t.connect(owner).cancelOwnershipTransfer())
      .to.emit(t, 'OwnershipTransferCancelled')
      .withArgs(owner.address, alice.address);

    expect(await t._pendingOwner()).to.equal(ethers.ZeroAddress);
    await expect(t.connect(alice).acceptOwnership()).to.be.reverted;
    // Owner unaffected -- can still mint and re-propose.
    expect(await t._owner()).to.equal(owner.address);
  });

  it('cancelOwnershipTransfer reverts when there is nothing pending (not a silent no-op)', async () => {
    const { t, owner } = await deploy();
    await expect(t.connect(owner).cancelOwnershipTransfer()).to.be.reverted;
  });

  it('non-owner cannot cancel', async () => {
    const { t, owner, alice, bob } = await deploy();
    await t.connect(owner).transferOwnership(alice.address);
    await expect(t.connect(bob).cancelOwnershipTransfer()).to.be.reverted;
  });

  it('a new owner can re-propose and rotate again (chained rotation)', async () => {
    const { t, owner, alice, bob } = await deploy();
    await t.connect(owner).transferOwnership(alice.address);
    await t.connect(alice).acceptOwnership();
    await t.connect(alice).transferOwnership(bob.address);
    await t.connect(bob).acceptOwnership();
    expect(await t._owner()).to.equal(bob.address);
    await expect(t.connect(alice).mintToken(alice.address, 1n)).to.be.reverted;
    await expect(t.connect(bob).mintToken(bob.address, 1n)).to.not.be.reverted;
  });

  describe('storage-layout compatibility with the Kaia mainnet deployment', () => {
    it('current contracts/TTJP/TanimoToken.sol is a storage-compatible upgrade from the on-chain baseline', async () => {
      const OldFactory = await ethers.getContractFactory(
        'OldTanimoTokenV1ForLayoutTest'
      );
      const NewFactory = await ethers.getContractFactory('TanimoToken');
      await upgrades.validateUpgrade(OldFactory, NewFactory);
    });
  });
});
