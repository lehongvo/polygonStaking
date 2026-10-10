// Test helpers for the V3 challenge contracts (ChallengeBaseStepV3 / ChallengeHIITV3).
// Days are UTC calendar days: a day key is the first second of the day and its range is
// [dayStart, dayStart + 86399]. The backend signature is produced exactly as the backend
// signs it: keccak256(abi.encodePacked(challenge, uint256[] [], uint256[] [payloadHash],
// uint64[2] data, chainId)) signed as an Ethereum signed message.
import hre from 'hardhat';
import { time } from '@nomicfoundation/hardhat-toolbox/network-helpers.js';

export const DAY = 86400;
// SIGNATURE_DOMAIN_V3 ("ESPV3SR!"): required value of _data[0] in a V3 result signature.
export const SIGNATURE_DOMAIN_V3 = 0x4553505633535221n;
export const SUCCESS_FEE = 5;
export const FAIL_FEE = 10;

export const STEP_TUPLE = 'tuple(uint256[] day,uint256[] steps,uint64[] timeRange)';
export const SPEED_TUPLE =
  'tuple(uint256[] day,uint256[] minutesAtTargetSpeed,uint256[] metsWalkingSpeed,uint64[] timeRange)';
export const HIIT_TUPLE = 'tuple(uint256[] day,uint256[] intervals,uint256[] totalSeconds,uint64[] timeRange)';
/** Default HIIT goal of a day in the tests: 6 high-intensity intervals and 60 high-intensity seconds. */
export const HIIT_GOAL = { intervals: 6, totalSeconds: 60 };

export interface StepInput {
  day: number[];
  steps: number[];
  timeRange: number[];
}
export interface SpeedInput {
  day: number[];
  minutesAtTargetSpeed: number[];
  metsWalkingSpeed: number[];
  timeRange: number[];
}
export interface HiitInput {
  day: number[];
  intervals: number[];
  totalSeconds: number[];
  timeRange: number[];
}

export const emptyStep = (): StepInput => ({ day: [], steps: [], timeRange: [] });
export const emptySpeed = (): SpeedInput => ({
  day: [],
  minutesAtTargetSpeed: [],
  metsWalkingSpeed: [],
  timeRange: [],
});
export const emptyHiit = (): HiitInput => ({ day: [], intervals: [], totalSeconds: [], timeRange: [] });

export const ranges = (days: number[]) => days.flatMap(d => [d, d + DAY - 1]);

export const stepInput = (rows: { day: number; steps: number }[]): StepInput => ({
  day: rows.map(r => r.day),
  steps: rows.map(r => r.steps),
  timeRange: ranges(rows.map(r => r.day)),
});
export const speedInput = (rows: { day: number; minutes: number; mets: number }[]): SpeedInput => ({
  day: rows.map(r => r.day),
  minutesAtTargetSpeed: rows.map(r => r.minutes),
  metsWalkingSpeed: rows.map(r => r.mets),
  timeRange: ranges(rows.map(r => r.day)),
});
type HiitRow = { day: number; success: number } | { day: number; intervals: number; totalSeconds: number };
/** HIIT rows; shorthand `success: 1` = values that reach HIIT_GOAL, `success: 0` = values just below it. */
export const hiitInput = (rows: HiitRow[]): HiitInput => {
  const values = rows.map(r =>
    'success' in r
      ? r.success
        ? [HIIT_GOAL.intervals, HIIT_GOAL.totalSeconds]
        : [HIIT_GOAL.intervals - 1, HIIT_GOAL.totalSeconds - 1]
      : [r.intervals, r.totalSeconds]
  );
  return {
    day: rows.map(r => r.day),
    intervals: values.map(v => v[0]),
    totalSeconds: values.map(v => v[1]),
    timeRange: ranges(rows.map(r => r.day)),
  };
};

export interface V3DeployOpts {
  duration?: number;
  goal?: number;
  dayRequired?: number;
  walkingSpeedData?: number[];
  hiitData?: number[];
  /** HIIT-only: [intervals per day, seconds per day] (default HIIT_GOAL). */
  hiitGoal?: number[];
  awardReceiversPercent?: number[];
  index?: number;
  allowGiveUp?: boolean[];
  allAwardToSponsor?: boolean;
  totalAmount?: bigint;
  grantRole?: boolean; // default true: the cron grants the challenge role in production
  msgValue?: bigint; // native coin sent at deployment (default totalAmount; 0 for a token challenge)
  erc20List?: string[]; // ERC20 tokens registered on the NFT before deployment
}

/**
 * Deploy a V3 challenge whose period starts on the next UTC midnight (day 0).
 * startTime = day0 + 1 and endTime = day0 + duration days - 1, following the agreed
 * "one second after / before the day boundary" rule.
 */
