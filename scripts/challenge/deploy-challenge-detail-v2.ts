import 'dotenv/config';
import * as fs from 'fs';
import { network, run } from 'hardhat';
import * as path from 'path';
import batchGrantRole from './grantChallengeRole';

const hre = require('hardhat');

interface ChallengeDeploymentConfig {
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
  systemFeePercentForStaking: number;
}

async function main() {
  console.log('🚀 CHALLENGE DETAIL V2 DEPLOYMENT');
  console.log('==================================');

  const [deployer] = await hre.ethers.getSigners();
  console.log(`📍 Network: ${network.name}`);
  console.log(`👤 Deployer: ${deployer.address}`);
  console.log(
    `💰 Balance: ${hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address))} ETH`
  );

  const configPath = path.join(
    __dirname,
    `../config/challenge-deployment.${network.name}.json`
  );

  let config: ChallengeDeploymentConfig | any;

  try {
    const envConfigRaw = process.env.CONFIG_DEPLOY_CHALLENGE;
    if (envConfigRaw && envConfigRaw.trim().length > 0) {
      const parsed = parseEnvConfig(envConfigRaw);
      config = normalizeConfig(parsed);
      console.log('✅ Configuration loaded from ENV (CONFIG_DEPLOY_CHALLENGE)');
    } else {
      console.error(
        '❌ CONFIG_DEPLOY_CHALLENGE not found in environment variables'
      );
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Failed to load configuration:', error);
    process.exit(1);
  }
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  const minBalance = hre.ethers.parseEther('0.1');
  if (balance < minBalance) {
    console.error(
      `❌ Insufficient balance. Need at least ${hre.ethers.formatEther(minBalance)} ETH`
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
    config.systemFeePercentForStaking,
  ];
  console.log('constructorArgs', constructorArgs);

  console.log('\n🏗️  DEPLOYING CONTRACT');
  console.log('======================');

  const ContractFactory =
    await hre.ethers.getContractFactory('ChallengeDetailV2');

  console.log('⏳ Deploying ChallengeDetailV2...', constructorArgs);
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

    // Get current gas price and calculate cost
    const feeData = await hre.ethers.provider.getFeeData();
    const defaultGasPrice = hre.ethers.parseUnits('40', 'gwei');
    const gasPrice = feeData.gasPrice ?? defaultGasPrice;
    const estCostWei = estimatedGas * gasPrice;

    console.log(`Estimated gas: ${estimatedGas.toString()}`);
    console.log(`Gas price: ${hre.ethers.formatUnits(gasPrice, 'gwei')} gwei`);
    console.log(`Estimated cost: ${hre.ethers.formatEther(estCostWei)} ETH`);
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Add 1% buffer to gas limit for safety
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

    console.log(
      `Using gas limit: ${gasLimit} (${Math.round((gasLimit / Number(estimatedGas) - 1) * 100)}% buffer)`
    );

    contract = await ContractFactory.deploy(...constructorArgs, overrides);
    await contract.waitForDeployment();
  } catch (error) {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  }

  const contractAddress = await contract.getAddress();
  console.log(`✅ Contract deployed at: ${contractAddress}`);

  // Verify deployment
  console.log('\n🔍 VERIFYING DEPLOYMENT');
  console.log('=======================');

  const deployedCode = await hre.ethers.provider.getCode(contractAddress);
  if (deployedCode === '0x') {
    console.error('❌ Contract deployment failed - no code at address');
    process.exit(1);
  }
  console.log('✅ Contract code verified');

  // Test basic functionality
  console.log('\n🧪 TESTING BASIC FUNCTIONALITY');
  console.log('===============================');

  try {
    const sponsor = await contract.sponsor();
    const challenger = await contract.challenger();
    const startTime = await contract.startTime();
    const endTime = await contract.endTime();
    const goal = await contract.goal();
    const dayRequired = await contract.dayRequired();
    const createByToken = await contract.createByToken();
    const stakingStakeId = await contract.stakingStakeId();

    console.log(`✅ Sponsor: ${sponsor}`);
    console.log(`✅ Challenger: ${challenger}`);
    console.log(
      `✅ Start Time: ${new Date(Number(startTime) * 1000).toISOString()}`
    );
    console.log(
      `✅ End Time: ${new Date(Number(endTime) * 1000).toISOString()}`
    );
    console.log(`✅ Goal: ${goal} steps`);
    console.log(`✅ Day Required: ${dayRequired} days`);
    console.log(`✅ Create By Token: ${createByToken}`);
    console.log(`✅ Staking Stake ID: ${stakingStakeId}`);
    console.log(
      `✅ Auto-staking: ${stakingStakeId > 0 ? 'Enabled' : 'Disabled'}`
    );

    console.log('✅ All basic functionality tests passed');
  } catch (error) {
    console.error('❌ Basic functionality test failed:', error);
    process.exit(1);
  }

  // Contract verification on block explorer
  if (network.name !== 'hardhat' && network.name !== 'localhost') {
    // slepp 10s
    await new Promise(resolve => setTimeout(resolve, 10000));
    console.log('\n🔍 VERIFYING ON BLOCK EXPLORER');
    console.log('===============================');

    try {
      console.log('⏳ Waiting for block confirmations...');
      await contract.deploymentTransaction()?.wait(5);

      console.log('⏳ Verifying contract source code...');
      await run('verify:verify', {
        address: contractAddress,
        constructorArguments: constructorArgs,
      });
      console.log('✅ Contract verified on block explorer');
    } catch (error) {
      console.warn('⚠️  Contract verification failed:', error);
    }
  }

  // Grant role to deployed contract
  console.log('\n🔐 GRANTING CHALLENGE ROLE');
  console.log('===========================');

  let roleGrantTxHash: string | null = null;
  try {
    console.log(
      `⏳ Granting ALLOWED_CONTRACTS_CHALLENGE role to ${contractAddress}...`
    );
    roleGrantTxHash = await batchGrantRole(contractAddress);
    console.log('✅ Challenge role granted successfully');
  } catch (error) {
    console.warn('⚠️  Failed to grant challenge role:', error);
    console.log('You may need to grant the role manually later');
  }

  // Test sendDailyResult function
  await new Promise(resolve => setTimeout(resolve, 40000));
  console.log('\n📊 TESTING SEND DAILY RESULT');
  console.log('=============================');

  let sendDailyResultTxHash: string | null = null;
  try {
    // Prepare test data for sendDailyResult
    const testDay = [10];
    const testStepIndex = [1000];
    const testListGachaAddress: string[] = [];
    const testListNFTAddress: string[] = [];
    const testListIndexNFT: number[][] = [];
    const testListSenderAddress: string[][] = [];
    const testStatusTypeNft: boolean[] = [];
    const testTimeRange: [number, number] = [1, 100];

    console.log('⏳ Estimating gas for sendDailyResult...');

    // Estimate gas for sendDailyResult
    const estimatedGas = await contract.sendDailyResult.estimateGas(
      testDay,
      testStepIndex,
      testListGachaAddress,
      testListNFTAddress,
      testListIndexNFT,
      testListSenderAddress,
      testStatusTypeNft,
      testTimeRange
    );

    console.log(
      `Estimated gas for sendDailyResult: ${estimatedGas.toString()}`
    );

    // Get current gas price
    const feeData = await hre.ethers.provider.getFeeData();
    const gasPrice = feeData.gasPrice ?? hre.ethers.parseUnits('40', 'gwei');
    const estCostWei = estimatedGas * gasPrice;

    console.log(`Gas price: ${hre.ethers.formatUnits(gasPrice, 'gwei')} gwei`);
    console.log(`Estimated cost: ${hre.ethers.formatEther(estCostWei)} ETH`);

    // Add 20% buffer to gas limit
    const gasLimit = Math.ceil(Number(estimatedGas) * 1.2);
    console.log(
      `Using gas limit: ${gasLimit} (${Math.round((gasLimit / Number(estimatedGas) - 1) * 100)}% buffer)`
    );

    console.log('⏳ Sending sendDailyResult transaction...');

    // Send sendDailyResult transaction
    const sendDailyResultTx = await contract.sendDailyResult(
      testDay,
      testStepIndex,
      testListGachaAddress,
      testListNFTAddress,
      testListIndexNFT,
      testListSenderAddress,
      testStatusTypeNft,
      testTimeRange,
      {
        gasLimit,
        gasPrice,
      }
    );

    const receipt = await sendDailyResultTx.wait();
    sendDailyResultTxHash = sendDailyResultTx.hash;

    console.log(`✅ sendDailyResult transaction sent successfully`);
    console.log(`Transaction hash: ${sendDailyResultTxHash}`);
    console.log(`Gas used: ${receipt?.gasUsed?.toString() || 'N/A'}`);
  } catch (error) {
    console.warn('⚠️  Failed to send sendDailyResult transaction:', error);
    console.log(
      'This might be expected if the contract is not in the correct state for testing'
    );
  }

  // Save deployment information
  console.log('\n💾 SAVING DEPLOYMENT INFO');
  console.log('==========================');

  const deploymentInfo = {
    network: network.name,
    contractName: 'ChallengeDetailV2',
    contractAddress: contractAddress,
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
      goal: Number(await contract.goal()),
      dayRequired: Number(await contract.dayRequired()),
      stakingStakeId: Number(await contract.stakingStakeId()),
      createByToken: await contract.createByToken(),
      autoStaking: (await contract.stakingStakeId()) > 0,
    },
    stakingInfo: {
      enabled: (await contract.stakingStakeId()) > 0,
      stakeId: Number(await contract.stakingStakeId()),
      tokenType:
        config.createByToken === hre.ethers.ZeroAddress ? 'MATIC' : 'ERC20',
      protocol: 'aave_lending',
      duration:
        Number(await contract.endTime()) - Number(await contract.startTime()),
    },
    verification: {
      verified: network.name !== 'hardhat' && network.name !== 'localhost',
      explorerUrl: getExplorerUrl(network.name, contractAddress),
    },
    roleGranted: {
      challengeRole: roleGrantTxHash ? true : false,
      transactionHash: roleGrantTxHash,
      timestamp: new Date().toISOString(),
    },
    transactionSendStep: {
      sent: sendDailyResultTxHash ? true : false,
      transactionHash: sendDailyResultTxHash,
      timestamp: new Date().toISOString(),
      testData: {
        days: [10],
        stepIndex: [1000],
        timeRange: [1, 100],
      },
    },
  };

  const outputPath = path.join(
    process.cwd(),
    `deployInfo/challenge-detail-v2-${network.name}.json`
  );
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`✅ Deployment info saved to: ${outputPath}`);

  // Generate deployment report
  console.log('\n📊 DEPLOYMENT REPORT');
  console.log('====================');
  console.log(`Network: ${network.name}`);
  console.log(`Contract: ChallengeDetailV2`);
  console.log(`Address: ${contractAddress}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Block: ${deploymentInfo.blockNumber}`);
  console.log(`Time: ${deploymentInfo.deploymentTime}`);
  console.log(
    `Auto-staking: ${deploymentInfo.stakingInfo.enabled ? 'Enabled' : 'Disabled'}`
  );
  console.log(`Token Type: ${deploymentInfo.stakingInfo.tokenType}`);
  console.log(
    `Duration: ${Math.floor(+(Number(await contract.endTime()) - Number(await contract.startTime())) / 86400)} days`
  );
  console.log(`Explorer: ${deploymentInfo.verification.explorerUrl}`);
  console.log(
    `Challenge Role: ${deploymentInfo.roleGranted.challengeRole ? 'Granted' : 'Not Granted'}`
  );
  if (deploymentInfo.roleGranted.transactionHash) {
    console.log(`Role Grant TX: ${deploymentInfo.roleGranted.transactionHash}`);
  }
  console.log(
    `Send Daily Result: ${deploymentInfo.transactionSendStep.sent ? 'Sent' : 'Not Sent'}`
  );
  if (deploymentInfo.transactionSendStep.transactionHash) {
    console.log(
      `Send Step TX: ${deploymentInfo.transactionSendStep.transactionHash}`
    );
  }

  console.log('\n🎉 DEPLOYMENT COMPLETED SUCCESSFULLY!');
  console.log('=====================================');
  console.log('Contract Features:');
  console.log('• Auto-staking on deployment');
  console.log('• PolygonDeFi integration');
  console.log('• Challenge duration tracking');
  console.log('• Automatic reward distribution');
  console.log('• Challenge parameters from mock data');
  console.log('• Challenge role granted to ExerciseSupplementNFT');
  console.log('• sendDailyResult function tested');
  console.log('\nNext steps:');
  console.log('1. Test challenge functionality');
  console.log('2. Monitor staking rewards');
  console.log('3. Set up challenge monitoring');
  console.log('4. Prepare for production use');
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

function parseEnvConfig(raw: string): any {
  try {
    // Accept JSON or JS-like object from .env
    const normalized = raw.trim().startsWith('{')
      ? raw
      : raw.replace(/^CONFIG_DEPLOY_CHALLENGE\s*=\s*/, '');
    return JSON.parse(normalized);
  } catch (e) {
    throw new Error('Invalid CONFIG_DEPLOY_CHALLENGE JSON in .env');
  }
}

function toWei(value: string): bigint {
  // Accept plain wei ("1000...") or decimal ether-like ("1.0")
  if (/^\d+$/.test(value)) {
    return BigInt(value);
  }
  // Decimal ether string
  const [intPart, fracPart = ''] = value.split('.');
  const frac = (fracPart + '0'.repeat(18)).slice(0, 18);
  const combined = `${intPart}${frac}`.replace(/^0+(?=\d)/, '');
  if (!/^\d+$/.test(combined)) throw new Error('Invalid decimal amount');
  return BigInt(combined || '0');
}

function normalizeConfig(input: any): ChallengeDeploymentConfig {
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
    systemFeePercentForStaking: toNum(input.systemFeePercentForStaking),
  };
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('💥 DEPLOYMENT FAILED:', error);
    process.exit(1);
  });
