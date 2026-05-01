import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { ethers, network } from 'hardhat';

const UPGRADER_ROLE = ethers.id('UPGRADER_ROLE');
const ACCESS_CONTROL_ABI = [
  'function hasRole(bytes32 role, address account) view returns (bool)',
];

interface GachaEntry {
  Name: string;
  Network: string;
  GachaProxyAddress: string;
}

async function main() {
  console.log('🔐 GACHA UPGRADER_ROLE CHECK');
  console.log('============================');

  if (network.name !== 'polygon') {
    console.error(
      `❌ This script only supports network 'polygon', got '${network.name}'`
    );
    process.exit(1);
  }

  // Optional override via env var; default to signer (deploy wallet)
  let target: string;
  if (process.env.CHECK_ADDRESS) {
    try {
      target = ethers.getAddress(process.env.CHECK_ADDRESS);
    } catch {
      console.error(`❌ Invalid CHECK_ADDRESS: ${process.env.CHECK_ADDRESS}`);
      process.exit(1);
    }
  } else {
    const [signer] = await ethers.getSigners();
    target = signer.address;
  }

  console.log(`📍 Network: ${network.name}`);
  console.log(`🎯 Target:  ${target}`);
  console.log(`🔑 Role:    UPGRADER_ROLE = ${UPGRADER_ROLE}`);

  const jsonPath = path.join(
    process.cwd(),
    'docs',
    'contractAddress',
    'gachaAddress.json'
  );
  if (!fs.existsSync(jsonPath)) {
    console.error(`❌ File not found: ${jsonPath}`);
    process.exit(1);
  }
  const entries: GachaEntry[] = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  console.log(`✅ Loaded ${entries.length} entries\n`);

  const results: Array<{
    name: string;
    proxy: string;
    hasRole: boolean | null;
    error?: string;
  }> = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const tag = `[${i + 1}/${entries.length}] ${entry.Name.padEnd(12)}`;

    if (entry.Network !== 'polygon') {
      console.log(`⚠️  ${tag} skip — Network=${entry.Network}`);
      results.push({
        name: entry.Name,
        proxy: entry.GachaProxyAddress,
        hasRole: null,
        error: `Network ${entry.Network}, not polygon`,
      });
      continue;
    }

    const c = new ethers.Contract(
      entry.GachaProxyAddress,
      ACCESS_CONTROL_ABI,
      ethers.provider
    );

    try {
      const hasRole: boolean = await c.hasRole(UPGRADER_ROLE, target);
      const icon = hasRole ? '✅' : '🔒';
      console.log(
        `${icon} ${tag} ${entry.GachaProxyAddress} — ${hasRole ? 'HAS ROLE' : 'NO ROLE'}`
      );
      results.push({
        name: entry.Name,
        proxy: entry.GachaProxyAddress,
        hasRole,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`❌ ${tag} ${entry.GachaProxyAddress} — error: ${msg}`);
      results.push({
        name: entry.Name,
        proxy: entry.GachaProxyAddress,
        hasRole: null,
        error: msg,
      });
    }
  }

  const granted = results.filter(r => r.hasRole === true).length;
  const missing = results.filter(r => r.hasRole === false).length;
  const errored = results.filter(r => r.hasRole === null).length;

  console.log('\n📊 SUMMARY');
  console.log('==========');
  console.log(`Target wallet:  ${target}`);
  console.log(`Total proxies:  ${entries.length}`);
  console.log(`✅ Has role:    ${granted}`);
  console.log(`🔒 Missing:     ${missing}`);
  console.log(`❌ Errored:     ${errored}`);

  if (missing > 0) {
    console.log('\n🔒 PROXIES WITHOUT ROLE:');
    results
      .filter(r => r.hasRole === false)
      .forEach(r => console.log(`   ${r.name.padEnd(12)} ${r.proxy}`));
    console.log(
      '\n   → Run upgrade script: those proxies will be skipped with NO_ROLE.'
    );
    console.log(
      '   → To grant role manually, call grantRole(UPGRADER_ROLE, ' +
        target +
        ') on each proxy from a wallet that has DEFAULT_ADMIN_ROLE.'
    );
  }

  if (errored > 0) {
    console.log('\n❌ PROXIES WITH ERROR:');
    results
      .filter(r => r.hasRole === null)
      .forEach(r =>
        console.log(`   ${r.name.padEnd(12)} ${r.proxy} — ${r.error}`)
      );
  }

  // Non-zero exit if anything missing/errored, so CI can detect
  if (missing > 0 || errored > 0) {
    process.exit(1);
  }
  console.log('\n🎉 ALL PROXIES HAVE UPGRADER_ROLE — safe to upgrade.');
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('💥 CHECK FAILED:', error);
    process.exit(1);
  });
