/**
 * Deploy a single ChallengeHIIT instance on Kaia mainnet, then verify it
 * on Kaiascan.
 *
 * Mirrors deploy-challenge-base-step-kaia.ts: reads the `deployHiit` block
 * from scripts/contract/kaia.json, overrides primaryRequired[1] (startTime)
 * = now and primaryRequired[2] (endTime) = now + 30 days.
 *
 * HIIT constructor takes 11 args (no walkingSpeedData / hiitData). Its
 * primaryRequired has 6 elements:
 *   [duration, startTime, endTime, highIntensityIntervals,
 *    totalHighIntensityTime, dayRequired]
 *
 * allowGiveUp[1] = true → requires msg.value == totalAmount (native KAIA).
 *
 * Run:
 *   npm run deploy:challenge-hiit:kaia
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { ethers, network, run } from 'hardhat';

const KAIA_JSON_PATH = path.join(
  process.cwd(),
  'scripts',
  'contract',
  'kaia.json'
);

async function main() {
  console.log('🚀 CHALLENGE HIIT — DEPLOY ON KAIA MAINNET');
  console.log('===========================================');

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
  const cfg = kaiaJson.deployHiit;
  if (!cfg) {
    console.error('❌ kaia.json missing "deployHiit" block');
    process.exit(1);
  }
  if (!cfg.primaryRequired || cfg.primaryRequired.length !== 6) {
    console.error(
      '❌ deployHiit.primaryRequired must have 6 elements: [duration, startTime, endTime, highIntensityIntervals, totalHighIntensityTime, dayRequired]'
    );
    process.exit(1);
  }
  const now = Math.floor(Date.now() / 1000);
  const endTime = now + 30 * 24 * 3600;
  cfg.primaryRequired[1] = now;
  cfg.primaryRequired[2] = endTime;

  const totalAmount = BigInt(cfg.totalAmount);

  // Constructor args (11) — used for BOTH deploy and verify.
  const args: any[] = [
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
  ];

  console.log('\n📋 ARGS');
  console.log('=======');
  console.log(`stakeHolders:                ${JSON.stringify(cfg.stakeHolders)}`);
  console.log(`createByToken:               ${cfg.createByToken}`);
  console.log(`erc721Addresses:             ${JSON.stringify(cfg.erc721Addresses)}`);
  console.log(`primaryRequired:             ${JSON.stringify(cfg.primaryRequired)}`);
  console.log(`  [duration]               = ${cfg.primaryRequired[0]} days`);
  console.log(`  [startTime]              = ${cfg.primaryRequired[1]} (${new Date(cfg.primaryRequired[1] * 1000).toISOString()})`);
  console.log(`  [endTime]                = ${cfg.primaryRequired[2]} (${new Date(cfg.primaryRequired[2] * 1000).toISOString()})`);
  console.log(`  [highIntensityIntervals] = ${cfg.primaryRequired[3]}`);
  console.log(`  [totalHighIntensityTime] = ${cfg.primaryRequired[4]} s`);
  console.log(`  [dayRequired]            = ${cfg.primaryRequired[5]}`);
  console.log(`awardReceivers:              ${JSON.stringify(cfg.awardReceivers)}`);
  console.log(`index:                       ${cfg.index}`);
  console.log(`allowGiveUp:                 ${JSON.stringify(cfg.allowGiveUp)}`);
  console.log(`gasData:                     ${JSON.stringify(cfg.gasData)}`);
  console.log(`allAwardToSponsorWhenGiveUp: ${cfg.allAwardToSponsorWhenGiveUp}`);
  console.log(`awardReceiversPercent:       ${JSON.stringify(cfg.awardReceiversPercent)}`);
  console.log(`totalAmount:                 ${cfg.totalAmount} wei (${ethers.formatEther(totalAmount)} KAIA)`);
  console.log(`msg.value:                   ${totalAmount.toString()} wei (allowGiveUp[1]=true → required)`);

  console.log('\n🏗️  DEPLOYING ChallengeHIIT');
  const Factory = await ethers.getContractFactory('ChallengeHIIT');

  const tx = await Factory.deploy(...args, { value: totalAmount });

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
  // Public Kaia RPC is load-balanced; the read can hit a node that hasn't
  // synced the grant tx yet → poll a few times before giving up.
  let granted = false;
  for (let i = 0; i < 10 && !granted; i++) {
    granted = await esn.hasRole(role, address);
    if (!granted) await new Promise(r => setTimeout(r, 3000));
  }
  console.log(`     tx:      ${grantTx.hash}`);
  console.log(`     gas:     ${grantRcpt?.gasUsed?.toString()}`);
  console.log(`     hasRole: ${granted}`);
  if (!granted) {
    console.error('❌ Role not granted after tx (after retries)');
    process.exit(1);
  }

  // Verify on Kaiascan (uses APIKEY_KAIA + kaia customChains in hardhat.config).
  console.log('\n🔍 VERIFYING on Kaiascan...');
  let verified = false;
  try {
    await dTx?.wait(5); // wait for confirmations before verify
    await run('verify:verify', {
      address,
      constructorArguments: args,
    });
    verified = true;
    console.log('✅ Verified on Kaiascan');
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    if (/already verified/i.test(msg)) {
      verified = true;
      console.log('✅ Already verified');
    } else {
      console.warn('⚠️  Verify failed (deploy OK, re-verify later):', msg);
    }
  }

  // Update kaia.json
  kaiaJson.ChallengeHIIT = address;
  fs.writeFileSync(KAIA_JSON_PATH, JSON.stringify(kaiaJson, null, 4) + '\n');
  console.log(`\n💾 kaia.json: ChallengeHIIT = ${address}`);

  // Audit
  const auditPath = path.join(
    process.cwd(),
    'deployInfo',
    'challenge-hiit-kaia.json'
  );
  fs.writeFileSync(
    auditPath,
    JSON.stringify(
      {
        network: network.name,
        chainId: '8217',
        contractName: 'ChallengeHIIT',
        address,
        deployer: deployer.address,
        deploymentTime: new Date().toISOString(),
        blockNumber: receipt?.blockNumber ?? null,
        transactionHash: dTx?.hash ?? '',
        gasUsed: receipt?.gasUsed?.toString() ?? '',
        msgValue: totalAmount.toString(),
        constructorArgs: cfg,
        grantRoleTx: grantTx.hash,
        verified,
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
