/**
 * Verify the Kaia-mainnet contracts that were deployed BEFORE the Kaiascan
 * apiURL fix (so their deploy-time verify never ran). Tries Kaiascan
 * (etherscan API) then Sourcify per contract; reports a summary.
 *
 * Run:
 *   npm run verify:all:kaia
 */
import 'dotenv/config';
import { network, run, ethers } from 'hardhat';

interface Target {
  name: string;
  address: string;
  contract?: string; // fully-qualified, needed when the contract name is ambiguous
  args: any[];
}

const TARGETS: Target[] = [
  {
    name: 'ChallengeFee',
    address: '0x074a133a378b04FA936A53DAC4049aAa687FB16E',
    contract: 'contracts/ChallengeFee/ChallengeFee.sol:ChallengeFee',
    args: [0, 0],
  },
  {
    name: 'HistoryChallenges',
    address: '0x8B4a723d12FEe6a45f9FbF3d400FDc8517bB0E9A',
    contract: 'contracts/HistoryChallenges/HistoryChallenges.sol:HistoryChallenges',
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
    name: 'ExerciseSupplementNFTSpecial1',
    address: '0x4aEcd6bdb4DCAb9beb8a49F93c04c0C65d060530',
    contract:
      'contracts/ExerciseSupplementNFTSpecial1/ExerciseSupplementNFTSpecial1.sol:ExerciseSupplementNFTSpecial1',
    args: [],
  },
  {
    name: 'ExerciseSupplementNFTSpecial2',
    address: '0xC1849D39bb4003039089cC46AC55D480EfF045F0',
    contract:
      'contracts/ExerciseSupplementNFTSpecial2/ExerciseSupplementNFTSpecial2.sol:ExerciseSupplementNFTSpecial2',
    args: [],
  },
];

async function verifyOne(t: Target): Promise<string> {
  const code = await ethers.provider.getCode(t.address);
  if (code === '0x') return 'NO CODE';
  const params: any = { address: t.address, constructorArguments: t.args };
  if (t.contract) params.contract = t.contract;
  try {
    await run('verify:verify', params);
    return '✅ Kaiascan';
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    if (/already verified/i.test(msg)) return '✅ already verified';
    // fallback sourcify
    try {
      const sp: any = { address: t.address };
      if (t.contract) sp.contract = t.contract;
      await run('verify:sourcify', sp);
      return '✅ Sourcify only';
    } catch (e2: any) {
      const m2 = e2?.message ?? String(e2);
      if (/already verified/i.test(m2)) return '✅ already (sourcify)';
      return '❌ ' + msg.split('\n')[0].slice(0, 120);
    }
  }
}

async function main() {
  if (network.name !== 'kaia') {
    console.error(`❌ Only 'kaia', got '${network.name}'`);
    process.exit(1);
  }
  const results: string[] = [];
  for (const t of TARGETS) {
    console.log(`\n🔍 ${t.name} @ ${t.address}`);
    const r = await verifyOne(t);
    console.log(`   → ${r}`);
    results.push(`${r.startsWith('✅') ? '✅' : '❌'} ${t.name.padEnd(32)} ${r}`);
  }
  console.log('\n======== SUMMARY ========');
  results.forEach(r => console.log(r));
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('💥', err);
    process.exit(1);
  });
