import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { ethers, network, run } from 'hardhat';

const MIN_BALANCE_MATIC = '0.5';
const GAS_BUFFER_PERCENT = 20;
const CONFIRMATION_BLOCKS = 5;
const POLYGONSCAN_URL = 'https://polygonscan.com/address/';

async function main() {
  console.log('🚀 GACHA IMPLEMENTATION DEPLOYMENT');
  console.log('===================================');

  // ---------------------------------------------------------------------
  // 0. Network guard — script is polygon-only by design
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
  // 1. Pre-deployment checks
  // ---------------------------------------------------------------------
  console.log('\n🔍 PRE-DEPLOYMENT CHECKS');
  console.log('========================');

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

  const ContractFactory = await ethers.getContractFactory('Gacha');
  console.log('✅ Gacha artifact loaded');

  // ---------------------------------------------------------------------
  // 2. Gas estimate
  // ---------------------------------------------------------------------
  console.log('\n⛽ GAS ESTIMATE');
  console.log('===============');

  const unsignedTx = await ContractFactory.getDeployTransaction();
  const estimatedGas = await deployer.estimateGas(unsignedTx);
  const feeData = await ethers.provider.getFeeData();
  const fallbackGasPrice = ethers.parseUnits('40', 'gwei');
  const gasPrice = feeData.gasPrice ?? fallbackGasPrice;
  const estCostWei = estimatedGas * gasPrice;

  console.log(`Estimated gas:    ${estimatedGas.toString()}`);
  console.log(`Gas price:        ${ethers.formatUnits(gasPrice, 'gwei')} gwei`);
  console.log(`Estimated cost:   ${ethers.formatEther(estCostWei)} MATIC`);

  if (balance < estCostWei * 2n) {
    console.warn(
      `⚠️  Balance (${ethers.formatEther(balance)} MATIC) is less than 2x estimated cost. Proceeding anyway.`
    );
  }

  const gasLimit = Math.ceil(
    Number(estimatedGas) * (1 + GAS_BUFFER_PERCENT / 100)
  );
  console.log(`Gas limit (+${GAS_BUFFER_PERCENT}% buffer): ${gasLimit}`);

  console.log('\n⏸  Sleeping 10s before broadcasting — Ctrl+C now to abort.');
  await new Promise(resolve => setTimeout(resolve, 10_000));

  // ---------------------------------------------------------------------
  // 3. Deploy
  // ---------------------------------------------------------------------
  console.log('\n🏗️  DEPLOYING');
  console.log('=============');

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

  // Verify code exists at address
  const deployedCode = await ethers.provider.getCode(contractAddress);
  if (deployedCode === '0x') {
    console.error('❌ Deployment failed — no code at address');
    process.exit(1);
  }
  console.log('✅ On-chain code present');

  // ---------------------------------------------------------------------
  // 4. Verify source on Polygonscan
  // ---------------------------------------------------------------------
  console.log('\n🔍 VERIFY ON POLYGONSCAN');
  console.log('========================');

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
  // 5. Save deployment info
  // ---------------------------------------------------------------------
  console.log('\n💾 SAVING DEPLOYMENT INFO');
  console.log('=========================');

  const deployReceipt = await deployTx?.wait();
  const deploymentInfo = {
    network: network.name,
    contractName: 'Gacha',
    role: 'implementation',
    contractAddress,
    deployer: deployer.address,
    deploymentTime: new Date().toISOString(),
    blockNumber: deployReceipt?.blockNumber ?? null,
    transactionHash: deployTx?.hash ?? null,
    gasUsed: deployReceipt?.gasUsed?.toString() ?? null,
    gasLimit,
    estimatedGas: estimatedGas.toString(),
    gasPriceGwei: ethers.formatUnits(gasPrice, 'gwei'),
    estimatedCostMatic: ethers.formatEther(estCostWei),
    verification: {
      verified,
      explorerUrl: `${POLYGONSCAN_URL}${contractAddress}`,
    },
  };

  const outputPath = path.join(
    process.cwd(),
    'deployInfo',
    `gacha-impl-${network.name}.json`
  );
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(deploymentInfo, null, 2) + '\n');
  console.log(`✅ Saved to ${outputPath}`);

  // ---------------------------------------------------------------------
  // 6. Report
  // ---------------------------------------------------------------------
  console.log('\n📊 DEPLOYMENT REPORT');
  console.log('====================');
  console.log(`Network:           ${network.name}`);
  console.log(`Contract:          Gacha (implementation)`);
  console.log(`Address:           ${contractAddress}`);
  console.log(`Deployer:          ${deployer.address}`);
  console.log(`Block:             ${deploymentInfo.blockNumber}`);
  console.log(`Tx hash:           ${deploymentInfo.transactionHash}`);
  console.log(`Gas used:          ${deploymentInfo.gasUsed}`);
  console.log(`Gas limit:         ${gasLimit}`);
  console.log(`Gas price:         ${deploymentInfo.gasPriceGwei} gwei`);
  console.log(`Verified:          ${verified ? 'yes' : 'no'}`);
  console.log(`Explorer:          ${deploymentInfo.verification.explorerUrl}`);

  console.log('\n🎉 IMPLEMENTATION DEPLOYED');
  console.log('==========================');
  console.log('Next steps (run manually, not from this script):');
  console.log(
    `  1. For each proxy in docs/contractAddress/gachaAddress.json that has`
  );
  console.log(`     UPGRADER_ROLE granted to ${deployer.address}, call:`);
  console.log(`       proxy.upgradeTo(${contractAddress})`);
  console.log(
    `  2. Re-run scripts/gacha/get-gacha-implementation.ts to refresh JSON.`
  );
  console.log(
    `  3. Grant CLOSE_GACHA_ROLE to keeper/BACKEND wallet if it differs from`
  );
  console.log(
    `     ${deployer.address}, otherwise withdrawBalances will revert.`
  );
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('💥 DEPLOYMENT FAILED:', error);
    process.exit(1);
  });
