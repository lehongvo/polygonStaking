import { ethers } from 'hardhat';

// Minimal ABI for ChallengeDetailV2 reads
const CHALLENGE_READ_ABI = [
  'function startTime() view returns (uint256)',
  'function getAwardReceiversPercent() view returns (uint256[])',
];

export type CurrentRewardsResult = {
  listReceiversSuccess: string[]; // amounts as decimal strings (18 decimals)
  listReceiversFailed: string[]; // amounts as decimal strings (18 decimals)
  totalReward: string; // total reward before fee (18 decimals)
  totalFeeSystem: string; // system fee (18 decimals)
  totalReceiver: string; // reward after fee (18 decimals)
  indexSplit: number; // index where cumulative percent >= 100
};

// Expand scientific notation like "8.2926e-11" to plain decimal string
function expandScientific(numStr: string): string {
  if (!/[eE]/.test(numStr)) return numStr;
  const sign = numStr.trim().startsWith('-') ? '-' : '';
  const s = numStr.replace(/^[+-]/, '').toLowerCase();
  const [mantissaRaw, expRaw] = s.split('e');
  const exp = parseInt(expRaw, 10);
  const mantissa = mantissaRaw.replace(/^\./, '0.');
  const dot = mantissa.indexOf('.');
  const digits = mantissa.replace('.', '');
  const decimals = dot >= 0 ? mantissa.length - dot - 1 : 0;
  const pointPos = digits.length + exp - decimals;
  if (pointPos <= 0) {
    return sign + '0.' + '0'.repeat(-pointPos) + digits.replace(/^0+/, '');
  }
  if (pointPos >= digits.length) {
    return sign + digits + '0'.repeat(pointPos - digits.length);
  }
  return sign + digits.slice(0, pointPos) + '.' + digits.slice(pointPos);
}

// Helper to parse decimal string to 18-decimal BigInt (trims beyond 18 decimals)
function parseDecimalToWei(value: string): bigint {
  let s = expandScientific(String(value)).trim();
  if (s === '' || s === '-' || s === '.' || s === '-.') return 0n;
  const negative = s.startsWith('-');
  if (negative) s = s.slice(1);
  if (!s.includes('.')) s = s + '.0';
  let [intPart, fracPart] = s.split('.');
  if (intPart === '') intPart = '0';
  // remove leading zeros in intPart
  intPart = intPart.replace(/^0+(\d)/, '$1');
  // keep only digits in frac, then trim/pad to 18
  fracPart = (fracPart || '').replace(/\D/g, '');
  if (fracPart.length > 18) fracPart = fracPart.slice(0, 18);
  while (fracPart.length < 18) fracPart += '0';
  const combined = (intPart === '' ? '0' : intPart) + fracPart;
  let result = 0n;
  try {
    result = BigInt(combined === '' ? '0' : combined);
  } catch {
    result = 0n;
  }
  return negative ? -result : result;
}

function formatWei(value: bigint): string {
  return ethers.formatUnits(value, 18);
}

/**
 * Compute current reward split for receivers and system fee.
 * @param endTime Secs (unix)
 * @param apyPerSecond Decimal string (per-second rate), e.g. "0.00000000083" or scientific "8.3e-10"
 * @param feeSystem Percent (0-100) taken by system from rewards
 * @param challengeContractAddress Address of ChallengeDetailV2
 * @param rpcUrl Optional RPC URL
 */
export async function calReward(
  endTime: number,
  apyPerSecond: string,
  feeSystem: number,
  challengeContractAddress: string,
  rpcUrl?: string
): Promise<CurrentRewardsResult> {
  const provider = rpcUrl
    ? new (ethers as any).JsonRpcProvider(rpcUrl)
    : ethers.provider;
  const challenge = new (ethers as any).Contract(
    challengeContractAddress,
    CHALLENGE_READ_ABI,
    provider
  );

  // Read startTime and receiver percents
  const startTimeBn: bigint = await challenge.startTime();
  const percents: bigint[] = await challenge.getAwardReceiversPercent();

  const startTime = Number(startTimeBn);
  if (endTime < startTime) {
    throw new Error('endTime must be >= startTime');
  }

  // Total time (seconds)
  const totalTimeSeconds = BigInt(endTime - startTime);

  // APY per second (decimal) scaled to 1e18
  const apyPerSecondWei = parseDecimalToWei(apyPerSecond); // 18-dec scaled

  // totalReward = seconds * apyPerSecond
  const totalRewardWei = totalTimeSeconds * apyPerSecondWei;

  // fee system
  const totalFeeSystemWei = (totalRewardWei * BigInt(feeSystem)) / 100n;
  const totalReceiverWei = totalRewardWei - totalFeeSystemWei;

  // Determine split index where cumulative percent >= 100
  let cumulative = 0n;
  let indexSplit = percents.length;
  for (let i = 0; i < percents.length; i++) {
    cumulative += percents[i];
    if (cumulative >= 100n) {
      indexSplit = i;
      break;
    }
  }

  // Build success and failed lists
  const listReceiversSuccessWei: bigint[] = [];
  for (let i = 0; i < indexSplit; i++) {
    const p = percents[i] ?? 0n;
    const amt = (totalReceiverWei * p) / 100n;
    listReceiversSuccessWei.push(amt);
  }

  const listReceiversFailedWei: bigint[] = [];
  for (let i = indexSplit; i < percents.length; i++) {
    const p = percents[i] ?? 0n;
    const amt = (totalReceiverWei * p) / 100n;
    listReceiversFailedWei.push(amt);
  }

  return {
    listReceiversSuccess: listReceiversSuccessWei.map(formatWei),
    listReceiversFailed: listReceiversFailedWei.map(formatWei),
    totalReward: formatWei(totalRewardWei),
    totalFeeSystem: formatWei(totalFeeSystemWei),
    totalReceiver: formatWei(totalReceiverWei),
    indexSplit,
  };
}

// CLI usage:
// END=1735600000 APY_SECOND=0.00000000083 FEE=20 ADDR=0x... [RPC=...] npx hardhat run scripts/challenge/getCurrent.ts --network polygon
async function main() {
  const endEnv = process.env.END || '1756752400';
  const apySecondEnv = process.env.APY_SECOND || 8.292630650760506e-11;
  const feeEnv = process.env.FEE || 20;
  const addr = process.env.ADDR || '0xFe7d8E5A02107cF96C3720461c23E1DB711a58E0';
  const rpc =
    process.env.RPC ||
    process.env.POLYGON_RPC ||
    process.env.JSON_RPC ||
    'https://polygon-mainnet.g.alchemy.com/v2/***REMOVED-ALCHEMY-KEY***';

  if (!addr) {
    console.log('Missing ADDR env');
    return;
  }

  const end = Number(endEnv);
  const fee = Number(feeEnv);

  const res = await getCurrent(end, String(apySecondEnv), fee, addr, rpc);
  console.log(JSON.stringify(res, null, 2));
}

if (require.main === module) {
  main().catch(e => {
    console.error(e);
    process.exit(1);
  });
}
