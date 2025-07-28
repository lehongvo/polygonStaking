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
  console.log('🚀 Deploying ExerciseSupplementNFT to Polygon...');

  const [deployer] = await hre.ethers.getSigners();
  console.log('Deployer address:', deployer.address);

  // Get network info
  const networkInfo = await hre.ethers.provider.getNetwork();
  const networkName = network.name;
  console.log(`Network: ${networkName} (Chain ID: ${networkInfo.chainId})`);

  try {
    // Deploy ExerciseSupplementNFT (Regular deployment)
    console.log('\n📝 Deploying ExerciseSupplementNFT...');
    const ExerciseSupplementNFT = await hre.ethers.getContractFactory('ExerciseSupplementNFT');
    
    // Deploy without constructor arguments
    const exerciseNft = await ExerciseSupplementNFT.deploy();
    await exerciseNft.waitForDeployment();
    
    const contractAddress = await exerciseNft.getAddress();
    console.log(`✅ ExerciseSupplementNFT deployed to: ${contractAddress}`);

    // Save deployment info
    const deploymentInfo: DeploymentInfo = {
      network: networkName,
      chainId: Number(networkInfo.chainId),
      explorer: getExplorerUrl(networkName),
      deployer: deployer.address,
      contractName: 'ExerciseSupplementNFT',
      contractAddress: contractAddress,
      constructorArgs: [], // No constructor args
      deploymentDate: new Date().toISOString(),
      verified: false
    };

    // Write deployment info to file
    const deploymentPath = path.join(__dirname, '..', 'exercise-nft-deployment.json');
    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));

    console.log('\n🔍 Verifying contract...');
    
    // Wait a bit before verification
    console.log('⏳ Waiting 30 seconds before verification...');
    await new Promise(resolve => setTimeout(resolve, 30000));

    try {
      // Verify contract (no constructor arguments needed)
      console.log('📋 Verifying contract...');
      await run('verify:verify', {
        address: contractAddress,
        constructorArguments: []
      });

      deploymentInfo.verified = true;
      fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
      
      console.log('✅ Contract verified successfully!');
      
    } catch (verifyError) {
      console.warn('⚠️ Verification failed:', verifyError);
      console.log('You can verify manually later using:');
      console.log(`yarn hardhat verify --network ${networkName} ${contractAddress}`);
    }

    console.log('\n🎉 Deployment Summary:');
    console.log('======================');
    console.log(`Network: ${networkName}`);
    console.log(`Deployer: ${deployer.address}`);
    console.log(`Contract Address: ${contractAddress}`);
    console.log(`Verified: ${deploymentInfo.verified ? '✅' : '❌'}`);

    if (deploymentInfo.explorer) {
      console.log('\n🔗 Explorer Link:');
      console.log(`- Contract: ${deploymentInfo.explorer}/address/${contractAddress}`);
    }

    console.log(`\n📄 Deployment info saved to: ${deploymentPath}`);

  } catch (error) {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  }
}

function getExplorerUrl(network: string): string {
  const explorers: { [key: string]: string } = {
    'polygon': 'https://polygonscan.com',
    'amoy': 'https://amoy.polygonscan.com',
    'mumbai': 'https://mumbai.polygonscan.com',
    'localhost': '',
    'hardhat': ''
  };
  
  return explorers[network] || '';
}

main()
  .then(() => {
    console.log('\n🎉 ExerciseSupplementNFT deployment completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Deployment error:', error);
    process.exit(1);
  }); 