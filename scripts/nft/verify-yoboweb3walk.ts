import { network, run } from 'hardhat';

async function main() {
  console.log('🔍 YOBOWEB3WALK CONTRACT VERIFICATION');
  console.log('====================================');

  // Contract details - update these with your deployed contract
  const contractAddress = process.env.YOBO_CONTRACT_ADDRESS;
  const baseURI =
    process.env.YOBO_BASE_URI ||
    'ipfs://QmQEQYguTJ4ApkCJ8J5wSMGFfgZLP5Xz4w7yGArFdHkVjr/';

  if (!contractAddress) {
    console.error('❌ Please set YOBO_CONTRACT_ADDRESS environment variable');
    process.exit(1);
  }

  console.log(`📍 Network: ${network.name}`);
  console.log(`📄 Contract: ${contractAddress}`);
  console.log(`🖼️  Base URI: ${baseURI}`);

  if (network.name === 'hardhat' || network.name === 'localhost') {
    console.log('⚠️  Skipping verification on local network');
    return;
  }

  try {
    console.log('\n⏳ Verifying contract on block explorer...');

    await run('verify:verify', {
      address: contractAddress,
      constructorArguments: [baseURI],
    });

    console.log('✅ Contract verified successfully!');

    // Generate explorer URL
    const explorerUrl = getExplorerUrl(network.name, contractAddress);
    console.log(`🔗 View on explorer: ${explorerUrl}`);
  } catch (error: any) {
    if (error.message.includes('Already Verified')) {
      console.log('✅ Contract is already verified!');
    } else {
      console.error('❌ Verification failed:', error.message);
      process.exit(1);
    }
  }
}

function getExplorerUrl(networkName: string, address: string): string {
  const explorers: { [key: string]: string } = {
    polygon: `https://polygonscan.com/address/${address}`,
    amoy: `https://amoy.polygonscan.com/address/${address}`,
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
    console.error('💥 VERIFICATION FAILED:', error);
    process.exit(1);
  });
