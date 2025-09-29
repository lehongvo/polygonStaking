import { ethers } from "hardhat";

// Minimal ABI: read-only getter for public variable stakingStakeId
const CHALLENGE_ABI = [
  "function stakingStakeId() view returns (uint256)"
];

export async function isStakingChallange(contractAddress: string, rpcUrl?: string): Promise<boolean> {
  try {
    const provider = rpcUrl ? new (ethers as any).JsonRpcProvider(rpcUrl) : ethers.provider;
    const contract = new (ethers as any).Contract(contractAddress, CHALLENGE_ABI, provider);
    await contract.stakingStakeId();
    return true; // call succeeded => contract exposes stakingStakeId
  } catch {
    return false; // call reverted or ABI mismatch
  }
}

// CLI usage: ADDR=0x... [RPC=https://...] npx hardhat run scripts/challenge/isStaking.ts --network polygon
async function main() {
  const addr = process.env.ADDR || "";
  const rpc = process.env.RPC || process.env.POLYGON_RPC || process.env.JSON_RPC;
  if (!addr) {
    console.log("Missing ADDR env");
    return;
  }
  const ok = await isStakingChallange(addr, rpc);
  console.log(`isStakingChallange(${addr}) = ${ok}`);
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
