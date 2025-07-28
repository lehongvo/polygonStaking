import * as fs from 'fs';
import * as path from 'path';

interface DeploymentInfo {
  deployments: {
    [network: string]: {
      explorer?: string;
      contracts: {
        [name: string]: {
          name: string;
          address: string;
          description: string;
        };
      };
    };
  };
}

async function main() {
  console.log('🔍 Verifying contracts on blockchain explorer...');

  // Read deployment info
  const deploymentPath = path.join(__dirname, '..', 'deployment-info.json');
  const deploymentData: DeploymentInfo = JSON.parse(
    fs.readFileSync(deploymentPath, 'utf8')
  );

  const network = process.env.HARDHAT_NETWORK || 'amoy';
  const networkInfo = deploymentData.deployments[network];

  if (!networkInfo) {
    console.error(`❌ No deployment info found for network: ${network}`);
    process.exit(1);
  }

  console.log(`📋 Verifying contracts on ${network} network...`);

  // Verify each contract
  for (const [contractName, contractInfo] of Object.entries(
    networkInfo.contracts
  )) {
    try {
      console.log(`\n🔍 Verifying ${contractInfo.name}...`);
      console.log(`📍 Address: ${contractInfo.address}`);

      // Get constructor arguments based on contract type
      let constructorArgs: string[] = [];
      
      if (contractName === 'polToken') {
        // TestToken constructor: name, symbol, decimals, initialSupply
        constructorArgs = [
          '"Polygon Test"',
          '"POL"',
          '18',
          '1000000'
        ];
      } else if (contractName === 'defiAggregator') {
        // PolygonDeFiAggregator constructor: polTokenAddress
        const polTokenAddress = networkInfo.contracts.polToken?.address;
        if (polTokenAddress) {
          constructorArgs = [polTokenAddress];
        }
      }

      // Run hardhat verify command
      const { exec } = require('child_process');
      const verifyCommand = `npx hardhat verify --network ${network} ${contractInfo.address} ${constructorArgs.join(' ')}`;

      console.log(`🚀 Running: ${verifyCommand}`);

      exec(verifyCommand, (error: any, stdout: string, stderr: string) => {
        if (error) {
          console.log(`❌ Verification failed for ${contractInfo.name}:`);
          console.log(stderr);
        } else {
          console.log(`✅ Successfully verified ${contractInfo.name}!`);
          console.log(stdout);
        }
      });

      // Wait a bit between verifications to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 5000));
    } catch (error) {
      console.log(`❌ Error verifying ${contractInfo.name}:`, error);
    }
  }

  console.log('\n📊 Verification Summary:');
  console.log('========================');
  console.log(`Network: ${network}`);
  console.log(`Explorer: ${networkInfo.explorer || 'N/A'}`);
  console.log('\nContract Addresses:');

  for (const [name, contract] of Object.entries(networkInfo.contracts)) {
    console.log(`- ${contract.name}: ${contract.address}`);
  }

  console.log('\n🔗 View contracts on explorer:');
  for (const [name, contract] of Object.entries(networkInfo.contracts)) {
    const explorerUrl = networkInfo.explorer
      ? `${networkInfo.explorer}/address/${contract.address}`
      : `N/A`;
    console.log(`- ${contract.name}: ${explorerUrl}`);
  }
}

main()
  .then(() => {
    console.log('\n🎉 Contract verification completed!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Verification error:', error);
    process.exit(1);
  });
