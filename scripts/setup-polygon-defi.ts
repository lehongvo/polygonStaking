import { ethers } from 'hardhat';

async function main() {
  console.log('🚀 Setting up PolygonDeFiAggregator for Polygon PoS...');

  const [deployer] = await ethers.getSigners();
  console.log('Deployer address:', deployer.address);

  // Get network info
  const network = await ethers.provider.getNetwork();
  const networkName = process.env.HARDHAT_NETWORK || 'localhost';
  console.log(`Network: ${networkName} (Chain ID: ${network.chainId})`);

  // POL token address (use env var or default for mainnet)
  const POL_TOKEN_ADDRESS =
    process.env.POL_TOKEN_ADDRESS ||
    '0x455e53bd3ba7eCC66C8e1e2c4A1a2A0F4b9A5D0F';

  // Deploy test token for testnets, use real POL for mainnet
  let polTokenAddress = POL_TOKEN_ADDRESS;
  const shouldDeployTestToken =
    process.env.DEPLOY_TEST_TOKEN === 'true' ||
    networkName === 'amoy' ||
    networkName === 'localhost';

  // Deploy test token for testnets
  if (shouldDeployTestToken) {
    const TestTokenFactory = await ethers.getContractFactory('TestToken');
    const testPOL = await TestTokenFactory.deploy(
      'Polygon Test',
      'POL',
      18,
      1000000
    );
    await testPOL.waitForDeployment();
    polTokenAddress = await testPOL.getAddress();
    console.log('✅ Test POL Token deployed to:', polTokenAddress);
  }

  // Deploy PolygonDeFiAggregator
  const DeFiAggregatorFactory = await ethers.getContractFactory(
    'PolygonDeFiAggregator'
  );
  const defiAggregator = (await DeFiAggregatorFactory.deploy(
    polTokenAddress
  )) as any;
  await defiAggregator.waitForDeployment();

  const aggregatorAddress = await defiAggregator.getAddress();
  console.log('✅ PolygonDeFiAggregator deployed to:', aggregatorAddress);

  // Setup DeFi protocols
  console.log('\n📋 Setting up DeFi protocols...');

  // Protocol addresses (use env vars or mock for testing)
  const protocolAddresses = {
    stader:
      process.env.STADER_ADDRESS ||
      '0x1234567890123456789012345678901234567890',
    claystack:
      process.env.CLAYSTACK_ADDRESS ||
      '0x2345678901234567890123456789012345678901',
    ankr:
      process.env.ANKR_ADDRESS || '0x3456789012345678901234567890123456789012',
    quickswap_lp:
      process.env.QUICKSWAP_LP_ADDRESS ||
      '0x4567890123456789012345678901234567890123',
    aave_lending:
      process.env.AAVE_POOL_ADDRESS ||
      '0x5678901234567890123456789012345678901234',
  };

  // 1. Add Stader (Liquid Staking)
  try {
    await defiAggregator.addProtocol(
      'stader',
      protocolAddresses.stader,
      polTokenAddress, // reward token same as POL for now
      'liquid',
      1050 // 10.5% APY in basis points
    );
    console.log('✅ Added Stader liquid staking protocol');
  } catch (error) {
    console.log('⚠️ Stader protocol add failed:', (error as Error).message);
  }

  // 2. Add ClayStack (Liquid Staking)
  try {
    await defiAggregator.addProtocol(
      'claystack',
      protocolAddresses.claystack,
      polTokenAddress,
      'liquid',
      953 // 9.53% APY
    );
    console.log('✅ Added ClayStack liquid staking protocol');
  } catch (error) {
    console.log('⚠️ ClayStack protocol add failed:', (error as Error).message);
  }

  // 3. Add Ankr (Liquid Staking)
  try {
    await defiAggregator.addProtocol(
      'ankr',
      protocolAddresses.ankr,
      polTokenAddress,
      'liquid',
      955 // 9.55% APY
    );
    console.log('✅ Added Ankr liquid staking protocol');
  } catch (error) {
    console.log('⚠️ Ankr protocol add failed:', (error as Error).message);
  }

  // 4. Add QuickSwap LP Staking
  try {
    await defiAggregator.addProtocol(
      'quickswap_lp',
      protocolAddresses.quickswap_lp,
      polTokenAddress,
      'lp',
      1200 // 12% APY (higher for LP)
    );
    console.log('✅ Added QuickSwap LP staking protocol');
  } catch (error) {
    console.log(
      '⚠️ QuickSwap LP protocol add failed:',
      (error as Error).message
    );
  }

  // 5. Add Aave Lending
  try {
    await defiAggregator.addProtocol(
      'aave_lending',
      protocolAddresses.aave_lending,
      polTokenAddress,
      'lending',
      500 // 5% APY (lower for lending)
    );
    console.log('✅ Added Aave lending protocol');
  } catch (error) {
    console.log(
      '⚠️ Aave lending protocol add failed:',
      (error as Error).message
    );
  }

  // Display setup summary
  console.log('\n📊 Setup Summary:');
  console.log('===================');
  console.log('POL Token:', polTokenAddress);
  console.log('DeFi Aggregator:', aggregatorAddress);

  const allProtocols = await defiAggregator.getAllProtocols();
  console.log('\nSupported Protocols:');
  for (let i = 0; i < allProtocols.names.length; i++) {
    const apy = Number(allProtocols.apys[i]) / 100; // Convert from basis points
    console.log(`- ${allProtocols.names[i]}: ${apy}% APY`);
  }

  // Transfer test tokens if we deployed them
  if (shouldDeployTestToken) {
    const [, user1, user2] = await ethers.getSigners();
    const testToken = await ethers.getContractAt('TestToken', polTokenAddress);

    if (user1) {
      await testToken.transfer(user1.address, ethers.parseEther('10000'));
      console.log(`✅ Transferred 10,000 POL to ${user1.address}`);
    }

    if (user2) {
      await testToken.transfer(user2.address, ethers.parseEther('10000'));
      console.log(`✅ Transferred 10,000 POL to ${user2.address}`);
    }
  }

  console.log('\n🎉 PolygonDeFiAggregator setup completed!');
  console.log('\n📝 How to use:');
  console.log('1. Users approve POL tokens to DeFiAggregator');
  console.log("2. Call stake(amount, 'stader') or stake(amount, 'claystack')");
  console.log('3. Call claim() to claim rewards from all protocols');
  console.log('4. Call withdrawImmediately(amount, protocol) to withdraw');
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
    polToken: polTokenAddress,
    defiAggregator: aggregatorAddress,
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
