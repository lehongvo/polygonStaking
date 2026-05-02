import hre from 'hardhat';

const { ethers, upgrades } = hre as any;

export async function deployExerciseSupplementFixture() {
  const [owner, donation, feeSetting, returned, challenger, attacker, other] =
    await ethers.getSigners();

  // Deploy ExerciseSupplementNFT via UUPS proxy
  const Factory = await ethers.getContractFactory('ExerciseSupplementNFT');
  const baseURI = 'ipfs://test/';
  const nft = await upgrades.deployProxy(
    Factory,
    [baseURI, donation.address, feeSetting.address, returned.address],
    { kind: 'uups', initializer: 'initialize' }
  );
  await nft.waitForDeployment();

  // Sane defaults so safeMintNFT() does not hit divide-by-zero on
  // listToleranceAmount[*] and routes _goal=0 inputs to the else branch
  // (avoids the special-NFT path which requires extra setup per test).
  await nft.connect(owner).updateToleranceAmount(2, 4);
  await nft.connect(owner).updateSpecialConditionInfo(1, 0, 0, 0, 0, 0);

  // Helper deploy MockTargetNFT instances
  const TargetFactory = await ethers.getContractFactory('MockTargetNFT');
  const soulBoundNft = await TargetFactory.deploy();
  await soulBoundNft.waitForDeployment();
  const specialNft0 = await TargetFactory.deploy();
  await specialNft0.waitForDeployment();
  const specialNft1 = await TargetFactory.deploy();
  await specialNft1.waitForDeployment();
  const normalNft = await TargetFactory.deploy();
  await normalNft.waitForDeployment();
  const requiredNft = await TargetFactory.deploy();
  await requiredNft.waitForDeployment();

  return {
    nft,
    soulBoundNft,
    specialNft0,
    specialNft1,
    normalNft,
    requiredNft,
    owner,
    donation,
    feeSetting,
    returned,
    challenger,
    attacker,
    other,
    baseURI,
  };
}