export async function deployV3(name: 'ChallengeBaseStepV3' | 'ChallengeHIITV3', opts: V3DeployOpts = {}) {
  const signers = await hre.ethers.getSigners();
  const [sponsor, challenger, feeAddr, returnedWallet] = signers;
  const security = hre.ethers.Wallet.createRandom();

  const Nft = await hre.ethers.getContractFactory('MockSignerExerciseSupplementNFT');
  const nft = await Nft.deploy(returnedWallet.address, SUCCESS_FEE, FAIL_FEE, security.address);
  if (opts.erc20List && opts.erc20List.length) await nft.setErc20List(opts.erc20List);

  const latest = await time.latest();
  const day0 = (Math.floor(latest / DAY) + 1) * DAY;
  const duration = opts.duration ?? 10;
  const startTime = day0 + 1;
  const endTime = day0 + duration * DAY - 1;
  const percents = opts.awardReceiversPercent ?? [100];
  const receivers = signers.slice(4, 4 + percents.length).map(s => s.address);
  const totalAmount = opts.totalAmount ?? hre.ethers.parseEther('1');
  const common = [
    [sponsor.address, challenger.address, feeAddr.address],
    hre.ethers.ZeroAddress,
    [await nft.getAddress()],
  ];

  const Factory = await hre.ethers.getContractFactory(name);
  let challenge: any;
  if (name === 'ChallengeBaseStepV3') {
    challenge = await Factory.deploy(
      ...common,
      [duration, startTime, endTime, opts.goal ?? 1000, opts.dayRequired ?? 3],
      receivers,
      opts.index ?? 1,
      opts.allowGiveUp ?? [true, true, false],
      [0, 0, 0],
      opts.allAwardToSponsor ?? false,
      percents,
      totalAmount,
      opts.walkingSpeedData ?? [],
      opts.hiitData ?? [],
      { value: opts.msgValue ?? totalAmount }
    );
  } else {
    challenge = await Factory.deploy(
      ...common,
      [duration, startTime, endTime, opts.dayRequired ?? 3, ...(opts.hiitGoal ?? [HIIT_GOAL.intervals, HIIT_GOAL.totalSeconds])],
      receivers,
      opts.index ?? 1,
      opts.allowGiveUp ?? [true, true, false],
      [0, 0, 0],
      opts.allAwardToSponsor ?? false,
      percents,
      totalAmount,
      { value: opts.msgValue ?? totalAmount }
    );
  }
  await challenge.waitForDeployment();
  if (opts.grantRole !== false) await nft.grantChallengeRole(await challenge.getAddress());
  const dayKey = (k: number) => day0 + k * DAY;
  return { challenge, nft, security, signers, sponsor, challenger, day0, dayKey, startTime, endTime, duration };
}

/**
 * Payload hash exactly as the contracts compute it: each set is keccak256(abi.encode(<its arrays in struct
 * order>)); BaseStep signs keccak256(abi.encode(stepHash, speedHash, hiitHash)), HIIT-only signs hiitHash.
 */
export function payloadHashBaseStep(step: StepInput, speed: SpeedInput, hiit: HiitInput): string {
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

export function payloadHashHiit(hiit: HiitInput): string {
  const coder = hre.ethers.AbiCoder.defaultAbiCoder();
  return hre.ethers.keccak256(
    coder.encode(['uint256[]', 'uint256[]', 'uint256[]', 'uint64[]'], [hiit.day, hiit.intervals, hiit.totalSeconds, hiit.timeRange])
  );
}

/** Sign like the backend: day array empty, step-index array = [payloadHash], data = [domain, expiry]. */
export async function signPayload(
  security: any,
  challengeAddress: string,
  payloadHash: string,
  expiresIn = 300,
  domain: bigint = SIGNATURE_DOMAIN_V3
): Promise<{ data: [bigint, number]; signature: string }> {
  const { chainId } = await hre.ethers.provider.getNetwork();
  const data: [bigint, number] = [domain, (await time.latest()) + expiresIn];
  const hash = hre.ethers.solidityPackedKeccak256(
    ['address', 'uint256[]', 'uint256[]', 'uint64[2]', 'uint256'],
    [challengeAddress, [], [BigInt(payloadHash)], data, chainId]
  );
  const signature = await security.signMessage(hre.ethers.getBytes(hash));
  return { data, signature };
}

/** Sign and send a BaseStepV3 result. */
export async function sendBaseStep(
  ctx: { challenge: any; security: any; challenger: any },
  sets: { step?: StepInput; speed?: SpeedInput; hiit?: HiitInput; gacha?: string[] },
  sender: any = ctx.challenger
) {
  const step = sets.step ?? emptyStep();
  const speed = sets.speed ?? emptySpeed();
  const hiit = sets.hiit ?? emptyHiit();
  const addr = await ctx.challenge.getAddress();
  const { data, signature } = await signPayload(ctx.security, addr, payloadHashBaseStep(step, speed, hiit));
  return ctx.challenge
    .connect(sender)
    .sendDailyResult(step, speed, hiit, data, signature, sets.gacha ?? [], [], [], []);
}

/** Sign and send a HIITV3 result. */
export async function sendHiit(
  ctx: { challenge: any; security: any; challenger: any },
  hiit: HiitInput,
  sender: any = ctx.challenger,
  gacha: string[] = []
) {
  const addr = await ctx.challenge.getAddress();
  const { data, signature } = await signPayload(ctx.security, addr, payloadHashHiit(hiit));
  return ctx.challenge.connect(sender).sendDailyResult(hiit, data, signature, gacha, [], [], []);
}

/** Move the chain clock to `ts` (only forward). */
export async function moveTo(ts: number) {
  const now = await time.latest();
  if (ts > now) await time.increaseTo(ts);
}
