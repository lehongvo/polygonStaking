import 'dotenv/config';

const hre = require('hardhat');

async function main() {
  console.log('🔍 Testing Withdraw with Debug Logs...');
  console.log('=====================================');

  const [signer] = await hre.ethers.getSigners();
  console.log(`👤 Signer: ${signer.address}`);

  // Load deployment info
  const deploymentPath = 'deployInfo/polygon-defi-deployment.json';
  const deploymentInfo = require(`../${deploymentPath}`);
  const contractAddress = deploymentInfo.contractAddress;

  console.log(`📋 Contract: ${contractAddress}`);

  // Get contract instance
  const DeFiAggregatorFactory = await hre.ethers.getContractFactory(
    'PolygonDeFiAggregator'
  );
  const contract =
    DeFiAggregatorFactory.attach(contractAddress).connect(signer);

  try {
    // Check user's stakes
    console.log('\n📊 Checking user stakes...');
    const stakes = await contract.getUserTimeLockedStakes(signer.address);
    console.log(`📋 Found ${stakes.length} stakes`);

    if (stakes.length === 0) {
      console.log('❌ No stakes found. Please stake first.');
      return;
    }

    // Find active stake
    let activeStakeId = -1;
    for (let i = 0; i < stakes.length; i++) {
      if (stakes[i].isActive) {
        activeStakeId = i;
        break;
      }
    }

    if (activeStakeId === -1) {
      console.log('❌ No active stakes found.');
      return;
    }

    console.log(`\n📋 Active Stake #${activeStakeId}:`);
    console.log(
      `💰 Amount: ${hre.ethers.formatEther(stakes[activeStakeId].amount)} WMATIC`
    );
    console.log(`📊 Shares: ${stakes[activeStakeId].shares.toString()}`);
    console.log(
      `⏰ Start: ${new Date(Number(stakes[activeStakeId].startTime) * 1000).toLocaleString()}`
    );
    console.log(
      `⏰ End: ${new Date(Number(stakes[activeStakeId].endTime) * 1000).toLocaleString()}`
    );
    console.log(`🔒 Active: ${stakes[activeStakeId].isActive}`);
    console.log(`📋 Protocol: ${stakes[activeStakeId].protocol}`);
    console.log(`🪙 Token: ${stakes[activeStakeId].stakingToken}`);

    // Check protocol info
    console.log('\n🔍 Checking protocol info...');
    const protocolInfo = await contract.protocols(
      stakes[activeStakeId].protocol
    );
    console.log(`📋 Protocol Type: ${protocolInfo.protocolType}`);
    console.log(`📋 Contract Address: ${protocolInfo.contractAddress}`);
    console.log(`📋 Is Active: ${protocolInfo.isActive}`);

    // Check current balances
    console.log('\n💰 Checking current balances...');
    const position = await contract.userPositions(signer.address);
    console.log(
      `📊 Total Deposited: ${hre.ethers.formatEther(position.totalDeposited)}`
    );

    // Get token protocol balance and shares using view functions
    const tokenProtocolPosition = await contract.getUserTokenProtocolPosition(
      signer.address,
      stakes[activeStakeId].stakingToken,
      stakes[activeStakeId].protocol
    );
    console.log(
      `📊 Token Protocol Balance: ${hre.ethers.formatEther(tokenProtocolPosition.balance)}`
    );
    console.log(
      `📊 Token Protocol Shares: ${tokenProtocolPosition.shares.toString()}`
    );

    // Check WMATIC balance before
    const wmaticAddress = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270';
    const wmatic = await hre.ethers.getContractAt('IERC20', wmaticAddress);
    const balanceBefore = await wmatic.balanceOf(signer.address);
    console.log(
      `\n💰 WMATIC Balance Before: ${hre.ethers.formatEther(balanceBefore)}`
    );

    // Test withdraw with detailed logging
    console.log('\n🔄 Testing withdraw...');
    console.log(`📋 Stake ID: ${activeStakeId}`);
    console.log(
      `📋 Shares to withdraw: ${stakes[activeStakeId].shares.toString()}`
    );

    // Estimate gas
    const gasEstimate =
      await contract.withdrawTimeLockedStake.estimateGas(activeStakeId);
    console.log(`⛽ Estimated Gas: ${gasEstimate.toString()}`);

    // Execute withdraw
    console.log('\n🚀 Executing withdraw...');
    const tx = await contract.withdrawTimeLockedStake(activeStakeId, {
      gasLimit: Math.floor(Number(gasEstimate) * 1.2), // Add 20% buffer
    });

    console.log(`⏳ Transaction: ${tx.hash}`);
    console.log('⏳ Waiting for confirmation...');

    const receipt = await tx.wait();
    console.log(`✅ Confirmed in block: ${receipt.blockNumber}`);

    // Check logs
    console.log('\n📋 Transaction Logs:');
    if (receipt.logs.length > 0) {
      receipt.logs.forEach((log, i) => {
        console.log(`\nEvent ${i}:`);
        console.log(`  Address: ${log.address}`);
        console.log(`  Topics: ${log.topics.join(', ')}`);
        console.log(`  Data: ${log.data}`);

        // Check if this is Aave Pool
        if (
          log.address.toLowerCase() ===
          '0x794a61358d6845594f94dc1db02a252b5b4814ad'
        ) {
          console.log(`  🏦 AAVE POOL INTERACTION DETECTED!`);
        }
      });
    }

    // Check WMATIC balance after
    const balanceAfter = await wmatic.balanceOf(signer.address);
    console.log(
      `\n💰 WMATIC Balance After: ${hre.ethers.formatEther(balanceAfter)}`
    );
    console.log(
      `💎 Net Received: ${hre.ethers.formatEther(balanceAfter - balanceBefore)}`
    );

    // Check updated stake info
    const updatedStakes = await contract.getUserTimeLockedStakes(
      signer.address
    );
    if (updatedStakes[activeStakeId]) {
      console.log(`\n📊 Updated Stake Info:`);
      console.log(`🔒 Is Active: ${updatedStakes[activeStakeId].isActive}`);
    }

    console.log('\n✅ WITHDRAW DEBUG COMPLETED!');
  } catch (error) {
    console.log('❌ Withdraw failed:', error.message);

    if (error.data) {
      console.log('📋 Error Data:', error.data);
    }

    if (error.reason) {
      console.log('📋 Error Reason:', error.reason);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
