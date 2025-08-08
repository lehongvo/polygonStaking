import * as fs from "fs";
import { ethers, network, run } from "hardhat";
import * as path from "path";

async function main() {
    console.log("🚀 YOBOWEB3WALK NFT DEPLOYMENT");
    console.log("==============================");
    
    const [deployer] = await ethers.getSigners();
    console.log(`📍 Network: ${network.name}`);
    console.log(`👤 Deployer: ${deployer.address}`);
    console.log(`💰 Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);

    // Get base URI from environment variable
    const baseURI = process.env.YOBO_BASE_URI || "ipfs://QmQEQYguTJ4ApkCJ8J5wSMGFfgZLP5Xz4w7yGArFdHkVjr/";
    console.log(`🖼️  Base URI: ${baseURI}`);

    // Pre-deployment checks
    console.log("\n🔍 PRE-DEPLOYMENT CHECKS");
    console.log("========================");
    
    // Check deployer balance
    const balance = await ethers.provider.getBalance(deployer.address);
    const minBalance = ethers.parseEther("0.01"); // Minimum 0.01 ETH
    if (balance < minBalance) {
        console.error(`❌ Insufficient balance. Need at least ${ethers.formatEther(minBalance)} ETH`);
        process.exit(1);
    }
    console.log("✅ Deployer balance sufficient");

    // Validate base URI
    if (!baseURI || !baseURI.startsWith("ipfs://")) {
        console.error("❌ Invalid base URI. Must start with 'ipfs://'");
        process.exit(1);
    }
    console.log("✅ Base URI validated");

    // Deploy contract
    console.log("\n🏗️  DEPLOYING CONTRACT");
    console.log("======================");
    
    const ContractFactory = await ethers.getContractFactory("YOBOWEB3WALK");
    
    console.log("⏳ Deploying YOBOWEB3WALK...");
    const contract = await ContractFactory.deploy(baseURI);
    await contract.waitForDeployment();
    
    const contractAddress = await contract.getAddress();
    console.log(`✅ Contract deployed at: ${contractAddress}`);

    // Verify deployment
    console.log("\n🔍 VERIFYING DEPLOYMENT");
    console.log("=======================");
    
    const deployedCode = await ethers.provider.getCode(contractAddress);
    if (deployedCode === "0x") {
        console.error("❌ Contract deployment failed - no code at address");
        process.exit(1);
    }
    console.log("✅ Contract code verified");

    // Test basic functionality
    console.log("\n🧪 TESTING BASIC FUNCTIONALITY");
    console.log("===============================");
    
    try {
        const name = await contract.name();
        const symbol = await contract.symbol();
        const owner = await contract.owner();
        const maxSupply = await contract.MAX_SUPPLY();
        const totalMinted = await contract.totalMinted();
        const remainingSupply = await contract.remainingSupply();
        
        console.log(`✅ Name: ${name}`);
        console.log(`✅ Symbol: ${symbol}`);
        console.log(`✅ Owner: ${owner}`);
        console.log(`✅ Max Supply: ${maxSupply}`);
        console.log(`✅ Total Minted: ${totalMinted}`);
        console.log(`✅ Remaining Supply: ${remainingSupply}`);
        console.log(`✅ Soul Bound: ${await contract.isSoulBound()}`);
    } catch (error) {
        console.error("❌ Basic functionality test failed:", error);
        process.exit(1);
    }

    // Mint 2 NFTs to specified address
    console.log("\n🎨 MINTING NFTs");
    console.log("===============");
    
    const mintToAddress = "0xe340371845820cb16Cb8908E0ed07e2E1Ff40024";
    
    try {
        console.log(`⏳ Minting NFT #1 to ${mintToAddress}...`);
        const tx1 = await contract.safeMint(mintToAddress);
        await tx1.wait();
        console.log(`✅ NFT #1 minted! Transaction: ${tx1.hash}`);
        
        console.log(`⏳ Minting NFT #2 to ${mintToAddress}...`);
        const tx2 = await contract.safeMint(mintToAddress);
        await tx2.wait();
        console.log(`✅ NFT #2 minted! Transaction: ${tx2.hash}`);
        
        // Check balance
        const balance = await contract.balanceOf(mintToAddress);
        console.log(`✅ Balance of ${mintToAddress}: ${balance} NFTs`);
        
        // Get token IDs
        const tokenId1 = await contract.getTokenIdByOwner(mintToAddress);
        console.log(`✅ Token ID owned: ${tokenId1}`);
        
        // Get token URI
        const tokenURI = await contract.tokenURI(tokenId1);
        console.log(`✅ Token URI: ${tokenURI}`);
        
    } catch (error) {
        console.error("❌ Minting failed:", error);
        // Don't exit here as deployment was successful
    }

    // Contract verification on block explorer
    if (network.name !== "hardhat" && network.name !== "localhost") {
        console.log("\n🔍 VERIFYING ON BLOCK EXPLORER");
        console.log("===============================");
        
        try {
            console.log("⏳ Waiting for block confirmations...");
            await contract.deploymentTransaction()?.wait(5); // Wait 5 blocks
            
            console.log("⏳ Verifying contract source code...");
            await run("verify:verify", {
                address: contractAddress,
                constructorArguments: [baseURI],
            });
            console.log("✅ Contract verified on block explorer");
        } catch (error) {
            console.warn("⚠️  Contract verification failed:", error);
        }
    }

    // Save deployment information
    console.log("\n💾 SAVING DEPLOYMENT INFO");
    console.log("==========================");
    
    const deploymentInfo = {
        network: network.name,
        contractName: "YOBOWEB3WALK",
        contractAddress: contractAddress,
        deployer: deployer.address,
        deploymentTime: new Date().toISOString(),
        blockNumber: await ethers.provider.getBlockNumber(),
        constructorArgs: {
            baseURI: baseURI
        },
        contractDetails: {
            name: "YOBOWEB3WALK",
            symbol: "YOB3WK",
            maxSupply: 201,
            soulBound: true
        },
        initialMints: [
            {
                to: mintToAddress,
                count: 2,
                description: "Initial mints for testing"
            }
        ],
        verification: {
            verified: network.name !== "hardhat" && network.name !== "localhost",
            explorerUrl: getExplorerUrl(network.name, contractAddress)
        }
    };

    const outputPath = path.join(__dirname, `../deployments/yoboweb3walk-${network.name}.json`);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(deploymentInfo, null, 2));
    console.log(`✅ Deployment info saved to: ${outputPath}`);

    // Generate deployment report
    console.log("\n📊 DEPLOYMENT REPORT");
    console.log("====================");
    console.log(`Network: ${network.name}`);
    console.log(`Contract: YOBOWEB3WALK`);
    console.log(`Address: ${contractAddress}`);
    console.log(`Deployer: ${deployer.address}`);
    console.log(`Block: ${deploymentInfo.blockNumber}`);
    console.log(`Time: ${deploymentInfo.deploymentTime}`);
    console.log(`Base URI: ${baseURI}`);
    console.log(`Max Supply: 201 tokens (0-200)`);
    console.log(`Soul Bound: Yes (transfers disabled)`);
    console.log(`Explorer: ${deploymentInfo.verification.explorerUrl}`);
    
    console.log("\n🎉 DEPLOYMENT COMPLETED SUCCESSFULLY!");
    console.log("=====================================");
    console.log("Contract Features:");
    console.log("• Soul Bound Token (SBT) - transfers disabled by default");
    console.log("• Max supply: 201 tokens (IDs 0-200)");
    console.log("• Admin-controlled minting");
    console.log("• Challenge completion tracking");
    console.log("• Emergency transfer mode available");
    console.log("• 3-digit zero-padded token URIs (000.json, 001.json, etc.)");
    console.log("\nNext steps:");
    console.log("1. Test minting functionality");
    console.log("2. Set up admin addresses if needed");
    console.log("3. Configure challenge completion system");
    console.log("4. Monitor contract usage");
}

function getExplorerUrl(networkName: string, address: string): string {
    const explorers: { [key: string]: string } = {
        polygon: `https://polygonscan.com/address/${address}`,
        amoy: `https://amoy.polygonscan.com/address/${address}`,
        mumbai: `https://mumbai.polygonscan.com/address/${address}`,
        ethereum: `https://etherscan.io/address/${address}`,
        goerli: `https://goerli.etherscan.io/address/${address}`,
        sepolia: `https://sepolia.etherscan.io/address/${address}`
    };
    
    return explorers[networkName] || `Unknown network: ${networkName}`;
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("💥 DEPLOYMENT FAILED:", error);
        process.exit(1);
    });
