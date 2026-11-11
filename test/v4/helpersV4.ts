// Test helpers for the V4 challenge contracts (ChallengeBaseStepV4 / ChallengeHIITV4).
// Days are UTC calendar days. Step and speed keep the V3 shapes and hashes; only HIIT changes.
import hre from 'hardhat';
import { time } from '@nomicfoundation/hardhat-toolbox/network-helpers.js';
import {
  DAY,
  emptySpeed,
  emptyStep,
  moveTo,
  ranges,
  SpeedInput,
  signPayload as signPayloadV3,
  speedInput,
  StepInput,
  stepInput,
} from '../v3/helpersV3.ts';

export { DAY, emptySpeed, emptyStep, moveTo, ranges, speedInput, stepInput };

// SIGNATURE_DOMAIN_V4 ("ESPV4SR!"): required value of _data[0] in a V4 result signature.
export const SIGNATURE_DOMAIN_V4 = 0x4553505634535221n;
export const MAIN_MENU = [20, 10, 8, 2, 80];
export const GAVE_UP = 3n;
export const SUCCESS = 1n;
export const PROCESSING = 0n;

export interface HiitInputV4 {
  day: number[];
  achieved: number[];
  timeRange: number[];
}

export const emptyHiit = (): HiitInputV4 => ({ day: [], achieved: [], timeRange: [] });

/** Achieved days with full-day ranges. */
export const achievedInput = (days: number[]): HiitInputV4 => ({
  day: days,
  achieved: days.map(() => 1),
  timeRange: ranges(days),
});

/** Achieved days with explicit ranges, [start0, end0, start1, end1, ...]. */
export const withRange = (days: number[], timeRange: number[]): HiitInputV4 => ({
  day: days,
  achieved: days.map(() => 1),
  timeRange,
});

export interface V4DeployOpts {
  duration?: number;
  goal?: number;
  dayRequired?: number;
  menu?: number[];
  walkingSpeedData?: number[];
  hiitData?: number[];
  /** Seconds from the UTC midnight of day 0 to startTime (default 1, the future-start rule). */
  startOffset?: number;
  /** Replaces _primaryRequired, to test invalid layouts. */
  primaryRequired?: number[];
  awardReceiversPercent?: number[];
  /** Replaces the default receivers (signers 4, 5, ...), e.g. to list one address twice or in both lists. */
  awardReceivers?: string[];
  /** Replaces the fee address (signer 2), e.g. with a receiver that refuses coin. */
  feeAddress?: string;
  /** Replaces _gasData ([0, 0, 0]); index 2 is the gas fee paid to the challenger at deployment. */
  gasData?: (number | bigint)[];
  index?: number;
  allowGiveUp?: boolean[];
  allAwardToSponsor?: boolean;
  totalAmount?: bigint;
  grantRole?: boolean;
  msgValue?: bigint;
  erc20List?: string[];
}

export async function deployV4(name: 'ChallengeBaseStepV4' | 'ChallengeHIITV4', opts: V4DeployOpts = {}) {
  const signers = await hre.ethers.getSigners();
  const [sponsor, challenger, feeAddr, returnedWallet] = signers;
  const security = hre.ethers.Wallet.createRandom();

  const Nft = await hre.ethers.getContractFactory('MockSignerExerciseSupplementNFT');
  const nft = await Nft.deploy(returnedWallet.address, 5, 10, security.address);
  if (opts.erc20List && opts.erc20List.length) await nft.setErc20List(opts.erc20List);

  const latest = await time.latest();
  const day0 = (Math.floor(latest / DAY) + 1) * DAY;
  const duration = opts.duration ?? 10;
  const startTime = day0 + (opts.startOffset ?? 1);
  const endTime = day0 + duration * DAY - 1;
  // Fees of the mock fee source: 5% on success, 10% on failure. Success shares + success fee and failure shares
  // + failure fee must each make 100 (Q5), so the default is one success receiver at 95 and one failure receiver at 90.
  const percents = opts.awardReceiversPercent ?? [95, 90];
  const receivers = opts.awardReceivers ?? signers.slice(4, 4 + percents.length).map(s => s.address);
  const totalAmount = opts.totalAmount ?? hre.ethers.parseEther('1');
  const common = [
    [sponsor.address, challenger.address, opts.feeAddress ?? feeAddr.address],
    hre.ethers.ZeroAddress,
    [await nft.getAddress()],
  ];
  const tail = [
    receivers,
    opts.index ?? 1,
    opts.allowGiveUp ?? [true, true, false],
    opts.gasData ?? [0, 0, 0],
    opts.allAwardToSponsor ?? false,
    percents,
    totalAmount,
  ];

  const Factory = await hre.ethers.getContractFactory(name);
  let challenge: any;
  if (name === 'ChallengeBaseStepV4') {
    challenge = await Factory.deploy(
      ...common,
      opts.primaryRequired ?? [duration, startTime, endTime, opts.goal ?? 1000, opts.dayRequired ?? 3],
      ...tail,
      opts.walkingSpeedData ?? [],
      opts.hiitData ?? [],
      { value: opts.msgValue ?? totalAmount }
    );
  } else {
    challenge = await Factory.deploy(
      ...common,
      opts.primaryRequired ?? [duration, startTime, endTime, opts.dayRequired ?? 3, ...(opts.menu ?? MAIN_MENU)],
      ...tail,
      { value: opts.msgValue ?? totalAmount }
    );
  }
  await challenge.waitForDeployment();
  if (opts.grantRole !== false) await nft.grantChallengeRole(await challenge.getAddress());
  const dayKey = (k: number) => day0 + k * DAY;
  return { challenge, nft, security, signers, sponsor, challenger, day0, dayKey, startTime, endTime, duration };
}

