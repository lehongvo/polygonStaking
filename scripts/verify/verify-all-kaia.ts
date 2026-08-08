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
// CHALLENGE-2709: TARGETS lives in a pure-data module (no 'hardhat' import) so
// test/scripts/verify-all-kaia-fqns.test.ts can import the exact same list without pulling in
// this script's `import ... from 'hardhat'` (only valid under Hardhat's script-runner injection,
// not from an ordinary test-side import).
import { Target, TARGETS } from './kaia-verify-targets.ts';

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
    results.push(
      `${r.startsWith('✅') ? '✅' : '❌'} ${t.name.padEnd(32)} ${r}`
    );
  }
  console.log('\n======== SUMMARY ========');
  results.forEach(r => console.log(r));
  // CHALLENGE-2709: previously always exited 0 even when a target's verification failed --
  // silent in CI/automation. Fail closed if anything in this run didn't verify.
  if (results.some(r => r.startsWith('❌'))) {
    process.exitCode = 1;
  }
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch(err => {
    console.error('💥', err);
    process.exit(1);
  });
