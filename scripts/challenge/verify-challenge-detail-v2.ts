import 'dotenv/config';
import * as fs from 'fs';
import { ethers, network, run } from 'hardhat';
import * as path from 'path';

const hre = require('hardhat');

interface DeploymentInfo {
  network: string;
  contractName: string;
  contractAddress: string;
  deployer: string;
  deploymentTime: string;
  blockNumber: number;
  constructorArgs: any;
  verification: {
    verified: boolean;
    explorerUrl: string;
  };
}

async function main() {
  console.log('🔍 CHALLENGE DETAIL V2 VERIFICATION');
  console.log('====================================');

  // Load deployment info
  const deploymentPath = path.join(
    process.cwd(),
    `deployInfo/challenge-detail-v2-${network.name}.json`
  );

  if (!fs.existsSync(deploymentPath)) {
    console.error(`❌ Deployment info not found: ${deploymentPath}`);
    console.log('Please run deployment script first');
    process.exit(1);
  }

  const deploymentInfo: DeploymentInfo = JSON.parse(
    fs.readFileSync(deploymentPath, 'utf8')
  );

  console.log(`📍 Network: ${network.name}`);
  console.log(`📄 Contract: ${deploymentInfo.contractName}`);
  console.log(`📍 Address: ${deploymentInfo.contractAddress}`);
  console.log(`👤 Deployer: ${deploymentInfo.deployer}`);

  // Check if already verified
  if (deploymentInfo.verification.verified) {
    console.log('✅ Contract is already verified');
    console.log(`🔗 Explorer: ${deploymentInfo.verification.explorerUrl}`);
    return;
  }

  // Skip verification for local networks
  if (network.name === 'hardhat' || network.name === 'localhost') {
    console.log('⚠️  Skipping verification for local network');
    return;
  }

  // Verify contract
  console.log('\n🔍 VERIFYING CONTRACT');
  console.log('=====================');

  try {
    console.log('⏳ Verifying contract source code...');
    
    await run('verify:verify', {
      address: deploymentInfo.contractAddress,
      constructorArguments: [
        deploymentInfo.constructorArgs.stakeHolders,
        deploymentInfo.constructorArgs.createByToken,
        deploymentInfo.constructorArgs.erc721Addresses,
        deploymentInfo.constructorArgs.primaryRequired,
        deploymentInfo.constructorArgs.awardReceivers,
        deploymentInfo.constructorArgs.index,
        deploymentInfo.constructorArgs.allowGiveUp,
        deploymentInfo.constructorArgs.gasData.map((g: string) => ethers.parseEther(g)),
        deploymentInfo.constructorArgs.allAwardToSponsorWhenGiveUp,
        deploymentInfo.constructorArgs.awardReceiversPercent,
        ethers.parseEther(deploymentInfo.constructorArgs.totalAmount)
      ],
    });

    console.log('✅ Contract verified successfully!');

    // Update deployment info
    deploymentInfo.verification.verified = true;
    deploymentInfo.verification.explorerUrl = getExplorerUrl(
      network.name, 
      deploymentInfo.contractAddress
    );

    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
    console.log('✅ Deployment info updated');

  } catch (error: any) {
    if (error.message.includes('Already Verified')) {
      console.log('✅ Contract was already verified!');
      
      // Update deployment info
      deploymentInfo.verification.verified = true;
      deploymentInfo.verification.explorerUrl = getExplorerUrl(
        network.name, 
        deploymentInfo.contractAddress
      );
      
      fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
    } else {
      console.error('❌ Verification failed:', error.message);
      console.log('\n🔧 Manual verification command:');
      console.log(`npx hardhat verify --network ${network.name} ${deploymentInfo.contractAddress} \\`);
      console.log(`  "${deploymentInfo.constructorArgs.stakeHolders}" \\`);
      console.log(`  "${deploymentInfo.constructorArgs.createByToken}" \\`);
      console.log(`  "${deploymentInfo.constructorArgs.erc721Addresses}" \\`);
      console.log(`  "${deploymentInfo.constructorArgs.primaryRequired}" \\`);
      console.log(`  "${deploymentInfo.constructorArgs.awardReceivers}" \\`);
      console.log(`  ${deploymentInfo.constructorArgs.index} \\`);
      console.log(`  "${deploymentInfo.constructorArgs.allowGiveUp}" \\`);
      console.log(`  "${deploymentInfo.constructorArgs.gasData.map((g: string) => ethers.parseEther(g))}" \\`);
      console.log(`  ${deploymentInfo.constructorArgs.allAwardToSponsorWhenGiveUp} \\`);
      console.log(`  "${deploymentInfo.constructorArgs.awardReceiversPercent}" \\`);
      console.log(`  ${ethers.parseEther(deploymentInfo.constructorArgs.totalAmount)}`);
      process.exit(1);
    }
  }

  // Display verification result
  console.log('\n📊 VERIFICATION RESULT');
  console.log('======================');
  console.log(`Network: ${network.name}`);
  console.log(`Contract: ${deploymentInfo.contractName}`);
  console.log(`Address: ${deploymentInfo.contractAddress}`);
  console.log(`Verified: ✅ Yes`);
  console.log(`Explorer: ${deploymentInfo.verification.explorerUrl}`);
  console.log(`Source Code: ${deploymentInfo.verification.explorerUrl}#code`);
  console.log(`Read Contract: ${deploymentInfo.verification.explorerUrl}#readContract`);
  console.log(`Write Contract: ${deploymentInfo.verification.explorerUrl}#writeContract`);

  console.log('\n🎉 VERIFICATION COMPLETED SUCCESSFULLY!');
  console.log('=====================================');
  console.log('Contract is now publicly verifiable on the block explorer');
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
    console.error('💥 VERIFICATION FAILED:', error);
    process.exit(1);
  });
