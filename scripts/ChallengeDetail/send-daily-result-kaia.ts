/**
 * Call sendDailyResult on the most-recently deployed ChallengeBaseStep
 * on Kaia mainnet.
 *
 * Reads address from scripts/contract/kaia.json -> ChallengeBaseStep.
 *
 * Test config: day 1, steps = goal (10) → walking speed + HIIT disabled
 * for this challenge so those arrays are empty. NFT/Gacha lists also
 * empty (no rewards being claimed in this call).
 *
 * NOTE: signature is `sendDailyResult(uint256[], uint256[], address[],
 * address[], uint256[][], address[][], bool[], uint64[2], uint256[],
 * uint256[], uint256[], uint256[])` — the on-chain signature param
 * was commented out by Vincent before this run.
 *
 * Run:
 *   npm run send-daily-result:kaia
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { ethers, network } from 'hardhat';

const KAIA_JSON_PATH = path.join(
  process.cwd(),
  'scripts',
  'contract',
  'kaia.json'
);

async function main() {
  console.log('🚀 SEND DAILY RESULT — KAIA MAINNET');
  console.log('====================================');

  if (network.name !== 'kaia') {
    console.error(`❌ Only 'kaia', got '${network.name}'`);
    process.exit(1);
  }

  const [sender] = await ethers.getSigners();
  console.log(`📍 Network: ${network.name}`);
  console.log(`👤 Sender:  ${sender.address}`);

  const kaiaJson = JSON.parse(fs.readFileSync(KAIA_JSON_PATH, 'utf8'));
  const CHALLENGE = kaiaJson.ChallengeBaseStep;
  if (!CHALLENGE) {
    console.error('❌ kaia.json missing ChallengeBaseStep');
    process.exit(1);
  }
  console.log(`🎯 Challenge: ${CHALLENGE}`);

  const contract = await ethers.getContractAt('ChallengeBaseStep', CHALLENGE);

  // Pre-flight: read challenger + time window
  const challenger = await (contract as any).challenger();
  const startTime = await (contract as any).startTime();
  const endTime = await (contract as any).endTime();
  const goal = await (contract as any).goal();
  console.log(`\n📋 Pre-flight state:`);
  console.log(`   challenger: ${challenger}`);
  console.log(`   startTime:  ${startTime} (${new Date(Number(startTime) * 1000).toISOString()})`);
  console.log(`   endTime:    ${endTime} (${new Date(Number(endTime) * 1000).toISOString()})`);
  console.log(`   goal:       ${goal}`);
  console.log(`   now:        ${Math.floor(Date.now() / 1000)}`);

  if (challenger.toLowerCase() !== sender.address.toLowerCase()) {
    console.error(`❌ sender != challenger — sendDailyResult requires onlyChallenger`);
    process.exit(1);
  }

  // Build payload — day 1, steps == goal (10), no gacha/nft, no walking
  // speed (disabled), no HIIT (disabled).
  const days: bigint[] = [1n];
  const steps: bigint[] = [BigInt(goal)]; // == goal -> day 1 success
  const listGachaAddress: string[] = [];
  const listNFTAddress: string[] = [];
  const listIndexNFT: bigint[][] = [];
  const listSenderAddress: string[][] = [];
  const statusTypeNft: boolean[] = [];
  const timeRange: [bigint, bigint] = [0n, 0n];
  const intervals: bigint[] = []; // HIIT off
  const totalSeconds: bigint[] = []; // HIIT off
  const minutesAtTargetSpeed: bigint[] = []; // walking speed off
  const metsWalkingSpeed: bigint[] = []; // walking speed off

  console.log('\n📤 sendDailyResult args:');
  console.log({
    days: days.map(x => x.toString()),
    steps: steps.map(x => x.toString()),
    listGachaAddress,
    listNFTAddress,
    listIndexNFT,
    listSenderAddress,
    statusTypeNft,
    timeRange: timeRange.map(x => x.toString()),
    intervals,
    totalSeconds,
    minutesAtTargetSpeed,
    metsWalkingSpeed,
  });

  // estimate gas first to surface revert reasons early
  console.log('\n⛽ Estimating gas...');
  const estGas = await (contract as any).sendDailyResult.estimateGas(
    days,
    steps,
    listGachaAddress,
    listNFTAddress,
    listIndexNFT,
    listSenderAddress,
    statusTypeNft,
    timeRange,
    intervals,
    totalSeconds,
    minutesAtTargetSpeed,
    metsWalkingSpeed
  );
  console.log(`   estimated: ${estGas.toString()} gas`);

  console.log('\n📤 Sending tx...');
  const tx = await (contract as any).sendDailyResult(
    days,
    steps,
    listGachaAddress,
    listNFTAddress,
    listIndexNFT,
    listSenderAddress,
    statusTypeNft,
    timeRange,
    intervals,
    totalSeconds,
    minutesAtTargetSpeed,
    metsWalkingSpeed,
    { gasLimit: Math.ceil(Number(estGas) * 1.2) }
  );
  console.log(`   tx hash: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`   block:   ${receipt?.blockNumber}`);
  console.log(`   gas:     ${receipt?.gasUsed?.toString()}`);

  // Read back daily result if there's a getter
  console.log('\n🔍 Post-state:');
  try {
    const finished = await (contract as any).isFinished();
    const success = await (contract as any).isSuccess();
    console.log(`   isFinished: ${finished}`);
    console.log(`   isSuccess:  ${success}`);
  } catch (e) {
    /* ignore */
  }

  console.log(`\n🔗 Explorer: https://kaiascan.io/tx/${tx.hash}`);
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('💥 SEND FAILED:', err);
    process.exit(1);
  });
