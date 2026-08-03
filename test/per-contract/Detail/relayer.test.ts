import { expect } from 'chai';
import hre from 'hardhat';
import { time } from '@nomicfoundation/hardhat-toolbox/network-helpers.js';

const SUCCESS_FEE = 10;
const FAIL_FEE = 10;

// Adversarial test cho sendDailyResultViaRelayer (meta-tx): challenger ký off-chain, relayer submit.
// ⚠️ Đây là fund-authorization — test này KHÔNG thay thế security audit, nhưng verify các invariant chính.
async function deploy() {
  const [, challenger, feeAddr, returnedNFTWallet, sponsor, recv1, recv2, relayer, attacker] =
    await hre.ethers.getSigners();
  const MockNFT = await hre.ethers.getContractFactory('MockExerciseSupplementNFT');
  const nft = await MockNFT.deploy(returnedNFTWallet.address, SUCCESS_FEE, FAIL_FEE);
  const Factory = await hre.ethers.getContractFactory('ChallengeDetail');
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
    { value: hre.ethers.parseEther('10') }
  );
  return { challenger, challenge, startTime, relayer, attacker };
}

async function buildChallengerSig(
  signer: any,
  challengeAddr: string,
  chainId: bigint,
  nonce: number,
  deadline: number,
  day: number[],
  stepIndex: number[],
  data: [number, number],
  timeRange: [number, number]
) {
  const coder = hre.ethers.AbiCoder.defaultAbiCoder();
  // Tham số NFT/Gacha nay được bind vào chữ ký qua assetHash. Các test này relay với
  // danh sách tài sản rỗng nên hash tương ứng với ('0x', [], [], [], [], []).
  const assetHash = hre.ethers.keccak256(
    coder.encode(
      ['bytes', 'address[]', 'address[]', 'uint256[][]', 'address[][]', 'bool[]'],
      ['0x', [], [], [], [], []]
    )
  );
  const payload = hre.ethers.keccak256(
    coder.encode(
      ['address', 'uint256', 'uint256', 'uint256', 'uint256[]', 'uint256[]', 'uint64[2]', 'uint64[2]', 'bytes32'],
      [challengeAddr, chainId, nonce, deadline, day, stepIndex, data, timeRange, assetHash]
    )
  );
  // signMessage(getBytes(payload)) → ký keccak256("\x19Ethereum Signed Message:\n32" + payload) = ethHash contract
  return signer.signMessage(hre.ethers.getBytes(payload));
}

describe('ChallengeDetail — sendDailyResultViaRelayer (meta-tx, adversarial)', function () {
  it('valid relay: challenger ký, relayer submit → settle + relayNonce +1', async function () {
    const { challenger, challenge, startTime, relayer } = await deploy();
    await time.increaseTo(startTime + 100);
    const addr = await challenge.getAddress();
    const chainId = (await hre.ethers.provider.getNetwork()).chainId;
    const day = [startTime + 200];
    const stepIndex = [1500];
    const data: [number, number] = [0, 0];
    const timeRange: [number, number] = [0, 0];
    const deadline = startTime + 100000;

    const sig = await buildChallengerSig(challenger, addr, chainId, 0, deadline, day, stepIndex, data, timeRange);

    expect(await challenge.relayNonce(challenger.address)).to.equal(0n);
    await challenge
      .connect(relayer)
      .sendDailyResultViaRelayer(day, stepIndex, data, '0x', [], [], [], [], [], timeRange, 0, deadline, sig);
    expect(await challenge.relayNonce(challenger.address)).to.equal(1n); // đã settle + nonce tăng
  });

  it('wrong signer (attacker ký thay challenger) → revert RelayBadSignature', async function () {
    const { challenge, startTime, relayer, attacker } = await deploy();
    await time.increaseTo(startTime + 100);
    const addr = await challenge.getAddress();
    const chainId = (await hre.ethers.provider.getNetwork()).chainId;
    const day = [startTime + 200];
    const stepIndex = [1500];
    const data: [number, number] = [0, 0];
    const timeRange: [number, number] = [0, 0];
    const deadline = startTime + 100000;
    const sig = await buildChallengerSig(attacker, addr, chainId, 0, deadline, day, stepIndex, data, timeRange);
    await expect(
      challenge
        .connect(relayer)
        .sendDailyResultViaRelayer(day, stepIndex, data, '0x', [], [], [], [], [], timeRange, 0, deadline, sig)
    ).to.be.revertedWithCustomError(challenge, 'RelayBadSignature');
  });

  it('replay (dùng lại nonce cũ) → revert RelayBadNonce', async function () {
    const { challenger, challenge, startTime, relayer } = await deploy();
    await time.increaseTo(startTime + 100);
    const addr = await challenge.getAddress();
    const chainId = (await hre.ethers.provider.getNetwork()).chainId;
    const data: [number, number] = [0, 0];
    const timeRange: [number, number] = [0, 0];
    const deadline = startTime + 100000;
    const day1 = [startTime + 200];
    const sig1 = await buildChallengerSig(challenger, addr, chainId, 0, deadline, day1, [1500], data, timeRange);
    await challenge
      .connect(relayer)
      .sendDailyResultViaRelayer(day1, [1500], data, '0x', [], [], [], [], [], timeRange, 0, deadline, sig1);
    // relay lại với nonce=0 (đã dùng) → RelayBadNonce
    await expect(
      challenge
        .connect(relayer)
        .sendDailyResultViaRelayer(day1, [1500], data, '0x', [], [], [], [], [], timeRange, 0, deadline, sig1)
    ).to.be.revertedWithCustomError(challenge, 'RelayBadNonce');
  });

  it('deadline hết hạn → revert RelayExpired', async function () {
    const { challenger, challenge, startTime, relayer } = await deploy();
    await time.increaseTo(startTime + 100);
    const addr = await challenge.getAddress();
    const chainId = (await hre.ethers.provider.getNetwork()).chainId;
    const day = [startTime + 200];
    const data: [number, number] = [0, 0];
    const timeRange: [number, number] = [0, 0];
    const past = startTime + 50; // đã qua (now = startTime+100)
    const sig = await buildChallengerSig(challenger, addr, chainId, 0, past, day, [1500], data, timeRange);
    await expect(
      challenge
        .connect(relayer)
        .sendDailyResultViaRelayer(day, [1500], data, '0x', [], [], [], [], [], timeRange, 0, past, sig)
    ).to.be.revertedWithCustomError(challenge, 'RelayExpired');
  });
});
