import { ethers } from "hardhat";

// Aave v3 Pool (Polygon)
const AAVE_POOL = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";
// WMATIC token (Polygon)
const WMATIC = "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270";
// aWMATIC token (Polygon) - to check balance after supply
const AWMATIC = "0x6d80113e533a2C0fe82EaBD35f1875DcEA89Ea97";

const WMATIC_ABI = [
  "function deposit() payable",
  "function balanceOf(address) view returns (uint256)",
  "function approve(address spender, uint256 value) returns (bool)"
];

const POOL_ABI = [
  "function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)"
];

async function main() {
  const amountMatic = process.env.AMOUNT || "0.05"; // MATIC
  const amount = ethers.parseEther(amountMatic);

  const [signer] = await ethers.getSigners();
  console.log(`Signer: ${signer.address}`);
  console.log(`Deposit amount: ${amountMatic} MATIC`);

  const wmatic = new ethers.Contract(WMATIC, WMATIC_ABI, signer);
  const pool = new ethers.Contract(AAVE_POOL, POOL_ABI, signer);
  const aWmatic = new ethers.Contract(AWMATIC, ["function balanceOf(address) view returns (uint256)"], signer);

  const balBefore = await aWmatic.balanceOf(signer.address);
  console.log(`aWMATIC before: ${ethers.formatEther(balBefore)}`);

  // Ensure we have WMATIC; wrap if needed
  const wBal: bigint = await wmatic.balanceOf(signer.address);
  if (wBal < amount) {
    const toWrap = amount - wBal;
    console.log(`Wrapping ${ethers.formatEther(toWrap)} MATIC -> WMATIC...`);
    const txWrap = await wmatic.deposit({ value: toWrap });
    await txWrap.wait();
    console.log("Wrapped");
  }

  // Approve AAVE Pool if allowance insufficient
  const allowance = await new ethers.Contract(WMATIC, ["function allowance(address owner, address spender) view returns (uint256)"], signer)
    .allowance(signer.address, AAVE_POOL);
  if (allowance < amount) {
    console.log("Approving AAVE Pool...");
    const txApprove = await wmatic.approve(AAVE_POOL, amount);
    await txApprove.wait();
    console.log("Approved");
  } else {
    console.log("Sufficient allowance; skip approve");
  }

  // Supply to AAVE pool
  console.log("Supplying to AAVE Pool...");
  const txSupply = await pool.supply(WMATIC, amount, signer.address, 0);
  const receipt = await txSupply.wait();
  console.log(`Supply tx: ${receipt?.hash}`);

  const balAfter = await aWmatic.balanceOf(signer.address);
  console.log(`aWMATIC after: ${ethers.formatEther(balAfter)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


