import * as fs from 'fs';
import { ethers } from 'hardhat';

async function main() {
  console.log('🔄 Testing Withdraw from Aave...');

  // Load deployment info
  const deploymentPath = './polygon-defi-deployment.json';
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  const contractAddress = deployment.contractAddress;

  console.log(`📍 Contract Address: ${contractAddress}`);

  // Get contract instance
  const PolygonDeFiAggregator = await ethers.getContractFactory(
    'PolygonDeFiAggregator'
  );
  const contract = PolygonDeFiAggregator.attach(contractAddress);

  // Get signer
  const [signer] = await ethers.getSigners();
  console.log(`👤 Signer: ${signer.address}`);

  // WMATIC token address
  const WMATIC_ADDRESS = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270';
  const WMATIC = await ethers.getContractAt('IERC20', WMATIC_ADDRESS);

  try {
    // Check current position
    console.log('\n📊 Current Position:');
    const userPosition = await contract.userPositions(signer.address);
    console.log(
      `  - Total Deposited: ${userPosition.totalDeposited.toString()} wei`
    );
    console.log(
      `  - Total Claimed: ${userPosition.totalClaimed.toString()} wei`
    );
    console.log(
      `  - Last Action Time: ${new Date(Number(userPosition.lastActionTime) * 1000).toLocaleString()}`
    );

    // Check protocol balance
    const protocolBalance = await contract.tokenProtocolTVL(
      WMATIC_ADDRESS,
      'aave_lending'
    );
    console.log(`  - Protocol TVL: ${protocolBalance.toString()} wei`);

    // Check user's WMATIC balance before withdraw
    const balanceBefore = await WMATIC.balanceOf(signer.address);
    console.log(`💰 WMATIC Balance Before: ${balanceBefore.toString()} wei`);

    // Test immediate withdraw
    const withdrawAmount = ethers.parseEther('0.005'); // Withdraw 0.005 WMATIC (half of what we staked)
    console.log(
      `\n🎯 Testing immediate withdraw of ${withdrawAmount.toString()} wei...`
    );

    // Execute withdraw
    console.log('🚀 Executing withdraw transaction...');
    const withdrawTx = await contract.withdrawImmediately(
      WMATIC_ADDRESS, // token address
      withdrawAmount, // amount to withdraw
      'aave_lending', // protocol name
      {
        gasLimit: 800000, // Set higher gas limit
      }
    );

    console.log(`⏳ Withdraw transaction: ${withdrawTx.hash}`);
    console.log(
      '🔗 View on PolygonScan:',
      `https://polygonscan.com/tx/${withdrawTx.hash}`
    );

    const receipt = await withdrawTx.wait();
    console.log(`✅ Transaction confirmed in block: ${receipt.blockNumber}`);
    console.log(`⛽ Gas Used: ${receipt.gasUsed.toString()}`);

    // Check if transaction interacted with Aave
    console.log('\n🔍 Analyzing transaction logs...');
    let foundAaveInteraction = false;
    let foundWithdrawEvent = false;

    for (let i = 0; i < receipt.logs.length; i++) {
      const log = receipt.logs[i];
      console.log(`  Log ${i}: Address ${log.address}`);

      // Check if any log is from Aave Pool
      if (
        log.address.toLowerCase() ===
        '0x794a61358D6845594F94dc1DB02A252b5b4814aD'.toLowerCase()
      ) {
        console.log(`    ✅ Found interaction with Aave Pool!`);
        foundAaveInteraction = true;
      }

      // Check for Withdrawn event from our contract
      if (log.address.toLowerCase() === contractAddress.toLowerCase()) {
        console.log(`    📝 Found event from our contract`);
        foundWithdrawEvent = true;
      }
    }

    if (foundAaveInteraction) {
      console.log('\n🎉 SUCCESS: Real Aave withdraw is working!');
    } else {
      console.log('\n⚠️ No direct Aave interaction found in logs');
    }

    if (foundWithdrawEvent) {
      console.log('✅ Withdraw event emitted successfully');
    }

    // Check balances after withdraw
    console.log('\n📈 After Withdraw:');
    const balanceAfter = await WMATIC.balanceOf(signer.address);
    console.log(`💰 WMATIC Balance After: ${balanceAfter.toString()} wei`);
    console.log(
      `📈 Balance Change: ${(balanceAfter - balanceBefore).toString()} wei`
    );

    // Check updated position
    const updatedPosition = await contract.userPositions(signer.address);
    console.log(
      `  - Total Deposited: ${updatedPosition.totalDeposited.toString()} wei`
    );

    // Check updated protocol balance
    const updatedProtocolBalance = await contract.tokenProtocolTVL(
      WMATIC_ADDRESS,
      'aave_lending'
    );
    console.log(`  - Protocol TVL: ${updatedProtocolBalance.toString()} wei`);

    console.log('\n🎉 Withdraw test completed successfully!');
  } catch (error) {
    console.error('❌ Error:', error.message);

    if (error.reason) {
      console.error('Revert reason:', error.reason);
    }

    // Check if it's insufficient balance
    if (error.message.includes('insufficient')) {
      console.log('💡 Possible issue: Insufficient staked balance to withdraw');
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
