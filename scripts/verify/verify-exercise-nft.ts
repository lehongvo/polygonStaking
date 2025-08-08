import * as fs from 'fs';
import { network, run } from 'hardhat';
import * as path from 'path';

const hre = require('hardhat');

interface DeploymentInfo {
  network: string;
  chainId: number;
  explorer?: string;
  deployer: string;
  contractName: string;
  contractAddress: string;
  constructorArgs: any[];
  deploymentDate: string;
  verified: boolean;
}

async function main() {
  console.log('🔍 Verifying ExerciseSupplementNFT contract...');

  const networkName = network.name;
  console.log(`Network: ${networkName}`);

  // Read deployment info
  const deploymentPath = path.join(
    __dirname,
    '..',
    'exercise-nft-deployment.json'
  );

  if (!fs.existsSync(deploymentPath)) {
    console.error('❌ Deployment info file not found. Please deploy first.');
    process.exit(1);
  }

  const deploymentInfo: DeploymentInfo = JSON.parse(
    fs.readFileSync(deploymentPath, 'utf8')
  );

  if (deploymentInfo.network !== networkName) {
    console.error(
      `❌ Network mismatch. Deployment was on ${deploymentInfo.network}, current network is ${networkName}`
    );
    process.exit(1);
  }

  console.log(`Contract Address: ${deploymentInfo.contractAddress}`);

  try {
    // Verify contract (no constructor arguments)
    console.log('\n📋 Verifying contract...');
    await run('verify:verify', {
      address: deploymentInfo.contractAddress,
      constructorArguments: [],
    });
    console.log('✅ Contract verified!');

    // Update deployment info
    deploymentInfo.verified = true;
    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));

    console.log('\n🎉 Verification Summary:');
    console.log('========================');
    console.log(`Network: ${networkName}`);
    console.log(`Contract Address: ${deploymentInfo.contractAddress} ✅`);

    if (deploymentInfo.explorer) {
      console.log('\n🔗 Verified Explorer Link:');
      console.log(
        `- Contract: ${deploymentInfo.explorer}/address/${deploymentInfo.contractAddress}`
      );
    }
  } catch (error) {
    console.error('❌ Verification failed:', error);
    console.log('\n🔧 Manual verification command:');
    console.log(
      `yarn hardhat verify --network ${networkName} ${deploymentInfo.contractAddress}`
    );
    process.exit(1);
  }
}

main()
  .then(() => {
    console.log(
      '\n🎉 ExerciseSupplementNFT verification completed successfully!'
    );
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Verification error:', error);
    process.exit(1);
  });
