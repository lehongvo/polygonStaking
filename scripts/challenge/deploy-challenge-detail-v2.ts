import 'dotenv/config';
import * as fs from 'fs';
import { network, run } from 'hardhat';
import * as path from 'path';

const hre = require('hardhat');

interface ChallengeDeploymentConfig {
  // Challenge parameters
  stakeHolders: string[];
  createByToken: string; // address(0) for MATIC, token address for ERC20
  erc721Addresses: string[];
  primaryRequired: number[]; // [duration, startTime, endTime, goal, dayRequired]
  awardReceivers: string[];
  index: number;
  allowGiveUp: boolean[];
  gasData: string[]; // [gas1, gas2, gas3] in wei
  allAwardToSponsorWhenGiveUp: boolean;
  awardReceiversPercent: number[];
  totalAmount: string; // in wei
  
  // Network specific addresses
  exerciseSupplementNFT: string;
  challengeFee: string;
  ttjpToken?: string; // Optional TTJP token address
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

  // Load deployment configuration
  const configPath = path.join(
    __dirname,
    `../config/challenge-deployment.${network.name}.json`
  );
  
  let config: ChallengeDeploymentConfig;
  
  try {
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      console.log('✅ Configuration loaded from file');
    } else {
      // Use default configuration for testing
      config = getDefaultConfig(network.name);
      console.log('⚠️  Using default configuration (create config file for production)');
    }
  } catch (error) {
    console.error('❌ Failed to load configuration:', error);
    process.exit(1);
  }

  // Pre-deployment checks
  console.log('\n🔍 PRE-DEPLOYMENT CHECKS');
  console.log('========================');

  // Check deployer balance
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  const minBalance = hre.ethers.parseEther('0.1');
  if (balance < minBalance) {
    console.error(
      `❌ Insufficient balance. Need at least ${hre.ethers.formatEther(minBalance)} ETH`
    );
    process.exit(1);
  }
  console.log('✅ Deployer balance sufficient');

  // Validate configuration
  if (!hre.ethers.isAddress(config.exerciseSupplementNFT)) {
    console.error('❌ Invalid ExerciseSupplementNFT address');
    process.exit(1);
  }
  console.log('✅ Configuration validated');

  // Use timing from config or calculate if needed
  let startTime, endTime, challengeDuration;
  
  if (config.primaryRequired[1] > 0 && config.primaryRequired[2] > 0) {
    // Use existing timing from config
    startTime = config.primaryRequired[1];
    endTime = config.primaryRequired[2];
    challengeDuration = endTime - startTime;
  } else {
    // Calculate new timing
    const now = Math.floor(Date.now() / 1000);
    startTime = now + 3600; // Start in 1 hour
    endTime = now + (7 * 24 * 3600); // End in 7 days
    challengeDuration = endTime - startTime;
    
    // Update primaryRequired with calculated times
    config.primaryRequired = [
      config.primaryRequired[0], // duration (steps) - keep original
      startTime, // startTime
      endTime, // endTime
      config.primaryRequired[3], // goal - keep original
      config.primaryRequired[4] // dayRequired - keep original
    ];
  }

  console.log(`📅 Challenge Duration: ${Math.floor(challengeDuration / 86400)} days`);
  console.log(`📅 Start Time: ${new Date(startTime * 1000).toISOString()}`);
  console.log(`📅 End Time: ${new Date(endTime * 1000).toISOString()}`);

  // Prepare constructor parameters
  const totalAmountWei = hre.ethers.parseEther(config.totalAmount);
  const constructorArgs = [
    config.stakeHolders,
    config.createByToken,
    config.erc721Addresses,
    config.primaryRequired,
    config.awardReceivers,
    config.index,
    config.allowGiveUp,
    config.gasData.map(g => hre.ethers.parseEther(g)),
    config.allAwardToSponsorWhenGiveUp,
    config.awardReceiversPercent,
    totalAmountWei
  ];

  // Deploy contract
  console.log('\n🏗️  DEPLOYING CONTRACT');
  console.log('======================');

  const ContractFactory = await hre.ethers.getContractFactory('ChallengeDetailV2');

  console.log('⏳ Deploying ChallengeDetailV2...');
  
  // Determine if we need to send value (for MATIC staking)
  const deployOptions = config.createByToken === hre.ethers.ZeroAddress 
    ? { value: totalAmountWei }
    : {};

  const contract = await ContractFactory.deploy(...constructorArgs, deployOptions);
  await contract.waitForDeployment();

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
    const stakingStakeId = await contract.stakingStakeId();
    const createByToken = await contract.createByToken();

    console.log(`✅ Sponsor: ${sponsor}`);
    console.log(`✅ Challenger: ${challenger}`);
    console.log(`✅ Start Time: ${new Date(Number(startTime) * 1000).toISOString()}`);
    console.log(`✅ End Time: ${new Date(Number(endTime) * 1000).toISOString()}`);
    console.log(`✅ Goal: ${goal} steps`);
    console.log(`✅ Day Required: ${dayRequired} days`);
    console.log(`✅ Staking Stake ID: ${stakingStakeId}`);
    console.log(`✅ Create By Token: ${createByToken}`);
    console.log(`✅ Auto-staking: ${stakingStakeId > 0 ? 'Enabled' : 'Disabled'}`);
    
    console.log('✅ All basic functionality tests passed');
  } catch (error) {
    console.error('❌ Basic functionality test failed:', error);
    process.exit(1);
  }

  // Contract verification on block explorer
  if (network.name !== 'hardhat' && network.name !== 'localhost') {
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
      tokenType: config.createByToken === hre.ethers.ZeroAddress ? 'MATIC' : 'ERC20',
      protocol: 'aave_lending',
      duration: challengeDuration,
    },
    verification: {
      verified: network.name !== 'hardhat' && network.name !== 'localhost',
      explorerUrl: getExplorerUrl(network.name, contractAddress),
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
  console.log(`Auto-staking: ${deploymentInfo.stakingInfo.enabled ? 'Enabled' : 'Disabled'}`);
  console.log(`Token Type: ${deploymentInfo.stakingInfo.tokenType}`);
  console.log(`Duration: ${Math.floor(challengeDuration / 86400)} days`);
  console.log(`Explorer: ${deploymentInfo.verification.explorerUrl}`);

  console.log('\n🎉 DEPLOYMENT COMPLETED SUCCESSFULLY!');
  console.log('=====================================');
  console.log('Contract Features:');
  console.log('• Auto-staking on deployment');
  console.log('• PolygonDeFi integration');
  console.log('• Challenge duration tracking');
  console.log('• Automatic reward distribution');
  console.log('• Challenge parameters from mock data');
  console.log('\nNext steps:');
  console.log('1. Test challenge functionality');
  console.log('2. Monitor staking rewards');
  console.log('3. Set up challenge monitoring');
  console.log('4. Prepare for production use');
}

