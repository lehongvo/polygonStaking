import 'dotenv/config';
import * as fs from 'fs';
import { network, run } from 'hardhat';
import * as path from 'path';
import batchGrantRole from '../grantChallengeRole';

const hre = require('hardhat');

interface ChallengeWalkingSpeedDeploymentConfig {
  stakeHolders: string[];
  createByToken: string;
  erc721Addresses: string[];
  primaryRequired: number[];
  awardReceivers: string[];
  index: number;
  allowGiveUp: boolean[];
  gasData: string[];
  allAwardToSponsorWhenGiveUp: boolean;
  awardReceiversPercent: number[];
  totalAmount: string;
  walkingSpeedData: number[]; // [targetSpeed, requiredMinutesPerDay, minAchievementDays]
}

async function main() {
  console.log('🚀 CHALLENGE WALKING SPEED DEPLOYMENT');
  console.log('=====================================');

  const [deployer] = await hre.ethers.getSigners();
  console.log(`📍 Network: ${network.name}`);
  console.log(`👤 Deployer: ${deployer.address}`);
  console.log(
    `💰 Balance: ${hre.ethers.formatEther(
      await hre.ethers.provider.getBalance(deployer.address)
    )} ETH`
  );

  let config: ChallengeWalkingSpeedDeploymentConfig | any;

  try {
    const envConfigRaw = process.env.CONFIG_DEPLOY_CHALLENGE_WALKING_SPEED;
    if (envConfigRaw && envConfigRaw.trim().length > 0) {
      const parsed = parseEnvConfig(envConfigRaw);
      config = normalizeConfig(parsed);
      console.log(
        '✅ Configuration loaded from ENV (CONFIG_DEPLOY_CHALLENGE_WALKING_SPEED)'
      );
    } else {
      console.error(
        '❌ CONFIG_DEPLOY_CHALLENGE_WALKING_SPEED not found in environment variables'
      );
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Failed to load configuration:', error);
    process.exit(1);
  }

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
    config.walkingSpeedData,
  ];

  console.log('\n🏗️  DEPLOYING ChallengeWalkingSpeed');
  console.log('===================================');
  console.log('constructorArgs', constructorArgs);

  const ContractFactory = await hre.ethers.getContractFactory(
    'ChallengeWalkingSpeed'
  );

  let contract: any;
  try {
    const baseOverrides =
      config.allowGiveUp && config.allowGiveUp[1]
        ? { value: config.totalAmount }
        : {};
    console.log('baseOverrides', baseOverrides);

    // Estimate gas and fees
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
    console.log(`Gas price: ${hre.ethers.formatUnits(gasPrice, 'gwei')} gwei`);
    console.log(`Estimated cost: ${hre.ethers.formatEther(estCostWei)} ETH`);

    const gasLimit = Math.ceil(Number(estimatedGas) * 1.1);
    const overrides =
      feeData.maxFeePerGas && feeData.maxPriorityFeePerGas
        ? {
            ...baseOverrides,
            gasLimit,
            maxFeePerGas: feeData.maxFeePerGas,
            maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
          }
        : { ...baseOverrides, gasLimit, gasPrice };

    console.log(
      `Using gas limit: ${gasLimit} (${Math.round(
        (gasLimit / Number(estimatedGas) - 1) * 100
      )}% buffer)`
    );

    contract = await ContractFactory.deploy(...constructorArgs, overrides);
    await contract.waitForDeployment();
  } catch (error) {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  }

  const contractAddress = await contract.getAddress();
  console.log(`✅ Contract deployed at: ${contractAddress}`);

  // Basic on-chain code check
  const deployedCode = await hre.ethers.provider.getCode(contractAddress);
  if (deployedCode === '0x') {
    console.error('❌ Contract deployment failed - no code at address');
    process.exit(1);
  }
  console.log('✅ Contract code exists on chain');

  // Verify on explorer (if not local)
  if (network.name !== 'hardhat' && network.name !== 'localhost') {
    await new Promise(resolve => setTimeout(resolve, 10000));
    console.log('\n🔍 VERIFYING ON BLOCK EXPLORER');
    console.log('===============================');
    try {
      await contract.deploymentTransaction()?.wait(5);
      await new Promise(resolve => setTimeout(resolve, 10000));
      await run('verify:verify', {
        address: contractAddress,
        constructorArguments: constructorArgs,
      });
      console.log('✅ Contract verified on block explorer');
    } catch (error) {
      console.warn('⚠️  Contract verification failed:', error);
    }
  }

  // Save deployment information
  console.log('\n💾 SAVING DEPLOYMENT INFO');
  console.log('==========================');

  const deploymentInfo = {
    network: network.name,
    contractName: 'ChallengeWalkingSpeed',
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
    },
  };

  const outputPath = path.join(
    process.cwd(),
    `deployInfo/challenge-walking-speed-${network.name}.json`
  );
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`✅ Deployment info saved to: ${outputPath}`);

  console.log('\n🎉 DEPLOYMENT COMPLETED SUCCESSFULLY!');
  console.log('=====================================');
}

function parseEnvConfig(raw: string): any {
  try {
    const normalized = raw.trim().startsWith('{')
      ? raw
      : raw.replace(/^CONFIG_DEPLOY_CHALLENGE_WALKING_SPEED\s*=\s*/, '');
    return JSON.parse(normalized);
  } catch (e) {
    throw new Error(
      'Invalid CONFIG_DEPLOY_CHALLENGE_WALKING_SPEED JSON in .env'
    );
  }
}

function normalizeConfig(input: any): ChallengeWalkingSpeedDeploymentConfig {
  const toBool = (v: any) =>
    typeof v === 'boolean' ? v : String(v).toLowerCase() === 'true';
  const toNum = (v: any) => (typeof v === 'number' ? v : Number(v));

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
    walkingSpeedData: input.walkingSpeedData.map((n: any) => toNum(n)),
  };
}

main()
  .then(() => process.exit(0))
  .catch((error: any) => {
    console.error('💥 DEPLOYMENT FAILED:', error);
    process.exit(1);
  });
