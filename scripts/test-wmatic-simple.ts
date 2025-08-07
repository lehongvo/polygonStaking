import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';

const hre = require('hardhat');

async function main() {
  console.log('🧪 Testing WMATIC Staking...');

  // Read deployment info
  const deploymentPath = path.join(__dirname, '..', 'polygon-defi-deployment.json');
  const deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  
  const [deployer] = await hre.ethers.getSigners();
  console.log('User:', deployer.address);

  // WMATIC contract
  const WMATIC_ADDRESS = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270';
  const wmaticAbi = [
    'function deposit() payable',
    'function withdraw(uint256 amount)',
    'function balanceOf(address) view returns (uint256)',
    'function approve(address spender, uint256 amount) returns (bool)'
  ];
  
  const wmatic = new hre.ethers.Contract(WMATIC_ADDRESS, wmaticAbi, deployer);
  const defiAggregator = await hre.ethers.getContractAt('PolygonDeFiAggregator', deploymentInfo.contractAddress);
  
  const stakeAmount = hre.ethers.parseEther('0.1');
  
  try {
    console.log('\n💱 Step 1: Wrapping 0.1 POL to WMATIC...');
    const wrapTx = await wmatic.deposit({ value: stakeAmount });
    await wrapTx.wait();
    console.log('✅ Wrapped to WMATIC');
    
    const balance = await wmatic.balanceOf(deployer.address);
    console.log(`WMATIC Balance: ${hre.ethers.formatEther(balance)}`);

    console.log('\n🔓 Step 2: Approving WMATIC...');
    const approveTx = await wmatic.approve(deploymentInfo.contractAddress, stakeAmount);
    await approveTx.wait();
    console.log('✅ WMATIC approved');

    console.log('\n🔒 Step 3: Creating time-locked stake...');
    const currentTime = Math.floor(Date.now() / 1000);
    
    const stakeTx = await defiAggregator.createTimeLockedStake(
      WMATIC_ADDRESS,
      stakeAmount,
      'aave_lending',
      currentTime,
      60 // 1 minute
    );
    const receipt = await stakeTx.wait();
    console.log('✅ Stake created');
    
    // Find stake ID
    let stakeId;
    for (const log of receipt.logs) {
      try {
        const parsed = defiAggregator.interface.parseLog(log);
        if (parsed.name === 'TimeLockedStakeCreated') {
          stakeId = parsed.args.stakeId;
          break;
        }
      } catch {}
    }
    
    if (stakeId) {
      console.log(`Stake ID: ${stakeId}`);
      
      console.log('\n⏳ Waiting 65 seconds for time-lock to expire...');
      await new Promise(resolve => setTimeout(resolve, 65000));
      
      console.log('\n💰 Step 4: Withdrawing stake...');
      const withdrawTx = await defiAggregator.withdrawTimeLockedStake(stakeId);
      await withdrawTx.wait();
      console.log('✅ Stake withdrawn');
      
      const finalBalance = await wmatic.balanceOf(deployer.address);
      console.log(`Final WMATIC Balance: ${hre.ethers.formatEther(finalBalance)}`);
    }
    
    console.log('\n🎉 Test completed successfully!');
    console.log(`🔗 View on Polygonscan: https://polygonscan.com/address/${deploymentInfo.contractAddress}`);
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

main().catch(console.error);
