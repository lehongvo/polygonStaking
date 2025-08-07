import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';

const hre = require('hardhat');

async function main() {
  console.log('🧪 Testing Staking (Simple Version)...');

  // Read deployment info
  const deploymentPath = path.join(__dirname, '..', 'polygon-defi-deployment.json');
  const deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  
  console.log(`DeFi Aggregator: ${deploymentInfo.contractAddress}`);

  // Get signer
  const [deployer] = await hre.ethers.getSigners();
  console.log('User address:', deployer.address);

  // Check native POL balance
  const nativeBalance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`Native POL Balance: ${hre.ethers.formatEther(nativeBalance)} POL`);

  // Get contract
  const defiAggregator = await hre.ethers.getContractAt('PolygonDeFiAggregator', deploymentInfo.contractAddress);
  
  console.log('\n📋 Contract Info:');
  
  // Check supported tokens
  try {
    const supportedTokens = await defiAggregator.getSupportedTokens();
    console.log('Supported Tokens:', supportedTokens);
  } catch (error) {
    console.log('Could not fetch supported tokens');
  }
  
  // Check protocols
  try {
    const protocols = await defiAggregator.getAllProtocols();
    console.log('Protocols:', protocols.names);
    console.log('APYs:', protocols.apys.map((apy: any) => Number(apy) / 100 + '%'));
  } catch (error) {
    console.log('Could not fetch protocols');
  }

  console.log('\n💡 To test staking, you need:');
  console.log('1. ERC20 tokens (TTJP or POL ERC20)');
  console.log('2. Approve tokens to contract');
  console.log('3. Call stake() or createTimeLockedStake()');
  
  console.log('\n🔗 Contract on Polygonscan:');
  console.log(`https://polygonscan.com/address/${deploymentInfo.contractAddress}#writeContract`);
  
  console.log('\n📝 Manual staking steps:');
  console.log('1. Get TTJP tokens from: https://polygonscan.com/address/0x431D5dfF03120AFA4bDf332c61A6e1766eF37BDB');
  console.log('2. Approve TTJP to DeFi Aggregator');
  console.log('3. Call createTimeLockedStake() with:');
  console.log('   - token: 0x431D5dfF03120AFA4bDf332c61A6e1766eF37BDB');
  console.log('   - amount: 100000000000000000 (0.1 TTJP in wei)');
  console.log('   - protocol: aave_lending');
  console.log('   - startTime: current timestamp');
  console.log('   - duration: 60 (1 minute)');
}

main()
  .then(() => {
    console.log('\n✅ Info check completed!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
