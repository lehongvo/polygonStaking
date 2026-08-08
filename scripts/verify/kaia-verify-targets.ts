// CHALLENGE-2709: pure-data module (no 'hardhat' import) so both the verify script and its test
// can import the same TARGETS list -- Hardhat script-runner injects `network`/`run`/`ethers` from
// 'hardhat' specially when a script is executed via `hardhat run`, which is NOT available when a
// test imports a module the ordinary Node/ESM way; keeping this list import-side-effect-free
// avoids that mismatch entirely.
export interface Target {
  name: string;
  address: string;
  contract?: string; // fully-qualified, needed when the contract name is ambiguous
  args: any[];
}

export const TARGETS: Target[] = [
  {
    name: 'ChallengeFee',
    address: '0x074a133a378b04FA936A53DAC4049aAa687FB16E',
    contract: 'contracts/ChallengeFee/ChallengeFee.sol:ChallengeFee',
    args: [0, 0],
  },
  {
    name: 'HistoryChallenges',
    address: '0x8B4a723d12FEe6a45f9FbF3d400FDc8517bB0E9A',
    contract:
      'contracts/HistoryChallenges/HistoryChallenges.sol:HistoryChallenges',
    args: [],
  },
  {
    name: 'TanimoToken (impl)',
    address: '0xac514803F4Abb05bAA5462b9223EBD848ff256ce',
    contract: 'contracts/TTJP/TanimoToken.sol:TanimoToken',
    args: [],
  },
  {
    name: 'ExerciseSupplementNFT (impl)',
    address: '0xe4a82DB54684fd12189Af10eC121CF917428A8b3',
    contract: 'contracts/ExerciseSupplementNFT.sol:ExerciseSupplementNFT',
    args: [],
  },
  {
    // CHALLENGE-2709: both Special1.sol and Special2.sol declare the SAME contract name
    // (ExerciseSupplementNFTSpecial, not ...Special1/...Special2), and BOTH files physically
    // live under contracts/ExerciseSupplementNFTSpecial1/ -- contracts/ExerciseSupplementNFTSpecial2/
    // is an empty, unused directory. These FQNs now match
    // scripts/exerciseSupplementNFT/deploy-and-setup-special-kaia.ts's FQN1/FQN2 exactly.
    name: 'ExerciseSupplementNFTSpecial1',
    address: '0x4aEcd6bdb4DCAb9beb8a49F93c04c0C65d060530',
    contract:
      'contracts/ExerciseSupplementNFTSpecial1/ExerciseSupplementNFTSpecial1.sol:ExerciseSupplementNFTSpecial',
    args: [],
  },
  {
    name: 'ExerciseSupplementNFTSpecial2',
    address: '0xC1849D39bb4003039089cC46AC55D480EfF045F0',
    contract:
      'contracts/ExerciseSupplementNFTSpecial1/ExerciseSupplementNFTSpecial2.sol:ExerciseSupplementNFTSpecial',
    args: [],
  },
];
