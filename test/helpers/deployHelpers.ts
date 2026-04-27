import hre from 'hardhat';
import { time } from '@nomicfoundation/hardhat-toolbox/network-helpers.js';

export const SUCCESS_FEE = 5;
export const FAIL_FEE = 10;

export type ContractName =
  | 'ChallengeBaseStep'
  | 'ChallengeDetail'
  | 'ChallengeHIIT'
  | 'ChallengeBaseStepBackup'
  | 'ChallengeDetailBackup'
  | 'ChallengeHIITBackup';

export interface DeployOpts extends Record<string, any> {
  awardReceiversPercent: number[];
  receivers?: string[]; // overrides default 4..n signer addresses
  index?: number;
  totalAmount?: bigint;
  msgValue?: bigint;
  duration?: number;
  dayRequired?: number;
  goal?: number;
  highIntensityIntervals?: number; // for HIIT
  totalHighIntensityTime?: number; // for HIIT
  walkingSpeedData?: number[]; // for BaseStep
  hiitData?: number[]; // for BaseStep optional HIIT
  allowGiveUp?: boolean[];
  allAwardToSponsor?: boolean;
  gasFee?: number;
  sponsor?: string; // override
  challenger?: string;
  feeAddr?: string;
  erc20List?: string[]; // pre-populated ERC20 list on registry
}

export async function deployMockNFT(opts?: { erc20List?: string[] }) {
  const [, , , wallet] = await hre.ethers.getSigners();
  const Mock = await hre.ethers.getContractFactory('MockExerciseSupplementNFT');
  const nft = await Mock.deploy(wallet.address, SUCCESS_FEE, FAIL_FEE);
  if (opts?.erc20List && opts.erc20List.length) {
    await nft.setErc20List(opts.erc20List);
  }
  return nft;
}

export async function deployChallenge(name: ContractName, opts: DeployOpts) {
  const signers = await hre.ethers.getSigners();
  const [defaultSponsor, defaultChallenger, defaultFee, ,] = signers;

  const sponsor = opts.sponsor ?? defaultSponsor.address;
  const challenger = opts.challenger ?? defaultChallenger.address;
  const feeAddr = opts.feeAddr ?? defaultFee.address;

  const nft = await deployMockNFT({ erc20List: opts.erc20List });

  const Factory = await hre.ethers.getContractFactory(name);
  const block = await hre.ethers.provider.getBlock('latest');
  const startTime = block!.timestamp + 60;
  const duration = opts.duration ?? 30;
  const endTime = startTime + duration * 86400;
  const goal = opts.goal ?? 1000;
  const dayRequired = opts.dayRequired ?? 20;

  const receivers =
    opts.receivers ?? signers.slice(4, 4 + opts.awardReceiversPercent.length).map((s) => s.address);
  const idx = opts.index ?? 1;
  const allowGiveUp = opts.allowGiveUp ?? [true, true, false];
  const gasData = [0, 0, opts.gasFee ?? 0];
  const totalAmount = opts.totalAmount ?? hre.ethers.parseEther('100');
  const allAwardToSponsor = opts.allAwardToSponsor ?? false;

  const isHIIT = name.startsWith('ChallengeHIIT');
  const isBaseStep = name.startsWith('ChallengeBaseStep');

  if (isHIIT) {
    // ChallengeHIIT primary layout: [duration, startTime, endTime, highIntensityIntervals, totalHighIntensityTime, dayRequired]
    const primary = [
      duration,
      startTime,
      endTime,
      opts.highIntensityIntervals ?? 5,
      opts.totalHighIntensityTime ?? 60,
      dayRequired,
    ];
    const challenge = await Factory.deploy(
      [sponsor, challenger, feeAddr],
      hre.ethers.ZeroAddress,
      [await nft.getAddress()],
      primary,
      receivers,
      idx,
      allowGiveUp,
      gasData,
      allAwardToSponsor,
      opts.awardReceiversPercent,
      totalAmount,
      { value: opts.msgValue ?? totalAmount }
    );
    return { challenge, nft, startTime, endTime, signers };
  }

  if (isBaseStep) {
    const primary = [duration, startTime, endTime, goal, dayRequired];
    const challenge = await Factory.deploy(
      [sponsor, challenger, feeAddr],
      hre.ethers.ZeroAddress,
      [await nft.getAddress()],
      primary,
      receivers,
      idx,
      allowGiveUp,
      gasData,
      allAwardToSponsor,
      opts.awardReceiversPercent,
      totalAmount,
      opts.walkingSpeedData ?? [],
      opts.hiitData ?? [],
      { value: opts.msgValue ?? totalAmount }
    );
    return { challenge, nft, startTime, endTime, signers };
  }

  // ChallengeDetail / Backup
  const primary = [duration, startTime, endTime, goal, dayRequired];
  const challenge = await Factory.deploy(
    [sponsor, challenger, feeAddr],
    hre.ethers.ZeroAddress,
    [await nft.getAddress()],
    primary,
    receivers,
    idx,
    allowGiveUp,
    gasData,
    allAwardToSponsor,
    opts.awardReceiversPercent,
    totalAmount,
    { value: opts.msgValue ?? totalAmount }
  );
  return { challenge, nft, startTime, endTime, signers };
}

export interface SendStepArgs {
  day: number;
  steps: number;
  intervals?: number; // HIIT
  totalSeconds?: number; // HIIT
  minutes?: number; // walking speed
  mets?: number;
  timeRange?: [number, number];
}

/**
 * Convenience: call sendDailyResult on any of the 3 contracts with sane defaults.
 */
export async function sendStep(
  contract: any,
  contractName: ContractName,
  challengerSigner: any,
  args: SendStepArgs
) {
  const sig = '0x';
  const data: [number, number] = [0, 0];
  const range: [number, number] = args.timeRange ?? [0, 2 ** 53 - 1];

  if (contractName.startsWith('ChallengeHIIT')) {
    return contract
      .connect(challengerSigner)
      .sendDailyResult(
        [args.day],
        [args.intervals ?? 0],
        [args.totalSeconds ?? 0],
        data,
        sig,
        [],
        [],
        [],
        [],
        [],
        range
      );
  }

  if (contractName.startsWith('ChallengeBaseStep')) {
    return contract
      .connect(challengerSigner)
      .sendDailyResult(
        [args.day],
        [args.steps],
        data,
        sig,
        [],
        [],
        [],
        [],
        [],
        range,
        args.intervals !== undefined ? [args.intervals] : [],
        args.totalSeconds !== undefined ? [args.totalSeconds] : [],
        args.minutes !== undefined ? [args.minutes] : [],
        args.mets !== undefined ? [args.mets] : []
      );
  }

  // ChallengeDetail (step-only, no extra arrays)
  return contract
    .connect(challengerSigner)
    .sendDailyResult(
      [args.day],
      [args.steps],
      data,
      sig,
      [],
      [],
      [],
      [],
      [],
      range
    );
}

export async function moveToStart(startTime: number, offset = 100) {
  await time.increaseTo(startTime + offset);
}

export async function moveAfterEnd(endTime: number, offset = 2 * 86400 + 100) {
  await time.increaseTo(endTime + offset);
}
