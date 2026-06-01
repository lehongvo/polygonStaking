/**
 * Deploy HistoryChallenges helper contract on Kaia mainnet.
 *
 * Stateless contract (3 public view functions) — no constructor args,
 * no setup, not upgradeable. Update scripts/contract/kaia.json with
 * deployed address.
 *
 * Run:
 *   npm run deploy:history:kaia
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { ethers, network } from 'hardhat';

const KAIA_JSON_PATH = path.join(
  process.cwd(),
  'scripts',
  'contract',
  'kaia.json'
);

async function main() {
  console.log('🚀 HISTORY CHALLENGES — DEPLOY ON KAIA MAINNET');
  console.log('===============================================');

  if (network.name !== 'kaia') {
    console.error(`❌ Only network 'kaia' supported, got '${network.name}'`);
    process.exit(1);
  }

  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`📍 Network:  ${network.name} (8217)`);
  console.log(`👤 Deployer: ${deployer.address}`);
  console.log(`💰 Balance:  ${ethers.formatEther(balance)} KAIA`);

  if (balance < ethers.parseEther('0.1')) {
    console.error('❌ Need at least 0.1 KAIA');
    process.exit(1);
  }

  console.log('\n🏗️  DEPLOYING HistoryChallenges (no constructor args)');
  const Factory = await ethers.getContractFactory('HistoryChallenges');
  const c = await Factory.deploy();
  await c.waitForDeployment();
  const address = await c.getAddress();
  const tx = c.deploymentTransaction();
  const receipt = await tx?.wait();

  console.log(`\n✅ Deployed at:  ${address}`);
  console.log(`⛓  Tx hash:      ${tx?.hash}`);
  console.log(`📦 Block:        ${receipt?.blockNumber}`);
  console.log(`⛽ Gas used:     ${receipt?.gasUsed?.toString()}`);

  // Update kaia.json
  const kaiaJson = JSON.parse(fs.readFileSync(KAIA_JSON_PATH, 'utf8'));
  kaiaJson.HistoryChallenges = address;
  fs.writeFileSync(KAIA_JSON_PATH, JSON.stringify(kaiaJson, null, 4) + '\n');
  console.log(`\n💾 Updated ${KAIA_JSON_PATH}`);

  // Audit
  const auditPath = path.join(
    process.cwd(),
    'deployInfo',
    'history-challenges-kaia.json'
  );
  fs.mkdirSync(path.dirname(auditPath), { recursive: true });
  fs.writeFileSync(
    auditPath,
    JSON.stringify(
      {
        network: network.name,
        chainId: '8217',
        contractName: 'HistoryChallenges',
        address,
        deployer: deployer.address,
        deploymentTime: new Date().toISOString(),
        blockNumber: receipt?.blockNumber ?? null,
        transactionHash: tx?.hash ?? '',
        gasUsed: receipt?.gasUsed?.toString() ?? '',
        explorerUrl: `https://kaiascan.io/address/${address}`,
      },
      null,
      2
    ) + '\n'
  );
  console.log(`💾 Audit:        ${auditPath}`);
  console.log(`\n🔗 Explorer:     https://kaiascan.io/address/${address}`);
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('💥 DEPLOYMENT FAILED:', err);
    process.exit(1);
  });
