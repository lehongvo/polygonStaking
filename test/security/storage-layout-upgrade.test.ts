// CHALLENGE-2774: proves, using @openzeppelin/hardhat-upgrades' real storage-layout validator
// (not manual inspection), that:
//   1. The CURRENT contracts/gacha/gacha.sol and contracts/PolygonDeFiAggregator.sol are
//      upgrade-safe from the layout that is actually live on-chain today (see
//      docs/contractAddress/gachaAddress.json and deployInfo/polygon-defi-upgrade.json for the
//      deployed implementation addresses/dates that predate the storage-breaking commits).
//   2. The validator is not a no-op: fed the pre-fix ("broken") layout that inserted a new
//      variable in the middle of the existing one instead of appending it, it correctly REJECTS
//      the upgrade. This is the mutation-test evidence required by this effort's testing
//      standard -- a check that can't fail is not a check.
//
// OldGachaV1ForLayoutTest / OldDefiV1ForLayoutTest / BrokenGachaV2ForLayoutTest /
// BrokenDefiV2ForLayoutTest (contracts/mocks/storage-layout/) are verbatim snapshots of the real
// contracts at the git commits identified in the ticket evidence, renamed only at the top-level
// contract declaration so they can coexist in the same compilation. They are never deployed
// outside this test.
import { expect } from 'chai';
import hre from 'hardhat';

const { ethers, upgrades } = hre as any;

describe('CHALLENGE-2774: UUPS storage-layout compatibility (Gacha / PolygonDeFiAggregator)', () => {
  describe('Gacha', () => {
    it('current contracts/gacha/gacha.sol is a storage-compatible upgrade from the on-chain baseline', async () => {
      const OldFactory = await ethers.getContractFactory(
        'OldGachaV1ForLayoutTest'
      );
      const NewFactory = await ethers.getContractFactory('Gacha');
      // Must not throw. validateUpgrade performs a pure static layout comparison -- it does not
      // deploy anything and needs no init args.
      await upgrades.validateUpgrade(OldFactory, NewFactory);
    });

    it('mutation check: the pre-fix layout (variable inserted mid-contract) is correctly REJECTED', async () => {
      const OldFactory = await ethers.getContractFactory(
        'OldGachaV1ForLayoutTest'
      );
      const BrokenFactory = await ethers.getContractFactory(
        'BrokenGachaV2ForLayoutTest'
      );
      let threw = false;
      try {
        await upgrades.validateUpgrade(OldFactory, BrokenFactory);
      } catch (err: any) {
        threw = true;
        expect(String(err.message || err)).to.match(/storage|layout/i);
      }
      expect(
        threw,
        'validateUpgrade must reject the storage-incompatible layout'
      ).to.equal(true);
    });
  });

  describe('PolygonDeFiAggregator', () => {
    it('current contracts/PolygonDeFiAggregator.sol is a storage-compatible upgrade from the on-chain baseline', async () => {
      const OldFactory = await ethers.getContractFactory(
        'OldDefiV1ForLayoutTest'
      );
      const NewFactory = await ethers.getContractFactory(
        'PolygonDeFiAggregator'
      );
      await upgrades.validateUpgrade(OldFactory, NewFactory, {
        // Pre-existing finding (unrelated to CHALLENGE-2774): percentFeeForSystem has an inline
        // initial value, which OpenZeppelin flags for upgradeable contracts. Same allowance
        // already used by test/defi/defi-smoke.test.ts's deployProxy call.
        unsafeAllow: ['state-variable-assignment'],
      });
    });

    it('mutation check: the pre-fix layout (variable inserted mid-contract) is correctly REJECTED', async () => {
      const OldFactory = await ethers.getContractFactory(
        'OldDefiV1ForLayoutTest'
      );
      const BrokenFactory = await ethers.getContractFactory(
        'BrokenDefiV2ForLayoutTest'
      );
      let threw = false;
      try {
        await upgrades.validateUpgrade(OldFactory, BrokenFactory, {
          unsafeAllow: ['state-variable-assignment'],
        });
      } catch (err: any) {
        threw = true;
        expect(String(err.message || err)).to.match(/storage|layout/i);
      }
      expect(
        threw,
        'validateUpgrade must reject the storage-incompatible layout'
      ).to.equal(true);
    });
  });
});
