import 'dotenv/config';
import * as fs from 'fs';
import { network, run } from 'hardhat';
import * as path from 'path';
import batchGrantRole from '../grantChallengeRole';

const hre = require('hardhat');

/**
 * Deploy Challenge HIIT (or only Grant Role when NOT_DEPLOY=true).
 * - Default: deploy → verify → grant role → save deployInfo.
 * - NOT_DEPLOY=true: skip deploy, load contract from deployInfo/challenge-hiit-{network}.json, run grant role only.
 *
 * Example (deploy):
 *   npx hardhat run scripts/challenge/ChallengeHIIT/deploy-challenge-hiit.ts --network polygon
 *
 * Example (grant role only, use existing 0x79FC...):
 *   NOT_DEPLOY=true npx hardhat run scripts/challenge/ChallengeHIIT/deploy-challenge-hiit.ts --network polygon
 */

interface ChallengeHIITDeploymentConfig {
  stakeHolders: string[];
  createByToken: string;
  erc721Addresses: string[];
  /** [duration, startTime, endTime, highIntensityIntervals, totalHighIntensityTime, dayRequired] */
  primaryRequired: number[];
  awardReceivers: string[];
  index: number;
  allowGiveUp: boolean[];
  gasData: string[];
  allAwardToSponsorWhenGiveUp: boolean;
  awardReceiversPercent: number[];
  totalAmount: string;
}

function getExplorerUrl(networkName: string, address: string): string {
  const explorers: { [key: string]: string } = {
    polygon: `https://polygonscan.com/address/${address}`,
    amoy: `https://amoy.polygonscan.com/address/${address}`,
    mumbai: `https://mumbai.polygonscan.com/address/${address}`,
    ethereum: `https://etherscan.io/address/${address}`,
    goerli: `https://goerli.etherscan.io/address/${address}`,
    sepolia: `https://sepolia.etherscan.io/address/${address}`,
  };
  return explorers[networkName] || `Unknown network: ${networkName}`;
}

function parseEnvConfigHIIT(raw: string): any {
  const trimmed = raw.trim();
  const jsonStr = trimmed.startsWith('{')
    ? trimmed
    : trimmed.replace(/^CONFIG_DEPLOY_CHALLENGE_HIIT\s*=\s*/, '').trim();
  try {
    return JSON.parse(jsonStr);
  } catch {
    // Multi-line JSON in .env: load from .env and extract balanced {...}.
    // Note: does not handle strings containing '{' or '}' in values.
    const envPath = path.join(process.cwd(), '.env');
    if (!fs.existsSync(envPath))
      throw new Error('Invalid CONFIG_DEPLOY_CHALLENGE_HIIT JSON');
    const content = fs.readFileSync(envPath, 'utf-8');
    const key = 'CONFIG_DEPLOY_CHALLENGE_HIIT=';
    const idx = content.indexOf(key);
    if (idx === -1)
      throw new Error('CONFIG_DEPLOY_CHALLENGE_HIIT not found in .env');
    let start = content.indexOf('{', idx);
    if (start === -1)
      throw new Error('CONFIG_DEPLOY_CHALLENGE_HIIT: missing {');
    let depth = 0;
    let end = start;
    for (let i = start; i < content.length; i++) {
      if (content[i] === '{') depth++;
      else if (content[i] === '}') {
        depth--;
        if (depth === 0) {
          end = i + 1;
          break;
        }
      }
    }
    return JSON.parse(content.slice(start, end));
  }
}

function normalizeConfig(input: any): ChallengeHIITDeploymentConfig {
  const toBool = (v: any) =>
    typeof v === 'boolean' ? v : String(v).toLowerCase() === 'true';
  const toNum = (v: any) => (typeof v === 'number' ? v : Number(v));
  if (!input || typeof input !== 'object')
    throw new Error('Invalid config: expected object');
  return {
    stakeHolders: input.stakeHolders,
    createByToken: input.createByToken,
    erc721Addresses: input.erc721Addresses,
    primaryRequired: input.primaryRequired.map((n: any) => toNum(n)),
    awardReceivers: input.awardReceivers,
    index: toNum(input.index),
    allowGiveUp: input.allowGiveUp.map((b: any) => toBool(b)),
    gasData: input.gasData.map((g: any) => String(g)),
    allAwardToSponsorWhenGiveUp: toBool(input.allAwardToSponsorWhenGiveUp),
    awardReceiversPercent: input.awardReceiversPercent.map((n: any) =>
      toNum(n)
    ),
    totalAmount: String(input.totalAmount),
  };
}

