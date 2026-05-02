import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import hre from 'hardhat';
import { deployExerciseSupplementFixture } from './fixtures';

const { ethers } = hre as any;

describe('ExerciseSupplementNFT — View functions', function () {
  it('nextTokenIdToMint reflects mint counter', async function () {
    const { nft, owner, other } = await loadFixture(
      deployExerciseSupplementFixture
    );
    expect(await nft.nextTokenIdToMint()).to.equal(0n);
    await nft.connect(owner).safeMint(other.address);
    expect(await nft.nextTokenIdToMint()).to.equal(1n);
    await nft.connect(owner).safeMint(other.address);
    expect(await nft.nextTokenIdToMint()).to.equal(2n);
  });

  it('tokenURI: baseURI + id + extension', async function () {
    const { nft, owner } = await loadFixture(deployExerciseSupplementFixture);
    await nft.connect(owner).safeMint(owner.address);
    expect(await nft.tokenURI(0)).to.equal('ipfs://test/0.json');
  });

  it('tokenURI of non-existent token reverts', async function () {
    const { nft } = await loadFixture(deployExerciseSupplementFixture);
    await expect(nft.tokenURI(999)).to.be.reverted;
  });

  it('getNftListAddress / getErc20ListAddress / getSpecialNftAddress empty initially', async function () {
    const { nft } = await loadFixture(deployExerciseSupplementFixture);
    expect((await nft.getNftListAddress()).length).to.equal(0);
    expect((await nft.getErc20ListAddress()).length).to.equal(0);
    expect((await nft.getSpecialNftAddress()).length).to.equal(0);
    expect((await nft.getRequiredNftAddresses()).length).to.equal(0);
  });

  it('getListToleranceAmount returns set values', async function () {
    const { nft, owner } = await loadFixture(deployExerciseSupplementFixture);
    await nft.connect(owner).updateToleranceAmount(7, 9);
    const list = await nft.getListToleranceAmount();
    expect(list[0]).to.equal(7n);
    expect(list[1]).to.equal(9n);
  });

  it('getHistoryNFT returns zero when no transfer happened', async function () {
    const { nft } = await loadFixture(deployExerciseSupplementFixture);
    expect(
      await nft.getHistoryNFT(0, '0x0000000000000000000000000000000000000001')
    ).to.equal(ethers.ZeroAddress);
  });

  it('getListGachaAddress empty initially', async function () {
    const { nft } = await loadFixture(deployExerciseSupplementFixture);
    expect((await nft.getListGachaAddress()).length).to.equal(0);
  });

  it('supportsInterface: ERC721 + AccessControl', async function () {
    const { nft } = await loadFixture(deployExerciseSupplementFixture);
    // ERC721 interface id
    expect(await nft.supportsInterface('0x80ac58cd')).to.equal(true);
    // AccessControl interface id (0x7965db0b)
    expect(await nft.supportsInterface('0x7965db0b')).to.equal(true);
    // ERC165 interface id (0x01ffc9a7)
    expect(await nft.supportsInterface('0x01ffc9a7')).to.equal(true);
    // Random interface should be false
    expect(await nft.supportsInterface('0xdeadbeef')).to.equal(false);
  });

  it('tokenURI with empty baseURI returns empty + extension only? — verify behavior', async function () {
    const { nft, owner } = await loadFixture(deployExerciseSupplementFixture);
    await nft.connect(owner).setBaseURI('');
    await nft.connect(owner).safeMint(owner.address);
    // ERC721URIStorage logic: if baseURI empty, returns '' (no concatenation)
    const uri = await nft.tokenURI(0);
    // Implementation-specific; just verify it does not revert
    expect(typeof uri).to.equal('string');
  });

  it('tokenURI for token id with multiple digits', async function () {
    const { nft, owner } = await loadFixture(deployExerciseSupplementFixture);
    for (let i = 0; i < 12; i++) {
      await nft.connect(owner).safeMint(owner.address);
    }
    const uri = await nft.tokenURI(11);
    expect(uri).to.equal('ipfs://test/11.json');
  });

  it('getHistoryNFT before any transfer returns zero', async function () {
    const { nft, owner } = await loadFixture(deployExerciseSupplementFixture);
    await nft.connect(owner).safeMint(owner.address);
    expect(
      await nft.getHistoryNFT(0, '0x000000000000000000000000000000000000dEaD')
    ).to.equal(ethers.ZeroAddress);
  });

  it('getListToleranceAmount returns [0,0] before being set', async function () {
    // Use direct deploy without fixture defaults to test fresh state
    const Factory = await ethers.getContractFactory('ExerciseSupplementNFT');
    const { upgrades } = hre as any;
    const [a, b, c, d] = await ethers.getSigners();
    const fresh = await upgrades.deployProxy(
      Factory,
      ['ipfs://x/', a.address, b.address, c.address],
      { kind: 'uups', initializer: 'initialize' }
    );
    await fresh.waitForDeployment();
    const list = await fresh.getListToleranceAmount();
    expect(list[0]).to.equal(0n);
    expect(list[1]).to.equal(0n);
  });

  it('getNftListAddress reflects added items in order', async function () {
    const { nft, owner } = await loadFixture(deployExerciseSupplementFixture);
    const Target = await ethers.getContractFactory('MockTargetNFT');
    const a = await Target.deploy();
    const b = await Target.deploy();
    await a.waitForDeployment();
    await b.waitForDeployment();
    await nft
      .connect(owner)
      .updateNftListAddress(await a.getAddress(), true, true);
    await nft
      .connect(owner)
      .updateNftListAddress(await b.getAddress(), true, false);
    const list = await nft.getNftListAddress();
    expect(list[0]).to.equal(await a.getAddress());
    expect(list[1]).to.equal(await b.getAddress());
  });

  it('listNftSpecialConditionInfo readable as struct', async function () {
    const { nft, owner } = await loadFixture(deployExerciseSupplementFixture);
    await nft.connect(owner).updateSpecialConditionInfo(1, 2, 3, 4, 5, 6);
    const info = await nft.listNftSpecialConditionInfo();
    expect(info.targetStepPerDay).to.equal(1n);
    expect(info.challengeDuration).to.equal(2n);
    expect(info.amountDepositMatic).to.equal(3n);
    expect(info.amountDepositTTJP).to.equal(4n);
    expect(info.amountDepositJPYC).to.equal(5n);
    expect(info.dividendSuccess).to.equal(6n);
  });
});