export const deployHiit = (opts: V4DeployOpts = {}) => deployV4('ChallengeHIITV4', opts);

export function payloadHashHiit(hiit: HiitInputV4): string {
  const coder = hre.ethers.AbiCoder.defaultAbiCoder();
  return hre.ethers.keccak256(coder.encode(['uint256[]', 'uint256[]', 'uint64[]'], [hiit.day, hiit.achieved, hiit.timeRange]));
}

export function payloadHashBaseStep(step: StepInput, speed: SpeedInput, hiit: HiitInputV4): string {
  const coder = hre.ethers.AbiCoder.defaultAbiCoder();
  const stepHash = hre.ethers.keccak256(coder.encode(['uint256[]', 'uint256[]', 'uint64[]'], [step.day, step.steps, step.timeRange]));
  const speedHash = hre.ethers.keccak256(
    coder.encode(
      ['uint256[]', 'uint256[]', 'uint256[]', 'uint64[]'],
      [speed.day, speed.minutesAtTargetSpeed, speed.metsWalkingSpeed, speed.timeRange]
    )
  );
  return hre.ethers.keccak256(coder.encode(['bytes32', 'bytes32', 'bytes32'], [stepHash, speedHash, payloadHashHiit(hiit)]));
}

export const signPayload = (security: any, address: string, hash: string, expiresIn = 300, domain = SIGNATURE_DOMAIN_V4) =>
  signPayloadV3(security, address, hash, expiresIn, domain);

/** Sign and send a HIITV4 result. */
export async function sendHiit(
  ctx: { challenge: any; security: any; challenger: any },
  hiit: HiitInputV4,
  sender: any = ctx.challenger,
  gacha: string[] = []
) {
  const addr = await ctx.challenge.getAddress();
  const { data, signature } = await signPayload(ctx.security, addr, payloadHashHiit(hiit));
  return ctx.challenge.connect(sender).sendDailyResult(hiit, data, signature, gacha, [], [], []);
}

/**
 * Day 1 of steps and speed runs from the challenge start, as the backend builds it (point c): a full-day range of
 * the start day gets startTime as its start. `raw` sends the ranges as given (tests of invalid ranges).
 */
function dayOneFromStart<T extends { day: number[]; timeRange: number[] }>(input: T, startTime?: number): T {
  if (startTime === undefined) return input;
  const timeRange = input.timeRange.map((value, i) => {
    const day = input.day[Math.floor(i / 2)];
    return i % 2 === 0 && value === day && day < startTime && startTime < day + DAY ? startTime : value;
  });
  return { ...input, timeRange };
}

/** Sign and send a BaseStepV4 result. */
export async function sendBaseStep(
  ctx: { challenge: any; security: any; challenger: any; startTime?: number },
  sets: { step?: StepInput; speed?: SpeedInput; hiit?: HiitInputV4; gacha?: string[]; raw?: boolean },
  sender: any = ctx.challenger
) {
  const start = sets.raw ? undefined : ctx.startTime;
  const step = dayOneFromStart(sets.step ?? emptyStep(), start);
  const speed = dayOneFromStart(sets.speed ?? emptySpeed(), start);
  const hiit = sets.hiit ?? emptyHiit();
  const addr = await ctx.challenge.getAddress();
  const { data, signature } = await signPayload(ctx.security, addr, payloadHashBaseStep(step, speed, hiit));
  return ctx.challenge.connect(sender).sendDailyResult(step, speed, hiit, data, signature, sets.gacha ?? [], [], [], []);
}

export const giveUp = (ctx: { challenge: any }, signer: any) => ctx.challenge.connect(signer).giveUp([], [], [], []);
