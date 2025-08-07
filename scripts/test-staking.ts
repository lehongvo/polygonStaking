import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';

const hre = require('hardhat');

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
  console.log('🧪 Testing POL Staking with Time-Lock...');

  // Read deployment info
  const deploymentPath = path.join(__dirname, '..', 'polygon-defi-deployment.json');
  
  if (!fs.existsSync(deploymentPath)) {
    console.error('❌ Deployment file not found! Please deploy the contract first.');
    process.exit(1);
  }

  const deploymentInfo: DeploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  
  // Get network info
  const network = await hre.ethers.provider.getNetwork();
  const networkName = hre.network.name;
  
  console.log(`Network: ${networkName} (Chain ID: ${network.chainId})`);
  console.log(`DeFi Aggregator: ${deploymentInfo.contractAddress}`);

  // Get signers
  const [deployer] = await hre.ethers.getSigners();
  console.log('User address:', deployer.address);

  // Get contracts
  const defiAggregator = await hre.ethers.getContractAt('PolygonDeFiAggregator', deploymentInfo.contractAddress);
  
  // POL token address
  const polTokenAddress = deploymentInfo.tokens?.POL || process.env.POL_TOKEN_ADDRESS;
  if (!polTokenAddress) {
    console.error('❌ POL token address not found!');
    process.exit(1);
  }

  const polToken = await hre.ethers.getContractAt('IERC20', polTokenAddress);
  
  // Check POL balance
  const polBalance = await polToken.balanceOf(deployer.address);
  console.log(`POL Balance: ${hre.ethers.formatEther(polBalance)} POL`);

  const stakeAmount = hre.ethers.parseEther('0.1'); // 0.1 POL
  
  if (polBalance < stakeAmount) {
    console.error(`❌ Insufficient POL balance! Need 0.1 POL, have ${hre.ethers.formatEther(polBalance)} POL`);
    process.exit(1);
  }

  // Time-lock parameters
  const currentTime = Math.floor(Date.now() / 1000);
  const startTime = currentTime; // Start immediately
  const duration = 60; // 1 minute
  const endTime = startTime + duration;
  
  console.log('\n⏰ Time-Lock Parameters:');
  console.log(`Start Time: ${new Date(startTime * 1000).toLocaleString()}`);
  console.log(`End Time: ${new Date(endTime * 1000).toLocaleString()}`);
  console.log(`Duration: ${duration} seconds (1 minute)`);

  try {
    // Step 1: Approve POL tokens
    console.log('\n🔓 Step 1: Approving POL tokens...');
    const approveTx = await polToken.approve(deploymentInfo.contractAddress, stakeAmount);
    await approveTx.wait();
    console.log('✅ POL tokens approved');

    // Step 2: Create time-locked stake
    console.log('\n🔒 Step 2: Creating time-locked stake...');
    const stakeTx = await defiAggregator.createTimeLockedStake(
      polTokenAddress,
      stakeAmount,
      'aave_lending',
      startTime,
      duration
    );
    const stakeReceipt = await stakeTx.wait();
    console.log('✅ Time-locked stake created');
    console.log(`Transaction: ${stakeReceipt.hash}`);

    // Get stake ID from events
    const stakeEvent = stakeReceipt.logs.find((log: any) => {
      try {
        const parsed = defiAggregator.interface.parseLog(log);
        return parsed.name === 'TimeLockedStakeCreated';
      } catch {
        return false;
      }
    });

    let stakeId;
    if (stakeEvent) {
      const parsed = defiAggregator.interface.parseLog(stakeEvent);
      stakeId = parsed.args.stakeId;
      console.log(`Stake ID: ${stakeId}`);
    }

    // Step 3: Check stake info
    console.log('\n📊 Step 3: Checking stake info...');
    if (stakeId) {
      const stakeInfo = await defiAggregator.getTimeLockedStake(stakeId);
      console.log('Stake Info:');
      console.log(`- Amount: ${hre.ethers.formatEther(stakeInfo.amount)} POL`);
      console.log(`- Protocol: ${stakeInfo.protocol}`);
      console.log(`- Start Time: ${new Date(Number(stakeInfo.startTime) * 1000).toLocaleString()}`);
      console.log(`- End Time: ${new Date(Number(stakeInfo.endTime) * 1000).toLocaleString()}`);
      console.log(`- Active: ${stakeInfo.active}`);
    }

    // Step 4: Wait for time-lock to expire
    console.log('\n⏳ Step 4: Waiting for time-lock to expire...');
    console.log('Waiting 65 seconds to ensure time-lock expires...');
    
    // Wait 65 seconds (1 minute + 5 seconds buffer)
    await new Promise(resolve => setTimeout(resolve, 65000));
    
    console.log('✅ Time-lock should now be expired');

    // Step 5: Withdraw time-locked stake
    if (stakeId) {
      console.log('\n💰 Step 5: Withdrawing time-locked stake...');
      
      const balanceBefore = await polToken.balanceOf(deployer.address);
      console.log(`POL Balance Before Withdraw: ${hre.ethers.formatEther(balanceBefore)} POL`);
      
      const withdrawTx = await defiAggregator.withdrawTimeLockedStake(stakeId);
      const withdrawReceipt = await withdrawTx.wait();
      console.log('✅ Time-locked stake withdrawn');
      console.log(`Transaction: ${withdrawReceipt.hash}`);
      
      const balanceAfter = await polToken.balanceOf(deployer.address);
      console.log(`POL Balance After Withdraw: ${hre.ethers.formatEther(balanceAfter)} POL`);
      
      const gained = balanceAfter - balanceBefore;
      console.log(`Gained: ${hre.ethers.formatEther(gained)} POL`);
    }

    // Step 6: Check final state
    console.log('\n📈 Step 6: Final state check...');
    if (stakeId) {
      try {
        const finalStakeInfo = await defiAggregator.getTimeLockedStake(stakeId);
        console.log(`Final Stake Active: ${finalStakeInfo.active}`);
      } catch (error) {
        console.log('✅ Stake has been removed (expected after withdrawal)');
      }
    }

    console.log('\n🎉 Staking test completed successfully!');
    
    if (deploymentInfo.explorer) {
      console.log('\n🔗 View transactions on explorer:');
      console.log(`- Approve: ${deploymentInfo.explorer}/tx/${approveTx.hash}`);
      console.log(`- Stake: ${deploymentInfo.explorer}/tx/${stakeTx.hash}`);
      if (stakeId) {
        console.log(`- Withdraw: ${deploymentInfo.explorer}/tx/${withdrawTx.hash}`);
      }
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
