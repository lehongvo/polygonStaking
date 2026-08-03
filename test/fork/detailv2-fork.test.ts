import { expect } from 'chai';
import hre from 'hardhat';
import { time } from '@nomicfoundation/hardhat-toolbox/network-helpers.js';

// Fork-test cho ChallengeDetailV2 (constructor gọi WMATIC/Aave — chỉ deploy được trên fork polygon).
// Dùng RPC công khai (không cần .env/key), KHÔNG deploy chain thật. Verify deploy + relayer.
const RPC = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com';

describe('ChallengeDetailV2 — fork polygon (WMATIC/Aave)', function () {
  this.timeout(180000);

  before(async function () {
    try {
      await hre.network.provider.request({
        method: 'hardhat_reset',
        params: [{ forking: { jsonRpcUrl: RPC } }],
      });
    } catch (e) {
      this.skip();
    }
  });

  after(async function () {
    // reset về local (không fork) để không ảnh hưởng test khác
    await hre.network.provider.request({ method: 'hardhat_reset', params: [] });
  });

  it('deploy DetailV2 + relayer valid (smoke)', async function () {
    const ethers = (hre as any).ethers;
    const [, challenger, feeAddr, returnedNFTWallet, sponsor, recv1, recv2, relayer] =
      await ethers.getSigners();
    const MockNFT = await ethers.getContractFactory('MockExerciseSupplementNFT');
    const nft = await MockNFT.deploy(returnedNFTWallet.address, 10, 10);
    const Factory = await ethers.getContractFactory('ChallengeDetailV2');
    const block = await ethers.provider.getBlock('latest');
    const startTime = block!.timestamp + 60;
    const duration = 5;
    const endTime = startTime + duration * 86400;
    let challenge;
    try {
      challenge = await Factory.deploy(
        [sponsor.address, challenger.address, feeAddr.address],
        ethers.ZeroAddress,
        [await nft.getAddress()],
        [duration, startTime, endTime, 1000, 4],
        [recv1.address, recv2.address],
        1,
        [true, true, false],
        [0, 0, 0],
        false,
        [50, 40],
        ethers.parseEther('10'),
        0,
        { value: ethers.parseEther('10') }
      );
      await challenge.waitForDeployment();
    } catch (e: any) {
      // Fork/Aave phụ thuộc hạ tầng ngoài → nếu deploy fail vì môi trường, skip (không phải lỗi relayer).
      console.log('DetailV2 fork deploy skipped:', e.message?.split('\n')[0]);
      this.skip();
      return;
    }
    expect(await challenge.relayNonce(challenger.address)).to.equal(0n);

    // Relayer adversarial: valid (challenger ký) → settle + nonce++; wrong-signer → RelayBadSignature.
    await time.increaseTo(startTime + 100);
    const addr = await challenge.getAddress();
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const day = [startTime + 200];
    const stepIndex = [1500];
    const data: [number, number] = [0, 0];
    const timeRange: [number, number] = [0, 0];
    const deadline = startTime + 100000;
    const coder = ethers.AbiCoder.defaultAbiCoder();
    const buildSig = (signer: any, nonce: number) => {
      const payload = ethers.keccak256(
        coder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256[]', 'uint256[]', 'uint64[2]', 'uint64[2]', 'bytes32'],
          [addr, chainId, nonce, deadline, day, stepIndex, data, timeRange,
            // assetHash cho danh sách tài sản rỗng ('0x', [], [], [], [], []).
            hre.ethers.keccak256(
              coder.encode(
                ['bytes', 'address[]', 'address[]', 'uint256[][]', 'address[][]', 'bool[]'],
                ['0x', [], [], [], [], []]
              )
            )]
        )
      );
      return signer.signMessage(ethers.getBytes(payload));
    };
    // valid
    await challenge
      .connect(relayer)
      .sendDailyResultViaRelayer(day, stepIndex, data, '0x', [], [], [], [], [], timeRange, 0, deadline, await buildSig(challenger, 0));
    expect(await challenge.relayNonce(challenger.address)).to.equal(1n);
    // wrong signer (recv1 ký thay) → RelayBadSignature
    await expect(
      challenge
        .connect(relayer)
        .sendDailyResultViaRelayer(day, stepIndex, data, '0x', [], [], [], [], [], timeRange, 1, deadline, await buildSig(recv1, 1))
    ).to.be.revertedWithCustomError(challenge, 'RelayBadSignature');
  });
});
