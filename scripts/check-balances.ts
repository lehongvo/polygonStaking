const hre = require('hardhat');

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log('Address:', deployer.address);
  
  // Native POL balance
  const nativeBalance = await hre.ethers.provider.getBalance(deployer.address);
  console.log('Native POL Balance:', hre.ethers.formatEther(nativeBalance), 'POL');
  
  // TTJP token balance
  try {
    const ttjpToken = await hre.ethers.getContractAt('IERC20', '0x431D5dfF03120AFA4bDf332c61A6e1766eF37BDB');
    const ttjpBalance = await ttjpToken.balanceOf(deployer.address);
    console.log('TTJP Balance:', hre.ethers.formatEther(ttjpBalance), 'TTJP');
  } catch (error) {
    console.log('TTJP Balance: Error reading balance');
  }
  
  // POL token balance (ERC20)
  try {
    const polToken = await hre.ethers.getContractAt('IERC20', '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270');
    const polBalance = await polToken.balanceOf(deployer.address);
    console.log('POL Token Balance:', hre.ethers.formatEther(polBalance), 'POL');
  } catch (error) {
    console.log('POL Token Balance: Error reading balance');
  }
}

main().catch(console.error);
