import { expect } from 'chai';
import hre from 'hardhat';
import { time } from '@nomicfoundation/hardhat-toolbox/network-helpers.js';

const SUCCESS_FEE = 10;
const FAIL_FEE = 10;

// Adversarial test relayer cho ChallengeBaseStep (14 params — verify payload encoding NHIỀU params
// khác ChallengeDetail). ⚠️ FUND-AUTH — không thay audit.
async function deploy() {
  const [, challenger, feeAddr, returnedNFTWallet, sponsor, recv1, recv2, relayer, attacker] =
    await hre.ethers.getSigners();
  const MockNFT = await hre.ethers.getContractFactory('MockExerciseSupplementNFT');
  const nft = await MockNFT.deploy(returnedNFTWallet.address, SUCCESS_FEE, FAIL_FEE);
  const Factory = await hre.ethers.getContractFactory('ChallengeBaseStep');
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
    [],
    [],
    { value: hre.ethers.parseEther('10') }
  );
  return { challenger, challenge, startTime, relayer, attacker };
}

// Tham số NFT/Gacha điều khiển chuyển tài sản — phải nằm trong chữ ký (assetHash).
type Assets = {
  signature: string;
  gacha: string[];
  nft: string[];
  indexNFT: number[][];
  sender: string[][];
  statusTypeNft: boolean[];
};

const EMPTY_ASSETS: Assets = { signature: '0x', gacha: [], nft: [], indexNFT: [], sender: [], statusTypeNft: [] };

function assetHashOf(a: Assets) {
  const coder = hre.ethers.AbiCoder.defaultAbiCoder();
  return hre.ethers.keccak256(
    coder.encode(
      ['bytes', 'address[]', 'address[]', 'uint256[][]', 'address[][]', 'bool[]'],
      [a.signature, a.gacha, a.nft, a.indexNFT, a.sender, a.statusTypeNft]
    )
  );
}

// BaseStep payload: address(this), chainid, nonce, deadline, _day, _stepIndex, _data, _timeRange,
// _intervals, _totalSeconds, _minutesAtTargetSpeed, _metsWalkingSpeed, assetHash.
async function buildSig(signer: any, addr: string, chainId: bigint, nonce: number, deadline: number,
  day: number[], stepIndex: number[], data: [number, number], timeRange: [number, number],
  intervals: number[], totalSeconds: number[], minutesAtTargetSpeed: number[], metsWalkingSpeed: number[],
  assets: Assets = EMPTY_ASSETS) {
  const coder = hre.ethers.AbiCoder.defaultAbiCoder();
  const payload = hre.ethers.keccak256(
    coder.encode(
      ['address', 'uint256', 'uint256', 'uint256', 'uint256[]', 'uint256[]', 'uint64[2]', 'uint64[2]', 'uint256[]', 'uint256[]', 'uint256[]', 'uint256[]', 'bytes32'],
      [addr, chainId, nonce, deadline, day, stepIndex, data, timeRange, intervals, totalSeconds, minutesAtTargetSpeed, metsWalkingSpeed, assetHashOf(assets)]
    )
  );
  return signer.signMessage(hre.ethers.getBytes(payload));
}

