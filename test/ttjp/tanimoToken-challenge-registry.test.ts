// CHALLENGE-2707: TanimoToken._beforeTokenTransfer classified a transfer recipient as a
// "Challenge" solely by extcodesize(to) == sizeContract, then called IChallenge(to).isFinished().
// Code size is not an identity/authorization signal: an unrelated contract sharing that exact
// size would wrongly trigger the ABI call (and could revert transfers to it, or worse, hit
// incompatible ABI behavior if `to` doesn't actually implement isFinished()), while a legitimate
// Challenge upgrade/variant/compiler change could silently change size and bypass the guard.
// Replaced with an explicit onlyOwner-governed registry.
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
  await t.mintToken(owner.address, 1_000_000n);
  return { t, owner, alice, bob };
}

async function deployMockChallenge(finished: boolean) {
  const F = await ethers.getContractFactory('MockChallengeForHistory');
  const c = await F.deploy();
  await c.waitForDeployment();
  await c.setIsFinished(finished);
  return c;
}

describe('CHALLENGE-2707: TanimoToken transfer restriction uses a governed registry, not code size', () => {
  it('non-registered recipient (unrelated contract, even one implementing isFinished()) is never called and always accepts transfers', async () => {
    const { t, owner } = await deploy();
    const challenge = await deployMockChallenge(true); // isFinished() would revert if consulted
    // Never registered -- transfer must succeed with NO external isFinished() call.
    await expect(t.connect(owner).transfer(await challenge.getAddress(), 100n))
      .to.not.be.reverted;
    expect(await t.balanceOf(await challenge.getAddress())).to.equal(100n);
  });

  it('registered Challenge with isFinished()=true → transfer TO it reverts (Erc20ChallengeWasFinished)', async () => {
    const { t, owner } = await deploy();
    const challenge = await deployMockChallenge(true);
    await t
      .connect(owner)
      .setChallengeContract(await challenge.getAddress(), true);
    expect(
      await t.isRegisteredChallenge(await challenge.getAddress())
    ).to.equal(true);
    await expect(t.connect(owner).transfer(await challenge.getAddress(), 100n))
      .to.be.reverted;
  });

  it('registered Challenge with isFinished()=false → transfer succeeds', async () => {
    const { t, owner } = await deploy();
    const challenge = await deployMockChallenge(false);
    await t
      .connect(owner)
      .setChallengeContract(await challenge.getAddress(), true);
    await expect(t.connect(owner).transfer(await challenge.getAddress(), 100n))
      .to.not.be.reverted;
  });

  it('un-registering a Challenge restores normal transfer rules (no more isFinished() consultation)', async () => {
    const { t, owner } = await deploy();
    const challenge = await deployMockChallenge(true);
    await t
      .connect(owner)
      .setChallengeContract(await challenge.getAddress(), true);
    await expect(t.connect(owner).transfer(await challenge.getAddress(), 100n))
      .to.be.reverted;

    await t
      .connect(owner)
      .setChallengeContract(await challenge.getAddress(), false);
    expect(
      await t.isRegisteredChallenge(await challenge.getAddress())
    ).to.equal(false);
    await expect(t.connect(owner).transfer(await challenge.getAddress(), 100n))
      .to.not.be.reverted;
  });

  it('EOA recipients are never affected by the registry (no ABI call possible on an EOA)', async () => {
    const { t, owner, alice } = await deploy();
    await expect(t.connect(owner).transfer(alice.address, 100n)).to.not.be
      .reverted;
  });

  it('setChallengeContract is onlyOwner', async () => {
    const { t, alice, bob } = await deploy();
    await expect(t.connect(alice).setChallengeContract(bob.address, true)).to.be
      .reverted;
  });

  it('setChallengeContract(address(0), ...) reverts (InvalidChallengeAddress)', async () => {
    const { t, owner } = await deploy();
    await expect(
      t.connect(owner).setChallengeContract(ethers.ZeroAddress, true)
    ).to.be.reverted;
  });

  it('setChallengeContract emits ChallengeRegistryUpdated', async () => {
    const { t, owner, bob } = await deploy();
    await expect(t.connect(owner).setChallengeContract(bob.address, true))
      .to.emit(t, 'ChallengeRegistryUpdated')
      .withArgs(bob.address, true);
  });

  it('an unrelated contract that happens to share the SAME runtime bytecode size as a real Challenge is unaffected unless separately registered (the actual code-size collision bug)', async () => {
    const { t, owner } = await deploy();
    // Two independently-deployed instances of the SAME mock contract necessarily share the same
    // runtime bytecode size -- exactly the collision the old extcodesize check could not tell
    // apart. Registering only one must not affect the other.
    const registeredOne = await deployMockChallenge(true);
    const unrelatedOne = await deployMockChallenge(true);
    await t
      .connect(owner)
      .setChallengeContract(await registeredOne.getAddress(), true);

    await expect(
      t.connect(owner).transfer(await registeredOne.getAddress(), 100n)
    ).to.be.reverted;
    await expect(
      t.connect(owner).transfer(await unrelatedOne.getAddress(), 100n)
    ).to.not.be.reverted;
  });
});
