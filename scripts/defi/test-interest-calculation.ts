import * as fs from "fs";
import { ethers } from "hardhat";
import * as path from "path";

async function main() {
    console.log("💰 Testing Interest Calculation");
    console.log("===============================");

    const [signer] = await ethers.getSigners();
    console.log(`👤 Signer: ${signer.address}`);

    // Load deployment info
    const deploymentPath = path.join(__dirname, "../polygon-defi-deployment.json");
    const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    
    const contractAddress = deployment.contractAddress;
    const polAddress = deployment.tokens.POL;
    
    console.log(`📋 Contract: ${contractAddress}`);
    console.log(`🪙 POL: ${polAddress}`);

    // Connect to contracts
    const defiAggregator = await ethers.getContractAt("PolygonDeFiAggregator", contractAddress);
    const polToken = await ethers.getContractAt("IERC20", polAddress);

    // Check current stake
    console.log("\n📊 Current Stake Info:");
    const stakeInfo = await defiAggregator.getUserTokenProtocolPosition(signer.address, polAddress, "aave_lending");
    console.log(`💰 Staked Balance: ${ethers.formatEther(stakeInfo.balance)} POL`);
    console.log(`📈 Estimated Rewards: ${ethers.formatEther(stakeInfo.estimatedRewards)} POL`);
    console.log(`🔢 Shares: ${ethers.formatEther(stakeInfo.shares)}`);

    // Get protocol info
    console.log("\n🏦 Protocol Info:");
    const protocolInfo = await defiAggregator.protocols("aave_lending");
    console.log(`📍 Contract: ${protocolInfo.contractAddress}`);
    console.log(`💎 Reward Token: ${protocolInfo.rewardToken}`);
    console.log(`📈 Current APY: ${Number(protocolInfo.currentAPY) / 100}% (${protocolInfo.currentAPY} basis points)`);
    console.log(`🏷️ Type: ${protocolInfo.protocolType}`);
    console.log(`✅ Active: ${protocolInfo.isActive}`);

    // Get total position
    console.log("\n📊 Total Position:");
    const totalPosition = await defiAggregator.getUserTotalPosition(signer.address);
    console.log(`💰 Total Deposited: ${ethers.formatEther(totalPosition.totalDeposited)} tokens`);
    console.log(`💸 Total Claimed: ${ethers.formatEther(totalPosition.totalClaimed)} tokens`);
    console.log(`💎 Estimated Value: ${ethers.formatEther(totalPosition.estimatedValue)} tokens`);
    console.log(`🎁 Total Rewards: ${ethers.formatEther(totalPosition.totalRewards)} tokens`);

    // Calculate manual interest for verification
    console.log("\n🧮 Manual Interest Calculation:");
    const balance = stakeInfo.balance;
    const apy = protocolInfo.currentAPY; // basis points
    const currentTime = Math.floor(Date.now() / 1000);
    
    // Get protocol last update time
    const lastUpdate = await defiAggregator.protocolLastUpdate("aave_lending");
    const timeElapsed = BigInt(currentTime) - lastUpdate;
    
    console.log(`⏰ Current Time: ${new Date(currentTime * 1000).toLocaleString()}`);
    console.log(`⏰ Last Update: ${new Date(Number(lastUpdate) * 1000).toLocaleString()}`);
    console.log(`⏱️ Time Elapsed: ${timeElapsed} seconds (${Number(timeElapsed) / 3600} hours)`);
    
    if (balance > 0) {
        // Manual calculation: (balance * APY * timeElapsed) / (365 days * 10000)
        const secondsInYear = BigInt(365 * 24 * 3600);
        const manualRewards = (balance * BigInt(apy) * timeElapsed) / (secondsInYear * BigInt(10000));
        
        console.log(`💰 Balance: ${ethers.formatEther(balance)} POL`);
        console.log(`📈 APY: ${apy} basis points (${Number(apy)/100}%)`);
        console.log(`🧮 Manual Calculation: ${ethers.formatEther(manualRewards)} POL`);
        console.log(`📊 Contract Calculation: ${ethers.formatEther(stakeInfo.estimatedRewards)} POL`);
        
        // Calculate daily/yearly projections
        const dailyRewards = (balance * BigInt(apy)) / (BigInt(365) * BigInt(10000));
        const yearlyRewards = (balance * BigInt(apy)) / BigInt(10000);
        
        console.log(`\n📅 Projections:`);
        console.log(`📅 Daily Rewards: ${ethers.formatEther(dailyRewards)} POL`);
        console.log(`📅 Yearly Rewards: ${ethers.formatEther(yearlyRewards)} POL`);
        console.log(`📅 APY Verification: ${(Number(yearlyRewards) / Number(balance)) * 100}%`);
    }

    // Test claiming rewards (if any)
    if (stakeInfo.estimatedRewards > 0) {
        console.log("\n💸 Testing Claim Rewards:");
        const balanceBefore = await polToken.balanceOf(signer.address);
        console.log(`💰 Balance Before: ${ethers.formatEther(balanceBefore)} POL`);
        
        try {
            const claimTx = await defiAggregator.claim(polAddress);
            await claimTx.wait();
            
            const balanceAfter = await polToken.balanceOf(signer.address);
            const claimed = balanceAfter - balanceBefore;
            
            console.log(`💰 Balance After: ${ethers.formatEther(balanceAfter)} POL`);
            console.log(`🎁 Claimed: ${ethers.formatEther(claimed)} POL`);
        } catch (error) {
            console.log(`⚠️ Claim failed: ${error.message}`);
        }
    } else {
        console.log("\n💸 No rewards to claim yet (need more time for interest to accrue)");
    }

    console.log("\n💡 Interest Calculation Notes:");
    console.log("- Interest accrues based on time elapsed since last protocol update");
    console.log("- APY is calculated per second: (balance * APY * seconds) / (365 days * 10000)");
    console.log("- For meaningful rewards, stake for longer periods (hours/days)");
    console.log("- Aave lending protocols typically auto-compound interest");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("💥 Test failed:", error);
        process.exit(1);
    });
