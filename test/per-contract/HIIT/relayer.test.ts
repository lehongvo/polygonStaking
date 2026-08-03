import { expect } from 'chai';
import hre from 'hardhat';
import { time } from '@nomicfoundation/hardhat-toolbox/network-helpers.js';

const SUCCESS_FEE = 10;
const FAIL_FEE = 10;

// Adversarial relayer test cho ChallengeHIIT (params `_intervals/_totalSeconds` ở vị trí khác).
async function deploy() {
  const [, challenger, feeAddr, returnedNFTWallet, sponsor, recv1, recv2, relayer, attacker] =
    await hre.ethers.getSigners();
  const MockNFT = await hre.ethers.getContractFactory('MockExerciseSupplementNFT');
  const nft = await MockNFT.deploy(returnedNFTWallet.address, SUCCESS_FEE, FAIL_FEE);
  const Factory = await hre.ethers.getContractFactory('ChallengeHIIT');
  const block = await hre.ethers.provider.getBlock('latest');
  const startTime = block!.timestamp + 60;
  const duration = 30;
  const endTime = startTime + duration * 86400;
  const primary = [duration, startTime, endTime, 5, 60, 20];
  const challenge = await Factory.deploy(
    [sponsor.address, challenger.address, feeAddr.address],
    hre.ethers.ZeroAddress,
    [await nft.getAddress()],
    primary,
    [recv1.address, recv2.address],
    1,
    [true, true, false],
    [0, 0, 0],
    false,
    [50, 40],
    hre.ethers.parseEther('100'),
    { value: hre.ethers.parseEther('100') }
  );
  return { challenger, challenge, startTime, relayer, attacker };
}

// HIIT payload: address(this), chainid, nonce, deadline, _day, _intervals, _totalSeconds, _data, _timeRange.
async function buildSig(signer: any, addr: string, chainId: bigint, nonce: number, deadline: number,
  day: number[], intervals: number[], totalSeconds: number[], data: [number, number], timeRange: [number, number]) {
  const coder = hre.ethers.AbiCoder.defaultAbiCoder();
  const payload = hre.ethers.keccak256(
    coder.encode(
      ['address', 'uint256', 'uint256', 'uint256', 'uint256[]', 'uint256[]', 'uint256[]', 'uint64[2]', 'uint64[2]', 'bytes32'],
      [addr, chainId, nonce, deadline, day, intervals, totalSeconds, data, timeRange,
        // assetHash cho danh sách tài sản rỗng ('0x', [], [], [], [], []).
        hre.ethers.keccak256(
          coder.encode(
            ['bytes', 'address[]', 'address[]', 'uint256[][]', 'address[][]', 'bool[]'],
            ['0x', [], [], [], [], []]
          )
        )]
    )
  );
  return signer.signMessage(hre.ethers.getBytes(payload));
}

describe('ChallengeHIIT — sendDailyResultViaRelayer', function () {
  it('valid relay → settle (currentStatus=1) + relayNonce +1', async function () {
    const { challenger, challenge, startTime, relayer } = await deploy();
    await time.increaseTo(startTime + 100);
    const addr = await challenge.getAddress();
    const chainId = (await hre.ethers.provider.getNetwork()).chainId;
    const day = [startTime + 200];
    const intervals = [5];
    const totalSeconds = [60];
    const data: [number, number] = [0, 0];
    const timeRange: [number, number] = [0, startTime + 200 + 86400];
    const deadline = startTime + 500000;
    const sig = await buildSig(challenger, addr, chainId, 0, deadline, day, intervals, totalSeconds, data, timeRange);
    await challenge
      .connect(relayer)
      .sendDailyResultViaRelayer(day, intervals, totalSeconds, data, '0x', [], [], [], [], [], timeRange, 0, deadline, sig);
    expect(await challenge.relayNonce(challenger.address)).to.equal(1n);
  });

  it('wrong signer → RelayBadSignature', async function () {
    const { challenge, startTime, relayer, attacker } = await deploy();
    await time.increaseTo(startTime + 100);
    const addr = await challenge.getAddress();
    const chainId = (await hre.ethers.provider.getNetwork()).chainId;
    const day = [startTime + 200];
    const timeRange: [number, number] = [0, 0];
    const deadline = startTime + 500000;
    const sig = await buildSig(attacker, addr, chainId, 0, deadline, day, [5], [60], [0, 0], timeRange);
    await expect(
      challenge
        .connect(relayer)
        .sendDailyResultViaRelayer(day, [5], [60], [0, 0], '0x', [], [], [], [], [], timeRange, 0, deadline, sig)
    ).to.be.revertedWithCustomError(challenge, 'RelayBadSignature');
  });
});
