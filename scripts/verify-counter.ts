import { run } from "hardhat";

async function main() {
  const contractAddress = process.env.CONTRACT_ADDRESS || "0x3c88DF50399750372865Bf84cD0ebdc486EF58d8";
  
  console.log("🔍 Verifying Counter contract...");
  console.log("Contract Address:", contractAddress);
  
  try {
    await run("verify:verify", {
      address: contractAddress,
      constructorArguments: [],
      network: "sepolia"
    });
    console.log("✅ Contract verified successfully!");
    console.log("🔗 View on Etherscan: https://sepolia.etherscan.io/address/" + contractAddress);
  } catch (error) {
    console.log("⚠️ Verification failed:", (error as Error).message);
    console.log("💡 You can manually verify at: https://sepolia.etherscan.io/verifyContract");
    console.log("📋 Contract source code is in: contracts/Counter/Counter.sol");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Verification failed:", error);
    process.exit(1);
  });
