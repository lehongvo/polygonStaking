import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { ethers, network, run } from 'hardhat';

const MIN_BALANCE_MATIC = '0.5';
const GAS_BUFFER_PERCENT = 20;
const CONFIRMATION_BLOCKS = 5;
const POLYGONSCAN_URL = 'https://polygonscan.com/address/';
const PRE_BROADCAST_DELAY_MS = 10_000;

interface ExerciseSupplementEntry {
  Name: string;
  Network: string;
  ExerciseSupplementNFTProxyAddress: string;
  ImplementAddress: string;
  ImplementAddressDeployAt: string;
  NewImplementAddress: string;
  NewImplementAddressDeployAt: string;
  TX: string;
  gas: string;
}

const JSON_PATH = path.join(
  process.cwd(),
  'docs',
  'contractAddress',
  'exerciseSupplementNFTAddress.json'
);

const UPGRADER_ROLE = ethers.id('UPGRADER_ROLE');

async function checkUpgraderRole(
  proxyAddress: string,
  account: string
): Promise<boolean> {
  const proxy = await ethers.getContractAt(
    'ExerciseSupplementNFT',
    proxyAddress
  );
  return await proxy.hasRole(UPGRADER_ROLE, account);
}

async function main() {
  console.log('🚀 EXERCISE SUPPLEMENT NFT — IMPLEMENTATION DEPLOYMENT');
  console.log('======================================================');

  // ---------------------------------------------------------------------
  // 0. Network guard
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

  // ---------------------------------------------------------------------
  // 1. Pre-deployment checks (owner + balance)
  // ---------------------------------------------------------------------
  console.log('\n🔍 STEP 1 — PRE-DEPLOYMENT CHECKS');
  console.log('==================================');

  const minBalance = ethers.parseEther(MIN_BALANCE_MATIC);
  if (balance < minBalance) {
    console.error(
      `❌ Insufficient balance. Need at least ${MIN_BALANCE_MATIC} MATIC`
    );
    process.exit(1);
  }
  console.log(`✅ Balance >= ${MIN_BALANCE_MATIC} MATIC`);

  const apiKey =
    process.env.ETHERSCAN_API_KEY ?? process.env.POLYGONSCAN_API_KEY;
  if (!apiKey) {
    console.error(
      '❌ Missing API key — set ETHERSCAN_API_KEY or POLYGONSCAN_API_KEY in .env'
    );
    process.exit(1);
  }
  console.log('✅ Block explorer API key present');

  if (!fs.existsSync(JSON_PATH)) {
    console.error(`❌ Address file not found: ${JSON_PATH}`);
    process.exit(1);
  }
  const entries: ExerciseSupplementEntry[] = JSON.parse(
    fs.readFileSync(JSON_PATH, 'utf8')
  );
  console.log(`✅ Loaded ${entries.length} proxy entries from JSON`);

  // Sanity: warn if NewImplementAddress already filled (avoid silent overwrite)
  const filledEntries = entries.filter(
    e => e.Network === 'polygon' && e.NewImplementAddress
  );
  if (filledEntries.length > 0) {
    console.warn(
      `⚠️  ${filledEntries.length} entries already have NewImplementAddress — those slots will be SKIPPED in JSON write`
    );
    for (const e of filledEntries) {
      console.warn(`   - ${e.Name}: ${e.NewImplementAddress}`);
    }
  }

  // Bonus: check UPGRADER_ROLE on each polygon proxy (read-only, informational)
  console.log('\n🔐 UPGRADER_ROLE check on proxies:');
  for (const entry of entries) {
    if (entry.Network !== 'polygon') continue;
    try {
      const has = await checkUpgraderRole(
        entry.ExerciseSupplementNFTProxyAddress,
        deployer.address
      );
      const tag = `${entry.Name} (${entry.ExerciseSupplementNFTProxyAddress})`;
      if (has) {
        console.log(`   ✅ ${tag} — deployer HAS UPGRADER_ROLE`);
      } else {
        console.warn(
          `   ⚠️  ${tag} — deployer does NOT have UPGRADER_ROLE (cannot upgrade later)`
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(
        `   ⚠️  ${entry.Name} — role check failed: ${msg} (continuing)`
      );
    }
  }

  const ContractFactory = await ethers.getContractFactory('ExerciseSupplementNFT');
  console.log('\n✅ ExerciseSupplementNFT artifact loaded');

  // ---------------------------------------------------------------------
  // 2. Gas estimate (must be <= balance)
  // ---------------------------------------------------------------------
  console.log('\n⛽ STEP 2 — GAS ESTIMATE');
  console.log('========================');

  const unsignedTx = await ContractFactory.getDeployTransaction();
  const estimatedGas = await deployer.estimateGas(unsignedTx);
  const feeData = await ethers.provider.getFeeData();
  const fallbackGasPrice = ethers.parseUnits('40', 'gwei');
  const gasPrice = feeData.gasPrice ?? fallbackGasPrice;
  const estCostWei = estimatedGas * gasPrice;

  console.log(`Estimated gas:    ${estimatedGas.toString()}`);
  console.log(`Gas price:        ${ethers.formatUnits(gasPrice, 'gwei')} gwei`);
  console.log(`Estimated cost:   ${ethers.formatEther(estCostWei)} MATIC`);
  console.log(`Wallet balance:   ${ethers.formatEther(balance)} MATIC`);

  if (balance < estCostWei) {
    console.error(
      `❌ Balance (${ethers.formatEther(balance)} MATIC) < estimated cost (${ethers.formatEther(estCostWei)} MATIC). Aborting.`
    );
    process.exit(1);
  }
  console.log('✅ Balance >= estimated cost');

  if (balance < estCostWei * 2n) {
    console.warn(
      `⚠️  Balance is less than 2x estimated cost. Proceeding anyway.`
    );
  }

  const gasLimit = Math.ceil(
    Number(estimatedGas) * (1 + GAS_BUFFER_PERCENT / 100)
  );
  console.log(`Gas limit (+${GAS_BUFFER_PERCENT}% buffer): ${gasLimit}`);

  console.log(
    `\n⏸  Sleeping ${PRE_BROADCAST_DELAY_MS / 1000}s before broadcasting — Ctrl+C now to abort.`
  );
  await new Promise(resolve => setTimeout(resolve, PRE_BROADCAST_DELAY_MS));

  // ---------------------------------------------------------------------
  // 3. Deploy
  // ---------------------------------------------------------------------
  console.log('\n🏗️  STEP 3 — DEPLOYING');
  console.log('======================');

  const overrides =
    feeData.maxFeePerGas && feeData.maxPriorityFeePerGas
      ? {
          gasLimit,
          maxFeePerGas: feeData.maxFeePerGas,
          maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
        }
      : { gasLimit, gasPrice };

  console.log('⏳ Sending deployment transaction...');
  const contract = await ContractFactory.deploy(overrides);
  const deployTx = contract.deploymentTransaction();
  console.log(`Tx hash: ${deployTx?.hash}`);

  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();
  console.log(`✅ Contract deployed at: ${contractAddress}`);

  const deployedCode = await ethers.provider.getCode(contractAddress);
  if (deployedCode === '0x') {
    console.error('❌ Deployment failed — no code at address');
    process.exit(1);
  }
  console.log('✅ On-chain code present');

  const deployReceipt = await deployTx?.wait();
  const gasUsed = deployReceipt?.gasUsed?.toString() ?? '';
  const txHash = deployTx?.hash ?? '';
  const deployedAt = new Date().toISOString();

  // ---------------------------------------------------------------------
  // 4. Save NewImplementAddress to JSON
  // ---------------------------------------------------------------------
  console.log('\n💾 STEP 4 — SAVE NewImplementAddress TO JSON');
  console.log('=============================================');

  let written = 0;
  let skipped = 0;
  for (const entry of entries) {
    if (entry.Network !== 'polygon') {
      console.log(`   ⏭️  ${entry.Name} — non-polygon, skip`);
      skipped++;
      continue;
    }
    if (entry.NewImplementAddress) {
      console.log(
        `   ⏭️  ${entry.Name} — NewImplementAddress already set (${entry.NewImplementAddress}), skip to avoid overwrite`
      );
      skipped++;
      continue;
    }
    entry.NewImplementAddress = contractAddress;
    entry.NewImplementAddressDeployAt = deployedAt;
    entry.TX = txHash;
    entry.gas = gasUsed;
    written++;
    console.log(`   ✅ ${entry.Name} — filled NewImplementAddress`);
  }

  fs.writeFileSync(JSON_PATH, JSON.stringify(entries, null, 2) + '\n');
  console.log(
    `\n📊 JSON updated — written: ${written}, skipped: ${skipped}`
  );
  console.log(`💾 Saved to ${JSON_PATH}`);

  // ---------------------------------------------------------------------
  // 5. Verify source on Polygonscan
  // ---------------------------------------------------------------------
  console.log('\n🔍 STEP 5 — VERIFY SOURCE ON POLYGONSCAN');
  console.log('=========================================');

  let verified = false;
  try {
    console.log(`⏳ Waiting ${CONFIRMATION_BLOCKS} confirmations...`);
    await deployTx?.wait(CONFIRMATION_BLOCKS);

    console.log('⏳ Submitting source for verification...');
    await run('verify:verify', {
      address: contractAddress,
      constructorArguments: [],
    });
    console.log('✅ Source verified on Polygonscan');
    verified = true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.toLowerCase().includes('already verified')) {
      console.log('✅ Source already verified on Polygonscan');
      verified = true;
    } else {
      console.warn(`⚠️  Verification failed: ${msg}`);
      console.warn(
        `   Manual: npx hardhat verify --network polygon ${contractAddress}`
      );
    }
  }

  // ---------------------------------------------------------------------
  // 6. Save audit-trail deployment info
  // ---------------------------------------------------------------------
  const deploymentInfo = {
    network: network.name,
    contractName: 'ExerciseSupplementNFT',
    role: 'implementation',
    contractAddress,
    deployer: deployer.address,
    deploymentTime: deployedAt,
    blockNumber: deployReceipt?.blockNumber ?? null,
    transactionHash: txHash,
    gasUsed,
    gasLimit,
    estimatedGas: estimatedGas.toString(),
    gasPriceGwei: ethers.formatUnits(gasPrice, 'gwei'),
    estimatedCostMatic: ethers.formatEther(estCostWei),
    verification: {
      verified,
      explorerUrl: `${POLYGONSCAN_URL}${contractAddress}`,
    },
  };

  const auditPath = path.join(
    process.cwd(),
    'deployInfo',
    `exercise-supplement-impl-${network.name}.json`
  );
  fs.mkdirSync(path.dirname(auditPath), { recursive: true });
  fs.writeFileSync(auditPath, JSON.stringify(deploymentInfo, null, 2) + '\n');
  console.log(`\n💾 Audit trail saved to ${auditPath}`);

  // ---------------------------------------------------------------------
  // 7. Report
  // ---------------------------------------------------------------------
  console.log('\n📊 DEPLOYMENT REPORT');
  console.log('====================');
  console.log(`Network:           ${network.name}`);
  console.log(`Contract:          ExerciseSupplementNFT (implementation)`);
  console.log(`Address:           ${contractAddress}`);
  console.log(`Deployer:          ${deployer.address}`);
  console.log(`Block:             ${deploymentInfo.blockNumber}`);
  console.log(`Tx hash:           ${txHash}`);
  console.log(`Gas used:          ${gasUsed}`);
  console.log(`Gas limit:         ${gasLimit}`);
  console.log(`Gas price:         ${deploymentInfo.gasPriceGwei} gwei`);
  console.log(`Verified:          ${verified ? 'yes' : 'no'}`);
  console.log(`Explorer:          ${deploymentInfo.verification.explorerUrl}`);

  console.log('\n🎉 IMPLEMENTATION DEPLOYED');
  console.log('==========================');
  console.log('Next steps (run manually, NOT from this script):');
  console.log(
    `  1. Review the new implementation at ${deploymentInfo.verification.explorerUrl}`
  );
  console.log(
    `  2. For each proxy in docs/contractAddress/exerciseSupplementNFTAddress.json,`
  );
  console.log(`     ensure deployer has UPGRADER_ROLE then call:`);
  console.log(`       proxy.upgradeTo(${contractAddress})`);
  console.log(
    `  3. Immediately call updateSecurityAddress(<signer>) on each upgraded proxy.`
  );
  console.log(
    `  4. Re-run scripts/exerciseSupplementNFT/get-implementation.ts to refresh JSON.`
  );
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('💥 DEPLOYMENT FAILED:', error);
    process.exit(1);
  });
