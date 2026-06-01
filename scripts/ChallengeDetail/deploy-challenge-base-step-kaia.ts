/**
 * Deploy a single ChallengeBaseStep instance on Kaia mainnet.
 *
 * Reads `deploy` block from scripts/contract/kaia.json, but overrides
 * primaryRequired[1] (startTime) = now and primaryRequired[2] (endTime)
 * = now + 30 days per Vincent's instruction.
 *
 * allowGiveUp[1] = true → requires msg.value == totalAmount, paid in
 * native KAIA.
 *
 * Run:
 *   npm run deploy:challenge-base-step:kaia
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
  console.log('🚀 CHALLENGE BASE STEP — DEPLOY ON KAIA MAINNET');
  console.log('================================================');

  if (network.name !== 'kaia') {
    console.error(`❌ Only 'kaia', got '${network.name}'`);
    process.exit(1);
  }

  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`📍 Network:  ${network.name}`);
  console.log(`👤 Deployer: ${deployer.address}`);
  console.log(`💰 Balance:  ${ethers.formatEther(balance)} KAIA`);

  // Load config + override timestamps
  const kaiaJson = JSON.parse(fs.readFileSync(KAIA_JSON_PATH, 'utf8'));
  const cfg = kaiaJson.deploy;
  if (!cfg) {
    console.error('❌ kaia.json missing "deploy" block');
    process.exit(1);
  }
  const now = Math.floor(Date.now() / 1000);
  const endTime = now + 30 * 24 * 3600;
  cfg.primaryRequired[1] = now;
  cfg.primaryRequired[2] = endTime;

  const totalAmount = BigInt(cfg.totalAmount);

  console.log('\n📋 ARGS');
  console.log('=======');
  console.log(`stakeHolders:                ${JSON.stringify(cfg.stakeHolders)}`);
  console.log(`createByToken:               ${cfg.createByToken}`);
  console.log(`erc721Addresses:             ${JSON.stringify(cfg.erc721Addresses)}`);
  console.log(`primaryRequired:             ${JSON.stringify(cfg.primaryRequired)}`);
  console.log(`  [duration]      = ${cfg.primaryRequired[0]} days`);
  console.log(`  [startTime]     = ${cfg.primaryRequired[1]} (${new Date(cfg.primaryRequired[1] * 1000).toISOString()})`);
  console.log(`  [endTime]       = ${cfg.primaryRequired[2]} (${new Date(cfg.primaryRequired[2] * 1000).toISOString()})`);
  console.log(`  [goal]          = ${cfg.primaryRequired[3]}`);
  console.log(`  [dayRequired]   = ${cfg.primaryRequired[4]}`);
  console.log(`awardReceivers:              ${JSON.stringify(cfg.awardReceivers)}`);
  console.log(`index:                       ${cfg.index}`);
  console.log(`allowGiveUp:                 ${JSON.stringify(cfg.allowGiveUp)}`);
  console.log(`gasData:                     ${JSON.stringify(cfg.gasData)}`);
  console.log(`allAwardToSponsorWhenGiveUp: ${cfg.allAwardToSponsorWhenGiveUp}`);
  console.log(`awardReceiversPercent:       ${JSON.stringify(cfg.awardReceiversPercent)}`);
  console.log(`totalAmount:                 ${cfg.totalAmount} wei (${ethers.formatEther(totalAmount)} KAIA)`);
  console.log(`walkingSpeedData:            ${JSON.stringify(cfg.walkingSpeedData)}`);
  console.log(`hiitData:                    ${JSON.stringify(cfg.hiitData)}`);
  console.log(`msg.value:                   ${totalAmount.toString()} wei (allowGiveUp[1]=true → required)`);

  console.log('\n🏗️  DEPLOYING ChallengeBaseStep');
  const Factory = await ethers.getContractFactory('ChallengeBaseStep');

  const tx = await Factory.deploy(
    cfg.stakeHolders,
    cfg.createByToken,
    cfg.erc721Addresses,
    cfg.primaryRequired,
    cfg.awardReceivers,
    cfg.index,
    cfg.allowGiveUp,
    cfg.gasData.map((s: string) => BigInt(s)),
    cfg.allAwardToSponsorWhenGiveUp,
    cfg.awardReceiversPercent,
    totalAmount,
    cfg.walkingSpeedData,
    cfg.hiitData,
    { value: totalAmount }
  );

  await tx.waitForDeployment();
  const address = await tx.getAddress();
  const dTx = tx.deploymentTransaction();
  const receipt = await dTx?.wait();

  console.log(`\n✅ Deployed at: ${address}`);
  console.log(`⛓  Tx hash:     ${dTx?.hash}`);
  console.log(`📦 Block:       ${receipt?.blockNumber}`);
  console.log(`⛽ Gas used:    ${receipt?.gasUsed?.toString()}`);

  // Grant ALLOWED_CONTRACTS_CHALLENGE on the ESN proxy so the new
  // challenge can call back into ESN during sendDailyResult.
  console.log('\n🔑 Granting ALLOWED_CONTRACTS_CHALLENGE on ESN proxy...');
  const ESN_PROXY = cfg.erc721Addresses[0];
  const esn = new ethers.Contract(
    ESN_PROXY,
    [
      'function grantRole(bytes32,address)',
      'function hasRole(bytes32,address) view returns (bool)',
      'function ALLOWED_CONTRACTS_CHALLENGE() view returns (bytes32)',
    ],
    deployer
  );
  const role = await esn.ALLOWED_CONTRACTS_CHALLENGE();
  const grantTx = await esn.grantRole(role, address);
  const grantRcpt = await grantTx.wait();
  const granted = await esn.hasRole(role, address);
  console.log(`     tx:      ${grantTx.hash}`);
  console.log(`     gas:     ${grantRcpt?.gasUsed?.toString()}`);
  console.log(`     hasRole: ${granted}`);
  if (!granted) {
    console.error('❌ Role not granted after tx');
    process.exit(1);
  }

  // Update kaia.json
  kaiaJson.ChallengeBaseStep = address;
  fs.writeFileSync(KAIA_JSON_PATH, JSON.stringify(kaiaJson, null, 4) + '\n');
  console.log(`\n💾 kaia.json: ChallengeBaseStep = ${address}`);

  // Audit
  const auditPath = path.join(
    process.cwd(),
    'deployInfo',
    'challenge-base-step-kaia.json'
  );
  fs.writeFileSync(
    auditPath,
    JSON.stringify(
      {
        network: network.name,
        chainId: '8217',
        contractName: 'ChallengeBaseStep',
        address,
        deployer: deployer.address,
        deploymentTime: new Date().toISOString(),
        blockNumber: receipt?.blockNumber ?? null,
        transactionHash: dTx?.hash ?? '',
        gasUsed: receipt?.gasUsed?.toString() ?? '',
        msgValue: totalAmount.toString(),
        constructorArgs: cfg,
        grantRoleTx: grantTx.hash,
        explorerUrl: `https://kaiascan.io/address/${address}`,
      },
      null,
      2
    ) + '\n'
  );
  console.log(`💾 Audit:     ${auditPath}`);
  console.log(`\n🔗 Explorer:  https://kaiascan.io/address/${address}`);
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('💥 DEPLOYMENT FAILED:', err);
    process.exit(1);
  });
