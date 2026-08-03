import { expect } from 'chai';
import hre from 'hardhat';
import { time } from '@nomicfoundation/hardhat-toolbox/network-helpers.js';

const SUCCESS_FEE = 10;
const FAIL_FEE = 10;

// Relayer + smoke test cho ChallengeGCM (trước 0 test). sendDailyResult có thêm `_glucoseLevels`.
async function deploy() {
  const [, challenger, feeAddr, returnedNFTWallet, sponsor, recv1, recv2, relayer, attacker] =
    await hre.ethers.getSigners();
  const MockNFT = await hre.ethers.getContractFactory('MockExerciseSupplementNFT');
  const nft = await MockNFT.deploy(returnedNFTWallet.address, SUCCESS_FEE, FAIL_FEE);
  const Factory = await hre.ethers.getContractFactory('ChallengeGCM');
  const block = await hre.ethers.provider.getBlock('latest');
  const startTime = block!.timestamp + 60;
  const duration = 5;
  const endTime = startTime + duration * 86400;
  const challenge = await Factory.deploy(
    [sponsor.address, challenger.address, feeAddr.address],
    hre.ethers.ZeroAddress,
    [await nft.getAddress()],
    [duration, startTime, endTime, 1000, 4],
    [recv1.address, recv2.address],
    1,
    [true, true, false],
    [0, 0, 0],
    false,
    [50, 40],
    hre.ethers.parseEther('10'),
    [70, 180, 3], // _gcmData: [minGlucose, maxGlucose, minSuccessDays] (dayRequired 4 >= 3)
    { value: hre.ethers.parseEther('10') }
  );
  return { challenger, challenge, startTime, relayer, attacker, recv1 };
}

// GCM payload: address(this), chainid, nonce, deadline, _day, _stepIndex, _data, _timeRange, _glucoseLevels.
async function buildSig(signer: any, addr: string, chainId: bigint, nonce: number, deadline: number,
  day: number[], stepIndex: number[], data: [number, number], timeRange: [number, number], glucose: number[]) {
  const coder = hre.ethers.AbiCoder.defaultAbiCoder();
  const payload = hre.ethers.keccak256(
    coder.encode(
      ['address', 'uint256', 'uint256', 'uint256', 'uint256[]', 'uint256[]', 'uint64[2]', 'uint64[2]', 'uint256[]', 'bytes32'],
      [addr, chainId, nonce, deadline, day, stepIndex, data, timeRange, glucose,
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

describe('ChallengeGCM — smoke + sendDailyResultViaRelayer', function () {
  it('deploy + valid relay → settle + relayNonce +1', async function () {
    const { challenger, challenge, startTime, relayer } = await deploy();
    await time.increaseTo(startTime + 100);
    const addr = await challenge.getAddress();
    const chainId = (await hre.ethers.provider.getNetwork()).chainId;
    const day = [startTime + 200];
    const stepIndex = [1500];
    const data: [number, number] = [0, 0];
    const timeRange: [number, number] = [0, 0];
    const glucose: number[] = [100]; // 1 reading trong khoảng [70,180] → đạt goal ngày đó
    const deadline = startTime + 100000;
    const sig = await buildSig(challenger, addr, chainId, 0, deadline, day, stepIndex, data, timeRange, glucose);
    await challenge
      .connect(relayer)
      .sendDailyResultViaRelayer(day, stepIndex, data, '0x', [], [], [], [], [], timeRange, glucose, 0, deadline, sig);
    expect(await challenge.relayNonce(challenger.address)).to.equal(1n);
  });

  it('wrong signer → RelayBadSignature', async function () {
    const { challenge, startTime, relayer, recv1 } = await deploy();
    await time.increaseTo(startTime + 100);
    const addr = await challenge.getAddress();
    const chainId = (await hre.ethers.provider.getNetwork()).chainId;
    const day = [startTime + 200];
    const timeRange: [number, number] = [0, 0];
    const deadline = startTime + 100000;
    const sig = await buildSig(recv1, addr, chainId, 0, deadline, day, [1500], [0, 0], timeRange, []);
    await expect(
      challenge
        .connect(relayer)
        .sendDailyResultViaRelayer(day, [1500], [0, 0], '0x', [], [], [], [], [], timeRange, [], 0, deadline, sig)
    ).to.be.revertedWithCustomError(challenge, 'RelayBadSignature');
  });
});
