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
  console.log('🚀 Deploying SoulBoundNFT to network...');

  const [deployer] = await hre.ethers.getSigners();
  console.log('Deployer address:', deployer.address);

  // Get network info
  const networkInfo = await hre.ethers.provider.getNetwork();
  const networkName = network.name;
  console.log(`Network: ${networkName} (Chain ID: ${networkInfo.chainId})`);

  // Constructor parameters
  const contractName = 'Soul Bound NFT';
  const contractSymbol = 'SBNFT';
  const baseURI = 'https://api.soulbound.com/metadata/';

  const constructorArgs = [contractName, contractSymbol, baseURI];

  try {
    // Deploy SoulBoundNFT
    console.log('\n📝 Deploying SoulBoundNFT...');
    console.log(`Constructor Args:`);
    console.log(`- Name: ${contractName}`);
    console.log(`- Symbol: ${contractSymbol}`);
    console.log(`- Base URI: ${baseURI}`);

    const SoulBoundNFT = await hre.ethers.getContractFactory('SoulBoundNFT');

    // Deploy with constructor arguments
    const soulBoundNft = await SoulBoundNFT.deploy(
      contractName,
      contractSymbol,
      baseURI
    );
    await soulBoundNft.waitForDeployment();

    const contractAddress = await soulBoundNft.getAddress();
    console.log(`✅ SoulBoundNFT deployed to: ${contractAddress}`);

    // Save deployment info
    const deploymentInfo: DeploymentInfo = {
      network: networkName,
      chainId: Number(networkInfo.chainId),
      explorer: getExplorerUrl(networkName),
      deployer: deployer.address,
      contractName: 'SoulBoundNFT',
      contractAddress: contractAddress,
      constructorArgs: constructorArgs,
      deploymentDate: new Date().toISOString(),
      verified: false,
    };

    // Write deployment info to file
    const deploymentPath = path.join(
      __dirname,
      '..',
      'soulbound-nft-deployment.json'
    );
    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));

    console.log('\n🔍 Verifying contract...');

    // Wait a bit before verification
    console.log('⏳ Waiting 30 seconds before verification...');
    await new Promise(resolve => setTimeout(resolve, 30000));

    try {
      // Verify contract with constructor arguments
      console.log('📋 Verifying contract...');
      await run('verify:verify', {
        address: contractAddress,
        constructorArguments: constructorArgs,
      });

      deploymentInfo.verified = true;
      fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));

      console.log('✅ Contract verified successfully!');
    } catch (verifyError) {
      console.warn('⚠️ Verification failed:', verifyError);
      console.log('You can verify manually later using:');
      console.log(
        `yarn hardhat verify --network ${networkName} ${contractAddress} "${contractName}" "${contractSymbol}" "${baseURI}"`
      );
    }

    // Test basic functionality
    console.log('\n🧪 Testing basic functionality...');
    try {
      const nextTokenId = await soulBoundNft.nextTokenIdToMint();
      console.log(`Next token ID to mint: ${nextTokenId}`);

      const isSoulBound = await soulBoundNft.isSoulBound();
      console.log(`Is Soul Bound: ${isSoulBound}`);

      const admins = await soulBoundNft.getAdmins();
      console.log(`Admins: ${admins}`);

      console.log('✅ Basic functionality test passed!');
    } catch (testError) {
      console.warn('⚠️ Basic functionality test failed:', testError);
    }

    console.log('\n🎉 Deployment Summary:');
    console.log('======================');
    console.log(`Network: ${networkName}`);
    console.log(`Deployer: ${deployer.address}`);
    console.log(`Contract Address: ${contractAddress}`);
    console.log(`Contract Name: ${contractName}`);
    console.log(`Contract Symbol: ${contractSymbol}`);
    console.log(`Base URI: ${baseURI}`);
    console.log(`Verified: ${deploymentInfo.verified ? '✅' : '❌'}`);

    if (deploymentInfo.explorer) {
      console.log('\n🔗 Explorer Link:');
      console.log(
        `- Contract: ${deploymentInfo.explorer}/address/${contractAddress}`
      );
    }

    console.log(`\n📄 Deployment info saved to: ${deploymentPath}`);
  } catch (error) {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  }
}

function getExplorerUrl(network: string): string {
  const explorers: { [key: string]: string } = {
    polygon: 'https://polygonscan.com',
    amoy: 'https://amoy.polygonscan.com',
    mumbai: 'https://mumbai.polygonscan.com',
    localhost: '',
    hardhat: '',
  };

  return explorers[network] || '';
}

main()
  .then(() => {
    console.log('\n🎉 SoulBoundNFT deployment completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Deployment error:', error);
    process.exit(1);
  });
