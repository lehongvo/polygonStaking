/**
 * Deploy ExerciseSupplementNFT UUPS proxy on Kairos testnet (Kaia).
 *
 * The proxy is what the BACKEND `networks.nft_contract_address` column should
 * point to. The implementation contract is co-deployed automatically by
 * `upgrades.deployProxy`.
 *
 * Run:
 *   npm run deploy:exercise-proxy:kairos
 *
 * Initializer args (see contracts/ExerciseSupplementNFT.sol:initialize):
 *   _initBaseURI         - empty string, set later via setBaseURI()
 *   _donationWalletAddress - deployer (testnet placeholder)
 *   _feeSettingAddress     - deployer (testnet placeholder; real FeeSetting
 *                            contract needed before challenge deploys work)
 *   _returnedNFTWallet     - deployer (testnet placeholder)
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { ethers, upgrades, network } from 'hardhat';

const MIN_BALANCE_KAIA = '1.0';

async function main() {
  console.log('🚀 EXERCISE SUPPLEMENT NFT — UUPS PROXY DEPLOY ON KAIROS');
  console.log('=========================================================');

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

  if (balance < ethers.parseEther(MIN_BALANCE_KAIA)) {
    console.error(
      `❌ Need at least ${MIN_BALANCE_KAIA} KAIA — faucet at https://faucet.kaia.io`
    );
    process.exit(1);
  }

  console.log('\n🏗️  STEP 1 — DEPLOYING UUPS PROXY');
  console.log('==================================');

  const Factory = await ethers.getContractFactory(
    'contracts/ExerciseSupplementNFT.sol:ExerciseSupplementNFT'
  );

  // Testnet placeholder values — replace via setBaseURI / role-grant after deploy.
  const initBaseURI = '';
  const donationWallet = deployer.address;
  const feeSettingAddress = deployer.address;
  const returnedNFTWallet = deployer.address;

  console.log('⏳ Calling upgrades.deployProxy (kind: uups)...');
  console.log(`   initBaseURI:       "${initBaseURI}"`);
  console.log(`   donationWallet:    ${donationWallet}`);
  console.log(`   feeSettingAddress: ${feeSettingAddress}  (placeholder)`);
  console.log(`   returnedNFTWallet: ${returnedNFTWallet}`);

  const proxy = await upgrades.deployProxy(
    Factory,
    [initBaseURI, donationWallet, feeSettingAddress, returnedNFTWallet],
    { initializer: 'initialize', kind: 'uups' }
  );

  await proxy.waitForDeployment();
  const proxyAddress = await proxy.getAddress();
  console.log(`\n✅ Proxy deployed at:          ${proxyAddress}`);

  const implAddress =
    await upgrades.erc1967.getImplementationAddress(proxyAddress);
  console.log(`📋 Implementation address:     ${implAddress}`);

  const deployTx = proxy.deploymentTransaction();
  const receipt = await deployTx?.wait();
  console.log(`⛓  Tx hash:                    ${deployTx?.hash}`);
  console.log(`📦 Block:                      ${receipt?.blockNumber}`);
  console.log(`⛽ Gas used:                   ${receipt?.gasUsed?.toString()}`);

  // ---------------------------------------------------------------------
  // Save audit trail
  // ---------------------------------------------------------------------
  const deploymentInfo = {
    network: network.name,
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    contractName: 'ExerciseSupplementNFT',
    proxyAddress,
    implementationAddress: implAddress,
    deployer: deployer.address,
    deploymentTime: new Date().toISOString(),
    blockNumber: receipt?.blockNumber ?? null,
    transactionHash: deployTx?.hash ?? '',
    gasUsed: receipt?.gasUsed?.toString() ?? '',
    initArgs: {
      initBaseURI,
      donationWallet,
      feeSettingAddress,
      returnedNFTWallet,
    },
    explorerUrl:
      network.name === 'kairos'
        ? `https://kairos.kaiascan.io/address/${proxyAddress}`
        : `https://kaiascan.io/address/${proxyAddress}`,
  };

  const auditPath = path.join(
    process.cwd(),
    'deployInfo',
    `exercise-supplement-proxy-${network.name}.json`
  );
  fs.mkdirSync(path.dirname(auditPath), { recursive: true });
  fs.writeFileSync(auditPath, JSON.stringify(deploymentInfo, null, 2) + '\n');
  console.log(`\n💾 Audit trail saved to ${auditPath}`);

  // Update scripts/contract/kaia.json with proxy + impl addresses
  if (network.name === 'kaia') {
    const kaiaJsonPath = path.join(
      process.cwd(),
      'scripts',
      'contract',
      'kaia.json'
    );
    const kaiaJson = JSON.parse(fs.readFileSync(kaiaJsonPath, 'utf8'));
    kaiaJson.ExerciseSupplementNFTProxyAddress = proxyAddress;
    kaiaJson.ExerciseSupplementNFTImplementContract = implAddress;
    fs.writeFileSync(
      kaiaJsonPath,
      JSON.stringify(kaiaJson, null, 4) + '\n'
    );
    console.log(`💾 Updated ${kaiaJsonPath}`);
  }

  console.log('\n📊 DEPLOYMENT REPORT');
  console.log('====================');
  console.log(`Proxy:           ${proxyAddress}`);
  console.log(`Implementation:  ${implAddress}`);
  console.log(`Explorer:        ${deploymentInfo.explorerUrl}`);
  console.log('\n📝 NEXT STEPS');
  console.log(`  1. Update BACKEND networks.nft_contract_address = ${proxyAddress}`);
  console.log(`  2. (Optional) deploy a real FeeSetting contract + call`);
  console.log(`     setFeeSettingAddress(<addr>) before deploying any challenge.`);
  console.log(`  3. (Optional) call setBaseURI("<ipfs://...>") for NFT metadata.`);
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('💥 DEPLOYMENT FAILED:', err);
    process.exit(1);
  });
