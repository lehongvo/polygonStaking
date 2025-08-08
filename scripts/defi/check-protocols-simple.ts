import * as fs from 'fs';
import { ethers } from 'hardhat';

async function main() {
  console.log('🔍 Checking aave_lending protocol...');

  // Load deployment info
  const deploymentPath = './polygon-defi-deployment.json';
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  const contractAddress = deployment.contractAddress;

  console.log(`📍 Contract Address: ${contractAddress}`);

  // Get contract instance
  const PolygonDeFiAggregator = await ethers.getContractFactory(
    'PolygonDeFiAggregator'
  );
  const contract = PolygonDeFiAggregator.attach(contractAddress);

  try {
    // Check aave_lending protocol
    console.log('\n🎯 Checking aave_lending protocol:');
    const aaveInfo = await contract.protocols('aave_lending');

    console.log(`  - Contract Address: ${aaveInfo.contractAddress}`);
    console.log(`  - Protocol Type: ${aaveInfo.protocolType}`);
    console.log(`  - Is Active: ${aaveInfo.isActive}`);
    console.log(`  - Protocol Name: ${aaveInfo.protocolName}`);

    if (
      aaveInfo.contractAddress === '0x0000000000000000000000000000000000000000'
    ) {
      console.log('❌ Aave protocol has zero address - needs to be fixed!');

      // Check if we can use setProtocolStatus to deactivate and re-add
      console.log(
        '\n🔧 Attempting to fix by deactivating and re-adding protocol...'
      );

      // First deactivate
      const tx1 = await contract.setProtocolStatus('aave_lending', false);
      console.log(`⏳ Deactivating protocol: ${tx1.hash}`);
      await tx1.wait();

      // Then add with correct address
      const AAVE_V3_POOL = '0x794a61358D6845594F94dc1DB02A252b5b4814aD';
      const tx2 = await contract.addProtocol(
        'aave_lending_v2', // New name to avoid conflict
        AAVE_V3_POOL,
        '0x0000000000000000000000000000000000000000', // No specific reward token
        'lending',
        500 // 5% APY
      );

      console.log(`⏳ Adding new protocol: ${tx2.hash}`);
      await tx2.wait();

      console.log("✅ Fixed! New protocol added as 'aave_lending_v2'");
    } else {
      console.log('✅ Aave protocol has valid address');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
