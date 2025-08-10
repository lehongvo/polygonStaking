import 'dotenv/config';

const hre = require('hardhat');

async function main() {
  console.log('🔍 Checking Transaction Details...');
  console.log('================================');

  const [signer] = await hre.ethers.getSigners();
  console.log(`👤 Signer: ${signer.address}`);

  // Transaction hashes
  const stakingTxHash = '0xb4c96007b5b7884a14177dd3258915e8f6809dde4e50295238161dd78bd7392f';
  const withdrawTxHash = '0x925410918420eeb3703b7f3f3a184b3a9ff2846f5d7a4f9e16abb3aa40c6a96f';

  try {
    // Get transaction details
    console.log('\n📋 Staking Transaction Details:');
    const stakingTx = await hre.ethers.provider.getTransaction(stakingTxHash);
    if (stakingTx) {
      console.log(`📝 Hash: ${stakingTx.hash}`);
      console.log(`📊 Block Number: ${stakingTx.blockNumber}`);
      console.log(`💰 Value: ${hre.ethers.formatEther(stakingTx.value || 0)} MATIC`);
      console.log(`📋 To: ${stakingTx.to}`);
      console.log(`📋 From: ${stakingTx.from}`);
      console.log(`⛽ Gas Price: ${hre.ethers.formatUnits(stakingTx.gasPrice || 0, 'gwei')} Gwei`);
      console.log(`📋 Data: ${stakingTx.data}`);
    }

    // Get transaction receipt
    const stakingReceipt = await hre.ethers.provider.getTransactionReceipt(stakingTxHash);
    if (stakingReceipt) {
      console.log(`\n📊 Staking Transaction Receipt:`);
      console.log(`⛽ Gas Used: ${stakingReceipt.gasUsed.toString()}`);
      console.log(`📊 Status: ${stakingReceipt.status === 1 ? 'Success' : 'Failed'}`);
      console.log(`📋 Logs: ${stakingReceipt.logs.length} events`);
      
      // Parse logs
      if (stakingReceipt.logs.length > 0) {
        console.log('\n📋 Event Logs:');
        stakingReceipt.logs.forEach((log, i) => {
          console.log(`Event ${i}:`);
          console.log(`  Address: ${log.address}`);
          console.log(`  Topics: ${log.topics.join(', ')}`);
          console.log(`  Data: ${log.data}`);
        });
      }
    }

    console.log('\n📋 Withdraw Transaction Details:');
    const withdrawTx = await hre.ethers.provider.getTransaction(withdrawTxHash);
    if (withdrawTx) {
      console.log(`📝 Hash: ${withdrawTx.hash}`);
      console.log(`📊 Block Number: ${withdrawTx.blockNumber}`);
      console.log(`💰 Value: ${hre.ethers.formatEther(withdrawTx.value || 0)} MATIC`);
      console.log(`📋 To: ${withdrawTx.to}`);
      console.log(`📋 From: ${withdrawTx.from}`);
      console.log(`⛽ Gas Price: ${hre.ethers.formatUnits(withdrawTx.gasPrice || 0, 'gwei')} Gwei`);
      console.log(`📋 Data: ${withdrawTx.data}`);
    }

    // Get transaction receipt
    const withdrawReceipt = await hre.ethers.provider.getTransactionReceipt(withdrawTxHash);
    if (withdrawReceipt) {
      console.log(`\n📊 Withdraw Transaction Receipt:`);
      console.log(`⛽ Gas Used: ${withdrawReceipt.gasUsed.toString()}`);
      console.log(`📊 Status: ${withdrawReceipt.status === 1 ? 'Success' : 'Failed'}`);
      console.log(`📋 Logs: ${withdrawReceipt.logs.length} events`);
      
      // Parse logs
      if (withdrawReceipt.logs.length > 0) {
        console.log('\n📋 Event Logs:');
        withdrawReceipt.logs.forEach((log, i) => {
          console.log(`Event ${i}:`);
          console.log(`  Address: ${log.address}`);
          console.log(`  Topics: ${log.topics.join(', ')}`);
          console.log(`  Data: ${log.data}`);
        });
      }
    }

    // Check if Aave Pool was called
    console.log('\n🔍 Checking Aave Pool Interaction...');
    const aavePoolAddress = '0x794a61358D6845594F94dc1DB02A252b5b4814aD';
    
    // Check if any logs contain Aave Pool address
    const stakingLogs = stakingReceipt?.logs || [];
    const withdrawLogs = withdrawReceipt?.logs || [];
    
    const aaveInStaking = stakingLogs.some(log => log.address.toLowerCase() === aavePoolAddress.toLowerCase());
    const aaveInWithdraw = withdrawLogs.some(log => log.address.toLowerCase() === aavePoolAddress.toLowerCase());
    
    console.log(`🏦 Aave Pool in Staking Logs: ${aaveInStaking ? '✅ YES' : '❌ NO'}`);
    console.log(`🏦 Aave Pool in Withdraw Logs: ${aaveInWithdraw ? '✅ YES' : '❌ NO'}`);
    
    if (!aaveInStaking && !aaveInWithdraw) {
      console.log('\n⚠️  WARNING: Aave Pool was NOT called!');
      console.log('This means the contract is not actually staking to Aave.');
      console.log('Check the contract logic and protocol configuration.');
    } else {
      console.log('\n✅ SUCCESS: Aave Pool was called!');
    }

  } catch (error) {
    console.log('❌ Check failed:', error.message);
  }

  console.log('\n✅ TRANSACTION DETAILS CHECK COMPLETED!');
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('💥 Check failed:', error);
    process.exit(1);
  });
