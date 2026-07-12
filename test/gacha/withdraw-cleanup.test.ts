import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import hre from 'hardhat';
import { deployGachaFixture, TypeToken } from './fixtures';

const { ethers } = hre as any;

/**
 * Test suite for withdraw + reward cleanup behavior.
 *
 * Covers:
 *   1. withdrawBalances (modified) — auto-cleanup matching reward entries before transfer
 *   2. withdrawBalancesBatch (new) — batch variant with 4 token types and caps
 *   3. Storage state consistency post-cleanup (rewardTokens / listIdToken / unlockRate sum)
 *   4. Edge cases: idempotency, no-match silent skip, multi-match delete-all
 */
describe('Gacha — withdraw with reward cleanup', function () {
  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------
  async function addReward(
    gacha: any,
    owner: any,
    addr: string,
    indexToken: number,
    type: TypeToken,
    rewardValue: number = 1,
    unlockRate: number = 50,
    isMintNft: boolean = false,
    listNft: number[] = [],
    maxAllowed: number = 5
  ) {
    await gacha
      .connect(owner)
      .addNewReward(
        addr,
        unlockRate,
        rewardValue,
        indexToken,
        type,
        isMintNft,
        maxAllowed,
        listNft
      );
  }

  async function getListIdToken(gacha: any): Promise<bigint[]> {
    return await gacha.getListIdToken();
  }

  async function getReward(gacha: any, idx: number) {
    return await gacha.rewardTokens(idx);
  }

  // -----------------------------------------------------------------------
  // Suite 1: withdrawBalances (single, modified)
  // -----------------------------------------------------------------------
  describe('withdrawBalances — auto-cleanup behavior', function () {
    it('rejects caller without CLOSE_GACHA_ROLE', async function () {
      const { gacha, attacker, erc20Reward } =
        await loadFixture(deployGachaFixture);
      await expect(
        gacha
          .connect(attacker)
          .withdrawBalances(
            await erc20Reward.getAddress(),
            0,
            TypeToken.ERC20
          )
      ).to.be.revertedWithCustomError(gacha, 'AccessControlUnauthorizedAccount');
    });

    it('ERC20: withdraws balance and deletes matching reward entry', async function () {
      const { gacha, owner, erc20Reward, returnedNFTWallet } =
        await loadFixture(deployGachaFixture);
      await addReward(
        gacha,
        owner,
        await erc20Reward.getAddress(),
        0,
        TypeToken.ERC20
      );
      await erc20Reward.mint(await gacha.getAddress(), 500n);

      const listBefore = await getListIdToken(gacha);
      expect(listBefore.length).to.equal(1);

      await expect(
        gacha
          .connect(owner)
          .withdrawBalances(
            await erc20Reward.getAddress(),
            0,
            TypeToken.ERC20
          )
      ).to.emit(gacha, 'DeleteReward');

      expect(
        await erc20Reward.balanceOf(returnedNFTWallet.address)
      ).to.equal(500n);
      const listAfter = await getListIdToken(gacha);
      expect(listAfter.length).to.equal(0);
      const reward = await getReward(gacha, listBefore[0]);
      expect(reward.addressToken).to.equal(ethers.ZeroAddress);
    });

    it('ERC1155: withdraws balance for one tokenId and deletes that reward (other tokenIds preserved)', async function () {
      const { gacha, owner, erc1155Reward, returnedNFTWallet } =
        await loadFixture(deployGachaFixture);
      const erc1155Addr = await erc1155Reward.getAddress();
      await addReward(gacha, owner, erc1155Addr, 5, TypeToken.ERC1155);
      await addReward(gacha, owner, erc1155Addr, 7, TypeToken.ERC1155);
      await erc1155Reward.mint(await gacha.getAddress(), 5, 200);
      await erc1155Reward.mint(await gacha.getAddress(), 7, 100);

      expect((await getListIdToken(gacha)).length).to.equal(2);

      await gacha
        .connect(owner)
        .withdrawBalances(erc1155Addr, 5, TypeToken.ERC1155);

      expect(
        await erc1155Reward.balanceOf(returnedNFTWallet.address, 5)
      ).to.equal(200n);
      // tokenId 7 reward must still exist
      const list = await getListIdToken(gacha);
      expect(list.length).to.equal(1);
      const remaining = await getReward(gacha, list[0]);
      expect(remaining.indexToken).to.equal(7n);
    });

    it('NATIVE: withdraws ETH balance and deletes NATIVE reward', async function () {
      const { gacha, owner, returnedNFTWallet } =
        await loadFixture(deployGachaFixture);
      await addReward(
        gacha,
        owner,
        ethers.ZeroAddress,
        0,
        TypeToken.NATIVE_TOKEN
      );
      await owner.sendTransaction({
        to: await gacha.getAddress(),
        value: ethers.parseEther('0.5'),
      });

      const before = await ethers.provider.getBalance(
        returnedNFTWallet.address
      );

      await gacha
        .connect(owner)
        .withdrawBalances(ethers.ZeroAddress, 0, TypeToken.NATIVE_TOKEN);

      const after = await ethers.provider.getBalance(
        returnedNFTWallet.address
      );
      expect(after - before).to.equal(ethers.parseEther('0.5'));
      expect((await getListIdToken(gacha)).length).to.equal(0);
    });

    it('idempotent: re-running withdrawBalances after cleanup does not revert', async function () {
      const { gacha, owner, erc20Reward } =
        await loadFixture(deployGachaFixture);
      await addReward(
        gacha,
        owner,
        await erc20Reward.getAddress(),
        0,
        TypeToken.ERC20
      );
      await erc20Reward.mint(await gacha.getAddress(), 100n);

      await gacha
        .connect(owner)
        .withdrawBalances(await erc20Reward.getAddress(), 0, TypeToken.ERC20);
      // Second call: no reward to delete, no balance to transfer — must not revert
      await expect(
        gacha
          .connect(owner)
          .withdrawBalances(
            await erc20Reward.getAddress(),
            0,
            TypeToken.ERC20
          )
      ).to.not.be.reverted;
    });

    it('silent skip: withdraw token with no matching reward succeeds and transfers balance', async function () {
      const { gacha, owner, erc20Reward, returnedNFTWallet } =
        await loadFixture(deployGachaFixture);
      // No reward registered for this ERC20
      await erc20Reward.mint(await gacha.getAddress(), 250n);

      await expect(
        gacha
          .connect(owner)
          .withdrawBalances(
            await erc20Reward.getAddress(),
            0,
            TypeToken.ERC20
          )
      ).to.not.be.reverted;

      expect(
        await erc20Reward.balanceOf(returnedNFTWallet.address)
      ).to.equal(250n);
    });

    it('multi-match: deletes ALL reward entries with same (token, type) for ERC20', async function () {
      const { gacha, owner, erc20Reward } =
        await loadFixture(deployGachaFixture);
      const addr = await erc20Reward.getAddress();
      await addReward(gacha, owner, addr, 0, TypeToken.ERC20);
      // Note: addNewReward does not enforce uniqueness — admin error simulation
      await addReward(gacha, owner, addr, 0, TypeToken.ERC20);
      expect((await getListIdToken(gacha)).length).to.equal(2);

      await gacha
        .connect(owner)
        .withdrawBalances(addr, 0, TypeToken.ERC20);

      expect((await getListIdToken(gacha)).length).to.equal(0);
    });

    it('multi-match: ERC1155 strict match deletes only same indexToken duplicates', async function () {
      const { gacha, owner, erc1155Reward } =
        await loadFixture(deployGachaFixture);
      const addr = await erc1155Reward.getAddress();
      await addReward(gacha, owner, addr, 5, TypeToken.ERC1155);
      await addReward(gacha, owner, addr, 5, TypeToken.ERC1155); // duplicate
      await addReward(gacha, owner, addr, 7, TypeToken.ERC1155); // different id
      expect((await getListIdToken(gacha)).length).to.equal(3);

      await gacha
        .connect(owner)
        .withdrawBalances(addr, 5, TypeToken.ERC1155);

      const list = await getListIdToken(gacha);
      expect(list.length).to.equal(1);
      const remaining = await getReward(gacha, list[0]);
      expect(remaining.indexToken).to.equal(7n);
    });

    it('emits RewardCleanupCompleted event with correct count', async function () {
      const { gacha, owner, erc20Reward } =
        await loadFixture(deployGachaFixture);
      const addr = await erc20Reward.getAddress();
      await addReward(gacha, owner, addr, 0, TypeToken.ERC20);
      await addReward(gacha, owner, addr, 0, TypeToken.ERC20);

      await expect(
        gacha
          .connect(owner)
          .withdrawBalances(addr, 0, TypeToken.ERC20)
      )
        .to.emit(gacha, 'RewardCleanupCompleted')
        .withArgs(addr, 0, TypeToken.ERC20, 2, await gacha.getAddress());
    });

    it('does NOT emit RewardCleanupCompleted when 0 matches', async function () {
      const { gacha, owner, erc20Reward } =
        await loadFixture(deployGachaFixture);
      // No reward registered
      await erc20Reward.mint(await gacha.getAddress(), 100n);

      const tx = await gacha
        .connect(owner)
        .withdrawBalances(
          await erc20Reward.getAddress(),
          0,
          TypeToken.ERC20
        );
      const receipt = await tx.wait();
      const cleanupEvent = receipt.logs.find((log: any) => {
        try {
          const parsed = gacha.interface.parseLog(log);
          return parsed?.name === 'RewardCleanupCompleted';
        } catch {
          return false;
        }
      });
      expect(cleanupEvent).to.be.undefined;
    });

    it('zero-balance withdraw still cleans up matching reward', async function () {
      const { gacha, owner, erc20Reward } =
        await loadFixture(deployGachaFixture);
      await addReward(
        gacha,
        owner,
        await erc20Reward.getAddress(),
        0,
        TypeToken.ERC20
      );
      // Balance is 0 — no transfer happens but cleanup should still run
      expect((await getListIdToken(gacha)).length).to.equal(1);

      await gacha
        .connect(owner)
        .withdrawBalances(await erc20Reward.getAddress(), 0, TypeToken.ERC20);

      expect((await getListIdToken(gacha)).length).to.equal(0);
    });

    it('post-cleanup: addNewReward can re-use the freed slot', async function () {
      const { gacha, owner, erc20Reward } =
        await loadFixture(deployGachaFixture);
      const addr = await erc20Reward.getAddress();
      await addReward(gacha, owner, addr, 0, TypeToken.ERC20);
      const listBefore = await getListIdToken(gacha);
      const slotIdx = listBefore[0];

      await gacha.connect(owner).withdrawBalances(addr, 0, TypeToken.ERC20);
      expect((await getListIdToken(gacha)).length).to.equal(0);

      // Add new reward — should reuse slot 1
      await addReward(gacha, owner, addr, 0, TypeToken.ERC20);
      const listAfter = await getListIdToken(gacha);
      expect(listAfter.length).to.equal(1);
      // Slot index should be the same (1)
      expect(listAfter[0]).to.equal(slotIdx);
    });
  });

  // -----------------------------------------------------------------------
  // Suite 2: withdrawBalancesBatch
  // -----------------------------------------------------------------------
  describe('withdrawBalancesBatch — outer/inner validation', function () {
    it('rejects caller without CLOSE_GACHA_ROLE', async function () {
      const { gacha, attacker, erc20Reward } =
        await loadFixture(deployGachaFixture);
      await expect(
        gacha
          .connect(attacker)
          .withdrawBalancesBatch(
            [await erc20Reward.getAddress()],
            [[]],
            [TypeToken.ERC20]
          )
      ).to.be.revertedWithCustomError(gacha, 'AccessControlUnauthorizedAccount');
    });

    it('reverts EMPTY BATCH on empty addresses', async function () {
      const { gacha, owner } = await loadFixture(deployGachaFixture);
      await expect(
        gacha.connect(owner).withdrawBalancesBatch([], [], [])
      ).to.be.revertedWithCustomError(gacha, 'EmptyBatch');
    });

    it('reverts TOO MANY CONTRACTS when > 10 addresses', async function () {
      const { gacha, owner, erc20Reward } =
        await loadFixture(deployGachaFixture);
      const addr = await erc20Reward.getAddress();
      const addresses = Array(11).fill(addr);
      const indexTokens = Array(11).fill([]);
      const types = Array(11).fill(TypeToken.ERC20);
      await expect(
        gacha
          .connect(owner)
          .withdrawBalancesBatch(addresses, indexTokens, types)
      ).to.be.revertedWithCustomError(gacha, 'TooManyContracts');
    });

    it('reverts INDEX TOKENS LENGTH MISMATCH', async function () {
      const { gacha, owner, erc20Reward } =
        await loadFixture(deployGachaFixture);
      await expect(
        gacha
          .connect(owner)
          .withdrawBalancesBatch(
            [await erc20Reward.getAddress()],
            [[], []],
            [TypeToken.ERC20]
          )
      ).to.be.revertedWithCustomError(gacha, 'IndexTokensLengthMismatch');
    });

    it('reverts TYPE TOKENS LENGTH MISMATCH', async function () {
      const { gacha, owner, erc20Reward } =
        await loadFixture(deployGachaFixture);
      await expect(
        gacha
          .connect(owner)
          .withdrawBalancesBatch(
            [await erc20Reward.getAddress()],
            [[]],
            [TypeToken.ERC20, TypeToken.ERC20]
          )
      ).to.be.revertedWithCustomError(gacha, 'TypeTokensLengthMismatch');
    });

    it('reverts TOO MANY IDS when inner > 20', async function () {
      const { gacha, owner, erc1155Reward } =
        await loadFixture(deployGachaFixture);
      const ids = Array.from({ length: 21 }, (_, i) => i + 1);
      await expect(
        gacha
          .connect(owner)
          .withdrawBalancesBatch(
            [await erc1155Reward.getAddress()],
            [ids],
            [TypeToken.ERC1155]
          )
      ).to.be.revertedWithCustomError(gacha, 'TooManyIds');
    });

    it('reverts NATIVE NO IDS when ids passed for NATIVE', async function () {
      const { gacha, owner } = await loadFixture(deployGachaFixture);
      await expect(
        gacha
          .connect(owner)
          .withdrawBalancesBatch(
            [ethers.ZeroAddress],
            [[1]],
            [TypeToken.NATIVE_TOKEN]
          )
      ).to.be.revertedWithCustomError(gacha, 'NativeNoIds');
    });

    it('reverts ZERO ADDRESS when NATIVE has non-zero address', async function () {
      const { gacha, owner, erc20Reward } =
        await loadFixture(deployGachaFixture);
      await expect(
        gacha
          .connect(owner)
          .withdrawBalancesBatch(
            [await erc20Reward.getAddress()],
            [[]],
            [TypeToken.NATIVE_TOKEN]
          )
      ).to.be.revertedWithCustomError(gacha, 'ZeroAddress');
    });

    it('reverts ERC20 MAX 1 ID when more than 1 id for ERC20', async function () {
      const { gacha, owner, erc20Reward } =
        await loadFixture(deployGachaFixture);
      await expect(
        gacha
          .connect(owner)
          .withdrawBalancesBatch(
            [await erc20Reward.getAddress()],
            [[1, 2]],
            [TypeToken.ERC20]
          )
      ).to.be.revertedWithCustomError(gacha, 'Erc20Max1Id');
    });

    it('reverts INVALID TOKEN when ERC20 address is zero', async function () {
      const { gacha, owner } = await loadFixture(deployGachaFixture);
      await expect(
        gacha
          .connect(owner)
          .withdrawBalancesBatch(
            [ethers.ZeroAddress],
            [[]],
            [TypeToken.ERC20]
          )
      ).to.be.revertedWithCustomError(gacha, 'InvalidToken');
    });

    it('reverts EMPTY IDS when ERC721 has no ids', async function () {
      const { gacha, owner, erc721Reward } =
        await loadFixture(deployGachaFixture);
      await expect(
        gacha
          .connect(owner)
          .withdrawBalancesBatch(
            [await erc721Reward.getAddress()],
            [[]],
            [TypeToken.ERC721]
          )
      ).to.be.revertedWithCustomError(gacha, 'EmptyIds');
    });

    it('reverts EMPTY IDS when ERC1155 has no ids', async function () {
      const { gacha, owner, erc1155Reward } =
        await loadFixture(deployGachaFixture);
      await expect(
        gacha
          .connect(owner)
          .withdrawBalancesBatch(
            [await erc1155Reward.getAddress()],
            [[]],
            [TypeToken.ERC1155]
          )
      ).to.be.revertedWithCustomError(gacha, 'EmptyIds');
    });
  });

  describe('withdrawBalancesBatch — success per type', function () {
    it('NATIVE: withdraws all ETH balance with cleanup', async function () {
      const { gacha, owner, returnedNFTWallet } =
        await loadFixture(deployGachaFixture);
      await addReward(
        gacha,
        owner,
        ethers.ZeroAddress,
        0,
        TypeToken.NATIVE_TOKEN
      );
      await owner.sendTransaction({
        to: await gacha.getAddress(),
        value: ethers.parseEther('0.3'),
      });
      const before = await ethers.provider.getBalance(
        returnedNFTWallet.address
      );

      await gacha
        .connect(owner)
        .withdrawBalancesBatch(
          [ethers.ZeroAddress],
          [[]],
          [TypeToken.NATIVE_TOKEN]
        );

      const after = await ethers.provider.getBalance(
        returnedNFTWallet.address
      );
      expect(after - before).to.equal(ethers.parseEther('0.3'));
      expect((await getListIdToken(gacha)).length).to.equal(0);
    });

    it('ERC20: empty ids → withdraws + cleans up reward registered with id=0', async function () {
      const { gacha, owner, erc20Reward, returnedNFTWallet } =
        await loadFixture(deployGachaFixture);
      const addr = await erc20Reward.getAddress();
      await addReward(gacha, owner, addr, 0, TypeToken.ERC20);
      await erc20Reward.mint(await gacha.getAddress(), 1000n);

      await gacha
        .connect(owner)
        .withdrawBalancesBatch([addr], [[]], [TypeToken.ERC20]);

      expect(
        await erc20Reward.balanceOf(returnedNFTWallet.address)
      ).to.equal(1000n);
      expect((await getListIdToken(gacha)).length).to.equal(0);
    });

    it('ERC20: with single id passed (used as lookup hint)', async function () {
      const { gacha, owner, erc20Reward, returnedNFTWallet } =
        await loadFixture(deployGachaFixture);
      const addr = await erc20Reward.getAddress();
      await addReward(gacha, owner, addr, 0, TypeToken.ERC20);
      await erc20Reward.mint(await gacha.getAddress(), 500n);

      await gacha
        .connect(owner)
        .withdrawBalancesBatch([addr], [[0]], [TypeToken.ERC20]);

      expect(
        await erc20Reward.balanceOf(returnedNFTWallet.address)
      ).to.equal(500n);
    });

    it('ERC721: transfers multiple tokenIds + cleans up all ERC721 rewards for address', async function () {
      const { gacha, owner, erc721Reward, returnedNFTWallet } =
        await loadFixture(deployGachaFixture);
      const addr = await erc721Reward.getAddress();
      // Add 2 ERC721 rewards (mint mode — no listNft tokenIds needed)
      await addReward(
        gacha,
        owner,
        addr,
        0,
        TypeToken.ERC721,
        1,
        50,
        true,
        []
      );
      await addReward(
        gacha,
        owner,
        addr,
        0,
        TypeToken.ERC721,
        1,
        50,
        true,
        []
      );

      // Mint 3 NFTs to the gacha contract
      const gachaAddr = await gacha.getAddress();
      await erc721Reward.mint(gachaAddr, 1);
      await erc721Reward.mint(gachaAddr, 2);
      await erc721Reward.mint(gachaAddr, 3);

      await gacha
        .connect(owner)
        .withdrawBalancesBatch(
          [addr],
          [[1, 2, 3]],
          [TypeToken.ERC721]
        );

      expect(await erc721Reward.ownerOf(1)).to.equal(returnedNFTWallet.address);
      expect(await erc721Reward.ownerOf(2)).to.equal(returnedNFTWallet.address);
      expect(await erc721Reward.ownerOf(3)).to.equal(returnedNFTWallet.address);
      // Both ERC721 rewards deleted (matched by addr+type)
      expect((await getListIdToken(gacha)).length).to.equal(0);
    });

    it('ERC1155: transfers multiple tokenIds via safeBatchTransferFrom + per-id cleanup', async function () {
      const { gacha, owner, erc1155Reward, returnedNFTWallet } =
        await loadFixture(deployGachaFixture);
      const addr = await erc1155Reward.getAddress();
      const gachaAddr = await gacha.getAddress();

      await addReward(gacha, owner, addr, 1, TypeToken.ERC1155);
      await addReward(gacha, owner, addr, 2, TypeToken.ERC1155);
      await addReward(gacha, owner, addr, 3, TypeToken.ERC1155);

      await erc1155Reward.mint(gachaAddr, 1, 100);
      await erc1155Reward.mint(gachaAddr, 2, 200);
      await erc1155Reward.mint(gachaAddr, 3, 300);

      await gacha
        .connect(owner)
        .withdrawBalancesBatch(
          [addr],
          [[1, 2, 3]],
          [TypeToken.ERC1155]
        );

      expect(
        await erc1155Reward.balanceOf(returnedNFTWallet.address, 1)
      ).to.equal(100n);
      expect(
        await erc1155Reward.balanceOf(returnedNFTWallet.address, 2)
      ).to.equal(200n);
      expect(
        await erc1155Reward.balanceOf(returnedNFTWallet.address, 3)
      ).to.equal(300n);
      // All 3 ERC1155 rewards deleted
      expect((await getListIdToken(gacha)).length).to.equal(0);
    });

    it('ERC1155: zero-balance ids are filtered out (still cleans up rewards)', async function () {
      const { gacha, owner, erc1155Reward, returnedNFTWallet } =
        await loadFixture(deployGachaFixture);
      const addr = await erc1155Reward.getAddress();
      const gachaAddr = await gacha.getAddress();

      await addReward(gacha, owner, addr, 1, TypeToken.ERC1155);
      await addReward(gacha, owner, addr, 2, TypeToken.ERC1155);

      // Only mint id=1; id=2 has 0 balance
      await erc1155Reward.mint(gachaAddr, 1, 50);

      await expect(
        gacha
          .connect(owner)
          .withdrawBalancesBatch(
            [addr],
            [[1, 2]],
            [TypeToken.ERC1155]
          )
      ).to.not.be.reverted;

      expect(
        await erc1155Reward.balanceOf(returnedNFTWallet.address, 1)
      ).to.equal(50n);
      expect(
        await erc1155Reward.balanceOf(returnedNFTWallet.address, 2)
      ).to.equal(0n);
      // Both rewards still cleaned up
      expect((await getListIdToken(gacha)).length).to.equal(0);
    });

    it('mixed types in single batch: ERC20 + ERC721 + ERC1155 + NATIVE all succeed', async function () {
      const { gacha, owner, erc20Reward, erc721Reward, erc1155Reward, returnedNFTWallet } =
        await loadFixture(deployGachaFixture);
      const erc20Addr = await erc20Reward.getAddress();
      const erc721Addr = await erc721Reward.getAddress();
      const erc1155Addr = await erc1155Reward.getAddress();
      const gachaAddr = await gacha.getAddress();

      // Add rewards
      await addReward(gacha, owner, erc20Addr, 0, TypeToken.ERC20);
      await addReward(
        gacha,
        owner,
        erc721Addr,
        0,
        TypeToken.ERC721,
        1,
        50,
        true,
        []
      );
      await addReward(gacha, owner, erc1155Addr, 5, TypeToken.ERC1155);
      await addReward(
        gacha,
        owner,
        ethers.ZeroAddress,
        0,
        TypeToken.NATIVE_TOKEN
      );

      // Fund gacha
      await erc20Reward.mint(gachaAddr, 100n);
      await erc721Reward.mint(gachaAddr, 1);
      await erc1155Reward.mint(gachaAddr, 5, 30);
      await owner.sendTransaction({
        to: gachaAddr,
        value: ethers.parseEther('0.1'),
      });

      const ethBefore = await ethers.provider.getBalance(
        returnedNFTWallet.address
      );

      await gacha
        .connect(owner)
        .withdrawBalancesBatch(
          [erc20Addr, erc721Addr, erc1155Addr, ethers.ZeroAddress],
          [[], [1], [5], []],
          [
            TypeToken.ERC20,
            TypeToken.ERC721,
            TypeToken.ERC1155,
            TypeToken.NATIVE_TOKEN,
          ]
        );

      expect(await erc20Reward.balanceOf(returnedNFTWallet.address)).to.equal(
        100n
      );
      expect(await erc721Reward.ownerOf(1)).to.equal(returnedNFTWallet.address);
      expect(
        await erc1155Reward.balanceOf(returnedNFTWallet.address, 5)
      ).to.equal(30n);
      expect(
        (await ethers.provider.getBalance(returnedNFTWallet.address)) - ethBefore
      ).to.equal(ethers.parseEther('0.1'));
      // All 4 rewards cleaned
      expect((await getListIdToken(gacha)).length).to.equal(0);
    });

    it('idempotent re-run of empty batch path (no rewards, no balances)', async function () {
      const { gacha, owner, erc20Reward } =
        await loadFixture(deployGachaFixture);
      // No rewards, no balances
      await expect(
        gacha
          .connect(owner)
          .withdrawBalancesBatch(
            [await erc20Reward.getAddress()],
            [[]],
            [TypeToken.ERC20]
          )
      ).to.not.be.reverted;
    });

    it('post-state: listIdToken consistent after multi-type batch', async function () {
      const { gacha, owner, erc20Reward, erc1155Reward } =
        await loadFixture(deployGachaFixture);
      const erc20Addr = await erc20Reward.getAddress();
      const erc1155Addr = await erc1155Reward.getAddress();
      const gachaAddr = await gacha.getAddress();

      // Setup: 2 ERC20 rewards (different unlockRate), 1 ERC1155 reward
      await addReward(gacha, owner, erc20Addr, 0, TypeToken.ERC20, 1, 30);
      await addReward(gacha, owner, erc20Addr, 0, TypeToken.ERC20, 1, 70);
      await addReward(gacha, owner, erc1155Addr, 5, TypeToken.ERC1155);
      expect((await getListIdToken(gacha)).length).to.equal(3);

      await erc20Reward.mint(gachaAddr, 100n);
      await erc1155Reward.mint(gachaAddr, 5, 50);

      // Withdraw only ERC20 — both ERC20 rewards should be cleaned, ERC1155 preserved
      await gacha
        .connect(owner)
        .withdrawBalancesBatch([erc20Addr], [[]], [TypeToken.ERC20]);

      const list = await getListIdToken(gacha);
      expect(list.length).to.equal(1);
      const remaining = await getReward(gacha, list[0]);
      expect(remaining.typeToken).to.equal(BigInt(TypeToken.ERC1155));
    });
  });

  // -----------------------------------------------------------------------
  // Suite 3: deleteReward (refactor — must not regress)
  // -----------------------------------------------------------------------
  describe('deleteReward (refactor regression)', function () {
    it('public deleteReward still works for UPDATER_REWARDS_ROLE caller', async function () {
      const { gacha, owner, erc20Reward } =
        await loadFixture(deployGachaFixture);
      await addReward(
        gacha,
        owner,
        await erc20Reward.getAddress(),
        0,
        TypeToken.ERC20
      );
      const list = await getListIdToken(gacha);
      expect(list.length).to.equal(1);

      await expect(gacha.connect(owner).deleteReward(list[0]))
        .to.emit(gacha, 'DeleteReward')
        .withArgs(owner.address, list[0], await gacha.getAddress());

      expect((await getListIdToken(gacha)).length).to.equal(0);
    });

    it('public deleteReward rejects non-UPDATER_REWARDS_ROLE caller', async function () {
      const { gacha, attacker } = await loadFixture(deployGachaFixture);
      await expect(
        gacha.connect(attacker).deleteReward(1)
      ).to.be.revertedWithCustomError(gacha, 'AccessControlUnauthorizedAccount');
    });

    it('public deleteReward reverts on non-existent index', async function () {
      const { gacha, owner } = await loadFixture(deployGachaFixture);
      await expect(
        gacha.connect(owner).deleteReward(999)
      ).to.be.revertedWithCustomError(gacha, 'IndexOfTokenRewardNotExist');
    });
  });
});
