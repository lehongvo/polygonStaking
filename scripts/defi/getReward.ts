import { ethers } from 'hardhat';

// Aave v3 Rewards Controller on Polygon
const AAVE_REWARDS_CONTROLLER = '0x357d51124f59836ded84c8a1730d72b749d8bc23';
const ABI = [
  // v3 variant
  'function getUserUnclaimedRewards(address user) view returns (uint256)',
  // v2 fallback
  'function getRewardsBalance(address[] assets, address user) view returns (uint256)',
  // query rewards configured for an asset (v3)
  'function getRewardsByAsset(address asset) view returns (address[] rewardsList)',
];
const ATOKEN_WMATIC = '0x6d80113e533a2C0fe82EaBD35f1875DcEA89Ea97';
const POOL = '0x794a61358D6845594F94dc1DB02A252b5b4814aD'; // Aave v3 Pool (Polygon)
const WMATIC = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270';

// Minimal ABIs for interest estimation via liquidityIndex
const POOL_ABI = [
  `function getReserveData(address asset) view returns (tuple(uint256 configuration,uint128 liquidityIndex,uint128 currentLiquidityRate,uint128 variableBorrowIndex,uint128 currentVariableBorrowRate,uint128 __deprecatedStableBorrowRate,uint40 lastUpdateTimestamp,uint16 id,uint40 liquidationGracePeriodUntil,address aTokenAddress,address __deprecatedStableDebtTokenAddress,address variableDebtTokenAddress,address interestRateStrategyAddress,uint128 accruedToTreasury,uint128 unbacked,uint128 isolationModeTotalDebt,uint128 virtualUnderlyingBalance))`,
];
const ATOKEN_ABI = [
  'function scaledBalanceOf(address user) view returns (uint256)',
  'function balanceOf(address user) view returns (uint256)',
];

async function main() {
  const addr = process.env.ADDR || '0x980B8Cd287b01deAeAD8576846eEb6de7Bcc2A50';
  const user = ethers.isAddress(addr)
    ? addr
    : '0x980B8Cd287b01deAeAD8576846eEb6de7Bcc2A50';

  const provider = ethers.provider;
  const controller = new ethers.Contract(
    AAVE_REWARDS_CONTROLLER,
    ABI,
    provider
  );

  // 1) Check rewards configured for aWMATIC asset
  let rewardsList: string[] = [];
  try {
    rewardsList = await controller.getRewardsByAsset(ATOKEN_WMATIC);
    console.log(`Rewards configured for aWMATIC: ${rewardsList.length}`);
    if (rewardsList.length > 0) {
      console.log(`Reward tokens: ${rewardsList.join(', ')}`);
    }
  } catch (e) {
    console.log(
      'getRewardsByAsset not available on this controller (likely v2)'
    );
  }

  // 2) Query unclaimed rewards if any program exists
  let unclaimed: bigint | null = null;
  try {
    unclaimed = await controller.getUserUnclaimedRewards(user);
  } catch {}

  if (unclaimed === null) {
    try {
      const assets = [ATOKEN_WMATIC];
      unclaimed = await controller.getRewardsBalance(assets, user);
    } catch {}
  }

  console.log(`User: ${user}`);
  if (unclaimed !== null) {
    console.log(
      `Unclaimed rewards: ${ethers.formatEther(unclaimed)} (WMATIC program on Polygon)`
    );
  } else {
    console.log(
      `Unable to query rewards with available ABIs (controller address/ABI mismatch).`
    );
  }

  // 3) Estimate interest (growth) using aToken balance (actual underlying)
  try {
    const aToken = new ethers.Contract(ATOKEN_WMATIC, ATOKEN_ABI, provider);
    const scaled: bigint = await aToken.scaledBalanceOf(user);
    const currentValueWei: bigint = await aToken.balanceOf(user);

    const principalEnv = process.env.PRINCIPAL || '0'; // optional; in WMATIC/MATIC
    const principalWei = principalEnv ? ethers.parseEther(principalEnv) : 0n;
    const interestWei =
      currentValueWei > principalWei ? currentValueWei - principalWei : 0n;

    console.log(`aToken scaledBalance: ${scaled.toString()}`);
    console.log(
      `Current underlying value (from aToken.balanceOf): ${ethers.formatEther(currentValueWei)} WMATIC`
    );
    if (principalWei > 0n) {
      console.log(
        `Interest (vs principal ${principalEnv}): ${ethers.formatEther(interestWei)} WMATIC`
      );
    }
  } catch (e) {
    console.log('Interest estimation skipped (aToken call failed)');
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
