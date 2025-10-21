import { ethers } from "hardhat";
import { run } from "hardhat";

async function main() {
  console.log("🚀 Starting deployment process...");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer address:", deployer.address);

  // Get network info
  const network = await ethers.provider.getNetwork();
  const networkName = process.env.HARDHAT_NETWORK || 'localhost';
  console.log(`Network: ${networkName} (Chain ID: ${network.chainId})`);

  // Step 1: Deploy Runki token
  console.log("\n📦 Step 1: Deploying Runki token...");
  const RunkiFactory = await ethers.getContractFactory("RinKi");
  const runkiToken = await RunkiFactory.deploy(
    deployer.address, // recipient
    deployer.address  // initialOwner
  );
  await runkiToken.waitForDeployment();
  const runkiAddress = await runkiToken.getAddress();
  console.log("✅ Runki token deployed to:", runkiAddress);
  console.log("✅ Hash of Runki token deployment:", runkiToken.deploymentTransaction()?.hash);
  
  // check balance of deployer
  const runkiBalance = await ethers.provider.getBalance(runkiAddress);
  console.log("Runki balance:", ethers.formatEther(runkiBalance), await runkiToken.symbol());

  // Step 2: Wait 20 seconds
  console.log("\n⏳ Step 2: Waiting 20 seconds...");
  await new Promise(resolve => setTimeout(resolve, 20000));
  console.log("✅ Wait completed");

  // Step 3: Calculate Counter contract address before deployment
  console.log("\n🔮 Step 3: Calculating Counter contract address...");
  const maxValue = 1000; // Set maximum value for the counter
  console.log("Max value set to:", maxValue);
  
  // Calculate deployment cost and contract address before deploying
  console.log("\n💰 Calculating deployment cost and contract address...");
  const CounterFactory = await ethers.getContractFactory("Counter");
  
  // Calculate contract address using CREATE2 or nonce-based method
  const deployerNonce = await ethers.provider.getTransactionCount(deployer.address);
  const pendingNonce = await ethers.provider.getTransactionCount(deployer.address, "pending");
  
  console.log("📊 Current Nonce:", deployerNonce);
  console.log("📊 Pending Nonce:", pendingNonce);
  console.log("📊 Deployer Address:", deployer.address);
  
  // Use pending nonce + 1 for more accurate prediction (after approve)
  const predictedAddress = ethers.getCreateAddress({
    from: deployer.address,
    nonce: pendingNonce + 1
  });
  
  console.log("🔮 Predicted Contract Address (after approve):", predictedAddress);
  
  // Estimate gas for deployment
  const deploymentData = CounterFactory.interface.encodeDeploy([maxValue, runkiAddress]);
  const gasEstimate = await ethers.provider.estimateGas({
    data: deploymentData,
  });
  
  // Get current gas price
  const gasPrice = await ethers.provider.getFeeData();
  const gasPriceGwei = ethers.formatUnits(gasPrice.gasPrice || 0, "gwei");
  
  // Calculate total cost
  const totalCost = gasEstimate * (gasPrice.gasPrice || 0n);
  const totalCostEth = ethers.formatEther(totalCost);
  
  console.log("📊 Deployment Estimates:");
  console.log("Gas Estimate:", gasEstimate.toString());
  console.log("Gas Price:", gasPriceGwei, "Gwei");
  console.log("Total Cost:", totalCostEth, "ETH");
  
  // Check deployer balance
  const deployerBalance = await ethers.provider.getBalance(deployer.address);
  const deployerBalanceEth = ethers.formatEther(deployerBalance);
  console.log("Deployer Balance:", deployerBalanceEth, "ETH");
  
  if (deployerBalance < totalCost) {
    console.log("⚠️ Warning: Insufficient balance for deployment!");
    console.log("Required:", totalCostEth, "ETH");
    console.log("Available:", deployerBalanceEth, "ETH");
  } else {
    console.log("✅ Sufficient balance for deployment");
  }
  
  // Step 4: Approve tokens for Counter contract
  console.log("\n🔐 Step 4: Approving tokens for Counter contract...");
  const approveAmount = ethers.parseEther("10"); // 10 tokens
  const approveTx = await runkiToken.approve(predictedAddress, approveAmount);
  await approveTx.wait();
  console.log("✅ Approved 10 tokens for Counter contract");
  console.log("Approved for address:", predictedAddress);
  console.log("Approve Tx:", approveTx.hash);

  // Step 5: Wait 20 seconds
  console.log("\n⏳ Step 5: Waiting 20 seconds...");
  await new Promise(resolve => setTimeout(resolve, 20000));
  console.log("✅ Wait completed");

  // Step 6: Deploy Counter contract
  console.log("\n🚀 Step 6: Deploying Counter contract...");
  const counter = await CounterFactory.deploy(maxValue, runkiAddress);
  await counter.waitForDeployment();
  
  const counterAddress = await counter.getAddress();
  console.log("✅ Counter deployed to:", counterAddress);
  
  // Get final nonce after deployment
  const finalNonce = await ethers.provider.getTransactionCount(deployer.address);
  console.log("📊 Final Nonce after deployment:", finalNonce);
  
  // Verify predicted address matches actual address
  if (predictedAddress.toLowerCase() === counterAddress.toLowerCase()) {
    console.log("🎯 Address prediction: ✅ CORRECT!");
  } else {
    console.log("❌ Address prediction: INCORRECT!");
    console.log("Predicted:", predictedAddress);
    console.log("Actual:", counterAddress);
    console.log("💡 Reason: Nonce changed during deployment process");
    console.log("Current Nonce:", deployerNonce);
    console.log("Pending Nonce:", pendingNonce);
    console.log("Final Nonce:", finalNonce);
  }
  
  // Get actual deployment transaction details
  const deploymentTx = counter.deploymentTransaction();
  if (deploymentTx) {
    const receipt = await deploymentTx.wait();
    const actualGasUsed = receipt?.gasUsed || 0n;
    const actualGasPrice = receipt?.gasPrice || 0n;
    const actualCost = actualGasUsed * actualGasPrice;
    const actualCostEth = ethers.formatEther(actualCost);
    
    console.log("\n📈 Actual Deployment Cost:");
    console.log("Gas Used:", actualGasUsed.toString());
    console.log("Gas Price:", ethers.formatUnits(actualGasPrice, "gwei"), "Gwei");
    console.log("Actual Cost:", actualCostEth, "ETH");
    console.log("Transaction Hash:", deploymentTx.hash);
  }

  // Test the contract
  console.log("\n🧪 Testing Counter contract...");
  
  // Get initial values
  const initialValue = await counter.x();
  const maxValueFromContract = await counter.maxValue();
  const owner = await counter.owner();
  console.log("Initial value:", initialValue.toString());
  console.log("Max value:", maxValueFromContract.toString());
  console.log("Owner:", owner);

  // Test inc() function
  console.log("Testing inc() function...");
  const tx1 = await counter.inc();
  await tx1.wait();
  const valueAfterInc = await counter.x();
  console.log("Value after inc():", valueAfterInc.toString());

  // Test incBy() function
  console.log("Testing incBy(5) function...");
  const tx2 = await counter.incBy(5);
  await tx2.wait();
  const valueAfterIncBy = await counter.x();
  console.log("Value after incBy(5):", valueAfterIncBy.toString());

  // Test dec() function
  console.log("Testing dec() function...");
  const tx3 = await counter.dec();
  await tx3.wait();
  const valueAfterDec = await counter.x();
  console.log("Value after dec():", valueAfterDec.toString());

  // Test isAtMax() function
  const isAtMax = await counter.isAtMax();
  console.log("Is at max value:", isAtMax);

  console.log("\n📊 Deployment Summary:");
  console.log("===================");
  console.log("Runki Token Address:", runkiAddress);
  console.log("Counter Address:", counterAddress);
  console.log("Deployer:", deployer.address);
  console.log("Max Value:", maxValue);
  console.log("Token Address in Counter:", runkiAddress);
  console.log("Network:", networkName);
  console.log("Chain ID:", network.chainId.toString());

  // Network-specific info
  if (networkName === "amoy") {
    console.log("\n🌐 Amoy Testnet Info:");
    console.log("Explorer: https://www.oklink.com/amoy");
    console.log("Contract URL: https://www.oklink.com/amoy/address/" + counterAddress);
  } else if (networkName === "polygon") {
    console.log("\n🌐 Polygon Mainnet Info:");
    console.log("Explorer: https://polygonscan.com");
    console.log("Contract URL: https://polygonscan.com/address/" + counterAddress);
  } else if (networkName === "sepolia") {
    console.log("\n🌐 Sepolia Testnet Info:");
    console.log("Explorer: https://sepolia.etherscan.io");
    console.log("Contract URL: https://sepolia.etherscan.io/address/" + counterAddress);
  }

  // Verify contract on Sepolia
  if (networkName === "sepolia") {
    console.log("\n🔍 Verifying contract on Sepolia...");
    try {
      await run("verify:verify", {
        address: counterAddress,
        constructorArguments: [maxValue, runkiAddress],
      });
      console.log("✅ Contract verified successfully!");
    } catch (error) {
      console.log("⚠️ Verification failed:", (error as Error).message);
      console.log("💡 Manual verification: https://sepolia.etherscan.io/verifyContract");
    }
  }

  console.log("\n🎉 Counter contract deployment completed!");
  console.log("\n📝 How to use:");
  console.log("1. Call inc() to increment by 1");
  console.log("2. Call incBy(amount) to increment by specific amount");
  console.log("3. Call dec() to decrement by 1");
  console.log("4. Call decBy(amount) to decrement by specific amount");
  console.log("5. Call x() to get current value");
  console.log("6. Call getMaxValue() to get maximum value");
  console.log("7. Call isAtMax() to check if at maximum");
  console.log("8. Owner can call reset(), pause(), unpause(), setMaxValue()");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
