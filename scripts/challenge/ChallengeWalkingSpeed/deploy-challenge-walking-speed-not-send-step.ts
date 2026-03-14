import 'dotenv/config';
import * as fs from 'fs';
import { network, run } from 'hardhat';
import * as path from 'path';
import batchGrantRole from '../grantChallengeRole';

const hre = require('hardhat');

/**
 * Deploy ChallengeBaseStep without sending step (deploy + verify + grant role only).
 * Config: CONFIG_DEPLOY_CHALLENGE_BASE_ONLY_STEP (multi-line JSON in .env supported).
 * - Default: deploy → verify → grant role → save deployInfo. No send step loop.
 * - NOT_DEPLOY=true: skip deploy, load contract from deployInfo/challenge-walking-speed-{network}.json, run grant role only.
 *
 * Example (deploy, no send step):
 *   npx hardhat run scripts/challenge/ChallengeWalkingSpeed/deploy-challenge-walking-speed-not-send-step.ts --network polygon
 *
 * Example (grant role only):
 *   NOT_DEPLOY=true npx hardhat run scripts/challenge/ChallengeWalkingSpeed/deploy-challenge-walking-speed-not-send-step.ts --network polygon
 */

interface ChallengeBaseStepDeploymentConfig {
  stakeHolders: string[];
  createByToken: string;
  erc721Addresses: string[];
  primaryRequired: number[]; // [duration, startTime, endTime, goal, dayRequired]
  awardReceivers: string[];
  index: number;
  allowGiveUp: boolean[];
  gasData: string[];
  allAwardToSponsorWhenGiveUp: boolean;
  awardReceiversPercent: number[];
  totalAmount: string;
  walkingSpeedData: number[];
  hiitData?: number[];
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

function parseEnvConfigBaseOnlyStep(raw: string): any {
  const trimmed = raw.trim();
  const jsonStr = trimmed.startsWith('{')
    ? trimmed
    : trimmed
        .replace(/^CONFIG_DEPLOY_CHALLENGE_BASE_ONLY_STEP\s*=\s*/, '')
        .trim();
  try {
    return JSON.parse(jsonStr);
  } catch {
    const envPath = path.join(process.cwd(), '.env');
    if (!fs.existsSync(envPath))
      throw new Error('Invalid CONFIG_DEPLOY_CHALLENGE_BASE_ONLY_STEP JSON');
    const content = fs.readFileSync(envPath, 'utf-8');
    const key = 'CONFIG_DEPLOY_CHALLENGE_BASE_ONLY_STEP=';
    const idx = content.indexOf(key);
    if (idx === -1)
      throw new Error(
        'CONFIG_DEPLOY_CHALLENGE_BASE_ONLY_STEP not found in .env'
      );
    let start = content.indexOf('{', idx);
    if (start === -1)
      throw new Error('CONFIG_DEPLOY_CHALLENGE_BASE_ONLY_STEP: missing {');
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

function normalizeConfig(input: any): ChallengeBaseStepDeploymentConfig {
  const toBool = (v: any) =>
    typeof v === 'boolean' ? v : String(v).toLowerCase() === 'true';
  const toNum = (v: any) => (typeof v === 'number' ? v : Number(v));
  const toNumArray = (v: any) =>
    Array.isArray(v) ? v.map((n: any) => toNum(n)) : [];
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
    walkingSpeedData: toNumArray(input.walkingSpeedData ?? []),
    hiitData: toNumArray(input.hiitData ?? []),
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

  console.log('🚀 CHALLENGE BASE STEP (Walking Speed) DEPLOYMENT — NO SEND STEP');
  console.log('=================================================================');

  const [deployer] = await hre.ethers.getSigners();
  console.log(`📍 Network: ${network.name}`);
  console.log(`👤 Deployer: ${deployer.address}`);
  console.log(
    `💰 Balance: ${hre.ethers.formatEther(
      await hre.ethers.provider.getBalance(deployer.address)
    )} ETH`
  );

  // --- Step 1: Load config ---
  console.log('\n📋 STEP 1: LOAD CONFIG');
  console.log('========================');
  let config: ChallengeBaseStepDeploymentConfig;

  try {
    const envConfigRaw = process.env.CONFIG_DEPLOY_CHALLENGE_BASE_ONLY_STEP;
    if (!envConfigRaw || envConfigRaw.trim().length === 0) {
      console.error(
        '❌ CONFIG_DEPLOY_CHALLENGE_BASE_ONLY_STEP not found in environment variables'
      );
      process.exit(1);
    }
    const parsed = parseEnvConfigBaseOnlyStep(envConfigRaw);
    config = normalizeConfig(parsed);
    if (!config.primaryRequired || config.primaryRequired.length < 5) {
      console.error(
        '❌ primaryRequired must have at least 5 elements: [duration, startTime, endTime, goal, dayRequired]'
      );
      process.exit(1);
    }
    if (!config.allowGiveUp || config.allowGiveUp.length !== 3) {
      console.error('❌ allowGiveUp must have exactly 3 elements');
      process.exit(1);
    }
    if (
      config.walkingSpeedData.length > 0 &&
      config.walkingSpeedData.length !== 3
    ) {
      console.error(
        '❌ walkingSpeedData must be [] or [targetSpeed, requiredMinutesPerDay, minAchievementDays] (length 3)'
      );
      process.exit(1);
    }
    if (
      (config.hiitData?.length ?? 0) > 0 &&
      (config.hiitData?.length ?? 0) !== 2
    ) {
      console.error(
        '❌ hiitData must be [] or [highIntensityIntervals, totalHighIntensityTime] (length 2)'
      );
      process.exit(1);
    }
    console.log(
      '✅ Configuration loaded from ENV (CONFIG_DEPLOY_CHALLENGE_BASE_ONLY_STEP)'
    );
    console.log(
      '  • walkingSpeedData:',
      config.walkingSpeedData.length
        ? config.walkingSpeedData
        : '[] (step only)'
    );
    console.log(
      '  • hiitData:',
      (config.hiitData?.length ?? 0) ? config.hiitData : '[] (no HIIT)'
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
    config.walkingSpeedData ?? [],
    config.hiitData ?? [],
  ];

  let contract: any;
  let contractAddress: string;

  // --- Step 2: Deploy or attach existing ---
  console.log('\n📋 STEP 2: DEPLOY OR USE EXISTING CONTRACT');
  console.log('==========================================');
  if (skipDeploy) {
    const deployInfoPath = path.join(
      process.cwd(),
      `deployInfo/challenge-walking-speed-${network.name}.json`
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
      await hre.ethers.getContractFactory('ChallengeBaseStep');
    contract = ContractFactory.attach(contractAddress);
  } else {
    const balance = await hre.ethers.provider.getBalance(deployer.address);
    const minBalance = hre.ethers.parseEther('0.05');
    if (balance < minBalance) {
      console.error(
        `❌ Insufficient balance. Need at least ${hre.ethers.formatEther(
          minBalance
        )} ETH`
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
      await hre.ethers.getContractFactory('ChallengeBaseStep');
    try {
      const baseOverrides =
        config.allowGiveUp && config.allowGiveUp[1]
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
  const deployedCode = await hre.ethers.provider.getCode(contractAddress);
  if (deployedCode === '0x') {
    console.error('❌ Contract deployment failed - no code at address');
    process.exit(1);
  }
  console.log('✅ Contract code verified');

  // --- Step 4: Verify on block explorer ---
  if (
    network.name !== 'hardhat' &&
    network.name !== 'localhost' &&
    !skipDeploy
  ) {
    console.log('\n📋 STEP 4: VERIFY ON BLOCK EXPLORER');
    console.log('===================================');
    await new Promise(resolve => setTimeout(resolve, 15000));
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

  // --- Step 5: Grant challenge role ---
  console.log('\n📋 STEP 5: GRANT CHALLENGE ROLE');
  console.log('=================================');
  let roleGrantTxHash: string | null = null;
  try {
    roleGrantTxHash = await batchGrantRole(contractAddress);
    await new Promise(resolve => setTimeout(resolve, 15000));
    console.log('✅ Challenge role granted successfully');
  } catch (error) {
    console.warn('⚠️  Failed to grant challenge role:', error);
  }

  // --- Step 6: Save deployment info ---
  console.log('\n📋 STEP 6: SAVE DEPLOYMENT INFO');
  console.log('================================');
  const outputPath = path.join(
    process.cwd(),
    `deployInfo/challenge-walking-speed-${network.name}.json`
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
      sendDailyResultTest: {
        sent: false,
        skipped: true,
        timestamp: new Date().toISOString(),
      },
    };
  } else {
    deploymentInfo = {
      network: network.name,
      contractName: 'ChallengeBaseStep',
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
        walkingSpeedData: config.walkingSpeedData,
        hiitData: config.hiitData ?? [],
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
        sent: false,
        skipped: true,
        timestamp: new Date().toISOString(),
      },
    };
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`✅ Deployment info saved to: ${outputPath}`);

  // --- Step 7: Report ---
  console.log('\n📋 STEP 7: DEPLOYMENT REPORT');
  console.log('===========================');
  console.log(`Network: ${network.name}`);
  console.log(`Contract: ChallengeBaseStep`);
  console.log(`Address: ${contractAddress}`);
  console.log(`Deployer: ${deploymentInfo.deployer ?? deployer.address}`);
  console.log(`Block: ${deploymentInfo.blockNumber ?? 'N/A'}`);
  console.log(
    `Explorer: ${deploymentInfo.verification?.explorerUrl ?? getExplorerUrl(network.name, contractAddress)}`
  );
  console.log(
    `Challenge Role: ${deploymentInfo.roleGranted?.challengeRole ? 'Granted' : 'Not Granted'}`
  );
  console.log('sendDailyResult: Not run (not-send-step script)');
  console.log('\n🎉 CHALLENGE BASE STEP DEPLOYMENT COMPLETED!');
}

main()
  .then(() => process.exit(0))
  .catch((error: any) => {
    console.error('💥 DEPLOYMENT FAILED:', error);
    process.exit(1);
  });
