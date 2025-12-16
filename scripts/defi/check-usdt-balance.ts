import hre, { ethers } from 'hardhat';

async function main() {
  console.log('💳 CHECK USDT BALANCE');
  console.log('=====================');

  const [deployer] = await ethers.getSigners();
  console.log('👤 Deployer:', deployer.address);

  const USDT = '0xc2132D05D31c914a87C6611C10748AEb04B58e8F';
  const usdt = await ethers.getContractAt(
    '@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20',
    USDT
  );

  const balance = await usdt.balanceOf(deployer.address);
  console.log('💳 USDT Balance:', ethers.formatUnits(balance, 6), 'USDT');
  console.log('💳 USDT Balance (raw):', balance.toString());
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
