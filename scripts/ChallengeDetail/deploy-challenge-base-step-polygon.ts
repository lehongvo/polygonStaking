/**
 * Deploy + verify a single ChallengeBaseStep instance on Polygon mainnet.
 *
 * Purpose: publish the N1-removed ChallengeBaseStep source on Polygonscan.
 * NO role grant (deployer is not ESN admin and it is not needed for a
 * verify-only deploy).
 *
 * allowGiveUp[1] = true → requires msg.value == totalAmount (native POL).
 *
 * Run:
 *   npm run deploy:challenge-base-step:polygon
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { ethers, network, run } from 'hardhat';

// Polygon ESN proxy (live, same one used by the prior Polygon HIIT deploy).
const ESN_PROXY_POLYGON = '0x55285EcCef5487E87C5980C880131aCadDE7767C';

async function main() {
  console.log('🚀 CHALLENGE BASE STEP — DEPLOY ON POLYGON MAINNET');
  console.log('==================================================');

  if (network.name !== 'polygon') {
    console.error(`❌ Only 'polygon', got '${network.name}'`);
    process.exit(1);
  }

  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`📍 Network:  ${network.name}`);
  console.log(`👤 Deployer: ${deployer.address}`);
  console.log(`💰 Balance:  ${ethers.formatEther(balance)} POL`);

  const now = Math.floor(Date.now() / 1000);
  const endTime = now + 30 * 24 * 3600;
  const d = deployer.address;

  const cfg = {
    stakeHolders: [d, d, d],
    createByToken: '0x0000000000000000000000000000000000000000',
    erc721Addresses: [ESN_PROXY_POLYGON],
    primaryRequired: [1, now, endTime, 1, 1],
    awardReceivers: [d, d],
    index: 1,
    allowGiveUp: [true, true, true],
    gasData: ['0', '0', '0'],
    allAwardToSponsorWhenGiveUp: true,
    awardReceiversPercent: [50, 50],
    totalAmount: '1000000000000',
    walkingSpeedData: [] as number[],
    hiitData: [] as number[],
  };
  const totalAmount = BigInt(cfg.totalAmount);

  console.log('\n📋 ARGS');
  console.log('=======');
  console.log(`stakeHolders:                ${JSON.stringify(cfg.stakeHolders)}`);
  console.log(`createByToken:               ${cfg.createByToken}`);
  console.log(`erc721Addresses:             ${JSON.stringify(cfg.erc721Addresses)}`);
  console.log(`primaryRequired:             ${JSON.stringify(cfg.primaryRequired)}`);
  console.log(`awardReceivers:              ${JSON.stringify(cfg.awardReceivers)}`);
  console.log(`index:                       ${cfg.index}`);
  console.log(`allowGiveUp:                 ${JSON.stringify(cfg.allowGiveUp)}`);
  console.log(`gasData:                     ${JSON.stringify(cfg.gasData)}`);
  console.log(`allAwardToSponsorWhenGiveUp: ${cfg.allAwardToSponsorWhenGiveUp}`);
  console.log(`awardReceiversPercent:       ${JSON.stringify(cfg.awardReceiversPercent)}`);
  console.log(`totalAmount:                 ${cfg.totalAmount} wei (${ethers.formatEther(totalAmount)} POL)`);
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

  // Verify on Polygonscan (uses POLYGONSCAN_API_KEY/ETHERSCAN_API_KEY).
  console.log('\n🔍 VERIFYING on Polygonscan...');
  let verified = false;
  try {
    await dTx?.wait(5);
    await run('verify:verify', {
      address,
      constructorArguments: [
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
      ],
    });
    verified = true;
    console.log('✅ Verified on Polygonscan');
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    if (/already verified/i.test(msg)) {
      verified = true;
      console.log('✅ Already verified');
    } else {
      console.warn('⚠️  Polygonscan verify failed, trying Sourcify…');
      try {
        await run('verify:sourcify', { address });
        verified = true;
        console.log('✅ Verified on Sourcify (chainId 137)');
      } catch (e2: any) {
        const msg2 = e2?.message ?? String(e2);
        if (/already verified/i.test(msg2)) {
          verified = true;
          console.log('✅ Already verified on Sourcify');
        } else {
          console.warn('⚠️  Verify failed (deploy OK, re-verify later):', msg2);
        }
      }
    }
  }

  const auditPath = path.join(process.cwd(), 'deployInfo', 'challenge-base-step-polygon.json');
  fs.writeFileSync(
    auditPath,
    JSON.stringify(
      {
        network: network.name,
        chainId: '137',
        contractName: 'ChallengeBaseStep',
        address,
        deployer: deployer.address,
        deploymentTime: new Date().toISOString(),
        blockNumber: receipt?.blockNumber ?? null,
        transactionHash: dTx?.hash ?? '',
        gasUsed: receipt?.gasUsed?.toString() ?? '',
        msgValue: totalAmount.toString(),
        constructorArgs: cfg,
        verified,
        explorerUrl: `https://polygonscan.com/address/${address}`,
      },
      null,
      2
    ) + '\n'
  );
  console.log(`\n💾 Audit:     ${auditPath}`);
  console.log(`🔗 Explorer:  https://polygonscan.com/address/${address}`);
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('💥 DEPLOYMENT FAILED:', err);
    process.exit(1);
  });
