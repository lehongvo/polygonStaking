
const hre = require('hardhat');

async function main() {
  console.log('🚀 Setting up Enhanced PolygonDeFiAggregator with Multi-Token Support...');

  const [deployer] = await hre.ethers.getSigners();
  console.log('Deployer address:', deployer.address);

  // Get network info
  const network = await hre.ethers.provider.getNetwork();
  const networkName = hre.network.name;
  console.log(`Network: ${networkName} (Chain ID: ${network.chainId})`);

  // Deploy test tokens for testnets
  const shouldDeployTestTokens = networkName === 'amoy' || networkName === 'localhost' || networkName === 'hardhat';

  let tokenAddresses = {
    TTJP: '0x431D5dfF03120AFA4bDf332c61A6e1766eF37BDB', // Real TTJP on mainnet
    POL: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',  // Real WPOL on mainnet
  };

  if (shouldDeployTestTokens) {
    console.log('\n🪙 Deploying test tokens...');
    
    // Deploy test TTJP
    const TestTokenFactory = await hre.ethers.getContractFactory('TestToken');
    const testTTJP = await TestTokenFactory.deploy(
      'Test TTJP Token',
      'TTJP',
      18,
      hre.ethers.parseEther('1000000') // 1M tokens
    );
    await testTTJP.waitForDeployment();
    tokenAddresses.TTJP = await testTTJP.getAddress();
    console.log('✅ Test TTJP Token deployed to:', tokenAddresses.TTJP);

    // Deploy test POL
    const testPOL = await TestTokenFactory.deploy(
      'Test POL Token',
      'POL',
      18,
      hre.ethers.parseEther('1000000') // 1M tokens
    );
    await testPOL.waitForDeployment();
    tokenAddresses.POL = await testPOL.getAddress();
    console.log('✅ Test POL Token deployed to:', tokenAddresses.POL);
  }

  // Deploy PolygonDeFiAggregator (no constructor params needed)
  console.log('\n📋 Deploying PolygonDeFiAggregator...');
  const DeFiAggregatorFactory = await hre.ethers.getContractFactory('PolygonDeFiAggregator');
  const defiAggregator = await DeFiAggregatorFactory.deploy();
  await defiAggregator.waitForDeployment();

  const aggregatorAddress = await defiAggregator.getAddress();
  console.log('✅ PolygonDeFiAggregator deployed to:', aggregatorAddress);

  // Check default supported tokens
  console.log('\n🪙 Checking supported tokens...');
  try {
    const supportedTokens = await defiAggregator.getAllSupportedTokens();
    console.log('Default supported tokens:');
    for (let i = 0; i < supportedTokens.addresses.length; i++) {
      console.log(`- ${supportedTokens.symbols[i]}: ${supportedTokens.addresses[i]}`);
    }
  } catch (error) {
    console.log('⚠️ Could not fetch supported tokens:', (error as Error).message);
  }

  // Setup DeFi protocols
  console.log('\n📋 Setting up DeFi protocols...');

  const protocolAddresses = {
    ankr: networkName === 'polygon' 
      ? '0xCfD4B4Bc15C8bF0Fd820B0D4558c725727B3ce89' // Real Ankr on mainnet
      : '0x1234567890123456789012345678901234567890', // Testnet placeholder
    aave_lending: networkName === 'polygon' 
      ? '0x794a61358D6845594F94dc1DB02A252b5b4814aD' // Real Aave on mainnet
      : '0x2345678901234567890123456789012345678901', // Testnet placeholder
  };

  // Add Ankr protocol
  try {
    await defiAggregator.addProtocol(
      'ankr',
      protocolAddresses.ankr,
      tokenAddresses.POL, // reward token
      'liquid',
      955 // 9.55% APY in basis points
    );
    console.log('✅ Added Ankr liquid staking protocol');
  } catch (error) {
    console.log('⚠️ Ankr protocol add failed:', (error as Error).message);
  }

  // Add Aave protocol
  try {
    await defiAggregator.addProtocol(
      'aave_lending',
      protocolAddresses.aave_lending,
      tokenAddresses.POL,
      'lending',
      500 // 5% APY
    );
    console.log('✅ Added Aave lending protocol');
  } catch (error) {
    console.log('⚠️ Aave protocol add failed:', (error as Error).message);
  }

  // Display setup summary
  console.log('\n📊 Setup Summary:');
  console.log('===================');
  console.log('DeFi Aggregator:', aggregatorAddress);
  console.log('\nSupported Tokens:');
  console.log(`- TTJP: ${tokenAddresses.TTJP}`);
  console.log(`- POL: ${tokenAddresses.POL}`);

  try {
    const allProtocols = await defiAggregator.getAllProtocols();
    console.log('\nSupported Protocols:');
    for (let i = 0; i < allProtocols.names.length; i++) {
      const apy = Number(allProtocols.apys[i]) / 100; // Convert from basis points
      console.log(`- ${allProtocols.names[i]}: ${apy}% APY`);
    }
  } catch (error) {
    console.log('⚠️ Could not fetch protocols:', (error as Error).message);
  }

  // Transfer test tokens if we deployed them
  if (shouldDeployTestTokens) {
    console.log('\n💰 Distributing test tokens...');
    const [, user1, user2] = await hre.ethers.getSigners();
    
    if (user1) {
      // Transfer TTJP
      const testTTJP = await hre.ethers.getContractAt('TestToken', tokenAddresses.TTJP);
      await testTTJP.transfer(user1.address, hre.ethers.parseEther('10000'));
      console.log(`✅ Transferred 10,000 TTJP to ${user1.address}`);

      // Transfer POL
      const testPOL = await hre.ethers.getContractAt('TestToken', tokenAddresses.POL);
      await testPOL.transfer(user1.address, hre.ethers.parseEther('10000'));
      console.log(`✅ Transferred 10,000 POL to ${user1.address}`);
    }

    if (user2) {
      // Transfer TTJP
      const testTTJP = await hre.ethers.getContractAt('TestToken', tokenAddresses.TTJP);
      await testTTJP.transfer(user2.address, hre.ethers.parseEther('10000'));
      console.log(`✅ Transferred 10,000 TTJP to ${user2.address}`);

      // Transfer POL
      const testPOL = await hre.ethers.getContractAt('TestToken', tokenAddresses.POL);
      await testPOL.transfer(user2.address, hre.ethers.parseEther('10000'));
      console.log(`✅ Transferred 10,000 POL to ${user2.address}`);
    }
  }

  console.log('\n🎉 Enhanced PolygonDeFiAggregator setup completed!');
  console.log('\n📝 How to use:');
  console.log('1. Users approve tokens (TTJP/POL) to DeFiAggregator');
  console.log("2. Call stake(tokenAddress, amount, 'protocol') for immediate staking");
  console.log("3. Call createTimeLockedStake(token, amount, protocol, startTime, duration) for time-locked staking");
  console.log('4. Call claim(tokenAddress) to claim rewards');
  console.log('5. Call withdrawImmediately(token, amount, protocol) to withdraw');
  console.log('6. Call withdrawTimeLockedStake(stakeId) when time-lock expires');
  
  console.log('\n💡 Example usage:');
  console.log(`// Stake TTJP immediately`);
  console.log(`stake("${tokenAddresses.TTJP}", ethers.parseEther("1000"), "ankr")`);
  console.log(`// Create time-locked POL stake`);
  console.log(`createTimeLockedStake("${tokenAddresses.POL}", ethers.parseEther("500"), "aave_lending", block.timestamp + 86400, 2592000)`);

  console.log('\n🌐 Network deployment info:');
  if (networkName === 'amoy') {
    console.log('✅ Deployed on Amoy testnet - Ready for testing!');
    console.log('🔗 Amoy Explorer: https://www.oklink.com/amoy');
  } else if (networkName === 'polygon') {
    console.log('🔥 Deployed on Polygon mainnet!');
    console.log('🔗 Polygon Explorer: https://polygonscan.com');
  } else {
    console.log(`📍 Deployed on ${networkName}`);
    console.log('💡 To deploy on mainnet: --network polygon');
    console.log('🧪 To deploy on Amoy: --network amoy');
  }

  return {
    defiAggregator: aggregatorAddress,
    tokens: tokenAddresses,
    protocols: protocolAddresses,
  };
}

main()
  .then(addresses => {
    console.log('\n📜 Contract Addresses:', addresses);
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
