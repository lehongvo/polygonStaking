import hre from 'hardhat';
import { Signer } from 'ethers';

const { ethers, upgrades } = hre as any;

export enum TypeToken {
  ERC20 = 0,
  ERC721 = 1,
  ERC1155 = 2,
  NATIVE_TOKEN = 3,
}

export enum DividendStatus {
  PENDING = 0,
  SUCCESS = 1,
  FAIL = 2,
}

export enum TypeRequireBalanceNft {
  WALLET = 0,
  CONTRACT = 1,
  ALL = 2,
}

export enum TypeRandomReward {
  NORMAL = 0,
  VRF_CHAINLINK = 1,
}

export enum TimeRandomReward {
  ONLY_TIME = 0,
  MULTIPLE_TIME = 1,
}

export interface ChallengeInfoStruct {
  targetStepPerDay: number;
  challengeDuration: number;
  stepDataToSend: number;
  toleranceAmount: number;
  dividendStatus: number;
  amountBaseDeposit: bigint;
  amountTokenDeposit: bigint;
  timeLimitActiveGacha: number;
  typeRequireBalanceNft: number;
}

export const defaultChallengeInfo: ChallengeInfoStruct = {
  targetStepPerDay: 5000,
  challengeDuration: 30,
  stepDataToSend: 5000,
  toleranceAmount: 4,
  dividendStatus: DividendStatus.PENDING,
  amountBaseDeposit: 1n,
  amountTokenDeposit: 0n,
  timeLimitActiveGacha: 10,
  typeRequireBalanceNft: TypeRequireBalanceNft.WALLET,
};

export async function deployGachaFixture() {
  const [owner, challenger, returnedNFTWallet, adminWallet, attacker, other] =
    await ethers.getSigners();

  // Mocks
  const VRFFactory = await ethers.getContractFactory('MockVRFConsumerBase');
  const vrfMultiple = await VRFFactory.deploy();
  const vrfOnly = await VRFFactory.deploy();
  const vrfClassic = await VRFFactory.deploy();
  await vrfMultiple.waitForDeployment();
  await vrfOnly.waitForDeployment();
  await vrfClassic.waitForDeployment();

  const SupplementFactory = await ethers.getContractFactory(
    'MockGachaSupplement'
  );
  const supplement = await SupplementFactory.deploy();
  await supplement.waitForDeployment();
  await supplement.setDestinationAddress(challenger.address);

  // Reward tokens
  const ERC20Factory = await ethers.getContractFactory('MockERC20');
  const erc20Reward = await ERC20Factory.deploy('Reward', 'RWD');
  await erc20Reward.waitForDeployment();

  const ERC721Factory = await ethers.getContractFactory(
    'MockGachaMintableERC721'
  );
  const erc721Reward = await ERC721Factory.deploy('NftReward', 'NREW');
  await erc721Reward.waitForDeployment();

  const ERC1155Factory = await ethers.getContractFactory('MockGachaERC1155');
  const erc1155Reward = await ERC1155Factory.deploy('1155Reward');
  await erc1155Reward.waitForDeployment();

  // Deploy Gacha through UUPS proxy
  const GachaFactory = await ethers.getContractFactory('Gacha');
  const initParams = [
    defaultChallengeInfo,
    [], // _requireBalanceNftAddress empty for default gacha
    [], // _typeNfts empty
    100, // _rateOfLost (slot 0 unlockRate)
    true, // _isDefaultGachaContract
    TypeRandomReward.NORMAL,
    TimeRandomReward.ONLY_TIME,
    await vrfMultiple.getAddress(),
    await vrfOnly.getAddress(),
    [returnedNFTWallet.address, adminWallet.address],
    'TestGacha',
    'TestSponsor',
  ];

  const gacha = await upgrades.deployProxy(GachaFactory, initParams, {
    kind: 'uups',
    initializer: 'initialize',
  });
  await gacha.waitForDeployment();

  // Set classic VRF address (initialize doesn't set it; setVRFConsumerBaseInfos does)
  await gacha
    .connect(owner)
    .setVRFConsumerBaseInfos(
      await vrfMultiple.getAddress(),
      await vrfOnly.getAddress(),
      await vrfClassic.getAddress(),
      TypeRandomReward.NORMAL,
      TimeRandomReward.ONLY_TIME
    );

  // Open gacha time window: start = 0, end = far future
  const farFuture = 0xffffffff; // max uint32
  await gacha.connect(owner).setGachaTime(0, farFuture);

  // Deploy challenge — its erc721Address(0) returns supplement contract
  const ChallengeFactory =
    await ethers.getContractFactory('MockGachaChallenge');
  const challenge = await ChallengeFactory.deploy(
    challenger.address,
    await supplement.getAddress()
  );
  await challenge.waitForDeployment();

  return {
    gacha,
    supplement,
    challenge,
    vrfMultiple,
    vrfOnly,
    vrfClassic,
    erc20Reward,
    erc721Reward,
    erc1155Reward,
    owner,
    challenger,
    returnedNFTWallet,
    adminWallet,
    attacker,
    other,
  };
}

/**
 * Helper: trigger gacha.randomRewards through the mock challenge so msg.sender
 * == _challengeAddress passes.
 */
export async function callRandomRewards(
  challenge: any,
  gacha: any,
  dataStep: number[] = [5000]
): Promise<boolean> {
  const tx = await challenge.callRandomRewards(
    await gacha.getAddress(),
    dataStep
  );
  await tx.wait();
  // Return value lives in event/state; we read userInfor.statusRandom instead in tests
  return true;
}

/**
 * Setup ERC20 reward at index 1 with the given unlock rate and max allowed.
 */
export async function addERC20Reward(
  gacha: any,
  owner: Signer,
  erc20: any,
  unlockRate: number,
  rewardValue: bigint,
  maxAllowed: number
) {
  await gacha
    .connect(owner)
    .addNewReward(
      await erc20.getAddress(),
      unlockRate,
      rewardValue,
      0,
      TypeToken.ERC20,
      false,
      maxAllowed,
      []
    );
}

/**
 * Force MockVRF to produce a specific random value so the cumulative bucket
 * selection in checkAbilityReward picks a specific reward.
 */
export async function setRandomResult(vrf: any, value: number | bigint) {
  await vrf.setRandomResult(value);
}
