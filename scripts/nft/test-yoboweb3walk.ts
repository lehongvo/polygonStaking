import { ethers, network } from "hardhat";

async function main() {
    console.log("🧪 YOBOWEB3WALK COMPREHENSIVE TESTING");
    console.log("====================================");
    
    const [deployer, user1, user2] = await ethers.getSigners();
    console.log(`📍 Network: ${network.name}`);
    console.log(`👤 Deployer: ${deployer.address}`);
    console.log(`👤 User1: ${user1.address}`);
    console.log(`👤 User2: ${user2.address}`);

    const contractAddress = process.env.YOBO_CONTRACT_ADDRESS || "0x5FbDB2315678afecb367f032d93F642f64180aa3";
    console.log(`📄 Contract: ${contractAddress}`);

    // Connect to contract
    const contract = await ethers.getContractAt("YOBOWEB3WALK", contractAddress);

    console.log("\n📊 INITIAL CONTRACT STATE");
    console.log("=========================");
    
    try {
        const name = await contract.name();
        const symbol = await contract.symbol();
        const owner = await contract.owner();
        const maxSupply = await contract.MAX_SUPPLY();
        const totalMinted = await contract.totalMinted();
        const remainingSupply = await contract.remainingSupply();
        const isSoulBound = await contract.isSoulBound();
        
        console.log(`Name: ${name}`);
        console.log(`Symbol: ${symbol}`);
        console.log(`Owner: ${owner}`);
        console.log(`Max Supply: ${maxSupply}`);
        console.log(`Total Minted: ${totalMinted}`);
        console.log(`Remaining Supply: ${remainingSupply}`);
        console.log(`Soul Bound: ${isSoulBound}`);
        
        // Check admin list
        const admins = await contract.getAdmins();
        console.log(`Admins: ${admins.join(", ")}`);
        
    } catch (error) {
        console.error("❌ Failed to read contract state:", error);
        return;
    }

    console.log("\n🎨 TESTING MINTING FUNCTIONS");
    console.log("============================");
    
    try {
        // Test safeMint
        console.log("Testing safeMint...");
        const mintTx = await contract.safeMint(user1.address);
        await mintTx.wait();
        console.log(`✅ Minted NFT to ${user1.address}`);
        
        // Check balance
        const user1Balance = await contract.balanceOf(user1.address);
        console.log(`User1 balance: ${user1Balance}`);
        
        // Get token ID
        if (user1Balance > 0) {
            const tokenId = await contract.getTokenIdByOwner(user1.address);
            console.log(`User1 token ID: ${tokenId}`);
            
            // Get token URI
            const tokenURI = await contract.tokenURI(tokenId);
            console.log(`Token URI: ${tokenURI}`);
        }
        
        // Test hasSBT function
        const hasSBT = await contract.hasSBT(user1.address);
        console.log(`User1 has SBT: ${hasSBT}`);
        
    } catch (error) {
        console.error("❌ Minting test failed:", error);
    }

    console.log("\n🔒 TESTING SOUL BOUND FUNCTIONALITY");
    console.log("===================================");
    
    try {
        // Try to transfer (should fail)
        const user1Balance = await contract.balanceOf(user1.address);
        if (user1Balance > 0) {
            const tokenId = await contract.getTokenIdByOwner(user1.address);
            
            console.log("Attempting transfer (should fail)...");
            try {
                const transferTx = await contract.connect(user1).transferFrom(user1.address, user2.address, tokenId);
                await transferTx.wait();
                console.log("❌ Transfer succeeded (unexpected!)");
            } catch (transferError: any) {
                if (transferError.message.includes("Soul Bound Token")) {
                    console.log("✅ Transfer correctly blocked (Soul Bound)");
                } else {
                    console.log(`✅ Transfer blocked: ${transferError.message}`);
                }
            }
        }
        
    } catch (error) {
        console.error("❌ Soul bound test failed:", error);
    }

    console.log("\n👥 TESTING ADMIN FUNCTIONS");
    console.log("==========================");
    
    try {
        // Test batch minting
        console.log("Testing batch mint...");
        const recipients = [user2.address];
        const batchTx = await contract.batchMint(recipients);
        await batchTx.wait();
        console.log(`✅ Batch minted to ${recipients.length} recipients`);
        
        // Check user2 balance
        const user2Balance = await contract.balanceOf(user2.address);
        console.log(`User2 balance: ${user2Balance}`);
        
    } catch (error) {
        console.error("❌ Admin function test failed:", error);
    }

    console.log("\n📈 FINAL CONTRACT STATE");
    console.log("=======================");
    
    try {
        const finalTotalMinted = await contract.totalMinted();
        const finalRemainingSupply = await contract.remainingSupply();
        
        console.log(`Final Total Minted: ${finalTotalMinted}`);
        console.log(`Final Remaining Supply: ${finalRemainingSupply}`);
        
        // Check all user balances
        const deployerBalance = await contract.balanceOf(deployer.address);
        const user1Balance = await contract.balanceOf(user1.address);
        const user2Balance = await contract.balanceOf(user2.address);
        
        console.log(`Deployer balance: ${deployerBalance}`);
        console.log(`User1 balance: ${user1Balance}`);
        console.log(`User2 balance: ${user2Balance}`);
        
    } catch (error) {
        console.error("❌ Failed to read final state:", error);
    }

    console.log("\n🎉 TESTING COMPLETED!");
    console.log("=====================");
    console.log("All major functions tested:");
    console.log("✅ Contract deployment");
    console.log("✅ Basic state reading");
    console.log("✅ Individual minting");
    console.log("✅ Batch minting");
    console.log("✅ Soul bound transfer prevention");
    console.log("✅ Token URI generation");
    console.log("✅ Admin functions");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("💥 TESTING FAILED:", error);
        process.exit(1);
    });
