const hre = require('hardhat');

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  
  console.log('Deployer address:', deployer.address);
  console.log('Balance:', hre.ethers.formatEther(balance), 'POL');
  console.log('Balance (wei):', balance.toString());
  
  const network = await hre.ethers.provider.getNetwork();
  console.log('Network:', hre.network.name, '(Chain ID:', network.chainId, ')');
}

main().catch(console.error);
