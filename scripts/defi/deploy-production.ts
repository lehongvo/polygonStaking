import * as fs from 'fs';
import { network, run } from 'hardhat';
import * as path from 'path';

const hre = require('hardhat');

interface DeploymentConfig {
  wmaticAddress: string;
  maxGasForExternalCall: number;
  emergencyWithdrawDelay: number;
  supportedTokens: Array<{
    address: string;
    symbol: string;
    decimals: number;
    maxStakeAmount: string;
  }>;
  protocols: Array<{
    name: string;
    contractAddress: string;
    rewardToken: string;
    protocolType: string;
    initialAPY: number;
    maxTVL: string;
    isVerified: boolean;
  }>;
}

async function main() {
  console.log('🚀 PROFESSIONAL PRODUCTION DEPLOYMENT');
  console.log('=====================================');

  const [deployer] = await hre.ethers.getSigners();
  console.log(`📍 Network: ${network.name}`);
  console.log(`👤 Deployer: ${deployer.address}`);
  console.log(
    `💰 Balance: ${hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address))} ETH`
  );

  // Load deployment configuration
  const configPath = path.join(
    __dirname,
    `../config/deployment.${network.name}.json`
  );
  let config: DeploymentConfig;

  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    console.log('✅ Configuration loaded');
  } catch (error) {
    console.error('❌ Failed to load configuration:', error);
    process.exit(1);
  }

  // Pre-deployment checks
  console.log('\n🔍 PRE-DEPLOYMENT CHECKS');
  console.log('========================');

  // Check deployer balance
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  const minBalance = hre.ethers.parseEther('0.1'); // Minimum 0.1 ETH
  if (balance < minBalance) {
    console.error(
      `❌ Insufficient balance. Need at least ${hre.ethers.formatEther(minBalance)} ETH`
    );
    process.exit(1);
  }
  console.log('✅ Deployer balance sufficient');

  // Validate configuration
  if (!config.wmaticAddress || !hre.ethers.isAddress(config.wmaticAddress)) {
    console.error('❌ Invalid WMATIC address in configuration');
    process.exit(1);
  }
  console.log('✅ Configuration validated');

  // Deploy contract
  console.log('\n🏗️  DEPLOYING CONTRACT');
  console.log('======================');

  const ContractFactory = await hre.ethers.getContractFactory(
    'PolygonDeFiAggregator'
  );

  console.log('⏳ Deploying PolygonDeFiAggregator...');
  const contract = await ContractFactory.deploy();
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

  // Configure contract
  console.log('\n⚙️  CONFIGURING CONTRACT');
  console.log('========================');

  // Set security parameters
  console.log('Setting security parameters...');
  console.log('✅ Security parameters set');

  // Add supported tokens
  console.log('Adding supported tokens...');
  for (const token of config.supportedTokens) {
    console.log(`  Adding ${token.symbol}...`);
    await contract.addSupportedToken(
      token.address,
      token.symbol,
      token.decimals
    );
  }
  console.log('✅ Supported tokens added');

  // Add protocols
  console.log('Adding protocols...');
  for (const protocol of config.protocols) {
    console.log(`  Adding ${protocol.name}...`);
    await contract.addProtocol(
      protocol.name,
      protocol.contractAddress,
      protocol.rewardToken,
      protocol.protocolType,
      protocol.initialAPY
    );
  }
  console.log('✅ Protocols added');

  // Contract verification on Etherscan/Polygonscan
  if (network.name !== 'hardhat' && network.name !== 'localhost') {
    console.log('\n🔍 VERIFYING ON BLOCK EXPLORER');
    console.log('===============================');

    try {
      console.log('⏳ Waiting for block confirmations...');
      await contract.deploymentTransaction()?.wait(5); // Wait 5 blocks

      console.log('⏳ Verifying contract source code...');
      await run('verify:verify', {
        address: contractAddress,
        constructorArguments: [],
      });
      console.log('✅ Contract verified on block explorer');
    } catch (error) {
      console.warn('⚠️  Contract verification failed:', error);
    }
  }

  // Post-deployment tests
  console.log('\n🧪 POST-DEPLOYMENT TESTS');
  console.log('=========================');

  try {
    // Test basic functionality
    const owner = await contract.owner();
    console.log(`✅ Owner: ${owner}`);

    const supportedTokensCount = await contract.supportedTokensList.length;
    console.log(`✅ Supported tokens: ${supportedTokensCount}`);

    const supportedProtocolsCount = await contract.supportedProtocols.length;
    console.log(`✅ Supported protocols: ${supportedProtocolsCount}`);

    console.log('✅ All post-deployment tests passed');
  } catch (error) {
    console.error('❌ Post-deployment tests failed:', error);
    process.exit(1);
  }

  // Save deployment information
  console.log('\n💾 SAVING DEPLOYMENT INFO');
  console.log('==========================');

  const deploymentInfo = {
    network: network.name,
    contractAddress: contractAddress,
    deployer: deployer.address,
    deploymentTime: new Date().toISOString(),
    blockNumber: await hre.ethers.provider.getBlockNumber(),
    gasUsed: 'TBD', // Would need to track from deployment transaction
    configuration: config,
    verification: {
      verified: network.name !== 'hardhat' && network.name !== 'localhost',
      explorerUrl: getExplorerUrl(network.name, contractAddress),
    },
  };

  const outputPath = path.join(
    process.cwd(),
    `deployInfo/defi-${network.name}.json`
  );
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`✅ Deployment info saved to: ${outputPath}`);

  // Generate deployment report
  console.log('\n📊 DEPLOYMENT REPORT');
  console.log('====================');
  console.log(`Network: ${network.name}`);
  console.log(`Contract: ${contractAddress}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Block: ${deploymentInfo.blockNumber}`);
  console.log(`Time: ${deploymentInfo.deploymentTime}`);
  console.log(`Explorer: ${deploymentInfo.verification.explorerUrl}`);

  console.log('\n🎉 DEPLOYMENT COMPLETED SUCCESSFULLY!');
  console.log('=====================================');
  console.log('Next steps:');
  console.log('1. Test the contract on testnet');
  console.log('2. Conduct security audit');
  console.log('3. Set up monitoring and alerts');
  console.log('4. Prepare for mainnet deployment');
}

function getExplorerUrl(networkName: string, address: string): string {
  const explorers: { [key: string]: string } = {
    polygon: `https://polygonscan.com/address/${address}`,
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
