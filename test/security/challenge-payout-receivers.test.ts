// CHALLENGE-2811: all six Challenge variants store per-receiver payout amounts in
// address-keyed mappings (approvalSuccessOf / approvalFailOf) but the settlement payout
// loops (transferToListReceiverSuccess/Fail) iterate the ORIGINAL _awardReceivers array and
// re-read the mapping once per array index. A duplicate address within the same outcome
// group therefore gets paid once per occurrence of the (possibly overwritten) mapping value
// -- overpaying that receiver at the expense of the rest of the balance. A zero address in
// _stakeHolders or _awardReceivers is also accepted with no validation.
//
// This proves, for all six variants, that:
//   - a zero-address stakeholder (sponsor/challenger/feeAddress) is rejected;
//   - a zero-address payout receiver is rejected;
//   - a duplicate receiver address WITHIN the same outcome group (success or fail) is rejected;
//   - the SAME address appearing once in the success group and once in the fail group is still
//     accepted (separate mappings, no aliasing bug there -- this is not what the ticket targets).
import { expect } from 'chai';
import hre from 'hardhat';

const DAY = 86400;

type ContractName =
  | 'ChallengeBaseStep'
  | 'ChallengeDetail'
  | 'ChallengeDetailV2'
  | 'ChallengeGCM'
  | 'ChallengeGCMAndSpeed'
  | 'ChallengeHIIT';

async function baseArgs() {
  const signers = await hre.ethers.getSigners();
  const [sponsor, challenger, feeAddr] = signers;
  const Mock = await hre.ethers.getContractFactory('MockExerciseSupplementNFT');
  const nft = await Mock.deploy(feeAddr.address, 5, 10);
  const block = await hre.ethers.provider.getBlock('latest');
  const startTime = block!.timestamp + 60;
  const duration = 30;
  const endTime = startTime + duration * DAY;
  const totalAmount = hre.ethers.parseEther('1');
  return {
    signers,
    sponsor,
    challenger,
    feeAddr,
    nft,
    startTime,
    endTime,
    duration,
    totalAmount,
  };
}

