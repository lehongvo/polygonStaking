import 'dotenv/config';
import * as fs from 'fs';
import { network } from 'hardhat';
import * as path from 'path';

const hre = require('hardhat');

// BaseStep signature helper. Uses CHALLENGE_PRIVATE_KEY from .env. stepIndex = [goal] per day.
const getSignatureSendStepForBaseStep = require('../utils/getSignatureSendStepBaseStep');

/**
 * Estimate gas for ChallengeBaseStep sendDailyResult.
 * - Contract address and config from deployInfo/challenge-walking-speed-{network}.json.
 * - _data and _signature from getSignatureSendStepForBaseStep (CHALLENGE_PRIVATE_KEY). Must match NFT securityAddress.
 * - Builds sendDailyResult args (with optional walkingSpeedData / hiitData) and outputs gas + input data per day.
 *
 * Run:
 *   npx hardhat run scripts/challenge/ChallengeWalkingSpeed/etm-gas-send-daily-result-base-step.ts --network polygon
 */

function serializeSendArgs(sendArgs: any[], dayTs?: number): object {
  const [
    _day,
    _stepIndex,
    _data,
    _signature,
    _listGachaAddress,
    _listNFTAddress,
    _listIndexNFT,
    _listSenderAddress,
    _statusTypeNft,
    _timeRange,
    _intervals,
    _totalSeconds,
    _minutesAtTargetSpeed,
    _metsWalkingSpeed,
  ] = sendArgs;
  const toStr = (b: bigint) => (typeof b === 'bigint' ? b.toString() : b);
  const arrToStr = (arr: bigint[] | number[]) =>
    Array.isArray(arr)
      ? arr.map((x: any) => (typeof x === 'bigint' ? x.toString() : x))
      : arr;
  return {
    _day: arrToStr(_day as bigint[]),
    _stepIndex: arrToStr(_stepIndex as bigint[]),
    _data: Array.isArray(_data) ? (_data as bigint[]).map(toStr) : _data,
    _signature: _signature,
    _listGachaAddress: _listGachaAddress,
    _listNFTAddress: _listNFTAddress,
    _listIndexNFT: (_listIndexNFT as bigint[][]).map(row => row.map(toStr)),
    _listSenderAddress: _listSenderAddress,
    _statusTypeNft: _statusTypeNft,
    _timeRange: Array.isArray(_timeRange)
      ? (_timeRange as bigint[]).map(toStr)
      : _timeRange,
    _intervals: arrToStr(_intervals as bigint[]),
    _totalSeconds: arrToStr(_totalSeconds as bigint[]),
    _minutesAtTargetSpeed: arrToStr(_minutesAtTargetSpeed as bigint[]),
    _metsWalkingSpeed: arrToStr(_metsWalkingSpeed as bigint[]),
    ...(dayTs !== undefined ? { _dayTimestamp: dayTs } : {}),
  };
}

