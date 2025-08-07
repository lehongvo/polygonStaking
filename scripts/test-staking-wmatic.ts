import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';

const hre = require('hardhat');

// WMATIC address on Polygon
const WMATIC_ADDRESS = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270';

async function main() {
  console.log('🧪 Testing WMATIC Staking with Time-Lock...');

  // Read deployment info
  const deploymentPath = path.join(__dirname, '..', 'polygon-defi-deployment.json');
  const deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  
  console.log(`DeFi Aggregator: ${deploymentInfo.contractAddress}`);

  // Get signer
  const [deployer] = await hre.ethers.getSigners();
  console.log('User address:', deployer.address);

  // Check native POL balance
  const nativeBalance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`Native POL Balance: ${hre.ethers.formatEther(nativeBalance)} POL`);

  // Get contracts
  const defiAggregator = await hre.ethers.getContractAt('PolygonDeFiAggregator', deploymentInfo.contractAddress);
  const wmatic = await hre.ethers.getContractAt('IWETH', WMATIC_ADDRESS);
  
  const stakeAmount = hre.ethers.parseEther('0.1'); // 0.1 WMATIC
  
  if (nativeBalance < stakeAmount * 2n) { // Need extra for gas
    console.error(`❌ Insufficient native POL! Need at least 0.2 POL for staking + gas`);
    process.exit(1);
  }

  // Time-lock parameters
  const currentTime = Math.floor(Date.now() / 1000);
  const startTime = currentTime;
  const duration = 60; // 1 minute
  const endTime = startTime + duration;
  
  console.log('\n⏰ Time-Lock Parameters:');
  console.log(`Start Time: ${new Date(startTime * 1000).toLocaleString()}`);
  console.log(`End Time: ${new Date(endTime * 1000).toLocaleString()}`);
  console.log(`Duration: ${duration} seconds (1 minute)`);

  try {
    // Step 1: Wrap POL to WMATIC
    console.log('\n💱 Step 1: Wrapping POL to WMATIC...');
    const wrapTx = await wmatic.deposit({ value: stakeAmount });
    await wrapTx.wait();
    console.log('✅ POL wrapped to WMATIC');
    
    const wmaticBalance = await wmatic.balanceOf(deployer.address);
    console.log(`WMATIC Balance: ${hre.ethers.formatEther(wmaticBalance)} WMATIC`);

    // Step 2: Approve WMATIC tokens
    console.log('\n🔓 Step 2: Approving WMATIC tokens...');
    const approveTx = await wmatic.approve(deploymentInfo.contractAddress, stakeAmount);
    await approveTx.wait();
    console.log('✅ WMATIC tokens approved');

    // Step 3: Create time-locked stake
    console.log('\n🔒 Step 3: Creating time-locked stake...');
    const stakeTx = await defiAggregator.createTimeLockedStake(
      WMATIC_ADDRESS,
      stakeAmount,
      'aave_lending',
      startTime,
      duration
    );
    const stakeReceipt = await stakeTx.wait();
    console.log('✅ Time-locked stake created');
    console.log(`Transaction: ${stakeReceipt.hash}`);

    // Get stake ID from events
    let stakeId;
    for (const log of stakeReceipt.logs) {
      try {
        const parsed = defiAggregator.interface.parseLog(log);
        if (parsed.name === 'TimeLockedStakeCreated') {
          stakeId = parsed.args.stakeId;
          console.log(`Stake ID: ${stakeId}`);
          break;
        }
      } catch {
        // Skip non-matching logs
      }
    }

    // Step 4: Check stake info
    console.log('\n📊 Step 4: Checking stake info...');
    if (stakeId) {
      const stakeInfo = await defiAggregator.getTimeLockedStake(stakeId);
      console.log('Stake Info:');
      console.log(`- Amount: ${hre.ethers.formatEther(stakeInfo.amount)} WMATIC`);
      console.log(`- Protocol: ${stakeInfo.protocol}`);
      console.log(`- Start Time: ${new Date(Number(stakeInfo.startTime) * 1000).toLocaleString()}`);
      console.log(`- End Time: ${new Date(Number(stakeInfo.endTime) * 1000).toLocaleString()}`);
      console.log(`- Active: ${stakeInfo.active}`);
    }

    // Step 5: Wait for time-lock to expire
    console.log('\n⏳ Step 5: Waiting for time-lock to expire...');
    console.log('Waiting 65 seconds to ensure time-lock expires...');
    
    // Wait 65 seconds (1 minute + 5 seconds buffer)
    await new Promise(resolve => setTimeout(resolve, 65000));
    
    console.log('✅ Time-lock should now be expired');

    // Step 6: Withdraw time-locked stake
    if (stakeId) {
      console.log('\n💰 Step 6: Withdrawing time-locked stake...');
      
      const balanceBefore = await wmatic.balanceOf(deployer.address);
      console.log(`WMATIC Balance Before Withdraw: ${hre.ethers.formatEther(balanceBefore)} WMATIC`);
      
      const withdrawTx = await defiAggregator.withdrawTimeLockedStake(stakeId);
      const withdrawReceipt = await withdrawTx.wait();
      console.log('✅ Time-locked stake withdrawn');
      console.log(`Transaction: ${withdrawReceipt.hash}`);
      
      const balanceAfter = await wmatic.balanceOf(deployer.address);
      console.log(`WMATIC Balance After Withdraw: ${hre.ethers.formatEther(balanceAfter)} WMATIC`);
      
      const gained = balanceAfter - balanceBefore;
      console.log(`Gained: ${hre.ethers.formatEther(gained)} WMATIC`);
      
      // Step 7: Unwrap WMATIC back to POL
      console.log('\n💱 Step 7: Unwrapping WMATIC back to POL...');
      const unwrapTx = await wmatic.withdraw(balanceAfter);
      await unwrapTx.wait();
      console.log('✅ WMATIC unwrapped back to POL');
    }

    console.log('\n🎉 Staking test completed successfully!');
    
    console.log('\n🔗 View transactions on Polygonscan:');
    console.log(`- Wrap: https://polygonscan.com/tx/${wrapTx.hash}`);
    console.log(`- Approve: https://polygonscan.com/tx/${approveTx.hash}`);
    console.log(`- Stake: https://polygonscan.com/tx/${stakeTx.hash}`);
    if (stakeId) {
      console.log(`- Withdraw: https://polygonscan.com/tx/${withdrawTx.hash}`);
    }

  } catch (error: any) {
    console.error('❌ Error during staking test:', error.message);
    
    if (error.message.includes('Time lock not expired')) {
      console.log('💡 Time-lock has not expired yet. Wait longer before withdrawing.');
    } else if (error.message.includes('insufficient allowance')) {
      console.log('💡 Token approval failed. Check token balance and try again.');
    } else if (error.message.includes('Stake not found')) {
      console.log('💡 Stake ID not found. Check if stake was created successfully.');
    }
    
    process.exit(1);
  }
}

main()
  .then(() => {
    console.log('\n✅ Test completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
