import 'dotenv/config';
import { network } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

const hre = require('hardhat');

interface WalkingSpeedDeploymentInfo {
  network: string;
  contractName: string;
  contractAddress: string;
  constructorArgs: {
    primaryRequired: number[]; // [duration, startTime, endTime, goal, dayRequired]
    walkingSpeedData: number[]; // [targetSpeed, requiredMinutesPerDay, minAchievementDays]
  };
}

async function main() {
  console.log('🚀 SEND STEP FOR CHALLENGE WALKING SPEED');
  console.log('========================================');

  const [sender] = await hre.ethers.getSigners();
  console.log(`📍 Network: ${network.name}`);
  console.log(`👤 Sender: ${sender.address}`);

  // Load deployment info
  const infoPath = path.join(
    process.cwd(),
    `deployInfo/challenge-walking-speed-${network.name}.json`
  );

  if (!fs.existsSync(infoPath)) {
    console.error(`❌ Deployment info not found at: ${infoPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(infoPath, 'utf8');
  const deploymentInfo: WalkingSpeedDeploymentInfo = JSON.parse(raw);

  const contractAddress = deploymentInfo.contractAddress;
  console.log(`📄 Using contract at: ${contractAddress}`);

  const primaryRequired = deploymentInfo.constructorArgs.primaryRequired;
  const walkingSpeedData = deploymentInfo.constructorArgs.walkingSpeedData;

  const startTime = Number(primaryRequired[1]);
  const goal = Number(primaryRequired[3] || 0);
  const requiredMinutesPerDay = Number(walkingSpeedData[1] || 0);

  console.log('primaryRequired:', primaryRequired);
  console.log('walkingSpeedData:', walkingSpeedData);

  // Build test data (2 days)
  const day1 = startTime + 100;
  const day2 = startTime + 300;

  const days = [110];
  const steps = [1000000];

  // Ensure minutes > requiredMinutesPerDay so walking speed passes
  const minutes = [
    requiredMinutesPerDay > 0 ? requiredMinutesPerDay + 1 : 30,
    requiredMinutesPerDay > 0 ? requiredMinutesPerDay + 2 : 30,
  ];

  // timeRange should cover both days
  const timeRange: [number, number] = [110, 200];

  const emptyAddresses: string[] = [];
  const emptyIndex: number[][] = [];
  const emptySender: string[][] = [];
  const emptyStatus: boolean[] = [];

  const contract = await hre.ethers.getContractAt(
    'ChallengeWalkingSpeed',
    contractAddress
  );

  console.log('\n📊 SENDING sendDailyResult');
  console.log('==========================');
  console.log({
    days,
    steps,
    emptyAddresses1: emptyAddresses,
    emptyAddresses2: emptyAddresses,
    emptyIndex,
    emptySender,
    emptyStatus,
    timeRange,
    minutes,
  });

  try {
    const estimatedGas = await contract.sendDailyResult.estimateGas(
      days,
      steps,
      emptyAddresses,
      emptyAddresses,
      emptyIndex,
      emptySender,
      emptyStatus,
      timeRange,
      minutes
    );

    const feeData = await hre.ethers.provider.getFeeData();
    const gasPrice = feeData.gasPrice ?? hre.ethers.parseUnits('40', 'gwei');
    const gasLimit = Math.ceil(Number(estimatedGas) * 1.2);

    console.log(`Estimated gas: ${estimatedGas.toString()}`);
    console.log(`Gas price: ${hre.ethers.formatUnits(gasPrice, 'gwei')} gwei`);
    console.log(`Gas limit: ${gasLimit}`);

    const tx = await contract.sendDailyResult(
      days,
      steps,
      emptyAddresses,
      emptyAddresses,
      emptyIndex,
      emptySender,
      emptyStatus,
      timeRange,
      minutes,
      {
        gasLimit,
        gasPrice,
      }
    );

    const receipt = await tx.wait();
    console.log(`✅ sendDailyResult tx hash: ${tx.hash}`);
    console.log(`Gas used: ${receipt?.gasUsed?.toString() || 'N/A'}`);
  } catch (error) {
    console.error('❌ Failed to send sendDailyResult:', error);
    process.exit(1);
  }

  console.log('\n🎉 SEND STEP COMPLETED');
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('💥 SCRIPT FAILED:', error);
    process.exit(1);
  });
