import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';

const hre = require('hardhat');

async function main() {
  console.log('🔍 Debugging Protocol Configuration...');
  console.log('=====================================');

  const [signer] = await hre.ethers.getSigners();
  console.log(`👤 Signer: ${signer.address}`);

  // Load deployment info
  const deploymentPath = path.join(
    process.cwd(),
    'deployInfo',
    'polygon-defi-deployment.json'
  );
  
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  const contractAddress = deployment.contractAddress;

  console.log(`📋 Contract: ${contractAddress}`);

  // Get contract instance
  const DeFiAggregatorFactory = await hre.ethers.getContractFactory('PolygonDeFiAggregator');
  const defiAggregator = DeFiAggregatorFactory.attach(contractAddress).connect(signer);

  try {
    // Check if aave_lending protocol exists
    console.log('\n🔍 Checking aave_lending protocol...');
    
    const protocolInfo = await defiAggregator.protocols('aave_lending');
    console.log(`📋 Protocol Info:`);
    console.log(`   Contract Address: ${protocolInfo.contractAddress}`);
    console.log(`   Protocol Type: ${protocolInfo.protocolType}`);
    console.log(`   Initial APY: ${protocolInfo.initialAPY}`);
    console.log(`   Is Active: ${protocolInfo.isActive}`);
    console.log(`   Total Deposited: ${hre.ethers.formatEther(protocolInfo.totalDeposited)} ETH`);

    // Check all protocols
    console.log('\n📋 All Protocols:');
    try {
      const allProtocols = await defiAggregator.getAllProtocols();
      console.log(`Names: ${allProtocols.names}`);
      console.log(`Addresses: ${allProtocols.addresses}`);
      console.log(`Types: ${allProtocols.types}`);
      console.log(`APYs: ${allProtocols.apys}`);
    } catch (error) {
      console.log('❌ getAllProtocols failed:', error.message);
    }

    // Check WMATIC token support
    console.log('\n🪙 Checking WMATIC token support...');
    const WMATIC_ADDRESS = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270';
    const tokenInfo = await defiAggregator.supportedTokens(WMATIC_ADDRESS);
    console.log(`📋 WMATIC Token Info:`);
    console.log(`   Symbol: ${tokenInfo.symbol}`);
    console.log(`   Decimals: ${tokenInfo.decimals}`);
    console.log(`   Is Active: ${tokenInfo.isActive}`);

    // Check if we can call Aave Pool directly
    console.log('\n🔍 Testing Aave Pool directly...');
    const aavePoolAddress = protocolInfo.contractAddress;
    
    if (aavePoolAddress && aavePoolAddress !== '0x0000000000000000000000000000000000000000') {
      try {
        // Try to get pool info
        const aavePool = await hre.ethers.getContractAt('IAavePool', aavePoolAddress);
        
        // This might fail if interface is wrong
        console.log(`✅ Aave Pool contract found at: ${aavePoolAddress}`);
        
        // Try to check if WMATIC is supported
        // const reserveData = await aavePool.getReserveData(WMATIC_ADDRESS);
        // console.log(`WMATIC Reserve Data: ${reserveData}`);
        
      } catch (error) {
        console.log(`❌ Failed to interact with Aave Pool: ${error.message}`);
      }
    } else {
      console.log('❌ Aave Pool address is not set or is zero address');
    }

    // Check recent transactions
    console.log('\n📊 Recent Activity:');
    const filter = defiAggregator.filters.TimeLockedStakeCreated();
    const events = await defiAggregator.queryFilter(filter, -100); // Last 100 blocks
    
    console.log(`Found ${events.length} TimeLockedStakeCreated events:`);
    events.forEach((event, i) => {
      console.log(`Event ${i}:`);
      console.log(`  User: ${event.args.user}`);
      console.log(`  Token: ${event.args.token}`);
      console.log(`  Protocol: ${event.args.protocol}`);
      console.log(`  Amount: ${hre.ethers.formatEther(event.args.amount)} ETH`);
    });

  } catch (error) {
    console.log('❌ Debug failed:', error.message);
  }

  console.log('\n✅ DEBUG COMPLETED!');
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('💥 Debug failed:', error);
    process.exit(1);
  });
