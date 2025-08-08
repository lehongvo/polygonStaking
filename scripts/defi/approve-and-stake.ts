import * as fs from 'fs';
import { ethers } from 'hardhat';

async function main() {
  console.log('🔧 Approve and Stake to Aave...');

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
    // Check current balance and allowance
    const balance = await WMATIC.balanceOf(signer.address);
    const allowance = await WMATIC.allowance(signer.address, contractAddress);

    console.log(`💰 WMATIC Balance: ${balance.toString()} wei`);
    console.log(`🔓 Current Allowance: ${allowance.toString()} wei`);

    // Stake amount
    const stakeAmount = ethers.parseEther('0.01'); // 0.01 WMATIC
    console.log(`🎯 Stake Amount: ${stakeAmount.toString()} wei`);

    // Check if we have enough balance
    if (balance < stakeAmount) {
      console.log('❌ Insufficient WMATIC balance!');
      return;
    }

    // Approve if needed
    if (allowance < stakeAmount) {
      console.log('\n🔓 Approving WMATIC spending...');
      const approveTx = await WMATIC.approve(contractAddress, stakeAmount);
      console.log(`⏳ Approval transaction: ${approveTx.hash}`);
      await approveTx.wait();
      console.log('✅ WMATIC approved!');

      // Verify approval
      const newAllowance = await WMATIC.allowance(
        signer.address,
        contractAddress
      );
      console.log(`🔓 New Allowance: ${newAllowance.toString()} wei`);
    }

    // Now stake to Aave
    console.log('\n🚀 Staking to Aave...');
    const stakeTx = await contract.stake(
      WMATIC_ADDRESS, // token address
      stakeAmount, // amount
      'aave_lending', // protocol name
      {
        gasLimit: 800000, // Set higher gas limit
      }
    );

    console.log(`⏳ Stake transaction: ${stakeTx.hash}`);
    console.log(
      '🔗 View on PolygonScan:',
      `https://polygonscan.com/tx/${stakeTx.hash}`
    );

    const receipt = await stakeTx.wait();
    console.log(`✅ Transaction confirmed in block: ${receipt.blockNumber}`);
    console.log(`⛽ Gas Used: ${receipt.gasUsed.toString()}`);

    // Check if transaction interacted with Aave
    console.log('\n🔍 Analyzing transaction logs...');
    let foundAaveInteraction = false;
    let foundStakeEvent = false;

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

      // Check for Staked event from our contract
      if (log.address.toLowerCase() === contractAddress.toLowerCase()) {
        console.log(`    📝 Found event from our contract`);
        foundStakeEvent = true;
      }
    }

    if (foundAaveInteraction) {
      console.log('\n🎉 SUCCESS: Real Aave integration is working!');
    } else {
      console.log('\n⚠️ No direct Aave interaction found in logs');
    }

    if (foundStakeEvent) {
      console.log('✅ Stake event emitted successfully');
    }

    // Verify updated position
    console.log('\n📈 Checking updated position...');
    const updatedPosition = await contract.userPositions(signer.address);
    console.log(
      `  - Total Deposited: ${updatedPosition.totalDeposited.toString()} wei`
    );

    // Check protocol balance
    const protocolBalance = await contract.tokenProtocolTVL(
      WMATIC_ADDRESS,
      'aave_lending'
    );
    console.log(`  - Protocol TVL: ${protocolBalance.toString()} wei`);

    console.log('\n🎉 Approve and stake completed successfully!');
  } catch (error) {
    console.error('❌ Error:', error.message);

    if (error.reason) {
      console.error('Revert reason:', error.reason);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
