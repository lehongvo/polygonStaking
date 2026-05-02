import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import hre from 'hardhat';
import { deployExerciseSupplementFixture } from './fixtures';

const { ethers } = hre as any;

async function deployErc20(symbol: string) {
  const Factory = await ethers.getContractFactory('MockERC20');
  const tok = await Factory.deploy(symbol, symbol);
  await tok.waitForDeployment();
  return tok;
}

describe('ExerciseSupplementNFT — ERC20 registry', function () {
  it('TTJP symbol → type 1', async function () {
    const { nft, owner } = await loadFixture(deployExerciseSupplementFixture);
    const tok = await deployErc20('TTJP');
    const addr = await tok.getAddress();
    await nft.connect(owner).updateListERC20Address(addr, true);
    expect(await nft.getTypeTokenErc20(addr)).to.equal(1n);
  });

  it('JPYC symbol → type 2', async function () {
    const { nft, owner } = await loadFixture(deployExerciseSupplementFixture);
    const tok = await deployErc20('JPYC');
    const addr = await tok.getAddress();
    await nft.connect(owner).updateListERC20Address(addr, true);
    expect(await nft.getTypeTokenErc20(addr)).to.equal(2n);
  });

  it('Other symbol → type 3', async function () {
    const { nft, owner } = await loadFixture(deployExerciseSupplementFixture);
    const tok = await deployErc20('USDC');
    const addr = await tok.getAddress();
    await nft.connect(owner).updateListERC20Address(addr, true);
    expect(await nft.getTypeTokenErc20(addr)).to.equal(3n);
  });

  it('add → list contains; remove → cleared', async function () {
    const { nft, owner } = await loadFixture(deployExerciseSupplementFixture);
    const tok = await deployErc20('XYZ');
    const addr = await tok.getAddress();
    await nft.connect(owner).updateListERC20Address(addr, true);
    let list = await nft.getErc20ListAddress();
    expect(list).to.include(addr);

    await nft.connect(owner).updateListERC20Address(addr, false);
    list = await nft.getErc20ListAddress();
    expect(list).to.not.include(addr);
    // type cleared after remove
    expect(await nft.getTypeTokenErc20(addr)).to.equal(0n);
  });

  it('non-role caller reverts', async function () {
    const { nft, attacker } = await loadFixture(deployExerciseSupplementFixture);
    const tok = await deployErc20('Z');
    await expect(
      nft.connect(attacker).updateListERC20Address(await tok.getAddress(), true)
    ).to.be.revertedWith(/AccessControl/);
  });

  it('symbol matching is case-sensitive: "ttjp" lowercase → type 3 (other)', async function () {
    const { nft, owner } = await loadFixture(deployExerciseSupplementFixture);
    const tok = await deployErc20('ttjp');
    const addr = await tok.getAddress();
    await nft.connect(owner).updateListERC20Address(addr, true);
    expect(await nft.getTypeTokenErc20(addr)).to.equal(3n);
  });

  it('partial match "TTJP_v2" → type 3 (not exact)', async function () {
    const { nft, owner } = await loadFixture(deployExerciseSupplementFixture);
    const tok = await deployErc20('TTJP_v2');
    const addr = await tok.getAddress();
    await nft.connect(owner).updateListERC20Address(addr, true);
    expect(await nft.getTypeTokenErc20(addr)).to.equal(3n);
  });

  it('add → remove → re-add same address: type re-detected', async function () {
    const { nft, owner } = await loadFixture(deployExerciseSupplementFixture);
    const tok = await deployErc20('TTJP');
    const addr = await tok.getAddress();

    await nft.connect(owner).updateListERC20Address(addr, true);
    expect(await nft.getTypeTokenErc20(addr)).to.equal(1n);
    await nft.connect(owner).updateListERC20Address(addr, false);
    expect(await nft.getTypeTokenErc20(addr)).to.equal(0n);
    await nft.connect(owner).updateListERC20Address(addr, true);
    expect(await nft.getTypeTokenErc20(addr)).to.equal(1n);
  });

  it('two different tokens: types tracked independently', async function () {
    const { nft, owner } = await loadFixture(deployExerciseSupplementFixture);
    const ttjp = await deployErc20('TTJP');
    const jpyc = await deployErc20('JPYC');
    await nft.connect(owner).updateListERC20Address(await ttjp.getAddress(), true);
    await nft.connect(owner).updateListERC20Address(await jpyc.getAddress(), true);

    expect(await nft.getTypeTokenErc20(await ttjp.getAddress())).to.equal(1n);
    expect(await nft.getTypeTokenErc20(await jpyc.getAddress())).to.equal(2n);

    // Remove only TTJP
    await nft
      .connect(owner)
      .updateListERC20Address(await ttjp.getAddress(), false);
    expect(await nft.getTypeTokenErc20(await ttjp.getAddress())).to.equal(0n);
    expect(await nft.getTypeTokenErc20(await jpyc.getAddress())).to.equal(2n);
  });

  it('add zero address → revert (no symbol() call)', async function () {
    const { nft, owner } = await loadFixture(deployExerciseSupplementFixture);
    await expect(
      nft.connect(owner).updateListERC20Address(ethers.ZeroAddress, true)
    ).to.be.revertedWith('INVALID ERC20 ADDRESS');
  });

  it('remove non-listed address: list unchanged + typeToken stays 0', async function () {
    const { nft, owner } = await loadFixture(deployExerciseSupplementFixture);
    const tok = await deployErc20('XYZ');
    const addr = await tok.getAddress();
    await nft.connect(owner).updateListERC20Address(addr, false);
    expect((await nft.getErc20ListAddress()).length).to.equal(0);
    expect(await nft.getTypeTokenErc20(addr)).to.equal(0n);
  });

  it('list is enumerable via getErc20ListAddress', async function () {
    const { nft, owner } = await loadFixture(deployExerciseSupplementFixture);
    const t1 = await deployErc20('TTJP');
    const t2 = await deployErc20('JPYC');
    const t3 = await deployErc20('USDC');
    await nft.connect(owner).updateListERC20Address(await t1.getAddress(), true);
    await nft.connect(owner).updateListERC20Address(await t2.getAddress(), true);
    await nft.connect(owner).updateListERC20Address(await t3.getAddress(), true);
    const list = await nft.getErc20ListAddress();
    expect(list.length).to.equal(3);
  });
});
