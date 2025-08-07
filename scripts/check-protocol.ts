import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';

const hre = require('hardhat');

async function main() {
  console.log('🔍 Checking Protocol Configuration...');

  // Read deployment info
  const deploymentPath = path.join(__dirname, '..', 'polygon-defi-deployment.json');
  const deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  
  const defiAggregator = await hre.ethers.getContractAt('PolygonDeFiAggregator', deploymentInfo.contractAddress);
  
  try {
    // Check aave_lending protocol
    const protocolInfo = await defiAggregator.getProtocolInfo('aave_lending');
    
    console.log('\n📋 aave_lending Protocol Info:');
    console.log(`- Contract Address: ${protocolInfo.contractAddress}`);
    console.log(`- Protocol Type: ${protocolInfo.protocolType}`);
    console.log(`- APY: ${Number(protocolInfo.apy) / 100}%`);
    console.log(`- Is Active: ${protocolInfo.isActive}`);
    console.log(`- Total Deposited: ${hre.ethers.formatEther(protocolInfo.totalDeposited)} tokens`);
    
    if (protocolInfo.contractAddress === '0x0000000000000000000000000000000000000000') {
      console.log('\n❌ PROBLEM: Aave contract address is zero address!');
      console.log('💡 This means AAVE_POOL_ADDRESS was not set during deployment');
      console.log('💡 The protocol exists but cannot interact with actual Aave contracts');
      
      console.log('\n🔧 To fix this:');
      console.log('1. Set AAVE_POOL_ADDRESS in .env file');
      console.log('2. Call updateProtocol() to set correct address');
      console.log('3. Or redeploy with correct env variables');
      
      // Aave V3 Pool address on Polygon
      const aavePoolAddress = '0x794a61358D6845594F94dc1DB02A252b5b4814aD';
      console.log(`\n📝 Correct Aave V3 Pool address on Polygon: ${aavePoolAddress}`);
    } else {
      console.log('\n✅ Protocol has valid contract address');
    }
    
  } catch (error: any) {
    console.error('❌ Error checking protocol:', error.message);
  }
}

main().catch(console.error);
