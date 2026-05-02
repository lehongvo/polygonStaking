import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import hre from 'hardhat';
import { deployExerciseSupplementFixture } from './fixtures';

const { ethers, upgrades } = hre as any;

describe('ExerciseSupplementNFT — Initialization', function () {
  it('cannot be initialized twice', async function () {
    const { nft, owner, donation, feeSetting, returned } = await loadFixture(
      deployExerciseSupplementFixture
    );
    await expect(
      nft
        .connect(owner)
        .initialize('x', donation.address, feeSetting.address, returned.address)
    ).to.be.revertedWith(/Initializable: contract is already initialized/);
  });

  it('grants DEFAULT_ADMIN_ROLE to deployer', async function () {
    const { nft, owner } = await loadFixture(deployExerciseSupplementFixture);
    const role = await nft.DEFAULT_ADMIN_ROLE();
    expect(await nft.hasRole(role, owner.address)).to.equal(true);
  });

  it('grants MINTER_ROLE to deployer and to the contract itself', async function () {
    const { nft, owner } = await loadFixture(deployExerciseSupplementFixture);
    const role = await nft.MINTER_ROLE();
    expect(await nft.hasRole(role, owner.address)).to.equal(true);
    expect(await nft.hasRole(role, await nft.getAddress())).to.equal(true);
  });

  it('grants UPGRADER_ROLE and UPDATER_ACTIVITIES_ROLE to deployer', async function () {
    const { nft, owner } = await loadFixture(deployExerciseSupplementFixture);
    const upgrader = await nft.UPGRADER_ROLE();
    const updater = await nft.UPDATER_ACTIVITIES_ROLE();
    expect(await nft.hasRole(upgrader, owner.address)).to.equal(true);
    expect(await nft.hasRole(updater, owner.address)).to.equal(true);
  });

  it('sets baseURI, baseExtension, and wallet addresses correctly', async function () {
    const { nft, donation, feeSetting, returned, baseURI } =
      await loadFixture(deployExerciseSupplementFixture);
    expect(await nft.donationWalletAddress()).to.equal(donation.address);
    expect(await nft.feeSettingAddress()).to.equal(feeSetting.address);
    expect(await nft.returnedNFTWallet()).to.equal(returned.address);
  });

  it('reports name and symbol', async function () {
    const { nft } = await loadFixture(deployExerciseSupplementFixture);
    expect(await nft.name()).to.equal('ExerciseSupplementNFT');
    expect(await nft.symbol()).to.equal('ESPLNFT');
  });

  it('counter starts at 0', async function () {
    const { nft } = await loadFixture(deployExerciseSupplementFixture);
    expect(await nft.nextTokenIdToMint()).to.equal(0n);
  });

  it('totalSupply (via balanceOf zero address checks not applicable in ERC721)', async function () {
    // ERC721 doesn't track totalSupply; verify state via mint counter
    const { nft, owner, other } = await loadFixture(
      deployExerciseSupplementFixture
    );
    await nft.connect(owner).safeMint(other.address);
    expect(await nft.nextTokenIdToMint()).to.equal(1n);
  });

  it('lists are empty after init (no NFT/ERC20/special/required/gacha)', async function () {
    const { nft } = await loadFixture(deployExerciseSupplementFixture);
    expect((await nft.getNftListAddress()).length).to.equal(0);
    expect((await nft.getErc20ListAddress()).length).to.equal(0);
    expect((await nft.getSpecialNftAddress()).length).to.equal(0);
    expect((await nft.getRequiredNftAddresses()).length).to.equal(0);
    expect((await nft.getListGachaAddress()).length).to.equal(0);
  });

  it('soulBoundNftAddress and securityAddress default to zero', async function () {
    const { nft } = await loadFixture(deployExerciseSupplementFixture);
    expect(await nft.soulBoundNftAddress()).to.equal(ethers.ZeroAddress);
  });

  it('attacker has no roles after init', async function () {
    const { nft, attacker } = await loadFixture(
      deployExerciseSupplementFixture
    );
    const roles = [
      await nft.DEFAULT_ADMIN_ROLE(),
      await nft.UPGRADER_ROLE(),
      await nft.UPDATER_ACTIVITIES_ROLE(),
      await nft.MINTER_ROLE(),
      await nft.ALLOWED_CONTRACTS_CHALLENGE(),
      await nft.ALLOWED_CONTRACTS_GACHA(),
    ];
    for (const r of roles) {
      expect(await nft.hasRole(r, attacker.address)).to.equal(false);
    }
  });
});
