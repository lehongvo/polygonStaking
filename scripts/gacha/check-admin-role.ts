import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { ethers, network } from 'hardhat';

// DEFAULT_ADMIN_ROLE in OZ AccessControl is bytes32(0).
const DEFAULT_ADMIN_ROLE =
  '0x0000000000000000000000000000000000000000000000000000000000000000';
const ACCESS_CONTROL_ABI = [
  'function hasRole(bytes32 role, address account) view returns (bool)',
];

interface GachaEntry {
  Name: string;
  Network: string;
  GachaProxyAddress: string;
}

async function main() {
  console.log('🔐 GACHA DEFAULT_ADMIN_ROLE CHECK');
  console.log('=================================');

  if (network.name !== 'polygon') {
    console.error(
      `❌ This script only supports network 'polygon', got '${network.name}'`
    );
    process.exit(1);
  }

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
  console.log(`🔑 Role:    DEFAULT_ADMIN_ROLE = ${DEFAULT_ADMIN_ROLE}`);

  const jsonPath = path.join(
    process.cwd(),
    'docs',
    'contractAddress',
    'gachaAddress.json'
  );
  const entries: GachaEntry[] = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  console.log(`✅ Loaded ${entries.length} entries\n`);

  const results: Array<{ name: string; hasRole: boolean | null }> = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const tag = `[${i + 1}/${entries.length}] ${entry.Name.padEnd(12)}`;
    if (entry.Network !== 'polygon') {
      console.log(`⚠️  ${tag} skip — Network=${entry.Network}`);
      results.push({ name: entry.Name, hasRole: null });
      continue;
    }
    const c = new ethers.Contract(
      entry.GachaProxyAddress,
      ACCESS_CONTROL_ABI,
      ethers.provider
    );
    try {
      const hasRole: boolean = await c.hasRole(DEFAULT_ADMIN_ROLE, target);
      const icon = hasRole ? '✅' : '🔒';
      console.log(
        `${icon} ${tag} ${entry.GachaProxyAddress} — ${hasRole ? 'HAS ROLE' : 'NO ROLE'}`
      );
      results.push({ name: entry.Name, hasRole });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`❌ ${tag} ${entry.GachaProxyAddress} — error: ${msg}`);
      results.push({ name: entry.Name, hasRole: null });
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

  if (granted > 0) {
    console.log(
      `\n   → Target wallet can grantRole(CLOSE_GACHA_ROLE, ...) on the ${granted} proxies above.`
    );
  }
  if (missing > 0 || errored > 0) {
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('💥 CHECK FAILED:', error);
    process.exit(1);
  });
