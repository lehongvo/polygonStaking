import 'dotenv/config';

const hre = require('hardhat');

interface TokenConfig {
  address: string;
  symbol: string;
  decimals: number;
}

interface ProtocolConfig {
  name: string;
  address: string;
  rewardToken: string;
  type: string;
  apy: number;
}

async function main() {
  console.log('🚀 Setting up Enhanced PolygonDeFiAggregator from Environment Variables...');

  const [deployer] = await hre.ethers.getSigners();
  console.log('Deployer address:', deployer.address);

  // Get network info
  const network = await hre.ethers.provider.getNetwork();
  const networkName = hre.network.name;
  console.log(`Network: ${networkName} (Chain ID: ${network.chainId})`);

  // Get token addresses from env
  const tokenConfigs: TokenConfig[] = [
    {
      address: process.env.TTJP_TOKEN_ADDRESS || '',
      symbol: 'TTJP',
      decimals: 18
    },
    {
      address: process.env.POL_TOKEN_ADDRESS || '',
      symbol: 'POL', 
      decimals: 18
    }
  ];

  console.log('\n🪙 Token Configuration from ENV:');
  tokenConfigs.forEach(token => {
    console.log(`- ${token.symbol}: ${token.address || 'NOT SET'}`);
  });

  // Deploy test tokens for testnets if enabled
  const shouldDeployTestTokens = process.env.DEPLOY_TEST_TOKENS === 'true' && 
    (networkName === 'amoy' || networkName === 'localhost' || networkName === 'hardhat');

  let finalTokenAddresses: { [symbol: string]: string } = {};

  if (shouldDeployTestTokens) {
    console.log('\n🪙 Deploying test tokens (DEPLOY_TEST_TOKENS=true)...');
    
    const TestTokenFactory = await hre.ethers.getContractFactory('TestToken');
    
    for (const tokenConfig of tokenConfigs) {
      const testToken = await TestTokenFactory.deploy(
        `Test ${tokenConfig.symbol} Token`,
        tokenConfig.symbol,
        tokenConfig.decimals,
        hre.ethers.parseEther('1000000') // 1M tokens
      );
      await testToken.waitForDeployment();
      finalTokenAddresses[tokenConfig.symbol] = await testToken.getAddress();
      console.log(`✅ Test ${tokenConfig.symbol} Token deployed to: ${finalTokenAddresses[tokenConfig.symbol]}`);
    }
  } else {
    console.log('\n🪙 Using token addresses from ENV...');
    for (const tokenConfig of tokenConfigs) {
      if (!tokenConfig.address) {
        throw new Error(`${tokenConfig.symbol}_TOKEN_ADDRESS not set in environment variables`);
      }
      finalTokenAddresses[tokenConfig.symbol] = tokenConfig.address;
      console.log(`✅ Using ${tokenConfig.symbol}: ${finalTokenAddresses[tokenConfig.symbol]}`);
    }
  }

  // Deploy PolygonDeFiAggregator (no constructor params)
  console.log('\n📋 Deploying PolygonDeFiAggregator...');
  const DeFiAggregatorFactory = await hre.ethers.getContractFactory('PolygonDeFiAggregator');
  const defiAggregator = await DeFiAggregatorFactory.deploy();
  await defiAggregator.waitForDeployment();

  const aggregatorAddress = await defiAggregator.getAddress();
  console.log('✅ PolygonDeFiAggregator deployed to:', aggregatorAddress);

  // Add supported tokens from env
  console.log('\n🪙 Adding supported tokens...');
  for (const tokenConfig of tokenConfigs) {
    try {
      await defiAggregator.addSupportedToken(
        finalTokenAddresses[tokenConfig.symbol],
        tokenConfig.symbol,
        tokenConfig.decimals
      );
      console.log(`✅ Added ${tokenConfig.symbol} token support`);
    } catch (error) {
      console.log(`⚠️ Failed to add ${tokenConfig.symbol}:`, (error as Error).message);
    }
  }

  // Setup DeFi protocols from env
  console.log('\n📋 Setting up DeFi protocols from ENV...');

  const protocolConfigs: ProtocolConfig[] = [
    {
      name: 'aave_lending',
      address: process.env.AAVE_POOL_ADDRESS || '',
      rewardToken: finalTokenAddresses.POL,
      type: 'lending',
      apy: 500 // 5%
    }
  ];

  // Add protocols that have addresses set in env
  for (const protocolConfig of protocolConfigs) {
    if (protocolConfig.address) {
      try {
        await defiAggregator.addProtocol(
          protocolConfig.name,
          protocolConfig.address,
          protocolConfig.rewardToken,
          protocolConfig.type,
          protocolConfig.apy
        );
        console.log(`✅ Added ${protocolConfig.name} protocol (${protocolConfig.apy/100}% APY)`);
      } catch (error) {
        console.log(`⚠️ Failed to add ${protocolConfig.name}:`, (error as Error).message);
      }
    } else {
      console.log(`⚠️ Skipping ${protocolConfig.name} - address not set in ENV`);
    }
  }

  // Display setup summary
  console.log('\n📊 Setup Summary:');
  console.log('===================');
  console.log('DeFi Aggregator:', aggregatorAddress);
  console.log('\nSupported Tokens:');
  Object.entries(finalTokenAddresses).forEach(([symbol, address]) => {
    console.log(`- ${symbol}: ${address}`);
  });

  try {
    const allProtocols = await defiAggregator.getAllProtocols();
    console.log('\nActive Protocols:');
    for (let i = 0; i < allProtocols.names.length; i++) {
      const apy = Number(allProtocols.apys[i]) / 100;
      console.log(`- ${allProtocols.names[i]}: ${apy}% APY`);
    }
  } catch (error) {
    console.log('⚠️ Could not fetch protocols:', (error as Error).message);
  }

  // Transfer test tokens if we deployed them
  if (shouldDeployTestTokens) {
    console.log('\n💰 Distributing test tokens...');
    const [, user1, user2] = await hre.ethers.getSigners();
    
    for (const [symbol, address] of Object.entries(finalTokenAddresses)) {
      const testToken = await hre.ethers.getContractAt('TestToken', address);
      
      if (user1) {
        await testToken.transfer(user1.address, hre.ethers.parseEther('10000'));
        console.log(`✅ Transferred 10,000 ${symbol} to ${user1.address}`);
      }
      
      if (user2) {
        await testToken.transfer(user2.address, hre.ethers.parseEther('10000'));
        console.log(`✅ Transferred 10,000 ${symbol} to ${user2.address}`);
      }
    }
  }

  console.log('\n🎉 Enhanced PolygonDeFiAggregator setup completed!');
  console.log('\n📝 How to use:');
  console.log('1. Users approve tokens to DeFiAggregator');
  console.log("2. Call stake(tokenAddress, amount, 'protocol') for immediate staking");
  console.log("3. Call createTimeLockedStake(token, amount, protocol, startTime, duration) for time-locked staking");
  console.log('4. Call claim(tokenAddress) to claim rewards');
  console.log('5. Call withdrawImmediately(token, amount, protocol) to withdraw');
  console.log('6. Call withdrawTimeLockedStake(stakeId) when time-lock expires');
  
  console.log('\n💡 Example usage:');
  console.log(`// Stake TTJP immediately`);
  console.log(`stake("${finalTokenAddresses.TTJP}", ethers.parseEther("1000"), "aave_lending")`);
  console.log(`// Create time-locked POL stake`);
  console.log(`createTimeLockedStake("${finalTokenAddresses.POL}", ethers.parseEther("500"), "aave_lending", block.timestamp + 86400, 2592000)`);

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

  console.log('\n🔧 Environment Variables Used:');
  console.log(`- TTJP_TOKEN_ADDRESS: ${process.env.TTJP_TOKEN_ADDRESS || 'NOT SET'}`);
  console.log(`- POL_TOKEN_ADDRESS: ${process.env.POL_TOKEN_ADDRESS || 'NOT SET'}`);
  console.log(`- AAVE_POOL_ADDRESS: ${process.env.AAVE_POOL_ADDRESS || 'NOT SET'}`);
  console.log(`- DEPLOY_TEST_TOKENS: ${process.env.DEPLOY_TEST_TOKENS || 'NOT SET'}`);

  return {
    defiAggregator: aggregatorAddress,
    tokens: finalTokenAddresses,
    protocols: protocolConfigs.reduce((acc, p) => ({ ...acc, [p.name]: p.address }), {}),
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
