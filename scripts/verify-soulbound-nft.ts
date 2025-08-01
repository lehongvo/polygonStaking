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
  console.log('🔍 Verifying SoulBoundNFT contract...');

  // Read deployment info
  const deploymentPath = path.join(__dirname, '..', 'soulbound-nft-deployment.json');
  
  if (!fs.existsSync(deploymentPath)) {
    console.error('❌ Deployment file not found! Please deploy the contract first.');
    console.log(`Expected file: ${deploymentPath}`);
    process.exit(1);
  }

  const deploymentInfo: DeploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  
  // Get network info
  const networkInfo = await hre.ethers.provider.getNetwork();
  const networkName = network.name;
  
  console.log(`Network: ${networkName} (Chain ID: ${networkInfo.chainId})`);
  console.log(`Contract Address: ${deploymentInfo.contractAddress}`);
  console.log(`Constructor Args: ${JSON.stringify(deploymentInfo.constructorArgs)}`);

  // Check if already verified
  if (deploymentInfo.verified) {
    console.log('✅ Contract is already verified!');
    if (deploymentInfo.explorer) {
      console.log(`🔗 View on explorer: ${deploymentInfo.explorer}/address/${deploymentInfo.contractAddress}`);
    }
    return;
  }

  // Verify network matches
  if (deploymentInfo.network !== networkName) {
    console.error(`❌ Network mismatch! Deployment was on ${deploymentInfo.network}, current network is ${networkName}`);
    process.exit(1);
  }

  try {
    console.log('\n📋 Verifying contract on blockchain...');
    
    await run('verify:verify', {
      address: deploymentInfo.contractAddress,
      constructorArguments: deploymentInfo.constructorArgs
    });

    // Update deployment info
    deploymentInfo.verified = true;
    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
    
    console.log('✅ Contract verified successfully!');
    
    console.log('\n🎉 Verification Summary:');
    console.log('========================');
    console.log(`Network: ${networkName}`);
    console.log(`Contract: ${deploymentInfo.contractName}`);
    console.log(`Address: ${deploymentInfo.contractAddress}`);
    console.log(`Constructor Args:`);
    deploymentInfo.constructorArgs.forEach((arg, index) => {
      const argNames = ['name', 'symbol', 'baseURI'];
      console.log(`  ${argNames[index] || `arg${index}`}: ${arg}`);
    });

    if (deploymentInfo.explorer) {
      console.log('\n🔗 Explorer Links:');
      console.log(`- Contract: ${deploymentInfo.explorer}/address/${deploymentInfo.contractAddress}`);
      console.log(`- Verified Code: ${deploymentInfo.explorer}/address/${deploymentInfo.contractAddress}#code`);
    }

  } catch (error: any) {
    console.error('❌ Verification failed:', error.message);
    
    if (error.message.includes('Already Verified')) {
      console.log('✅ Contract was already verified on the blockchain!');
      deploymentInfo.verified = true;
      fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
    } else {
      console.log('\n🔧 Manual verification command:');
      const [name, symbol, baseURI] = deploymentInfo.constructorArgs;
      console.log(`yarn hardhat verify --network ${networkName} ${deploymentInfo.contractAddress} "${name}" "${symbol}" "${baseURI}"`);
      
      console.log('\n🔧 Alternative verification with escaped quotes:');
      console.log(`yarn hardhat verify --network ${networkName} ${deploymentInfo.contractAddress} \\"${name}\\" \\"${symbol}\\" \\"${baseURI}\\"`);
      
      process.exit(1);
    }
  }
}

main()
  .then(() => {
    console.log('\n🎉 Verification completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Verification error:', error);
    process.exit(1);
  }); 