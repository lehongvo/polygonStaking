import { ethers } from 'hardhat';

// Aave v3 Rewards Controller and aWMATIC on Polygon
const REWARDS_CONTROLLER = '0x357d51124f59836ded84c8a1730d72b749d8bc23';
const AWMATIC = '0x6d80113e533a2C0fe82EaBD35f1875DcEA89Ea97';

const ABI = [
  // v3 API
  'function claimAllRewards(address[] assets, address to) returns (address[] rewardsList, uint256[] claimedAmounts)',
  // fallback v2
  'function claimRewards(address[] assets, uint256 amount, address to) returns (uint256)',
];

async function main() {
  const holder =
    process.env.HOLDER || '0xC56E28efdcf5c1974F3b7148a0a72c8bc2Fdb559'; // aToken holder
  const recipient = process.env.TO || holder;

  const [signer] = await ethers.getSigners();
  console.log(`Signer: ${signer.address}`);
  console.log(`Holder: ${holder}`);
  console.log(`Recipient: ${recipient}`);

  const controller = new ethers.Contract(REWARDS_CONTROLLER, ABI, signer);
  const assets = [AWMATIC];

  try {
    console.log('Calling claimAllRewards...');
    const tx = await controller.claimAllRewards(assets, recipient);
    const receipt = await tx.wait();
    console.log(`Tx: ${receipt?.hash}`);
  } catch (e) {
    console.log('claimAllRewards failed, trying claimRewards(amount=max)...');
    const max = ethers.MaxUint256;
    const tx = await controller.claimRewards(assets, max, recipient);
    const receipt = await tx.wait();
    console.log(`Tx: ${receipt?.hash}`);
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
