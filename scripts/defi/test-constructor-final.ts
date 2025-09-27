import { ethers } from "hardhat";
import { formatEther, parseEther } from "ethers";

async function main() {
  console.log("🔍 TESTING CONSTRUCTOR STAKE FINAL");
  console.log("==================================");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer address:", deployer.address);
  console.log("Deployer balance:", formatEther(await deployer.provider.getBalance(deployer.address)), "MATIC");

  // Amount to stake: 0.00001 MATIC
  const stakeAmount = parseEther("0.00001");
  const protocol = "aave_lending";

  console.log("\n📋 Deployment Parameters:");
  console.log("- Stake Amount:", formatEther(stakeAmount), "MATIC");
  console.log("- Protocol:", protocol);
  console.log("- Lock Duration: 2 days");

  // Deploy ConstructorStakeExample
  console.log("\n⏳ Deploying ConstructorStakeExample...");
  const ConstructorStakeExample = await ethers.getContractFactory("ConstructorStakeExample");
  
  const constructorStake = await ConstructorStakeExample.deploy(
    stakeAmount,
    protocol,
    { value: stakeAmount }
  );

  await constructorStake.waitForDeployment();
  const contractAddress = await constructorStake.getAddress();
  
  console.log("✅ ConstructorStakeExample deployed at:", contractAddress);
  console.log("📋 Stake ID:", await constructorStake.stakeId());
  console.log("📋 Staked Amount:", formatEther(await constructorStake.stakedAmount()), "MATIC");
  console.log("📋 Owner:", await constructorStake.owner());
  console.log("📋 Aggregator:", await constructorStake.aggregator());

  // Check contract balance
  const contractBalance = await constructorStake.getContractBalance();
  console.log("📋 Contract Balance:", formatEther(contractBalance), "MATIC");

  // Check aggregator for the stake
  const aggregatorAddress = "0xC56E28efdcf5c1974F3b7148a0a72c8bc2Fdb559";
  const aggregator = await ethers.getContractAt("PolygonDeFiAggregator", aggregatorAddress);
  
  console.log("\n📋 Checking stake in aggregator...");
  try {
    const stakes = await aggregator.getUserTimeLockedStakes(contractAddress);
    console.log("📋 Time-locked stakes:", stakes);
    
    if (stakes.length > 0) {
      const stake = stakes[0];
      console.log("📋 Stake details:");
      console.log("  - Amount:", formatEther(stake.amount), "MATIC");
      console.log("  - Shares:", formatEther(stake.shares), "shares");
      console.log("  - Start Time:", new Date(Number(stake.startTime) * 1000).toISOString());
      console.log("  - End Time:", new Date(Number(stake.endTime) * 1000).toISOString());
      console.log("  - Is Active:", stake.isActive);
      console.log("  - Is Scheduled:", stake.isScheduled);
      
      // Check if stake is ready for withdrawal
      const currentTime = Math.floor(Date.now() / 1000);
      const endTime = Number(stake.endTime);
      console.log("📋 Current timestamp:", currentTime);
      console.log("📋 Stake end time:", endTime);
      console.log("📋 Time until unlock:", endTime - currentTime, "seconds");
      console.log("📋 Can withdraw now:", currentTime >= endTime);
    }
  } catch (error) {
    console.log("❌ Error getting stakes:", error);
  }

  // Wait a moment before withdrawal
  console.log("\n⏳ Waiting 10 seconds before withdrawal...");
  await new Promise(resolve => setTimeout(resolve, 10000));

  // Try to withdraw stake
  console.log("\n💰 Attempting to withdraw stake...");
  const balanceBefore = await deployer.provider.getBalance(deployer.address);
  console.log("Balance before withdrawal:", formatEther(balanceBefore), "MATIC");

  try {
    const withdrawTx = await constructorStake.withdrawStake();
    const withdrawReceipt = await withdrawTx.wait();
    console.log("✅ Withdrawal successful!");
    console.log("📋 Transaction hash:", withdrawReceipt?.hash);

    const balanceAfter = await deployer.provider.getBalance(deployer.address);
    console.log("Balance after withdrawal:", formatEther(balanceAfter), "MATIC");
    console.log("Amount withdrawn:", formatEther(balanceAfter - balanceBefore), "MATIC");
  } catch (error) {
    console.log("❌ Withdrawal failed:", error);
    
    // If withdrawal failed due to time lock, try emergency withdraw
    console.log("\n🚨 Trying emergency withdraw...");
    try {
      const emergencyTx = await constructorStake.emergencyWithdraw();
      const emergencyReceipt = await emergencyTx.wait();
      console.log("✅ Emergency withdrawal successful!");
      console.log("📋 Transaction hash:", emergencyReceipt?.hash);
    } catch (emergencyError) {
      console.log("❌ Emergency withdrawal also failed:", emergencyError);
    }
  }

  // Check final contract balance
  const finalContractBalance = await constructorStake.getContractBalance();
  console.log("📋 Final Contract Balance:", formatEther(finalContractBalance), "MATIC");

  console.log("\n✅ Test completed!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Test failed:", error);
    process.exit(1);
  });
