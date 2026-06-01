/**
 * Deploy JPYC ERC20 (TestToken) on Kairos testnet and register it on
 * ExerciseSupplementNFT proxy via updateListERC20Address(jpyc, true).
 *
 * Proxy auto-detects symbol "JPYC" → typeTokenErc20 = 2.
 *
 * Run:
 *   env TS_NODE_PROJECT=tsconfig.scripts.json TS_NODE_TRANSPILE_ONLY=true \
 *       NODE_OPTIONS="--no-experimental-strip-types --require=ts-node/register" \
 *       npx hardhat run scripts/exerciseSupplementNFT/deploy-jpyc-and-register-kairos.ts \
 *       --network kairos
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { ethers, network } from 'hardhat';

const PROXY_ADDRESS = '0x6E3873EaF96eF7a31A499228c54F8B69F0E95b44';
const TOKEN_NAME = 'JPYC';
const TOKEN_SYMBOL = 'JPYC';
const TOKEN_DECIMALS = 18;
const INITIAL_SUPPLY = 10_000_000n; // 10M, constructor multiplies by 10^decimals
const MIN_BALANCE_KAIA = '0.5';

async function main() {
  console.log('🚀 DEPLOY JPYC ERC20 + REGISTER ON EXERCISE SUPPLEMENT NFT (KAIROS)');
  console.log('====================================================================');

  if (network.name !== 'kairos' && network.name !== 'kaia') {
    console.error(
      `❌ This script only supports network 'kairos' or 'kaia', got '${network.name}'`
    );
    process.exit(1);
  }

  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`📍 Network:  ${network.name}`);
  console.log(`👤 Deployer: ${deployer.address}`);
  console.log(`💰 Balance:  ${ethers.formatEther(balance)} KAIA`);
  console.log(`🎯 Proxy:    ${PROXY_ADDRESS}`);

  if (balance < ethers.parseEther(MIN_BALANCE_KAIA)) {
    console.error(
      `❌ Need at least ${MIN_BALANCE_KAIA} KAIA — faucet at https://faucet.kaia.io`
    );
    process.exit(1);
  }

  // -------------------------------------------------------------------
  // STEP 1 — Deploy TestToken as JPYC
  // -------------------------------------------------------------------
  console.log('\n🏗️  STEP 1 — DEPLOYING JPYC ERC20 (TestToken)');
  console.log('==============================================');
  console.log(`   name:          "${TOKEN_NAME}"`);
  console.log(`   symbol:        "${TOKEN_SYMBOL}"`);
  console.log(`   decimals:      ${TOKEN_DECIMALS}`);
  console.log(`   initialSupply: ${INITIAL_SUPPLY} (×10^${TOKEN_DECIMALS} wei to deployer)`);

  const TestToken = await ethers.getContractFactory('TestToken');
  const jpyc = await TestToken.deploy(
    TOKEN_NAME,
    TOKEN_SYMBOL,
    TOKEN_DECIMALS,
    INITIAL_SUPPLY
  );
  await jpyc.waitForDeployment();
  const jpycAddress = await jpyc.getAddress();
  const deployTx = jpyc.deploymentTransaction();
  const deployReceipt = await deployTx?.wait();

  console.log(`\n✅ JPYC deployed at:           ${jpycAddress}`);
  console.log(`⛓  Tx hash:                    ${deployTx?.hash}`);
  console.log(`📦 Block:                      ${deployReceipt?.blockNumber}`);
  console.log(`⛽ Gas used:                   ${deployReceipt?.gasUsed?.toString()}`);

  // Verify on-chain
  const onchainSymbol = await jpyc.symbol();
  const onchainDecimals = await jpyc.decimals();
  const deployerBal = await jpyc.balanceOf(deployer.address);
  console.log(`\n🔍 On-chain verify:`);
  console.log(`   symbol():            "${onchainSymbol}"`);
  console.log(`   decimals():          ${onchainDecimals}`);
  console.log(`   balanceOf(deployer): ${ethers.formatUnits(deployerBal, onchainDecimals)} ${onchainSymbol}`);

  if (onchainSymbol !== TOKEN_SYMBOL) {
    console.error(`❌ Symbol mismatch! Expected "${TOKEN_SYMBOL}", got "${onchainSymbol}". Aborting register step.`);
    process.exit(1);
  }

  // -------------------------------------------------------------------
  // STEP 2 — Register JPYC on ExerciseSupplementNFT proxy
  // -------------------------------------------------------------------
  console.log('\n🔗 STEP 2 — REGISTERING JPYC ON PROXY');
  console.log('======================================');
  console.log(`   Proxy:        ${PROXY_ADDRESS}`);
  console.log(`   Function:     updateListERC20Address(${jpycAddress}, true)`);

  const proxy = await ethers.getContractAt('ExerciseSupplementNFT', PROXY_ADDRESS);
  const updateTx = await proxy.updateListERC20Address(jpycAddress, true);
  const updateReceipt = await updateTx.wait();

  console.log(`\n✅ updateListERC20Address tx mined`);
  console.log(`⛓  Tx hash:                    ${updateTx.hash}`);
  console.log(`📦 Block:                      ${updateReceipt?.blockNumber}`);
  console.log(`⛽ Gas used:                   ${updateReceipt?.gasUsed?.toString()}`);

  // Verify on-chain
  const typeRegistered = await proxy.typeTokenErc20(jpycAddress);
  console.log(`\n🔍 On-chain verify:`);
  console.log(`   typeTokenErc20[jpyc]: ${typeRegistered} (expected 2 for JPYC)`);

  if (typeRegistered !== 2n) {
    console.error(`❌ Type mismatch! Expected 2, got ${typeRegistered}.`);
    process.exit(1);
  }

  // -------------------------------------------------------------------
  // Save audit trail
  // -------------------------------------------------------------------
  const deploymentInfo = {
    network: network.name,
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    proxyAddress: PROXY_ADDRESS,
    jpyc: {
      address: jpycAddress,
      name: TOKEN_NAME,
      symbol: TOKEN_SYMBOL,
      decimals: TOKEN_DECIMALS,
      initialSupply: INITIAL_SUPPLY.toString(),
      registeredType: typeRegistered.toString(),
    },
    deployer: deployer.address,
    deploymentTime: new Date().toISOString(),
    deployTx: {
      hash: deployTx?.hash ?? '',
      block: deployReceipt?.blockNumber ?? null,
      gasUsed: deployReceipt?.gasUsed?.toString() ?? '',
    },
    registerTx: {
      hash: updateTx.hash,
      block: updateReceipt?.blockNumber ?? null,
      gasUsed: updateReceipt?.gasUsed?.toString() ?? '',
    },
    explorerUrl:
      network.name === 'kairos'
        ? `https://kairos.kaiascan.io/address/${jpycAddress}`
        : `https://kaiascan.io/address/${jpycAddress}`,
  };

  const auditPath = path.join(
    process.cwd(),
    'deployInfo',
    `jpyc-token-${network.name}.json`
  );
  fs.mkdirSync(path.dirname(auditPath), { recursive: true });
  fs.writeFileSync(auditPath, JSON.stringify(deploymentInfo, null, 2) + '\n');
  console.log(`\n💾 Audit trail saved to ${auditPath}`);

  console.log('\n📊 SUMMARY');
  console.log('==========');
  console.log(`JPYC token:      ${jpycAddress}`);
  console.log(`Proxy registry:  ${PROXY_ADDRESS} (type=${typeRegistered})`);
  console.log(`Explorer:        ${deploymentInfo.explorerUrl}`);
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('💥 SCRIPT FAILED:', err);
    process.exit(1);
  });
