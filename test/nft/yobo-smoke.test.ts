import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import hre from 'hardhat';

const { ethers } = hre as any;

/**
 * Smoke/characterization test cho YOBOWEB3WALK (SBT ERC721, trước đây 0 test).
 * Verify deploy + custom error runtime SAU khi convert require→custom error (behavior-preserving).
 */
async function deployFixture() {
  const [owner, user] = await ethers.getSigners();
  const Factory = await ethers.getContractFactory('YOBOWEB3WALK');
  const nft = await Factory.deploy('ipfs://test/');
  await nft.waitForDeployment();
  return { nft, owner, user };
}

describe('YOBOWEB3WALK — smoke + custom error runtime', () => {
  it('deploy: name/symbol đúng', async () => {
    const { nft } = await loadFixture(deployFixture);
    expect(await nft.name()).to.equal('YOBOWEB3WALK');
    expect(await nft.symbol()).to.equal('YOB3WK');
  });

  it('deployer là admin đầu tiên; safeMint(address(0)) → revert InvalidAddress (custom error)', async () => {
    const { nft, owner } = await loadFixture(deployFixture);
    await expect(
      nft.connect(owner).safeMint(ethers.ZeroAddress)
    ).to.be.revertedWithCustomError(nft, 'InvalidAddress');
  });

  it('non-admin gọi safeMint → revert OnlyAdminsCanCallThisFunction (custom error)', async () => {
    const { nft, user } = await loadFixture(deployFixture);
    await expect(
      nft.connect(user).safeMint(user.address)
    ).to.be.revertedWithCustomError(nft, 'OnlyAdminsCanCallThisFunction');
  });

  it('admin safeMint hợp lệ → mint (balanceOf tăng)', async () => {
    const { nft, owner, user } = await loadFixture(deployFixture);
    await nft.connect(owner).safeMint(user.address);
    expect(await nft.balanceOf(user.address)).to.equal(1n);
  });
});
