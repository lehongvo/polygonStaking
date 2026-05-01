import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { ethers, network } from 'hardhat';

const NEW_IMPL_ADDRESS = '0xeA48C0b3cDfb3e58DdeDc5b6eC937624d89603f8';
const EIP1967_IMPL_SLOT =
  '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
const UPGRADER_ROLE = ethers.id('UPGRADER_ROLE');
const MIN_BALANCE_MATIC = '0.3';
const GAS_BUFFER_PERCENT = 20;
const GRACE_PERIOD_SECONDS = 15;

const UPGRADE_ABI = ['function upgradeTo(address newImplementation) external'];
const ACCESS_CONTROL_ABI = [
  'function hasRole(bytes32 role, address account) view returns (bool)',
];

interface GachaEntry {
  Name: string;
  Network: string;
  GachaProxyAddress: string;
  ImplementAddress: string;
  ImplementAddressDeployAt: string;
  TX?: string;
  gas?: string;
  NewImplementAddress?: string;
  NewImplementAddressDeployAt?: string;
}

type Status = 'READY' | 'SKIP' | 'NO_ROLE' | 'INVALID';

interface ProxyState {
  entry: GachaEntry;
  index: number;
  status: Status;
  reason: string;
  currentImpl?: string;
}

async function readImplFromProxy(proxyAddr: string): Promise<string> {
  const raw = await ethers.provider.getStorage(proxyAddr, EIP1967_IMPL_SLOT);
  return ethers.getAddress('0x' + raw.slice(-40));
}

async function hasUpgraderRole(
  proxyAddr: string,
  deployerAddr: string
): Promise<boolean> {
  const c = new ethers.Contract(proxyAddr, ACCESS_CONTROL_ABI, ethers.provider);
  return c.hasRole(UPGRADER_ROLE, deployerAddr);
}