async function main() {
  const networkName = network.name;
  const deployInfoPath = path.join(
    process.cwd(),
    `deployInfo/challenge-walking-speed-${networkName}.json`
  );

  if (!fs.existsSync(deployInfoPath)) {
    console.error('❌ Deploy info not found:', deployInfoPath);
    console.error(
      '   Run with --network polygon (or the network you deployed to).'
    );
    process.exit(1);
  }

  const deployInfo = JSON.parse(fs.readFileSync(deployInfoPath, 'utf-8'));
  const contractAddress = deployInfo.contractAddress;
  const primaryRequired = deployInfo.constructorArgs?.primaryRequired;
  const walkingSpeedData = deployInfo.constructorArgs?.walkingSpeedData ?? [];
  const hiitData = deployInfo.constructorArgs?.hiitData ?? [];

  if (!contractAddress) {
    console.error('❌ deployInfo missing contractAddress');
    process.exit(1);
  }

  if (!primaryRequired || primaryRequired.length < 5) {
    console.error(
      '❌ deployInfo.constructorArgs.primaryRequired must have at least 5 elements'
    );
    process.exit(1);
  }

  const pr = primaryRequired;
  const startTimeC = pr[1];
  const goal = pr[3];
  const dayRequiredCount = pr[4];

  const hasWalking = walkingSpeedData && walkingSpeedData.length >= 3;
  const hasHiit = hiitData && hiitData.length >= 2;
  const hiitIntervals = hasHiit ? hiitData[0] : 0;
  const hiitTotalSeconds = hasHiit ? hiitData[1] : 0;
  const walkingRequiredMinutes = hasWalking ? walkingSpeedData[1] : 0;

  console.log('📋 ESTIMATE GAS: sendDailyResult (Challenge BaseStep)');
  console.log('====================================================');
  console.log('Network:', networkName);
  console.log('Contract:', contractAddress);
  const challengerAddress = deployInfo.contractDetails?.challenger;
  console.log('Challenger:', challengerAddress ?? 'N/A');
  console.log('primaryRequired:', pr);
  console.log('walkingSpeedData:', hasWalking ? walkingSpeedData : '[]');
  console.log('hiitData:', hasHiit ? hiitData : '[]');
  console.log('');

  const ContractFactory =
    await hre.ethers.getContractFactory('ChallengeBaseStep');
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

  const results: {
    dayIndex: number;
    dayTs: number;
    gasEstimate: string;
    inputData: object;
  }[] = [];

  for (let i = 0; i < dayRequiredCount; i++) {
    const dayTs = startTimeC + (i + 1) * 86400 * 2;
    const testDay = [BigInt(dayTs)];
    const testStepIndex = [BigInt(goal)];
    const testTimeRange: [bigint, bigint] = [
      BigInt(dayTs - 100),
      BigInt(dayTs + 100),
    ];

    let testIntervals = hasHiit ? [BigInt(hiitIntervals)] : [];
    let testTotalSeconds = hasHiit ? [BigInt(hiitTotalSeconds)] : [];
    if (i === 1) {
      testIntervals = hasHiit ? [BigInt(1)] : [];
      testTotalSeconds = hasHiit ? [BigInt(1)] : [];
    }
    const testMinutes = hasWalking ? [BigInt(walkingRequiredMinutes)] : [];
    const testMets = hasWalking ? [BigInt(1)] : [];

    // Get real _data and _signature from getSignatureSendStepForBaseStep (CHALLENGE_PRIVATE_KEY). Must match NFT securityAddress.
    const dataSignature = await getSignatureSendStepForBaseStep(
      provider,
      contractAddress,
      [dayTs],
      [goal],
      timeRelease
    );

    if (dataSignature.error) {
      console.error(
        `Day ${i + 1}/${dayRequiredCount}: getSignatureSendStepForBaseStep failed:`,
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
      testStepIndex,
      testData,
      testSignature,
      testListGachaAddress,
      testListNFTAddress,
      testListIndexNFT,
      testListSenderAddress,
      testStatusTypeNft,
      testTimeRange,
      testIntervals,
      testTotalSeconds,
      testMinutes,
      testMets,
    ];

    const gasEstimate = challengerAddress
      ? await hre.ethers.provider.estimateGas({
          to: contractAddress,
          from: challengerAddress,
          data: contract.interface.encodeFunctionData(
            'sendDailyResult',
            sendArgs
          ),
        })
      : await contract.sendDailyResult.estimateGas(...sendArgs);
    const inputData = serializeSendArgs(sendArgs, dayTs);

    results.push({
      dayIndex: i + 1,
      dayTs,
      gasEstimate: gasEstimate.toString(),
      inputData,
    });

    console.log(
      `Day ${i + 1}/${dayRequiredCount} (dayTs=${dayTs}): gas = ${gasEstimate.toString()}`
    );
    console.log(
      '  → minutesAtTargetSpeed:',
      hasWalking ? walkingRequiredMinutes : '—',
      '| metsWalkingSpeed:',
      hasWalking ? '1' : '—',
      '| hiitIntervals:',
      testIntervals.length ? testIntervals[0].toString() : '—',
      '| hiitTotalSeconds:',
      testTotalSeconds.length ? testTotalSeconds[0].toString() : '—'
    );
    console.log('sendArgs (inputData):', JSON.stringify(inputData, null, 2));
  }

  console.log('');
  console.log('📊 OUTPUT: Gas estimates and input data');
  console.log('======================================');
  console.log(
    JSON.stringify({ contractAddress, network: networkName, results }, null, 2)
  );
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('💥 Error:', err);
    process.exit(1);
  });
