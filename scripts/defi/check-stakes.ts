import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';

const hre = require('hardhat');

async function main() {
  console.log('🔍 Checking Time-Locked Stakes on Polygon Mainnet...');
  console.log('===================================================');

  const [signer] = await hre.ethers.getSigners();
  console.log(`👤 Signer: ${signer.address}`);
  console.log(
    `💰 Balance: ${hre.ethers.formatEther(await hre.ethers.provider.getBalance(signer.address))} MATIC`
  );

  // Load deployment info
  const deploymentPath = path.join(
    process.cwd(),
    'deployInfo',
    'polygon-defi-deployment.json'
  );
  
  if (!fs.existsSync(deploymentPath)) {
    console.error('❌ Deployment file not found!');
    console.log('💡 Please deploy the contract first');
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  const contractAddress = deployment.contractAddress;

  console.log(`📋 Contract: ${contractAddress}`);

  // Get contract instance
  const defiAggregator = await hre.ethers.getContractAt(
    'PolygonDeFiAggregator',
    contractAddress
  );

  try {
    // Get user's time-locked stakes
    console.log('\n📊 Fetching your time-locked stakes...');
    const timeLockedStakes = await defiAggregator.getUserTimeLockedStakes(
      signer.address
    );

    if (timeLockedStakes.length === 0) {
      console.log('❌ No time-locked stakes found!');
      console.log('💡 Create your first stake using: npm run stake');
      return;
    }

    console.log(`\n📋 Found ${timeLockedStakes.length} time-locked stakes:`);
    console.log('='.repeat(60));

    let totalStaked = 0n;
    let activeStakes = 0;
    let maturedStakes = 0;

    // Display all stakes with detailed info
    for (let i = 0; i < timeLockedStakes.length; i++) {
      const stake = timeLockedStakes[i];
      
      console.log(`\n🆔 Stake #${i}:`);
      console.log(`💰 Amount: ${hre.ethers.formatEther(stake.amount)} WMATIC`);
      console.log(`🪙 Token: ${stake.stakingToken}`);
      console.log(`📋 Protocol: ${stake.protocol}`);
      console.log(`⏰ Start: ${new Date(Number(stake.startTime) * 1000).toLocaleString()}`);
      console.log(`⏰ End: ${new Date(Number(stake.endTime) * 1000).toLocaleString()}`);
      console.log(`🔒 Active: ${stake.isActive}`);
      console.log(`📅 Scheduled: ${stake.isScheduled}`);

      if (stake.isActive) {
        activeStakes++;
        totalStaked += stake.amount;

        // Check if matured
        const isMatured = await defiAggregator.isTimeLockedStakeMatured(
          signer.address,
          i
        );
        console.log(`✅ Matured: ${isMatured}`);
        
        if (isMatured) {
          maturedStakes++;
        }

        // Calculate time remaining
        const now = Math.floor(Date.now() / 1000);
        const endTime = Number(stake.endTime);
        const timeRemaining = endTime - now;

        if (timeRemaining > 0) {
          const days = Math.floor(timeRemaining / 86400);
          const hours = Math.floor((timeRemaining % 86400) / 3600);
          const minutes = Math.floor((timeRemaining % 3600) / 60);
          console.log(`⏳ Time to maturity: ${days}d ${hours}h ${minutes}m`);
        } else {
          console.log(`🎉 Ready for withdrawal!`);
        }

        // Show withdrawal command
        console.log(`💸 Withdraw command: withdrawTimeLockedStake(${i})`);
      } else {
        console.log(`❌ Inactive (already withdrawn)`);
      }

      console.log('-'.repeat(40));
    }

    // Summary
    console.log(`\n📊 SUMMARY:`);
    console.log(`📈 Total Stakes: ${timeLockedStakes.length}`);
    console.log(`🔒 Active Stakes: ${activeStakes}`);
    console.log(`✅ Matured Stakes: ${maturedStakes}`);
    console.log(`💰 Total Staked: ${hre.ethers.formatEther(totalStaked)} WMATIC`);

    // Withdrawal options
    if (activeStakes > 0) {
      console.log('\n💸 Withdrawal Options:');
      
      for (let i = 0; i < timeLockedStakes.length; i++) {
        const stake = timeLockedStakes[i];
        if (!stake.isActive) continue;

        const isMatured = await defiAggregator.isTimeLockedStakeMatured(
          signer.address,
          i
        );

        console.log(
          `💰 Stake #${i}: Can withdraw ${hre.ethers.formatEther(stake.amount)} WMATIC + rewards (100% return)`
        );
        console.log(`   Use: withdrawTimeLockedStake(${i})`);
        if (isMatured) {
          console.log(`   ✅ Matured - optimal time to withdraw`);
        } else {
          console.log(`   ⏰ Still earning - can withdraw anytime`);
        }
      }
    }

    console.log('\n💡 Time-Locked Staking Benefits:');
    console.log('✅ Predictable maturity dates');
    console.log('✅ Always 100% return (no penalties)');
    console.log('✅ Better reward optimization for long-term holders');
    console.log('✅ Immediate execution (no scheduling complexity)');
    console.log('✅ Flexible withdrawal anytime with full rewards');

    console.log('\n🔗 View on Polygonscan:');
    console.log(`📋 Contract: https://polygonscan.com/address/${contractAddress}`);
    console.log(`📋 Read Contract: https://polygonscan.com/address/${contractAddress}#readContract`);

  } catch (error: any) {
    console.log('❌ Failed to fetch stakes:', error.message);
    console.log('💡 This might be expected if:');
    console.log('   - Contract is not deployed');
    console.log('   - Network connection issues');
    console.log('   - RPC endpoint problems');
  }

  console.log('\n✅ STAKE CHECK COMPLETED!');
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('💥 Check failed:', error);
    process.exit(1);
  });
