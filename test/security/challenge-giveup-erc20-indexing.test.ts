// CHALLENGE-2795: giveUp() must index ERC20 receiver shares by the original token-list
// position. A compressed push-only array misaligns when an earlier token has zero balance.
import { expect } from 'chai';
import hre from 'hardhat';
import { deployMockNFT, moveToStart } from '../helpers/deployHelpers.ts';

type ContractName =
  | 'ChallengeBaseStep'
  | 'ChallengeDetail'
  | 'ChallengeDetailV2'
  | 'ChallengeGCM'
  | 'ChallengeGCMAndSpeed'
  | 'ChallengeHIIT';

const contracts: ContractName[] = [
  'ChallengeBaseStep',
  'ChallengeDetail',
  'ChallengeDetailV2',
  'ChallengeGCM',
  'ChallengeGCMAndSpeed',
  'ChallengeHIIT',
];

const AAVE_POOL_ADDRESS = '0x794a61358D6845594F94dc1DB02A252b5b4814aD';
const WMATIC_WPOC_ADDRESS = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270';

async function plantMock(address: string, factoryName: string) {
  const Factory = await hre.ethers.getContractFactory(factoryName);
  const deployed = await Factory.deploy();
  await deployed.waitForDeployment();
  const code = await hre.ethers.provider.getCode(await deployed.getAddress());
  await hre.network.provider.request({ method: 'hardhat_setCode', params: [address, code] });
}

async function deployVariant(contract: ContractName) {
  const signers = await hre.ethers.getSigners();
  const [sponsor, challenger, feeAddr] = signers;
  const MockERC20 = await hre.ethers.getContractFactory('MockERC20');
  const zeroBalanceToken = await MockERC20.deploy('ZeroSlot', 'ZRO');
  const fundedToken = await MockERC20.deploy('FundedSlot', 'FND');
  const zeroAddr = await zeroBalanceToken.getAddress();
  const fundedAddr = await fundedToken.getAddress();
  const nft = await deployMockNFT({ erc20List: [zeroAddr, fundedAddr] });
  const Factory = await hre.ethers.getContractFactory(contract);
  const block = await hre.ethers.provider.getBlock('latest');
  const startTime = block!.timestamp + 60;
  const duration = 30;
  const endTime = startTime + duration * 86400;
  const totalAmount = hre.ethers.parseEther('100');
  const receivers = [signers[4].address];
  const allowGiveUp = [true, true, false];
  const gasData = [0, 0, 0];
  const primary = [duration, startTime, endTime, 1000, 20];

  let challenge: any;
  if (contract === 'ChallengeHIIT') {
    challenge = await Factory.deploy(
      [sponsor.address, challenger.address, feeAddr.address],
      hre.ethers.ZeroAddress,
      [await nft.getAddress()],
      [duration, startTime, endTime, 5, 60, 20],
      receivers,
      1,
      allowGiveUp,
      gasData,
      false,
      [100],
      totalAmount,
      { value: totalAmount }
    );
  } else if (contract === 'ChallengeBaseStep') {
    challenge = await Factory.deploy(
      [sponsor.address, challenger.address, feeAddr.address],
      hre.ethers.ZeroAddress,
      [await nft.getAddress()],
      primary,
      receivers,
      1,
      allowGiveUp,
      gasData,
      false,
      [100],
      totalAmount,
      [],
      [],
      { value: totalAmount }
    );
  } else if (contract === 'ChallengeDetailV2') {
    await plantMock(WMATIC_WPOC_ADDRESS, 'MockWMATIC');
    await plantMock(AAVE_POOL_ADDRESS, 'MockAavePoolForTest');
    challenge = await Factory.deploy(
      [sponsor.address, challenger.address, feeAddr.address],
      hre.ethers.ZeroAddress,
      [await nft.getAddress()],
      primary,
      receivers,
      1,
      allowGiveUp,
      gasData,
      false,
      [100],
      totalAmount,
      0,
      { value: totalAmount }
    );
  } else if (contract === 'ChallengeGCM') {
    challenge = await Factory.deploy(
      [sponsor.address, challenger.address, feeAddr.address],
      hre.ethers.ZeroAddress,
      [await nft.getAddress()],
      primary,
      receivers,
      1,
      allowGiveUp,
      gasData,
      false,
      [100],
      totalAmount,
      [0, 200, 1],
      { value: totalAmount }
    );
  } else if (contract === 'ChallengeGCMAndSpeed') {
    challenge = await Factory.deploy(
      [sponsor.address, challenger.address, feeAddr.address],
      hre.ethers.ZeroAddress,
      [await nft.getAddress()],
      primary,
      receivers,
      1,
      allowGiveUp,
      gasData,
      false,
      [100],
      totalAmount,
      [0, 0, 1],
      [0, 200, 1],
      { value: totalAmount }
    );
  } else {
    challenge = await Factory.deploy(
      [sponsor.address, challenger.address, feeAddr.address],
      hre.ethers.ZeroAddress,
      [await nft.getAddress()],
      primary,
      receivers,
      1,
      allowGiveUp,
      gasData,
      false,
      [100],
      totalAmount,
      { value: totalAmount }
    );
  }

  const challengeAddr = await challenge.getAddress();
  await fundedToken.mint(challengeAddr, hre.ethers.parseEther('1000'));
  return { challenge, startTime, fundedToken, sponsor, challenger };
}

describe('CHALLENGE-2795: giveUp ERC20 indexing across all variants', function () {
  for (const contract of contracts) {
    describe(contract, function () {
      it('completes giveUp when token[0] has zero balance and token[1] is funded', async function () {
        const { challenge, startTime, fundedToken, sponsor, challenger } =
          await deployVariant(contract);

        await moveToStart(startTime);
        const sponsorBefore = await fundedToken.balanceOf(sponsor.address);

        await expect(challenge.connect(challenger).giveUp([], [], [], [])).to.not.be.reverted;

        expect(await fundedToken.balanceOf(sponsor.address)).to.be.greaterThan(sponsorBefore);
        expect(await challenge.isFinished()).to.equal(true);
      });
    });
  }
});
