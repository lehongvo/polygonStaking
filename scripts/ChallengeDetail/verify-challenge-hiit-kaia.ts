/**
 * Verify an already-deployed ChallengeHIIT on Kaiascan.
 * Reads the address + exact constructorArgs from
 * deployInfo/challenge-hiit-kaia.json (written by the deploy script).
 *
 * Run:
 *   npm run verify:challenge-hiit:kaia
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { network, run, ethers } from 'hardhat';

async function main() {
  if (network.name !== 'kaia') {
    console.error(`❌ Only 'kaia', got '${network.name}'`);
    process.exit(1);
  }
  const auditPath = path.join(process.cwd(), 'deployInfo', 'challenge-hiit-kaia.json');
  const audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
  const address = audit.address;
  const c = audit.constructorArgs;

  const args = [
    c.stakeHolders,
    c.createByToken,
    c.erc721Addresses,
    c.primaryRequired,
    c.awardReceivers,
    c.index,
    c.allowGiveUp,
    c.gasData.map((s: string) => BigInt(s)),
    c.allAwardToSponsorWhenGiveUp,
    c.awardReceiversPercent,
    BigInt(c.totalAmount),
  ];

  console.log(`🔍 Verifying ChallengeHIIT at ${address} on Kaiascan...`);
  // Ensure the explorer has indexed the deployed code first.
  const code = await ethers.provider.getCode(address);
  if (code === '0x') {
    console.error('❌ No code at address');
    process.exit(1);
  }

  // Try Etherscan-style (Kaiascan) first; fall back to Sourcify if it 400s.
  try {
    await run('verify:verify', { address, constructorArguments: args });
    console.log('✅ Verified on Kaiascan (etherscan API)');
    return;
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    if (/already verified/i.test(msg)) {
      console.log('✅ Already verified');
      return;
    }
    console.warn('⚠️  Kaiascan etherscan-API verify failed, trying Sourcify…');
  }

  try {
    await run('verify:sourcify', { address });
    console.log('✅ Verified on Sourcify (chainId 8217)');
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    if (/already verified/i.test(msg)) {
      console.log('✅ Already verified on Sourcify');
    } else {
      console.error('❌ Sourcify verify also failed:', msg);
      process.exit(1);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('💥', err);
    process.exit(1);
  });
