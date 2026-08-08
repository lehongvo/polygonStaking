// CHALLENGE-2709: scripts/verify/verify-all-kaia.ts named Special1/Special2 as
// contracts/ExerciseSupplementNFTSpecial{1,2}/ExerciseSupplementNFTSpecial{1,2}.sol:
// ExerciseSupplementNFTSpecial{1,2} -- but both files actually declare `contract
// ExerciseSupplementNFTSpecial` (no suffix) and both physically live under
// contracts/ExerciseSupplementNFTSpecial1/ (ExerciseSupplementNFTSpecial2/ is an empty,
// unused directory). Hardhat can't resolve a non-existent FQN, so verification failed.
// This proves every configured target's `contract` FQN resolves to a REAL compiled artifact --
// the same check the ticket's "CI confirms every configured FQN has an artifact" AC asks for.
import { expect } from 'chai';
import hre from 'hardhat';
import { TARGETS } from '../../scripts/verify/kaia-verify-targets.ts';

describe('CHALLENGE-2709: verify-all-kaia.ts target FQNs resolve to real compiled artifacts', function () {
  for (const t of TARGETS) {
    it(`${t.name}: contract FQN "${t.contract}" resolves`, async function () {
      expect(
        t.contract,
        `${t.name} must set an explicit fully-qualified contract name`
      ).to.be.a('string');
      // Throws HH700 ("... is not a valid fully qualified name" / no matching artifact) if the
      // FQN doesn't match a real compiled contract -- exactly the pre-fix Special1/Special2 bug.
      const artifact = await hre.artifacts.readArtifact(t.contract as string);
      expect(artifact.contractName.length).to.be.greaterThan(0);
    });
  }

  it('Special1 and Special2 FQNs point at DIFFERENT source files but the SAME declared contract name (ExerciseSupplementNFTSpecial)', async function () {
    const special1 = TARGETS.find(
      t => t.name === 'ExerciseSupplementNFTSpecial1'
    )!;
    const special2 = TARGETS.find(
      t => t.name === 'ExerciseSupplementNFTSpecial2'
    )!;
    expect(special1.contract).to.not.equal(special2.contract);
    const a1 = await hre.artifacts.readArtifact(special1.contract as string);
    const a2 = await hre.artifacts.readArtifact(special2.contract as string);
    expect(a1.contractName).to.equal('ExerciseSupplementNFTSpecial');
    expect(a2.contractName).to.equal('ExerciseSupplementNFTSpecial');
    expect(special1.contract).to.include(
      'ExerciseSupplementNFTSpecial1/ExerciseSupplementNFTSpecial1.sol'
    );
    expect(special2.contract).to.include(
      'ExerciseSupplementNFTSpecial1/ExerciseSupplementNFTSpecial2.sol'
    );
  });
});
