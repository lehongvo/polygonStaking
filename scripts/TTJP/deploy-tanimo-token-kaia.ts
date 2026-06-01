/**
 * Deploy TanimoToken (TTJP) UUPS proxy + implementation on Kaia mainnet.
 *
 *   1. Check deployer balance (min 0.2 KAIA)
 *   2. Estimate implementation deploy gas + total cost
 *   3. Deploy via upgrades.deployProxy (kind: uups)
 *   4. On-chain verify: name(), symbol(), decimals(), _owner()
 *   5. Update scripts/contract/kaia.json with proxy + impl addresses
 *   6. Save audit trail to deployInfo/tanimo-token-kaia.json
 *   7. Print Kaiascan verify commands
 *
 * Initializer args (contracts/TTJP/TanimoToken.sol:initialize):
 *   _ownerOfToken       - deployer (payable)
 *   _sizeCodeContract   - 16549 (deployed bytecode size of ChallengeBaseStep)
 *
 * Run:
 *   npm run deploy:ttjp:kaia
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { ethers, upgrades, network } from 'hardhat';

const MIN_BALANCE_KAIA = '0.2';
const SIZE_CODE_CONTRACT = 16549n;
const KAIA_JSON_PATH = path.join(
  process.cwd(),
  'scripts',
  'contract',
  'kaia.json'
);

async function main() {
  console.log('🚀 TANIMO TOKEN (TTJP) — UUPS PROXY DEPLOY ON KAIA MAINNET');
  console.log('==========================================================');

  if (network.name !== 'kaia') {
    console.error(
      `❌ This script only supports network 'kaia' (mainnet), got '${network.name}'`
    );
    process.exit(1);
  }

  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  const feeData = await ethers.provider.getFeeData();

  console.log(`📍 Network:   ${network.name} (chainId 8217)`);
  console.log(`👤 Deployer:  ${deployer.address}`);
  console.log(`💰 Balance:   ${ethers.formatEther(balance)} KAIA`);
  console.log(
    `⛽ gasPrice:  ${ethers.formatUnits(feeData.gasPrice ?? 0n, 'gwei')} gwei`
  );

  if (balance < ethers.parseEther(MIN_BALANCE_KAIA)) {
    console.error(
      `❌ Need at least ${MIN_BALANCE_KAIA} KAIA — current ${ethers.formatEther(balance)}`
    );
    process.exit(1);
  }

  // -------------------------------------------------------------------
  // STEP 1 — Pre-flight gas estimate (implementation deploy only;
  //          deployProxy adds ~150k for ERC1967Proxy + init call)
  // -------------------------------------------------------------------
  console.log('\n📊 STEP 1 — GAS ESTIMATE');
  console.log('=========================');
  const Factory = await ethers.getContractFactory('TanimoToken');
  const implDeployTx = await Factory.getDeployTransaction();
  const implGas = await ethers.provider.estimateGas(implDeployTx);
  const proxyGasEst = 250_000n; // ERC1967Proxy + initialize
  const totalGas = implGas + proxyGasEst;
  const gasPrice = feeData.gasPrice ?? ethers.parseUnits('25', 'gwei');
  const estCost = totalGas * gasPrice;
  console.log(`   Impl deploy:  ~${implGas.toString()} gas`);
  console.log(`   Proxy + init: ~${proxyGasEst.toString()} gas (estimate)`);
  console.log(`   Total est.:   ~${totalGas.toString()} gas`);
  console.log(`   Est. cost:    ~${ethers.formatEther(estCost)} KAIA`);

  if (estCost > balance) {
    console.error(
      `❌ Estimated cost ${ethers.formatEther(estCost)} > balance ${ethers.formatEther(balance)}`
    );
    process.exit(1);
  }

  // -------------------------------------------------------------------
  // STEP 2 — Deploy UUPS proxy + implementation
  // -------------------------------------------------------------------
  console.log('\n🏗️  STEP 2 — DEPLOYING UUPS PROXY');
  console.log('==================================');
  console.log('   Initializer args:');
  console.log(`     _ownerOfToken:     ${deployer.address}`);
  console.log(`     _sizeCodeContract: ${SIZE_CODE_CONTRACT.toString()}`);

  console.log('\n⏳ Calling upgrades.deployProxy (kind: uups)...');
  const proxy = await upgrades.deployProxy(
    Factory,
    [deployer.address, SIZE_CODE_CONTRACT],
    { initializer: 'initialize', kind: 'uups' }
  );
  await proxy.waitForDeployment();

  const proxyAddress = await proxy.getAddress();
  const implAddress =
    await upgrades.erc1967.getImplementationAddress(proxyAddress);
  const deployTx = proxy.deploymentTransaction();
  const receipt = await deployTx?.wait();

  console.log(`\n✅ Proxy deployed at:          ${proxyAddress}`);
  console.log(`📋 Implementation address:     ${implAddress}`);
  console.log(`⛓  Proxy tx hash:              ${deployTx?.hash}`);
  console.log(`📦 Block:                      ${receipt?.blockNumber}`);
  console.log(`⛽ Gas used:                   ${receipt?.gasUsed?.toString()}`);

  // -------------------------------------------------------------------
  // STEP 3 — On-chain verify
  // -------------------------------------------------------------------
  console.log('\n🔍 STEP 3 — ON-CHAIN VERIFY');
  console.log('============================');
  const tanimo = await ethers.getContractAt('TanimoToken', proxyAddress);
  const onchainName = await tanimo.name();
  const onchainSymbol = await tanimo.symbol();
  const onchainDecimals = await tanimo.decimals();
  const onchainOwner = await tanimo._owner();
  console.log(`   name():     "${onchainName}"`);
  console.log(`   symbol():   "${onchainSymbol}"`);
  console.log(`   decimals(): ${onchainDecimals}`);
  console.log(`   _owner():   ${onchainOwner}`);

  if (onchainSymbol !== 'TTJP') {
    console.error(`❌ Symbol mismatch! Expected "TTJP", got "${onchainSymbol}"`);
    process.exit(1);
  }
  if (onchainOwner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error(
      `❌ Owner mismatch! Expected ${deployer.address}, got ${onchainOwner}`
    );
    process.exit(1);
  }
  console.log('   ✅ All on-chain reads match expected values');

  // -------------------------------------------------------------------
  // STEP 4 — Update scripts/contract/kaia.json
  // -------------------------------------------------------------------
  console.log('\n💾 STEP 4 — UPDATE kaia.json');
  console.log('=============================');
  const kaiaJson = JSON.parse(fs.readFileSync(KAIA_JSON_PATH, 'utf8'));
  kaiaJson.TTJPProxyAddress = proxyAddress;
  kaiaJson.TanimoTokenImplementContract = implAddress;
  fs.writeFileSync(
    KAIA_JSON_PATH,
    JSON.stringify(kaiaJson, null, 4) + '\n'
  );
  console.log(`   Updated ${KAIA_JSON_PATH}`);
  console.log(`     TTJPProxyAddress:              ${proxyAddress}`);
  console.log(`     TanimoTokenImplementContract:  ${implAddress}`);

  // -------------------------------------------------------------------
  // STEP 5 — Save audit trail
  // -------------------------------------------------------------------
  const deploymentInfo = {
    network: network.name,
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    contractName: 'TanimoToken',
    proxyAddress,
    implementationAddress: implAddress,
    deployer: deployer.address,
    deploymentTime: new Date().toISOString(),
    blockNumber: receipt?.blockNumber ?? null,
    transactionHash: deployTx?.hash ?? '',
    gasUsed: receipt?.gasUsed?.toString() ?? '',
    initArgs: {
      _ownerOfToken: deployer.address,
      _sizeCodeContract: SIZE_CODE_CONTRACT.toString(),
    },
    onChain: {
      name: onchainName,
      symbol: onchainSymbol,
      decimals: onchainDecimals.toString(),
      owner: onchainOwner,
    },
    explorerUrl: `https://kaiascan.io/address/${proxyAddress}`,
  };

  const auditPath = path.join(
    process.cwd(),
    'deployInfo',
    `tanimo-token-${network.name}.json`
  );
  fs.mkdirSync(path.dirname(auditPath), { recursive: true });
  fs.writeFileSync(auditPath, JSON.stringify(deploymentInfo, null, 2) + '\n');
  console.log(`\n💾 Audit trail saved to ${auditPath}`);

  // -------------------------------------------------------------------
  // Final report + verify commands
  // -------------------------------------------------------------------
  console.log('\n📊 DEPLOYMENT REPORT');
  console.log('====================');
  console.log(`Proxy:           ${proxyAddress}`);
  console.log(`Implementation:  ${implAddress}`);
  console.log(`Explorer:        https://kaiascan.io/address/${proxyAddress}`);
  console.log('\n📝 NEXT STEPS — VERIFY SOURCE CODE');
  console.log('===================================');
  console.log(`  Implementation:`);
  console.log(`    npx hardhat verify --network kaia ${implAddress}`);
  console.log(`  Proxy (ERC1967Proxy):`);
  console.log(`    npx hardhat verify --network kaia ${proxyAddress}`);
  console.log(
    `  (If hardhat verify fails on Kaiascan, upload flattened source via UI:`
  );
  console.log(`   https://kaiascan.io/address/${implAddress}#code )`);
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('💥 DEPLOYMENT FAILED:', err);
    process.exit(1);
  });
