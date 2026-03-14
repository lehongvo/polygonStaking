import 'dotenv/config';
import * as fs from 'fs';
import { network } from 'hardhat';
import * as path from 'path';

const hre = require('hardhat');

// HIIT signature helper (mirrors BAP BACKEND getSignatureSendStepForHIIT: no contract call, stepIndex=[] in hash). Uses CHALLENGE_PRIVATE_KEY from .env.
const getSignatureSendStepForHIIT = require('../utils/getSignatureSendStepHIIT');

/**
 * Estimate gas for Challenge HIIT sendDailyResult.
 * - Contract address and primaryRequired are read from deployInfo/challenge-hiit-{network}.json.
 * - _data and _signature come from getSignatureSendStepForBaseStep (CHALLENGE_PRIVATE_KEY in .env).
 * - Builds input data for sendDailyResult (one call per day) and outputs estimated gas + input data.
 *
 * Run:
 *   npx hardhat run scripts/challenge/ChallengeHIIT/etm-gas-send-daily-result-hiit.ts --network polygon
 */

function serializeSendArgs(sendArgs: any[], dayTs?: number): object {
  const [
    _day,
    _intervals,
    _totalSeconds,
    _data,
    _signature,
    _listGachaAddress,
    _listNFTAddress,
    _listIndexNFT,
    _listSenderAddress,
    _statusTypeNft,
    _timeRange,
  ] = sendArgs;
  const toStr = (b: bigint) => (typeof b === 'bigint' ? b.toString() : b);
  const arrToStr = (arr: bigint[] | number[]) =>
    Array.isArray(arr) ? arr.map((x: any) => (typeof x === 'bigint' ? x.toString() : x)) : arr;
  return {
    _day: arrToStr(_day as bigint[]),
    _intervals: arrToStr(_intervals as bigint[]),
    _totalSeconds: arrToStr(_totalSeconds as bigint[]),
    _data: Array.isArray(_data) ? (_data as bigint[]).map(toStr) : _data,
    _signature: _signature,
    _listGachaAddress: _listGachaAddress,
    _listNFTAddress: _listNFTAddress,
    _listIndexNFT: (_listIndexNFT as bigint[][]).map(row => row.map(toStr)),
    _listSenderAddress: _listSenderAddress,
    _statusTypeNft: _statusTypeNft,
    _timeRange: Array.isArray(_timeRange) ? (_timeRange as bigint[]).map(toStr) : _timeRange,
    ...(dayTs !== undefined ? { _dayTimestamp: dayTs } : {}),
  };
}

async function main() {
  const networkName = network.name;
  const deployInfoPath = path.join(
    process.cwd(),
    `deployInfo/challenge-hiit-${networkName}.json`
  );

  if (!fs.existsSync(deployInfoPath)) {
    console.error('❌ Deploy info not found:', deployInfoPath);
    console.error('   Run with --network polygon (or the network you deployed to).');
    process.exit(1);
  }

  const deployInfo = JSON.parse(fs.readFileSync(deployInfoPath, 'utf-8'));
  const contractAddress = deployInfo.contractAddress;
  const primaryRequired = deployInfo.constructorArgs?.primaryRequired;

  if (!contractAddress) {
    console.error('❌ deployInfo missing contractAddress');
    process.exit(1);
  }

  if (!primaryRequired || primaryRequired.length < 6) {
    console.error('❌ deployInfo.constructorArgs.primaryRequired must have 6 elements');
    process.exit(1);
  }

  const pr = primaryRequired;

  const startTimeC = pr[1];
  const minIntervals = pr[3];
  const minTotalSeconds = pr[4];
  const dayRequiredCount = pr[5];

  console.log('📋 ESTIMATE GAS: sendDailyResult (Challenge HIIT)');
  console.log('=================================================');
  console.log('Network:', networkName);
  console.log('Contract:', contractAddress);
  const challengerAddress = deployInfo.contractDetails?.challenger;
  console.log('Challenger:', challengerAddress ?? 'N/A');
  console.log('primaryRequired:', pr);
  console.log('');

  const ContractFactory = await hre.ethers.getContractFactory('ChallengeHIIT');
  const contract = ContractFactory.attach(contractAddress);

  if (!challengerAddress) {
    console.warn('⚠️  deployInfo.contractDetails.challenger not found.');
  } else {
    console.log('(Challenger used as from for estimateGas)');
  }
  console.log('');
  const testListGachaAddress: string[] = [];
  const testListNFTAddress: string[] = [];
  const testListIndexNFT: bigint[][] = [];
  const testListSenderAddress: string[][] = [];
  const testStatusTypeNft: boolean[] = [];

  const provider = hre.ethers.provider;
  const timeRelease = 600;

  const results: { dayIndex: number; dayTs: number; gasEstimate: string; inputData: object }[] = [];

  for (let i = 0; i < dayRequiredCount; i++) {
    const dayTs = startTimeC + (i + 1) * 86400 * 2;
    const testDay = [BigInt(dayTs)];
    let testIntervals = [BigInt(minIntervals)];
    let testTotalSeconds = [BigInt(minTotalSeconds)];

    if (i === 1) {
      testIntervals = [BigInt(1)];
      testTotalSeconds = [BigInt(1)];
    }

    const testTimeRange: [bigint, bigint] = [
      BigInt(dayTs - 100),
      BigInt(dayTs + 100),
    ];

    // Get real _data and _signature from getSignatureSendStepForHIIT (CHALLENGE_PRIVATE_KEY). Must match NFT securityAddress.
    const dataSignature = await getSignatureSendStepForHIIT(
      provider,
      contractAddress,
      [dayTs],
      timeRelease
    );

    if (dataSignature.error) {
      console.error(
        `Day ${i + 1}/${dayRequiredCount}: getSignatureSendStepForHIIT failed:`,
        dataSignature.error,
        dataSignature.message
      );
      throw new Error(
        `Signature failed: ${dataSignature.error} - ${dataSignature.message}`
      );
    }

    const testData: [bigint, bigint] = [
      BigInt(dataSignature.dataSendStep[0]),
      BigInt(dataSignature.dataSendStep[1]),
    ];
    const testSignature = dataSignature.signature;

    const sendArgs = [
      testDay,
      testIntervals,
      testTotalSeconds,
      testData,
      testSignature,
      testListGachaAddress,
      testListNFTAddress,
      testListIndexNFT,
      testListSenderAddress,
      testStatusTypeNft,
      testTimeRange,
    ];

    const data = contract.interface.encodeFunctionData('sendDailyResult', sendArgs);
    const gasEstimate = challengerAddress
      ? await hre.ethers.provider.estimateGas({ to: contractAddress, from: challengerAddress, data })
      : await contract.sendDailyResult.estimateGas(...sendArgs);
    const inputData = serializeSendArgs(sendArgs, dayTs);

    results.push({
      dayIndex: i + 1,
      dayTs,
      gasEstimate: gasEstimate.toString(),
      inputData,
    });

    console.log(`Day ${i + 1}/${dayRequiredCount} (dayTs=${dayTs}): gas = ${gasEstimate.toString()}`);
    console.log('sendArgs (inputData):', JSON.stringify(inputData, null, 2));
  }

  console.log('');
  console.log('📊 OUTPUT: Gas estimates and input data');
  console.log('======================================');
  console.log(JSON.stringify({ contractAddress, network: networkName, results }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('💥 Error:', err);
    process.exit(1);
  });
