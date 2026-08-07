// CHALLENGE-2832: one reverting or fee-on-transfer ERC20 must not brick terminal settlement.
import { expect } from 'chai';
import hre from 'hardhat';
import { deployMockNFT, moveToStart } from '../helpers/deployHelpers.ts';

type ContractName = 'ChallengeBaseStep' | 'ChallengeDetail' | 'ChallengeHIIT';

const VARIANTS: ContractName[] = ['ChallengeBaseStep', 'ChallengeDetail', 'ChallengeHIIT'];

async function deployVariant(contract: ContractName, erc20List: string[]) {
  const signers = await hre.ethers.getSigners();
  const [sponsor, challenger, feeAddr] = signers;
  const nft = await deployMockNFT({ erc20List });
  const Factory = await hre.ethers.getContractFactory(contract);
  const block = await hre.ethers.provider.getBlock('latest');
  const startTime = block!.timestamp + 60;
  const duration = 30;
  const endTime = startTime + duration * 86400;
  const totalAmount = hre.ethers.parseEther('100');
  const receivers = [signers[4].address];
  const allowGiveUp = [true, true, false];
  const gasData = [0, 0, 0];
  const primary = [duration, startTime, endTime, 1000, 5];

  let challenge: any;
  if (contract === 'ChallengeHIIT') {
    challenge = await Factory.deploy(
      [sponsor.address, challenger.address, feeAddr.address],
      hre.ethers.ZeroAddress,
      [await nft.getAddress()],
      [duration, startTime, endTime, 5, 60, 5],
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
  await challenge.waitForDeployment();
  return { challenge, challenger, sponsor, startTime };
}

describe('CHALLENGE-2832: ERC20 settlement failures are isolated', () => {
  for (const name of VARIANTS) {
    describe(name, () => {
      it('giveUp completes when one registered ERC20 reverts on transfer; amount is credited', async function () {
        const MockGood = await hre.ethers.getContractFactory('MockERC20');
        const MockBad = await hre.ethers.getContractFactory('MockRevertERC20');
        const good = await MockGood.deploy('Good', 'GOOD');
        const bad = await MockBad.deploy('Bad', 'BAD');
        const goodAddr = await good.getAddress();
        const badAddr = await bad.getAddress();

        const { challenge, challenger, sponsor, startTime } = await deployVariant(name, [
          goodAddr,
          badAddr,
        ]);
        const challengeAddr = await challenge.getAddress();
        await good.mint(challengeAddr, hre.ethers.parseEther('100'));
        await bad.mint(challengeAddr, hre.ethers.parseEther('50'));

        await moveToStart(startTime);
        await expect(challenge.connect(challenger).giveUp([], [], [], [])).to.not.be.reverted;
        expect(await challenge.isFinished()).to.equal(true);

        const credited = await challenge.pendingErc20Claim(sponsor.address, badAddr);
        expect(credited).to.be.gt(0n);
        expect(await good.balanceOf(sponsor.address)).to.be.gt(0n);
      });

      it('fee-on-transfer ERC20 credits the shortfall for pull-claim', async function () {
        const MockFee = await hre.ethers.getContractFactory('MockFeeOnTransferERC20');
        const feeToken = await MockFee.deploy('Fee', 'FEE');
        const feeAddr = await feeToken.getAddress();

        const { challenge, challenger, sponsor, startTime } = await deployVariant(name, [feeAddr]);
        const challengeAddr = await challenge.getAddress();
        const payout = hre.ethers.parseEther('100');
        await feeToken.mint(challengeAddr, payout);

        await moveToStart(startTime);
        await expect(challenge.connect(challenger).giveUp([], [], [], [])).to.not.be.reverted;

        const sponsorGain = await feeToken.balanceOf(sponsor.address);
        const credited = await challenge.pendingErc20Claim(sponsor.address, feeAddr);
        expect(sponsorGain + credited).to.equal((payout * 90n) / 100n);
      });
    });
  }
});
