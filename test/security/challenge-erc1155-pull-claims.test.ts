// CHALLENGE-2791: terminal fail/give-up paths used to push ERC1155 returns in an unbounded
// depositor loop. A reverting receiver or a bloated depositor list could block settlement.
// Fix: credit returns to a per-recipient pull-claim ledger during settlement; recipients
// claim via claimPendingErc1155(). Zero-value deposits are rejected; duplicate depositors
// are never appended to the enumeration list.
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

const VARIANTS: ContractName[] = [
  'ChallengeBaseStep',
  'ChallengeDetail',
  'ChallengeDetailV2',
  'ChallengeGCM',
  'ChallengeGCMAndSpeed',
  'ChallengeHIIT',
];

const TOKEN_ID = 42n;
const DEPOSIT_AMOUNT = 10n;
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
  const nft = await deployMockNFT();
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

  await challenge.waitForDeployment();
  return { challenge, challenger, startTime };
}

async function deployErc1155() {
  const F = await hre.ethers.getContractFactory('MockERC1155');
  return F.deploy();
}

function erc1155GiveUpArgs(nftAddr: string, depositorAddr: string) {
  return [[nftAddr], [[TOKEN_ID, 0n]], [[depositorAddr]], [false]] as const;
}

describe('CHALLENGE-2791: ERC1155 fail-path pull claims', () => {
  for (const name of VARIANTS) {
    describe(name, () => {
      it('rejects zero-value ERC1155 deposits', async function () {
        const { challenge, challenger, startTime } = await deployVariant(name);
        const challengeAddr = await challenge.getAddress();
        const signers = await hre.ethers.getSigners();
        const depositor = signers[5];
        const erc1155 = await deployErc1155();

        await erc1155.mint(depositor.address, 99n, 1n);
        await expect(
          erc1155
            .connect(depositor)
            .safeTransferFrom(depositor.address, challengeAddr, 99n, 0n, '0x')
        ).to.be.revertedWithCustomError(challenge, 'ZeroErc1155Deposit');
        await moveToStart(startTime); // silence unused in some paths
        await challenger.getAddress();
      });

      it('giveUp credits ERC1155 instead of pushing; depositor can pull-claim', async function () {
        const { challenge, challenger, startTime } = await deployVariant(name);
        const challengeAddr = await challenge.getAddress();
        const signers = await hre.ethers.getSigners();
        const depositor = signers[5];
        const erc1155 = await deployErc1155();
        const nftAddr = await erc1155.getAddress();

        await erc1155.mint(depositor.address, TOKEN_ID, DEPOSIT_AMOUNT);
        await erc1155
          .connect(depositor)
          .safeTransferFrom(depositor.address, challengeAddr, TOKEN_ID, DEPOSIT_AMOUNT, '0x');

        await moveToStart(startTime);
        const args = erc1155GiveUpArgs(nftAddr, depositor.address);
        await expect(challenge.connect(challenger).giveUp(...args)).to.not.be.reverted;

        expect(await challenge.isFinished()).to.equal(true);
        expect(await erc1155.balanceOf(TOKEN_ID, depositor.address)).to.equal(0n);
        expect(await challenge.pendingErc1155Claim(depositor.address, nftAddr, TOKEN_ID)).to.equal(
          DEPOSIT_AMOUNT
        );

        await challenge.connect(depositor).claimPendingErc1155(nftAddr, TOKEN_ID);
        expect(await erc1155.balanceOf(TOKEN_ID, depositor.address)).to.equal(DEPOSIT_AMOUNT);
        expect(await challenge.pendingErc1155Claim(depositor.address, nftAddr, TOKEN_ID)).to.equal(0n);
      });

      it('a rejecting ERC1155 depositor does not block giveUp; claim restores on failure', async function () {
        const { challenge, challenger, startTime } = await deployVariant(name);
        const challengeAddr = await challenge.getAddress();
        const erc1155 = await deployErc1155();
        const nftAddr = await erc1155.getAddress();

        const RejectF = await hre.ethers.getContractFactory('MockRejectingERC1155Receiver');
        const rejecting = await RejectF.deploy();
        const rejectingAddr = await rejecting.getAddress();

        await erc1155.mint(rejectingAddr, TOKEN_ID, DEPOSIT_AMOUNT);
        await hre.ethers.provider.send('hardhat_impersonateAccount', [rejectingAddr]);
        await hre.ethers.provider.send('hardhat_setBalance', [
          rejectingAddr,
          '0x1000000000000000000',
        ]);
        const rejectingSigner = await hre.ethers.getSigner(rejectingAddr);
        await erc1155
          .connect(rejectingSigner)
          .safeTransferFrom(rejectingAddr, challengeAddr, TOKEN_ID, DEPOSIT_AMOUNT, '0x');
        await hre.ethers.provider.send('hardhat_stopImpersonatingAccount', [rejectingAddr]);

        await moveToStart(startTime);
        await expect(
          challenge.connect(challenger).giveUp(...erc1155GiveUpArgs(nftAddr, rejectingAddr))
        ).to.not.be.reverted;

        expect(await challenge.pendingErc1155Claim(rejectingAddr, nftAddr, TOKEN_ID)).to.equal(
          DEPOSIT_AMOUNT
        );

        await hre.ethers.provider.send('hardhat_impersonateAccount', [rejectingAddr]);
        await expect(
          challenge.connect(rejectingSigner).claimPendingErc1155(nftAddr, TOKEN_ID)
        ).to.be.revertedWithCustomError(challenge, 'Erc1155ClaimTransferFailed');
        expect(await challenge.pendingErc1155Claim(rejectingAddr, nftAddr, TOKEN_ID)).to.equal(
          DEPOSIT_AMOUNT
        );

        await rejecting.connect(rejectingSigner).setReject(false);
        await challenge.connect(rejectingSigner).claimPendingErc1155(nftAddr, TOKEN_ID);
        await hre.ethers.provider.send('hardhat_stopImpersonatingAccount', [rejectingAddr]);
        expect(await erc1155.balanceOf(TOKEN_ID, rejectingAddr)).to.equal(DEPOSIT_AMOUNT);
      });

      it('many depositors are all credited without blocking giveUp', async function () {
        const { challenge, challenger, startTime } = await deployVariant(name);
        const challengeAddr = await challenge.getAddress();
        const signers = await hre.ethers.getSigners();
        const depositors = signers.slice(5, 10);
        const erc1155 = await deployErc1155();
        const nftAddr = await erc1155.getAddress();

        for (const d of depositors) {
          await erc1155.mint(d.address, TOKEN_ID, 1n);
          await erc1155
            .connect(d)
            .safeTransferFrom(d.address, challengeAddr, TOKEN_ID, 1n, '0x');
        }

        await moveToStart(startTime);
        await expect(
          challenge
            .connect(challenger)
            .giveUp([nftAddr], [[TOKEN_ID, 0n]], [[depositors[0].address]], [false])
        ).to.not.be.reverted;

        for (const d of depositors) {
          expect(await challenge.pendingErc1155Claim(d.address, nftAddr, TOKEN_ID)).to.equal(1n);
        }
      });
    });
  }
});