describe('ChallengeBaseStep — sendDailyResultViaRelayer (multi-param payload)', function () {
  it('valid relay (14 params) → settle + relayNonce +1', async function () {
    const { challenger, challenge, startTime, relayer } = await deploy();
    await time.increaseTo(startTime + 100);
    const addr = await challenge.getAddress();
    const chainId = (await hre.ethers.provider.getNetwork()).chainId;
    const day = [startTime + 200];
    const stepIndex = [1500];
    const data: [number, number] = [0, 0];
    const timeRange: [number, number] = [0, 0];
    const deadline = startTime + 100000;
    const sig = await buildSig(challenger, addr, chainId, 0, deadline, day, stepIndex, data, timeRange, [], [], [], []);
    await challenge
      .connect(relayer)
      .sendDailyResultViaRelayer(day, stepIndex, data, '0x', [], [], [], [], [], timeRange, [], [], [], [], 0, deadline, sig);
    expect(await challenge.relayNonce(challenger.address)).to.equal(1n);
  });

  it('wrong signer → RelayBadSignature', async function () {
    const { challenge, startTime, relayer, attacker } = await deploy();
    await time.increaseTo(startTime + 100);
    const addr = await challenge.getAddress();
    const chainId = (await hre.ethers.provider.getNetwork()).chainId;
    const day = [startTime + 200];
    const timeRange: [number, number] = [0, 0];
    const deadline = startTime + 100000;
    const sig = await buildSig(attacker, addr, chainId, 0, deadline, day, [1500], [0, 0], timeRange, [], [], [], []);
    await expect(
      challenge
        .connect(relayer)
        .sendDailyResultViaRelayer(day, [1500], [0, 0], '0x', [], [], [], [], [], timeRange, [], [], [], [], 0, deadline, sig)
    ).to.be.revertedWithCustomError(challenge, 'RelayBadSignature');
  });

  // Chữ ký PHẢI bind các tham số điều khiển chuyển tài sản. Trước fix, relayer tái dùng được
  // chữ ký hợp lệ của challenger rồi tự thay người nhận NFT / target Gacha.
  it('relayer đổi _listSenderAddress (người nhận NFT) → RelayBadSignature', async function () {
    const { challenger, challenge, startTime, relayer, attacker } = await deploy();
    await time.increaseTo(startTime + 100);
    const addr = await challenge.getAddress();
    const chainId = (await hre.ethers.provider.getNetwork()).chainId;
    const day = [startTime + 200];
    const stepIndex = [1500];
    const data: [number, number] = [0, 0];
    const timeRange: [number, number] = [0, 0];
    const deadline = startTime + 100000;
    // Challenger ký với danh sách tài sản RỖNG.
    const sig = await buildSig(challenger, addr, chainId, 0, deadline, day, stepIndex, data, timeRange, [], [], [], [], EMPTY_ASSETS);
    // Relayer độc hại giữ nguyên chữ ký nhưng nhét địa chỉ của mình làm người nhận NFT.
    await expect(
      challenge
        .connect(relayer)
        .sendDailyResultViaRelayer(day, stepIndex, data, '0x', [], [], [], [[attacker.address]], [true], timeRange, [], [], [], [], 0, deadline, sig)
    ).to.be.revertedWithCustomError(challenge, 'RelayBadSignature');
  });

  it('relayer đổi _listGachaAddress (target Gacha) → RelayBadSignature', async function () {
    const { challenger, challenge, startTime, relayer, attacker } = await deploy();
    await time.increaseTo(startTime + 100);
    const addr = await challenge.getAddress();
    const chainId = (await hre.ethers.provider.getNetwork()).chainId;
    const day = [startTime + 200];
    const stepIndex = [1500];
    const data: [number, number] = [0, 0];
    const timeRange: [number, number] = [0, 0];
    const deadline = startTime + 100000;
    const sig = await buildSig(challenger, addr, chainId, 0, deadline, day, stepIndex, data, timeRange, [], [], [], [], EMPTY_ASSETS);
    await expect(
      challenge
        .connect(relayer)
        .sendDailyResultViaRelayer(day, stepIndex, data, '0x', [attacker.address], [], [], [], [], timeRange, [], [], [], [], 0, deadline, sig)
    ).to.be.revertedWithCustomError(challenge, 'RelayBadSignature');
  });

  it('assetHash khớp → relay vẫn chạy bình thường (không phá luồng hợp lệ)', async function () {
    const { challenger, challenge, startTime, relayer, attacker } = await deploy();
    await time.increaseTo(startTime + 100);
    const addr = await challenge.getAddress();
    const chainId = (await hre.ethers.provider.getNetwork()).chainId;
    const day = [startTime + 200];
    const stepIndex = [1500];
    const data: [number, number] = [0, 0];
    const timeRange: [number, number] = [0, 0];
    const deadline = startTime + 100000;
    // Challenger CHỦ ĐỘNG ký kèm đúng bộ tài sản sẽ dùng → phải pass.
    const assets: Assets = { signature: '0x', gacha: [], nft: [], indexNFT: [], sender: [[attacker.address]], statusTypeNft: [true] };
    const sig = await buildSig(challenger, addr, chainId, 0, deadline, day, stepIndex, data, timeRange, [], [], [], [], assets);
    await challenge
      .connect(relayer)
      .sendDailyResultViaRelayer(day, stepIndex, data, '0x', [], [], [], [[attacker.address]], [true], timeRange, [], [], [], [], 0, deadline, sig);
    expect(await challenge.relayNonce(challenger.address)).to.equal(1n);
  });
});