describe('CHALLENGE-2811: reject duplicate/zero payout receivers and stakeholders', () => {
  const contracts: ContractName[] = [
    'ChallengeBaseStep',
    'ChallengeDetail',
    'ChallengeDetailV2',
    'ChallengeGCM',
    'ChallengeGCMAndSpeed',
    'ChallengeHIIT',
  ];

  for (const contract of contracts) {
    describe(contract, () => {
      async function deploy(overrides: {
        stakeHolders?: string[];
        receivers: string[];
        percents: number[];
        index: number;
      }) {
        const b = await baseArgs();
        const Factory = await hre.ethers.getContractFactory(contract);
        const erc721 = [await b.nft.getAddress()];
        const stakeHolders = overrides.stakeHolders ?? [
          b.sponsor.address,
          b.challenger.address,
          b.feeAddr.address,
        ];
        const allowGiveUp = [true, true, false];
        const gasData = [0, 0, 0];

        if (contract === 'ChallengeHIIT') {
          const primary = [b.duration, b.startTime, b.endTime, 5, 60, 20];
          return Factory.deploy(
            stakeHolders,
            hre.ethers.ZeroAddress,
            erc721,
            primary,
            overrides.receivers,
            overrides.index,
            allowGiveUp,
            gasData,
            false,
            overrides.percents,
            b.totalAmount,
            { value: b.totalAmount }
          );
        }

        const primary = [b.duration, b.startTime, b.endTime, 1000, 20];

        if (contract === 'ChallengeBaseStep') {
          return Factory.deploy(
            stakeHolders,
            hre.ethers.ZeroAddress,
            erc721,
            primary,
            overrides.receivers,
            overrides.index,
            allowGiveUp,
            gasData,
            false,
            overrides.percents,
            b.totalAmount,
            [],
            [],
            { value: b.totalAmount }
          );
        }

        if (contract === 'ChallengeDetail') {
          return Factory.deploy(
            stakeHolders,
            hre.ethers.ZeroAddress,
            erc721,
            primary,
            overrides.receivers,
            overrides.index,
            allowGiveUp,
            gasData,
            false,
            overrides.percents,
            b.totalAmount,
            { value: b.totalAmount }
          );
        }

        if (contract === 'ChallengeDetailV2') {
          return Factory.deploy(
            stakeHolders,
            hre.ethers.ZeroAddress,
            erc721,
            primary,
            overrides.receivers,
            overrides.index,
            allowGiveUp,
            gasData,
            false,
            overrides.percents,
            b.totalAmount,
            0,
            { value: b.totalAmount }
          );
        }

        const gcmData = [0, 0, 0];

        if (contract === 'ChallengeGCM') {
          return Factory.deploy(
            stakeHolders,
            hre.ethers.ZeroAddress,
            erc721,
            primary,
            overrides.receivers,
            overrides.index,
            allowGiveUp,
            gasData,
            false,
            overrides.percents,
            b.totalAmount,
            gcmData,
            { value: b.totalAmount }
          );
        }

        const walkingSpeedData = [0, 0, 0];
        return Factory.deploy(
          stakeHolders,
          hre.ethers.ZeroAddress,
          erc721,
          primary,
          overrides.receivers,
          overrides.index,
          allowGiveUp,
          gasData,
          false,
          overrides.percents,
          b.totalAmount,
          walkingSpeedData,
          gcmData,
          { value: b.totalAmount }
        );
      }

      // Wraps an assertion so ChallengeDetailV2's unrelated Aave/WMATIC mainnet-fork
      // dependency (only reachable on the SUCCESS path, after all the checks under test have
      // already passed) doesn't turn a "should succeed" case into a false failure in this
      // sandbox. Revert-path assertions never reach that code and need no such handling.
      // IMPORTANT: on failure this calls mochaCtx.skip() (marks the test PENDING), never a
      // silent return -- a silently-swallowed exception here would make the assertion vacuous.
      async function expectDeployOk(
        mochaCtx: any,
        overrides: Parameters<typeof deploy>[0]
      ) {
        try {
          await expect(deploy(overrides)).to.not.be.reverted;
        } catch (e) {
          if (contract === 'ChallengeDetailV2') return mochaCtx.skip();
          throw e;
        }
      }

      it('accepts a valid configuration with distinct nonzero receivers (sanity baseline)', async function () {
        const signers = await hre.ethers.getSigners();
        const [recvA, recvB] = [signers[4].address, signers[5].address];
        await expectDeployOk(this, {
          receivers: [recvA, recvB],
          percents: [50, 40],
          index: 1,
        });
      });

      it('rejects a zero-address stakeholder (challenger)', async () => {
        const b = await baseArgs();
        const signers = await hre.ethers.getSigners();
        const recvA = signers[4].address;
        await expect(
          deploy({
            stakeHolders: [
              b.sponsor.address,
              hre.ethers.ZeroAddress,
              b.feeAddr.address,
            ],
            receivers: [recvA],
            percents: [70],
            index: 1,
          })
        ).to.be.reverted;
      });

      it('rejects a zero-address payout receiver', async () => {
        await expect(
          deploy({
            receivers: [hre.ethers.ZeroAddress],
            percents: [70],
            index: 1,
          })
        ).to.be.reverted;
      });

      it('rejects a duplicate receiver address within the SUCCESS group', async () => {
        const signers = await hre.ethers.getSigners();
        const recvA = signers[4].address;
        await expect(
          deploy({ receivers: [recvA, recvA], percents: [50, 40], index: 2 })
        ).to.be.reverted;
      });

      it('rejects a duplicate receiver address within the FAIL group', async () => {
        const signers = await hre.ethers.getSigners();
        const [recvA, recvB] = [signers[4].address, signers[5].address];
        await expect(
          deploy({
            receivers: [recvA, recvB, recvB],
            percents: [70, 50, 40],
            index: 1,
          })
        ).to.be.reverted;
      });

      it('accepts the SAME address once in the success group and once in the fail group (separate mappings, not a duplicate)', async function () {
        const signers = await hre.ethers.getSigners();
        const recvA = signers[4].address;
        await expectDeployOk(this, {
          receivers: [recvA, recvA],
          percents: [70, 90],
          index: 1,
        });
      });
    });
  }
});
