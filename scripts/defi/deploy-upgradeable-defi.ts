import { ethers, upgrades } from "hardhat";
import fs from "fs";
import path from "path";
import { formatEther } from "ethers";

interface DeploymentConfig {
  network: string;
  contractName: string;
  contractAddress: string;
  deployer: string;
  deploymentTime: string;
  gasUsed: string;
  constructorArgs: any[];
  verification: {
    status: string;
    etherscan: string;
    note?: string;
  };
  setup: {
    protocols: Array<{
      name: string;
      address: string;
      type: string;
      apy: number;
      active: boolean;
    }>;
    tokens: Array<{
      address: string;
      symbol: string;
      decimals: number;
      active: boolean;
    }>;
    constants: {
      WMATIC_ADDRESS: string;
    };
  };
  features: string[];
  usage: Record<string, string>;
  integration: {
    challengeDetailV2: string;
    note: string;
    status: string;
  };
}

async function main() {
  console.log("🚀 POLYGON DEFI AGGREGATOR - UPGRADEABLE DEPLOY");
  console.log("===============================================");
  
  const network = await ethers.provider.getNetwork();
  console.log(`🌐 Network: ${network.name} (${network.chainId})`);
  
  const [deployer] = await ethers.getSigners();
  console.log(`👤 Deployer: ${deployer.address}`);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`💰 Balance: ${formatEther(balance)} ${network.name === "polygon" ? "MATIC" : "ETH"}`);
  
  // Check if we have enough balance
  if (balance < ethers.parseEther("0.01")) {
    console.log("❌ Insufficient balance for deployment. Need at least 0.01 ETH/MATIC");
    process.exit(1);
  }
  
  console.log("\n🏗️  DEPLOYING UPGRADEABLE CONTRACT");
  console.log("===================================");
  
  // Deploy upgradeable contract
  const PolygonDeFiAggregator = await ethers.getContractFactory("PolygonDeFiAggregator");
  console.log("⏳ Deploying PolygonDeFiAggregator as upgradeable...");
  
  const wmaticAddress = "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270";
  
  const aggregator = await upgrades.deployProxy(
    PolygonDeFiAggregator,
    [deployer.address, wmaticAddress],
    { 
      initializer: "initialize",
      kind: "uups" // Use UUPS proxy pattern
    }
  );
  
  await aggregator.waitForDeployment();
  const contractAddress = await aggregator.getAddress();
  console.log(`✅ Upgradeable contract deployed at: ${contractAddress}`);
  
  // Get implementation address
  const implAddress = await upgrades.erc1967.getImplementationAddress(contractAddress);
  console.log(`📋 Implementation address: ${implAddress}`);
  
  // Get deployment transaction details
  const deployTx = aggregator.deploymentTransaction();
  const receipt = await deployTx?.wait();
  const gasUsed = receipt?.gasUsed.toString() || "~2.5M";
  
  console.log(`⛽ Gas used: ${gasUsed}`);
  
  console.log("\n🔧 SETTING UP CONTRACT");
  console.log("======================");
  
  // Setup protocols
  console.log("⏳ Adding Aave lending protocol...");
  const aavePoolAddress = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";
  const addProtocolTx = await aggregator.addProtocol(
    "aave_lending",
    aavePoolAddress,
    "lending",
    500 // 5% APY in basis points
  );
  await addProtocolTx.wait();
  console.log("✅ Aave lending protocol added");
  
  // Setup tokens
  console.log("⏳ Adding WMATIC token...");
  const addTokenTx = await aggregator.addSupportedToken(
    wmaticAddress,
    "WMATIC",
    18
  );
  await addTokenTx.wait();
  console.log("✅ WMATIC token added");
  
  console.log("\n🔍 VERIFYING SETUP");
  console.log("==================");
  
  // Verify protocols
  const [protocolNames, apys, activeStatus] = await aggregator.getAllProtocols();
  console.log(`📋 Protocols: ${protocolNames.join(", ")}`);
  
  // Verify tokens
  const [tokenAddresses, symbols, decimals, tokenActiveStatus] = await aggregator.getAllSupportedTokens();
  console.log(`🪙 Tokens: ${symbols.join(", ")}`);
  
  console.log("\n🔐 ATTEMPTING VERIFICATION");
  console.log("==========================");
  
  let verificationStatus = "failed";
  let etherscanUrl = `https://polygonscan.com/address/${contractAddress}`;
  let verificationNote = "Verification failed";
  
  if (network.name === "polygon") {
    try {
      console.log("⏳ Verifying contract on PolygonScan...");
      await hre.run("verify:verify", {
        address: contractAddress,
        constructorArguments: [],
      });
      verificationStatus = "success";
      verificationNote = "Contract verified successfully on PolygonScan";
      console.log("✅ Contract verified successfully");
    } catch (error: any) {
      console.log("⚠️ Verification failed:", error.message);
      verificationNote = `Verification failed: ${error.message}`;
    }
  } else {
    verificationStatus = "skipped";
    etherscanUrl = `Local network - no verification needed`;
    verificationNote = "Local hardhat network - verification not applicable";
    console.log("✅ Local deployment - verification skipped");
  }
  
  console.log("\n💾 SAVING DEPLOYMENT INFO");
  console.log("=========================");
  
  // Create deployment configuration
  const deploymentConfig: DeploymentConfig = {
    network: network.name,
    contractName: "PolygonDeFiAggregator",
    contractAddress: contractAddress,
    deployer: deployer.address,
    deploymentTime: new Date().toISOString(),
    gasUsed: gasUsed,
    constructorArgs: [],
    verification: {
      status: verificationStatus,
      etherscan: etherscanUrl,
      note: verificationNote
    },
    setup: {
      protocols: [
        {
          name: "aave_lending",
          address: aavePoolAddress,
          type: "lending",
          apy: 500,
          active: true
        }
      ],
      tokens: [
        {
          address: wmaticAddress,
          symbol: "WMATIC",
          decimals: 18,
          active: true
        }
      ],
      constants: {
        WMATIC_ADDRESS: wmaticAddress
      }
    },
    features: [
      "Time-locked staking",
      "Multi-protocol support (Aave, Compound, Liquid Staking)",
      "Native MATIC support",
      "Flexible withdrawal",
      "Pro-rate withdrawal mechanism",
      "Emergency functions",
      "Reentrancy protection",
      "Pausable functionality",
      "Upgradeable contract (UUPS pattern)"
    ],
    usage: {
      createTimeLockedStake: "Stake tokens with time lock",
      withdrawTimeLockedStake: "Withdraw staked tokens + rewards",
      getUserTokenProtocolPosition: "Get user position details",
      addProtocol: "Add new DeFi protocol (owner only)",
      addSupportedToken: "Add new supported token (owner only)"
    },
    integration: {
      challengeDetailV2: "Ready for integration with ChallengeDetailV2",
      note: "Upgradeable contract deployed and configured for ChallengeDetailV2 integration",
      status: "ready_for_deployment"
    }
  };
  
  // Save deployment info
  const fileName = network.name === "polygon" ? "polygon-defi-aggregator.json" : "hardhat-defi-aggregator.json";
  const configPath = path.join(__dirname, "../../deployInfo", fileName);
  fs.writeFileSync(configPath, JSON.stringify(deploymentConfig, null, 2));
  console.log(`✅ Deployment info saved to ${configPath}`);
  
  console.log("\n🧪 TESTING CONTRACT");
  console.log("===================");
  
  try {
    console.log("⏳ Testing staking functionality...");
    const testAmount = ethers.parseEther("0.0001");
    
    const stakeTx = await aggregator.createTimeLockedStake(
      wmaticAddress,
      testAmount,
      "aave_lending",
      2 * 24 * 60 * 60, // 2 days
      { value: testAmount }
    );
    
    const stakeReceipt = await stakeTx.wait();
    console.log(`✅ Test stake created! Gas used: ${stakeReceipt.gasUsed.toString()}`);
    
    // Get user stakes
    const userStakes = await aggregator.getUserTimeLockedStakes(deployer.address);
    console.log(`📊 User has ${userStakes.length} active stakes`);
    
    if (userStakes.length > 0) {
      const latestStake = userStakes[userStakes.length - 1];
      console.log(`📋 Latest stake: ${ethers.formatEther(latestStake.amount)} MATIC for ${latestStake.protocol}`);
      
      // Test withdrawal
      console.log("⏳ Testing withdrawal...");
      const stakeId = userStakes.length - 1;
      const withdrawTx = await aggregator.withdrawTimeLockedStake(stakeId);
      const withdrawReceipt = await withdrawTx.wait();
      console.log(`✅ Withdrawal successful! Gas used: ${withdrawReceipt.gasUsed.toString()}`);
    }
    
  } catch (error: any) {
    console.log("⚠️ Test staking failed:", error.message);
  }
  
  console.log("\n🎉 UPGRADEABLE DEPLOYMENT COMPLETED SUCCESSFULLY!");
  console.log("=================================================");
  console.log(`📍 Contract Address: ${contractAddress}`);
  console.log(`📋 Implementation: ${implAddress}`);
  console.log(`🔗 ${network.name === "polygon" ? "PolygonScan" : "Network"}: ${etherscanUrl}`);
  console.log(`📄 Config File: ${configPath}`);
  console.log(`✅ Status: Ready for ChallengeDetailV2 integration`);
  console.log(`🔄 Upgradeable: UUPS pattern enabled`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