function toBoolEnv(v: string | undefined): boolean {
  if (v === undefined || v === '') return false;
  return String(v).toLowerCase() === 'true' || v === '1';
}

async function main() {
  const skipDeploy = toBoolEnv(process.env.NOT_DEPLOY);
  if (skipDeploy) {
    console.log(
      '📌 NOT_DEPLOY=true → Skip deploy, use existing contract from deployInfo and run Grant Role only.'
    );
  }

  console.log('🚀 CHALLENGE HIIT DEPLOYMENT');
  console.log('============================');

  const [deployer] = await hre.ethers.getSigners();
  console.log(`📍 Network: ${network.name}`);
  console.log(`👤 Deployer: ${deployer.address}`);
  console.log(
    `💰 Balance: ${hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address))} ETH`
  );

  // --- Step 1: Load config ---
  console.log('\n📋 STEP 1: LOAD CONFIG');
  console.log('========================');
  let config: ChallengeHIITDeploymentConfig;

  try {
    const envConfigRaw = process.env.CONFIG_DEPLOY_CHALLENGE_HIIT;
    if (!envConfigRaw || envConfigRaw.trim().length === 0) {
      console.error(
        '❌ CONFIG_DEPLOY_CHALLENGE_HIIT not found in environment variables'
      );
      process.exit(1);
    }
    const parsed = parseEnvConfigHIIT(envConfigRaw);
    config = normalizeConfig(parsed);
    if (!config.primaryRequired || config.primaryRequired.length < 6) {
      console.error(
        '❌ primaryRequired must have 6 elements: [duration, startTime, endTime, highIntensityIntervals, totalHighIntensityTime, dayRequired]'
      );
      process.exit(1);
    }
    if (!config.allowGiveUp || config.allowGiveUp.length !== 3) {
      console.error('❌ allowGiveUp must have exactly 3 elements');
      process.exit(1);
    }
    console.log(
      '✅ Configuration loaded from ENV (CONFIG_DEPLOY_CHALLENGE_HIIT)'
    );
  } catch (error) {
    console.error('❌ Failed to load configuration:', error);
    process.exit(1);
  }

  const constructorArgs = [
    config.stakeHolders,
    config.createByToken,
    config.erc721Addresses,
    config.primaryRequired,
    config.awardReceivers,
    config.index,
    config.allowGiveUp,
    config.gasData,
    config.allAwardToSponsorWhenGiveUp,
    config.awardReceiversPercent,
    config.totalAmount,
  ];

  let contract: any;
  let contractAddress: string;

  // --- Step 2: Deploy or attach existing ---
  console.log('\n📋 STEP 2: DEPLOY OR USE EXISTING CONTRACT');
  console.log('==========================================');
  if (skipDeploy) {
    const deployInfoPath = path.join(
      process.cwd(),
      `deployInfo/challenge-hiit-${network.name}.json`
    );
    if (!fs.existsSync(deployInfoPath)) {
      console.error(
        '❌ Deploy info not found at',
        deployInfoPath,
        '(required when NOT_DEPLOY=true)'
      );
      process.exit(1);
    }
    const deployInfo = JSON.parse(fs.readFileSync(deployInfoPath, 'utf-8'));
    contractAddress = deployInfo.contractAddress;
    if (!contractAddress) {
      console.error('❌ deployInfo missing contractAddress');
      process.exit(1);
    }
    console.log('\n📌 USING EXISTING CONTRACT');
    console.log('==========================');
    console.log('Contract address:', contractAddress);
    const ContractFactory =
      await hre.ethers.getContractFactory('ChallengeHIIT');
    contract = ContractFactory.attach(contractAddress);
  } else {
    const balance = await hre.ethers.provider.getBalance(deployer.address);
    const minBalance = hre.ethers.parseEther('0.1');
    if (balance < minBalance) {
      console.error(
        `❌ Insufficient balance. Need at least ${hre.ethers.formatEther(minBalance)} ETH`
      );
      process.exit(1);
    }
    console.log('✅ Deployer balance sufficient');
    console.log(
      'Constructor args (primaryRequired length):',
      config.primaryRequired.length
    );

    console.log('\n🏗️  DEPLOYING CONTRACT');
    console.log('======================');

    const ContractFactory =
      await hre.ethers.getContractFactory('ChallengeHIIT');
    try {
      const baseOverrides = config.allowGiveUp[1]
        ? { value: BigInt(config.totalAmount) }
        : {};
      const unsignedTx = await ContractFactory.getDeployTransaction(
        ...constructorArgs,
        baseOverrides
      );
      const [signer] = await hre.ethers.getSigners();
      const estimatedGas = await signer.estimateGas(unsignedTx);
      const feeData = await hre.ethers.provider.getFeeData();
      const defaultGasPrice = hre.ethers.parseUnits('40', 'gwei');
      const gasPrice = feeData.gasPrice ?? defaultGasPrice;
      const estCostWei = estimatedGas * gasPrice;

      console.log(`Estimated gas: ${estimatedGas.toString()}`);
      console.log(
        `Gas price: ${hre.ethers.formatUnits(gasPrice, 'gwei')} gwei`
      );
      console.log(`Estimated cost: ${hre.ethers.formatEther(estCostWei)} ETH`);
      await new Promise(resolve => setTimeout(resolve, 2000));

      const gasLimit = Math.ceil(Number(estimatedGas) * 1.01);
      const overrides =
        feeData.maxFeePerGas && feeData.maxPriorityFeePerGas
          ? {
              ...baseOverrides,
              gasLimit,
              maxFeePerGas: feeData.maxFeePerGas,
              maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
            }
          : { ...baseOverrides, gasLimit, gasPrice };

      contract = await ContractFactory.deploy(...constructorArgs, overrides);
      await contract.waitForDeployment();
    } catch (error) {
      console.error('❌ Deployment failed:', error);
      process.exit(1);
    }

    contractAddress = await contract.getAddress();
    console.log(`✅ Contract deployed at: ${contractAddress}`);
  }

  // --- Step 3: Verify deployment (on-chain) ---
  console.log('\n📋 STEP 3: VERIFY DEPLOYMENT (ON-CHAIN)');
  console.log('======================================');
  console.log('\n🔍 VERIFYING DEPLOYMENT');
  console.log('=======================');

  const deployedCode = await hre.ethers.provider.getCode(contractAddress);
  if (deployedCode === '0x') {
    console.error('❌ Contract deployment failed - no code at address');
    process.exit(1);
  }
  console.log('✅ Contract code verified');

  // --- Step 4: Test basic functionality ---
  console.log('\n📋 STEP 4: TEST BASIC FUNCTIONALITY');
  console.log('===================================');
  console.log('\n🧪 TESTING BASIC FUNCTIONALITY');
  console.log('===============================');

  try {
    const sponsor = await contract.sponsor();
    const challenger = await contract.challenger();
    const startTime = await contract.startTime();
    const endTime = await contract.endTime();
    const highIntensityIntervals = await contract.highIntensityIntervals();
    const totalHighIntensityTime = await contract.totalHighIntensityTime();
    const dayRequired = await contract.dayRequired();
    const createByToken = await contract.createByToken();

    console.log(`✅ Sponsor: ${sponsor}`);
    console.log(`✅ Challenger: ${challenger}`);
    console.log(
      `✅ Start Time: ${new Date(Number(startTime) * 1000).toISOString()}`
    );
    console.log(
      `✅ End Time: ${new Date(Number(endTime) * 1000).toISOString()}`
    );
    console.log(`✅ High-intensity intervals/day: ${highIntensityIntervals}`);
    console.log(
      `✅ Total high-intensity time (s)/day: ${totalHighIntensityTime}`
    );
    console.log(`✅ Day required: ${dayRequired}`);
    console.log(`✅ Create By Token: ${createByToken}`);
    console.log('✅ All basic functionality tests passed');
  } catch (error) {
    console.error('❌ Basic functionality test failed:', error);
    process.exit(1);
  }

  // --- Step 5: Verify on block explorer ---
  if (
    network.name !== 'hardhat' &&
    network.name !== 'localhost' &&
    !skipDeploy
  ) {
    console.log('\n📋 STEP 5: VERIFY ON BLOCK EXPLORER');
    console.log('===================================');
    await new Promise(resolve => setTimeout(resolve, 15000));
    console.log('\n🔍 VERIFYING ON BLOCK EXPLORER');
    console.log('===============================');
    try {
      await contract.deploymentTransaction()?.wait(5);
      await run('verify:verify', {
        address: contractAddress,
        constructorArguments: constructorArgs,
      });
      console.log('✅ Contract verified on block explorer');
    } catch (error) {
      console.warn('⚠️  Contract verification failed:', error);
    }
  }

  // --- Step 6: Grant challenge role ---
  console.log('\n📋 STEP 6: GRANT CHALLENGE ROLE');
  console.log('=================================');
  console.log('\n🔐 GRANTING CHALLENGE ROLE');
  console.log('===========================');
  let roleGrantTxHash: string | null = null;
  try {
    roleGrantTxHash = await batchGrantRole(contractAddress);
    await new Promise(resolve => setTimeout(resolve, 15000));
    console.log('✅ Challenge role granted successfully');
  } catch (error) {
    console.warn('⚠️  Failed to grant challenge role:', error);
  }

  // --- Step 5b: Test sendDailyResult ---
  console.log('\n📋 STEP 5b: TEST SEND DAILY RESULT');
  console.log('===================================');
  console.log('\n📊 TESTING sendDailyResult');
  console.log('============================');

  let sendDailyResultTxHash: string | null = null;
  const dayRequiredCount = config.primaryRequired[5];
  try {
    const [startTimeC, endTimeC] = [
      config.primaryRequired[1],
      config.primaryRequired[2],
    ];
    const minIntervals = config.primaryRequired[3];
    const minTotalSeconds = config.primaryRequired[4];
    const testListGachaAddress: string[] = [];
    const testListNFTAddress: string[] = [];
    const testListIndexNFT: bigint[][] = [];
    const testListSenderAddress: string[][] = [];
    const testStatusTypeNft: boolean[] = [];

    const feeDataSend = await hre.ethers.provider.getFeeData();
    const gasPriceSend =
      feeDataSend.gasPrice ?? hre.ethers.parseUnits('40', 'gwei');

    for (let i = 0; i < dayRequiredCount; i++) {
      const dayTs = startTimeC + (i + 1) * 86400 * 2;
      const testDay = [BigInt(dayTs)];
      let testIntervals = [BigInt(minIntervals)];
      let testTotalSeconds = [BigInt(minTotalSeconds)];

      if (i == 1) {
        testIntervals = [BigInt(1)];
        testTotalSeconds = [BigInt(1)];
      }

      const testTimeRange: [bigint, bigint] = [
        BigInt(dayTs - 100),
        BigInt(dayTs + 100),
      ];

      // _data (uint64[2]) and _signature (bytes) for checkValidSignature — placeholder for test; real flow needs backend signature
      const testData: [bigint, bigint] = [0n, 0n];
      const testSignature = '0x';

      const sendArgs = [
        testDay,
        testIntervals,
        testTotalSeconds,
        testData,
        testSignature,
        testListGachaAddress,
        testListNFTAddress,
        testListIndexNFT,
        testListSenderAddress,
        testStatusTypeNft,
        testTimeRange,
      ];

      console.log(
        `\n⏳ [${i + 1}/${dayRequiredCount}] Estimating gas for sendDailyResult (day=${dayTs})...`
      );
      const estimatedGas = await contract.sendDailyResult.estimateGas(
        ...sendArgs
      );
      const gasLimitSend = Math.ceil(Number(estimatedGas) * 1.2);

      console.log(
        `⏳ [${i + 1}/${dayRequiredCount}] Sending sendDailyResult...`
      );
      const sendTx = await contract.sendDailyResult(...sendArgs, {
        gasLimit: gasLimitSend,
        gasPrice: gasPriceSend,
      });
      await sendTx.wait();
      sendDailyResultTxHash = sendTx.hash;
      console.log(
        `✅ [${i + 1}/${dayRequiredCount}] sendDailyResult tx: ${sendTx.hash}`
      );

      if (i < dayRequiredCount - 1) {
        console.log('   Waiting 10s before next send...');
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }
  } catch (error: any) {
    const msg = error?.reason ?? error?.message ?? String(error);
    console.warn('⚠️  sendDailyResult test failed:', msg);
    if (error?.data) console.warn('   Revert data:', error.data);
    console.log(
      '   This may be expected (onlyChallenger, valid signature from NFT, or onTimeSendResult required).'
    );
  }

  // --- Step 5c: After sendDailyResult — wait 20s then verify stored data ---
  if (sendDailyResultTxHash) {
    console.log('\n📋 STEP 5c: VERIFY STORED DATA (after sendDailyResult)');
    console.log('=====================================================');
    console.log('⏳ Waiting 20s for state to settle...');
    await new Promise(resolve => setTimeout(resolve, 20000));

    try {
      const [historyDate, historyData, historyIntervals, historyTime] =
        await contract.getHIITHistory();
      const [challengeCleared, challengeDayRequired, daysRemained] =
        await contract.getChallengeInfo();
      const state = await contract.getState();
      const [highIntensityIntervalsReq, totalHighIntensityTimeReq] =
        await contract.getHIITConfig();
      const [startTimeC, endTimeC] = [
        config.primaryRequired[1],
        config.primaryRequired[2],
      ];
      const testDay = [startTimeC];
      const achievedOnDay = await contract.getHIITAchievedOn(testDay[0]);

      console.log('\n📊 Stored data (should match sendDailyResult logic):');
      console.log(
        '  • historyDate:',
        historyDate.map((d: bigint) => d.toString())
      );
      console.log(
        '  • historyData (0=not achieved, 1=achieved):',
        historyData.map((d: bigint) => d.toString())
      );
      console.log(
        '  • historyIntervals:',
        historyIntervals.map((i: bigint) => i.toString())
      );
      console.log(
        '  • historyTime (seconds):',
        historyTime.map((t: bigint) => t.toString())
      );
      console.log(
        '  • currentStatus (days achieved):',
        challengeCleared.toString()
      );
      console.log('  • dayRequired:', challengeDayRequired.toString());
      console.log('  • daysRemained:', daysRemained.toString());
      console.log(
        `  • getHIITAchievedOn(${testDay[0]}):`,
        achievedOnDay.toString()
      );
      const stateNames: { [key: number]: string } = {
        0: 'PROCESSING',
        1: 'SUCCESS',
        2: 'FAILED',
        3: 'GAVE_UP',
        4: 'CLOSED',
      };
      console.log(
        '  • stateInstance:',
        stateNames[Number(state)] ?? Number(state)
      );

      const idx = historyDate.findIndex(
        (d: bigint) => Number(d) === testDay[0]
      );
      const expectedAchieved =
        idx >= 0 &&
        Number(historyIntervals[idx]) >= Number(highIntensityIntervalsReq) &&
        Number(historyTime[idx]) >= Number(totalHighIntensityTimeReq)
          ? 1
          : 0;
      const ok =
        idx >= 0 &&
        Number(historyData[idx]) === expectedAchieved &&
        Number(achievedOnDay) === expectedAchieved;
      if (ok) {
        console.log('\n✅ Stored data consistent with sendDailyResult logic.');
      } else {
        console.warn(
          '\n⚠️  Stored data check: some values may not match expected (review above).'
        );
      }
    } catch (err) {
      console.warn('⚠️  Failed to read stored data:', err);
    }
  }

  // --- Step 7: Save deployment info ---
  console.log('\n📋 STEP 7: SAVE DEPLOYMENT INFO');
  console.log('================================');
  console.log('\n💾 SAVING DEPLOYMENT INFO');
  console.log('==========================');

  const outputPath = path.join(
    process.cwd(),
    `deployInfo/challenge-hiit-${network.name}.json`
  );
  let deploymentInfo: any;
  if (skipDeploy && fs.existsSync(outputPath)) {
    const existing = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
    deploymentInfo = {
      ...existing,
      roleGranted: {
        challengeRole: !!roleGrantTxHash,
        transactionHash: roleGrantTxHash,
        timestamp: new Date().toISOString(),
      },
      contractDetails: {
        sponsor: await contract.sponsor(),
        challenger: await contract.challenger(),
        startTime: Number(await contract.startTime()),
        endTime: Number(await contract.endTime()),
        highIntensityIntervals: Number(await contract.highIntensityIntervals()),
        totalHighIntensityTime: Number(await contract.totalHighIntensityTime()),
        dayRequired: Number(await contract.dayRequired()),
        createByToken: await contract.createByToken(),
      },
      verification: existing.verification ?? {
        verified: network.name !== 'hardhat' && network.name !== 'localhost',
        explorerUrl: getExplorerUrl(network.name, contractAddress),
      },
      sendDailyResultTest: {
        sent: !!sendDailyResultTxHash,
        transactionHash: sendDailyResultTxHash,
        timestamp: new Date().toISOString(),
      },
    };
  } else {
    deploymentInfo = {
      network: network.name,
      contractName: 'ChallengeHIIT',
      contractAddress,
      deployer: deployer.address,
      deploymentTime: new Date().toISOString(),
      blockNumber: await hre.ethers.provider.getBlockNumber(),
      constructorArgs: {
        stakeHolders: config.stakeHolders,
        createByToken: config.createByToken,
        erc721Addresses: config.erc721Addresses,
        primaryRequired: config.primaryRequired,
        awardReceivers: config.awardReceivers,
        index: config.index,
        allowGiveUp: config.allowGiveUp,
        gasData: config.gasData,
        allAwardToSponsorWhenGiveUp: config.allAwardToSponsorWhenGiveUp,
        awardReceiversPercent: config.awardReceiversPercent,
        totalAmount: config.totalAmount,
      },
      contractDetails: {
        sponsor: await contract.sponsor(),
        challenger: await contract.challenger(),
        startTime: Number(await contract.startTime()),
        endTime: Number(await contract.endTime()),
        highIntensityIntervals: Number(await contract.highIntensityIntervals()),
        totalHighIntensityTime: Number(await contract.totalHighIntensityTime()),
        dayRequired: Number(await contract.dayRequired()),
        createByToken: await contract.createByToken(),
      },
      verification: {
        verified: network.name !== 'hardhat' && network.name !== 'localhost',
        explorerUrl: getExplorerUrl(network.name, contractAddress),
      },
      roleGranted: {
        challengeRole: !!roleGrantTxHash,
        transactionHash: roleGrantTxHash,
        timestamp: new Date().toISOString(),
      },
      sendDailyResultTest: {
        sent: !!sendDailyResultTxHash,
        transactionHash: sendDailyResultTxHash,
        timestamp: new Date().toISOString(),
      },
    };
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`✅ Deployment info saved to: ${outputPath}`);

  // --- Step 8: Report ---
  console.log('\n📋 STEP 8: DEPLOYMENT REPORT');
  console.log('===========================');
  console.log('\n📊 DEPLOYMENT REPORT');
  console.log('====================');
  console.log(`Network: ${network.name}`);
  console.log(`Contract: ChallengeHIIT`);
  console.log(`Address: ${contractAddress}`);
  console.log(`Deployer: ${deploymentInfo.deployer ?? deployer.address}`);
  console.log(`Block: ${deploymentInfo.blockNumber ?? 'N/A'}`);
  console.log(
    `Explorer: ${deploymentInfo.verification?.explorerUrl ?? getExplorerUrl(network.name, contractAddress)}`
  );
  console.log(
    `Challenge Role: ${deploymentInfo.roleGranted?.challengeRole ? 'Granted' : 'Not Granted'}`
  );
  console.log(
    `sendDailyResult test: ${deploymentInfo.sendDailyResultTest?.sent ? 'Sent' : 'Skipped/Failed'}`
  );
  console.log('\n🎉 CHALLENGE HIIT DEPLOYMENT COMPLETED!');
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('💥 DEPLOYMENT FAILED:', error);
    process.exit(1);
  });
