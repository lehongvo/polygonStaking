import * as fs from 'fs';
import { network, run } from 'hardhat';
import * as path from 'path';

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
  tokens?: {
    [symbol: string]: string;
  };
  protocols?: {
    [name: string]: string;
  };
}

async function main() {
  console.log('🔍 Verifying PolygonDeFiAggregator contract...');

  // Read deployment info
  const deploymentPath = path.join(
    process.cwd(),
    'deployInfo',
    'polygon-defi-deployment.json'
  );

  if (!fs.existsSync(deploymentPath)) {
    console.error(
      '❌ Deployment file not found! Please deploy the contract first.'
    );
    console.log(`Expected file: ${deploymentPath}`);
    console.log(
      '💡 Run deployment script first: npx hardhat run scripts/setup-polygon-defi.ts --network <network>'
    );
    process.exit(1);
  }

  const deploymentInfo: DeploymentInfo = JSON.parse(
    fs.readFileSync(deploymentPath, 'utf8')
  );

  // Get network info
  const networkName = network.name;
  const chainId = deploymentInfo.chainId;

  console.log(`Network: ${networkName} (Chain ID: ${chainId})`);
  console.log(`Contract Address: ${deploymentInfo.contractAddress}`);
  console.log(
    `Constructor Args: ${JSON.stringify(deploymentInfo.constructorArgs)}`
  );

  // Check if already verified
  if (deploymentInfo.verified) {
    console.log('✅ Contract is already verified!');
    if (deploymentInfo.explorer) {
      console.log(
        `🔗 View on explorer: ${deploymentInfo.explorer}/address/${deploymentInfo.contractAddress}`
      );
    }
    return;
  }

  // Verify network matches
  if (deploymentInfo.network !== networkName) {
    console.error(
      `❌ Network mismatch! Deployment was on ${deploymentInfo.network}, current network is ${networkName}`
    );
    process.exit(1);
  }

  try {
    console.log('\n📋 Verifying contract on blockchain...');

    await run('verify:verify', {
      address: deploymentInfo.contractAddress,
      constructorArguments: deploymentInfo.constructorArgs,
    });

    // Update deployment info
    deploymentInfo.verified = true;
    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));

    console.log('✅ Contract verified successfully!');

    console.log('\n🎉 Verification Summary:');
    console.log('========================');
    console.log(`Network: ${networkName}`);
    console.log(`Contract: ${deploymentInfo.contractName}`);
    console.log(`Address: ${deploymentInfo.contractAddress}`);
    console.log(`Deployer: ${deploymentInfo.deployer}`);
    console.log(`Deployment Date: ${deploymentInfo.deploymentDate}`);

    if (deploymentInfo.constructorArgs.length > 0) {
      console.log(
        `Constructor Args: ${JSON.stringify(deploymentInfo.constructorArgs)}`
      );
    } else {
      console.log('Constructor Args: None (empty constructor)');
    }

    // Display supported tokens
    if (deploymentInfo.tokens) {
      console.log('\n🪙 Supported Tokens:');
      Object.entries(deploymentInfo.tokens).forEach(([symbol, address]) => {
        console.log(`  - ${symbol}: ${address}`);
      });
    }

    // Display protocols
    if (deploymentInfo.protocols) {
      console.log('\n📋 Integrated Protocols:');
      Object.entries(deploymentInfo.protocols).forEach(([name, address]) => {
        console.log(`  - ${name}: ${address}`);
      });
    }

    if (deploymentInfo.explorer) {
      console.log('\n🔗 Explorer Links:');
      console.log(
        `- Contract: ${deploymentInfo.explorer}/address/${deploymentInfo.contractAddress}`
      );
      console.log(
        `- Verified Code: ${deploymentInfo.explorer}/address/${deploymentInfo.contractAddress}#code`
      );
      console.log(
        `- Read Contract: ${deploymentInfo.explorer}/address/${deploymentInfo.contractAddress}#readContract`
      );
      console.log(
        `- Write Contract: ${deploymentInfo.explorer}/address/${deploymentInfo.contractAddress}#writeContract`
      );
    }

    console.log('\n💡 Next Steps:');
    console.log('1. Test contract functions on explorer');
    console.log('2. Add tokens via addSupportedToken()');
    console.log('3. Add protocols via addProtocol()');
    console.log('4. Users can start staking!');
  } catch (error: any) {
    console.error('❌ Verification failed:', error.message);

    if (error.message.includes('Already Verified')) {
      console.log('✅ Contract was already verified on the blockchain!');
      deploymentInfo.verified = true;
      fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
    } else {
      console.log('\n🔧 Manual verification command:');
      if (deploymentInfo.constructorArgs.length > 0) {
        const argsString = deploymentInfo.constructorArgs
          .map(arg => `"${arg}"`)
          .join(' ');
        console.log(
          `npx hardhat verify --network ${networkName} ${deploymentInfo.contractAddress} ${argsString}`
        );
      } else {
        console.log(
          `npx hardhat verify --network ${networkName} ${deploymentInfo.contractAddress}`
        );
      }

      console.log('\n🔧 Alternative with hardhat-verify plugin:');
      console.log(
        `yarn hardhat verify --network ${networkName} ${deploymentInfo.contractAddress}`
      );

      console.log('\n📝 Common verification issues:');
      console.log('- Make sure contract is deployed and confirmed');
      console.log('- Check if POLYGONSCAN_API_KEY is set in .env');
      console.log('- Wait a few minutes after deployment before verifying');
      console.log('- Ensure constructor args match exactly');

      process.exit(1);
    }
  }
}

main()
  .then(() => {
    console.log('\n🎉 Verification completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Verification error:', error);
    process.exit(1);
  });