function getDefaultConfig(networkName: string): ChallengeDeploymentConfig {
  // Data from mock/index.js
  const stakeHolders = [
    "0xa826774CA92237635421FeBe045CA2f3D1D4dbf0", // sponsor
    "0xa826774CA92237635421FeBe045CA2f3D1D4dbf0", // challenger  
    "0xa826774CA92237635421FeBe045CA2f3D1D4dbf0"  // feeAddress
  ];
  
  return {
    stakeHolders: stakeHolders,
    createByToken: "0x0000000000000000000000000000000000000000", // Use MATIC
    erc721Addresses: [
      "0x55285EcCef5487E87C5980C880131aCadDE7767C"
    ],
    primaryRequired: [1, 1752742657, 1759742657, 100, 1], // Will be updated with real times
    awardReceivers: [
      "0xa826774CA92237635421FeBe045CA2f3D1D4dbf0", 
      "0xa826774CA92237635421FeBe045CA2f3D1D4dbf0"
    ],
    index: 1,
    allowGiveUp: [true, true, true],
    gasData: ['0.2', '0.2', '0'], // Convert from wei: 200000000000000000 = 0.2 ETH
    allAwardToSponsorWhenGiveUp: true,
    awardReceiversPercent: [100, 100],
    totalAmount: '0.001', // Convert from wei: 1000000000000 = 0.001 ETH (small amount for testing)
    exerciseSupplementNFT: "0x55285EcCef5487E87C5980C880131aCadDE7767C",
    challengeFee: "0x0000000000000000000000000000000000000000",
  };
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

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('💥 DEPLOYMENT FAILED:', error);
    process.exit(1);
  });
