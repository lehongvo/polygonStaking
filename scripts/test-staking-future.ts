import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';

const hre = require('hardhat');

async function main() {
  console.log('🧪 Testing WMATIC Staking (Future Start)...');

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
    // Check current WMATIC balance first
    const currentBalance = await wmatic.balanceOf(deployer.address);
    console.log(`Current WMATIC Balance: ${hre.ethers.formatEther(currentBalance)}`);
    
    if (currentBalance < stakeAmount) {
      console.log('\n💱 Step 1: Wrapping POL to WMATIC...');
      const wrapTx = await wmatic.deposit({ value: stakeAmount });
      await wrapTx.wait();
      console.log('✅ Wrapped to WMATIC');
    } else {
      console.log('\n✅ Already have enough WMATIC');
    }
    
    const balance = await wmatic.balanceOf(deployer.address);
    console.log(`WMATIC Balance: ${hre.ethers.formatEther(balance)}`);

    console.log('\n🔓 Step 2: Approving WMATIC...');
    const approveTx = await wmatic.approve(deploymentInfo.contractAddress, stakeAmount);
    await approveTx.wait();
    console.log('✅ WMATIC approved');

    console.log('\n🔒 Step 3: Creating time-locked stake...');
    
    // Get current block timestamp
    const latestBlock = await hre.ethers.provider.getBlock('latest');
    const currentBlockTime = latestBlock.timestamp;
    
    // Start time: 1 minute from now
    const startTime = currentBlockTime + 60;
    const duration = 86400; // 1 day
    const endTime = startTime + duration;
    
    console.log(`Current Block Time: ${new Date(currentBlockTime * 1000).toLocaleString()}`);
    console.log(`Start Time: ${new Date(startTime * 1000).toLocaleString()}`);
    console.log(`End Time: ${new Date(endTime * 1000).toLocaleString()}`);
    
    const stakeTx = await defiAggregator.createTimeLockedStake(
      WMATIC_ADDRESS,
      stakeAmount,
      'aave_lending',
      startTime,
      duration
    );
    const receipt = await stakeTx.wait();
    console.log('✅ Time-locked stake created');
    console.log(`Transaction: https://polygonscan.com/tx/${receipt.hash}`);
    
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
      console.log(`\n📋 Stake ID: ${stakeId}`);
      
      // Check stake info
      const stakeInfo = await defiAggregator.getTimeLockedStake(stakeId);
      console.log('\n📊 Stake Information:');
      console.log(`- Amount: ${hre.ethers.formatEther(stakeInfo.amount)} WMATIC`);
      console.log(`- Protocol: ${stakeInfo.protocol}`);
      console.log(`- Start Time: ${new Date(Number(stakeInfo.startTime) * 1000).toLocaleString()}`);
      console.log(`- End Time: ${new Date(Number(stakeInfo.endTime) * 1000).toLocaleString()}`);
      console.log(`- Active: ${stakeInfo.active}`);
      
      console.log('\n💡 Withdrawal Information:');
      console.log(`- Stake will be active from: ${new Date(startTime * 1000).toLocaleString()}`);
      console.log(`- Can withdraw after: ${new Date(endTime * 1000).toLocaleString()}`);
      console.log(`- To withdraw: call withdrawTimeLockedStake(${stakeId})`);
      
      // Save stake info for later withdrawal
      const stakeData = {
        stakeId: stakeId.toString(),
        amount: stakeAmount.toString(),
        startTime: startTime,
        endTime: endTime,
        contractAddress: deploymentInfo.contractAddress,
        tokenAddress: WMATIC_ADDRESS,
        protocol: 'aave_lending'
      };
      
      fs.writeFileSync('active-stake.json', JSON.stringify(stakeData, null, 2));
      console.log('\n💾 Stake info saved to active-stake.json');
    }
    
    console.log('\n🎉 Staking completed successfully!');
    console.log(`🔗 View contract: https://polygonscan.com/address/${deploymentInfo.contractAddress}#readContract`);
    console.log(`🔗 View stake transaction: https://polygonscan.com/tx/${receipt.hash}`);
    
    console.log('\n📝 Next Steps:');
    console.log('1. Wait for start time to begin earning rewards');
    console.log('2. Wait for end time to withdraw');
    console.log('3. Use withdrawTimeLockedStake() function to claim tokens + rewards');
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    
    if (error.message.includes('Start time cannot be in the past')) {
      console.log('💡 Start time must be in the future');
    } else if (error.message.includes('Minimum lock duration')) {
      console.log('💡 Contract requires minimum 1 day lock duration');
    } else if (error.message.includes('insufficient allowance')) {
      console.log('💡 Token approval failed');
    }
  }
}

main().catch(console.error);