async function main() {
  console.log('🚀 GACHA PROXY UPGRADE');
  console.log('======================');

  // ---------------------------------------------------------------------
  // Network guard — polygon-only
  // ---------------------------------------------------------------------
  if (network.name !== 'polygon') {
    console.error(
      `❌ This script only supports network 'polygon', got '${network.name}'`
    );
    process.exit(1);
  }

  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`📍 Network: ${network.name}`);
  console.log(`👤 Deployer: ${deployer.address}`);
  console.log(`💰 Balance: ${ethers.formatEther(balance)} MATIC`);
  console.log(`🎯 New impl: ${NEW_IMPL_ADDRESS}`);

  // ---------------------------------------------------------------------
  // Global pre-checks
  // ---------------------------------------------------------------------
  console.log('\n🔍 GLOBAL PRE-CHECKS');
  console.log('====================');

  const minBalance = ethers.parseEther(MIN_BALANCE_MATIC);
  if (balance < minBalance) {
    console.error(
      `❌ Insufficient balance. Need at least ${MIN_BALANCE_MATIC} MATIC`
    );
    process.exit(1);
  }
  console.log(`✅ Balance >= ${MIN_BALANCE_MATIC} MATIC`);

  const newImplCode = await ethers.provider.getCode(NEW_IMPL_ADDRESS);
  if (newImplCode === '0x') {
    console.error(`❌ New impl ${NEW_IMPL_ADDRESS} has no bytecode`);
    process.exit(1);
  }
  console.log(
    `✅ New impl has bytecode (${(newImplCode.length - 2) / 2} bytes)`
  );

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
  console.log(`✅ Loaded ${entries.length} entries from gachaAddress.json`);

  const implInfoPath = path.join(
    process.cwd(),
    'deployInfo',
    'gacha-impl-polygon.json'
  );
  let newImplDeployAt = '';
  if (fs.existsSync(implInfoPath)) {
    const implInfo = JSON.parse(fs.readFileSync(implInfoPath, 'utf8'));
    newImplDeployAt = implInfo.deploymentTime ?? '';
    if (
      implInfo.contractAddress &&
      implInfo.contractAddress.toLowerCase() !== NEW_IMPL_ADDRESS.toLowerCase()
    ) {
      console.warn(
        `⚠️  deployInfo address (${implInfo.contractAddress}) != hardcoded NEW_IMPL_ADDRESS. Hardcoded takes precedence.`
      );
    }
  }
  console.log(
    `✅ New impl deployAt: ${newImplDeployAt || '(unknown — deployInfo not found)'}`
  );

  // ---------------------------------------------------------------------
  // Per-proxy pre-check
  // ---------------------------------------------------------------------
  console.log('\n🔐 PER-PROXY PRE-CHECK');
  console.log('======================');

  const states: ProxyState[] = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const tag = `[${i + 1}/${entries.length}] ${entry.Name}`;

    if (entry.Network !== 'polygon') {
      states.push({
        entry,
        index: i,
        status: 'INVALID',
        reason: `Network=${entry.Network}`,
      });
      console.log(`⚠️  ${tag} — Network ${entry.Network}, skip`);
      continue;
    }

    let currentImpl: string;
    try {
      currentImpl = await readImplFromProxy(entry.GachaProxyAddress);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      states.push({
        entry,
        index: i,
        status: 'INVALID',
        reason: `read impl failed: ${msg}`,
      });
      console.log(`❌ ${tag} — read impl failed: ${msg}`);
      continue;
    }

    if (currentImpl.toLowerCase() === NEW_IMPL_ADDRESS.toLowerCase()) {
      states.push({
        entry,
        index: i,
        status: 'SKIP',
        reason: 'already at new impl',
        currentImpl,
      });
      console.log(`⏭️  ${tag} — already at V3, skip`);
      continue;
    }

    let hasRole: boolean;
    try {
      hasRole = await hasUpgraderRole(
        entry.GachaProxyAddress,
        deployer.address
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      states.push({
        entry,
        index: i,
        status: 'INVALID',
        reason: `hasRole failed: ${msg}`,
        currentImpl,
      });
      console.log(`❌ ${tag} — hasRole failed: ${msg}`);
      continue;
    }

    if (!hasRole) {
      states.push({
        entry,
        index: i,
        status: 'NO_ROLE',
        reason: 'deployer lacks UPGRADER_ROLE',
        currentImpl,
      });
      console.log(`🔒 ${tag} — no UPGRADER_ROLE, skip`);
      continue;
    }

    states.push({
      entry,
      index: i,
      status: 'READY',
      reason: '',
      currentImpl,
    });
    console.log(`✅ ${tag} — ready (current ${currentImpl})`);
  }

  const ready = states.filter(s => s.status === 'READY');
  const skipped = states.filter(s => s.status === 'SKIP').length;
  const noRole = states.filter(s => s.status === 'NO_ROLE').length;
  const invalid = states.filter(s => s.status === 'INVALID').length;

  console.log('\n📋 PRE-FLIGHT SUMMARY');
  console.log('=====================');
  console.log(`Ready:    ${ready.length}`);
  console.log(`Skip:     ${skipped} (already V3)`);
  console.log(`No role:  ${noRole}`);
  console.log(`Invalid:  ${invalid}`);

  if (ready.length === 0) {
    console.log('\nNothing to upgrade. Exiting.');
    process.exit(0);
  }

  // ---------------------------------------------------------------------
  // Gas estimate (sample first READY proxy)
  // ---------------------------------------------------------------------
  console.log('\n⛽ GAS ESTIMATE');
  console.log('===============');

  const sampleContract = new ethers.Contract(
    ready[0].entry.GachaProxyAddress,
    UPGRADE_ABI,
    deployer
  );

  let estimatedGas: bigint;
  try {
    estimatedGas = await sampleContract.upgradeTo.estimateGas(NEW_IMPL_ADDRESS);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(
      `❌ Gas estimate failed for sample ${ready[0].entry.Name}: ${msg}`
    );
    process.exit(1);
  }

  const feeData = await ethers.provider.getFeeData();
  const fallbackGasPrice = ethers.parseUnits('40', 'gwei');
  const gasPrice = feeData.gasPrice ?? fallbackGasPrice;
  const estCostPerProxy = estimatedGas * gasPrice;
  const estCostTotal = estCostPerProxy * BigInt(ready.length);

  console.log(`Estimated gas/upgrade: ${estimatedGas.toString()}`);
  console.log(
    `Gas price:             ${ethers.formatUnits(gasPrice, 'gwei')} gwei`
  );
  console.log(
    `Cost/upgrade:          ${ethers.formatEther(estCostPerProxy)} MATIC`
  );
  console.log(
    `Total cost (${ready.length} tx):       ${ethers.formatEther(estCostTotal)} MATIC`
  );

  if (balance < estCostTotal) {
    console.error(
      `❌ Balance ${ethers.formatEther(balance)} < estimated total cost ${ethers.formatEther(estCostTotal)}`
    );
    process.exit(1);
  }
  console.log(`✅ Balance covers total estimated cost`);

  const gasLimit = Math.ceil(
    Number(estimatedGas) * (1 + GAS_BUFFER_PERCENT / 100)
  );
  console.log(`Gas limit per tx:      ${gasLimit} (+${GAS_BUFFER_PERCENT}%)`);

  console.log(
    `\n⏸  Sleeping ${GRACE_PERIOD_SECONDS}s before broadcasting — Ctrl+C now to abort.`
  );
  await new Promise(resolve =>
    setTimeout(resolve, GRACE_PERIOD_SECONDS * 1000)
  );

  // ---------------------------------------------------------------------
  // Upgrade loop
  // ---------------------------------------------------------------------
  console.log('\n🏗️  UPGRADING');
  console.log('=============');

  const overrides =
    feeData.maxFeePerGas && feeData.maxPriorityFeePerGas
      ? {
          gasLimit,
          maxFeePerGas: feeData.maxFeePerGas,
          maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
        }
      : { gasLimit, gasPrice };

  let success = 0;
  let failed = 0;
  const results: Array<{
    name: string;
    proxy: string;
    status: string;
    tx?: string;
    gas?: string;
    error?: string;
  }> = [];

  for (const state of ready) {
    const tag = `[${state.index + 1}/${entries.length}] ${state.entry.Name}`;
    console.log(`\n🔄 ${tag} (${state.entry.GachaProxyAddress})`);

    const proxyContract = new ethers.Contract(
      state.entry.GachaProxyAddress,
      UPGRADE_ABI,
      deployer
    );

    try {
      const tx = await proxyContract.upgradeTo(NEW_IMPL_ADDRESS, overrides);
      console.log(`   Tx: ${tx.hash}`);
      const receipt = await tx.wait(1);
      if (!receipt) throw new Error('Receipt is null');

      // Verify on-chain impl matches expected
      const newImpl = await readImplFromProxy(state.entry.GachaProxyAddress);
      if (newImpl.toLowerCase() !== NEW_IMPL_ADDRESS.toLowerCase()) {
        throw new Error(`Post-upgrade impl mismatch: got ${newImpl}`);
      }

      const gasUsed = receipt.gasUsed.toString();
      console.log(`   ✅ Gas used: ${gasUsed}`);

      // Update JSON entry — atomic save after each success
      entries[state.index].TX = tx.hash;
      entries[state.index].gas = gasUsed;
      entries[state.index].NewImplementAddress =
        ethers.getAddress(NEW_IMPL_ADDRESS);
      entries[state.index].NewImplementAddressDeployAt = newImplDeployAt;

      fs.writeFileSync(jsonPath, JSON.stringify(entries, null, 2) + '\n');

      success++;
      results.push({
        name: state.entry.Name,
        proxy: state.entry.GachaProxyAddress,
        status: 'success',
        tx: tx.hash,
        gas: gasUsed,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`   ❌ Failed: ${msg}`);
      failed++;
      results.push({
        name: state.entry.Name,
        proxy: state.entry.GachaProxyAddress,
        status: 'failed',
        error: msg,
      });
    }
  }

  // ---------------------------------------------------------------------
  // Save report + final summary
  // ---------------------------------------------------------------------
  const reportPath = path.join(
    process.cwd(),
    'deployInfo',
    `gacha-upgrade-polygon-${Date.now()}.json`
  );
  const report = {
    network: network.name,
    deployer: deployer.address,
    newImplAddress: ethers.getAddress(NEW_IMPL_ADDRESS),
    newImplDeployAt,
    timestamp: new Date().toISOString(),
    summary: {
      total: entries.length,
      ready: ready.length,
      success,
      failed,
      skipped,
      noRole,
      invalid,
    },
    results,
  };
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');

  console.log('\n📊 FINAL REPORT');
  console.log('===============');
  console.log(`Total entries:  ${entries.length}`);
  console.log(`Ready (tried):  ${ready.length}`);
  console.log(`✅ Success:     ${success}`);
  console.log(`💥 Failed:      ${failed}`);
  console.log(`⏭️  Skipped:     ${skipped} (already V3)`);
  console.log(`🔒 No role:     ${noRole}`);
  console.log(`❌ Invalid:     ${invalid}`);
  console.log(`\nReport saved:  ${reportPath}`);
  console.log(`JSON updated:  ${jsonPath}`);

  if (failed > 0) {
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('💥 UPGRADE FAILED:', error);
    process.exit(1);
  });
