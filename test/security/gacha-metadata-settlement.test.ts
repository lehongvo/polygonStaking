// CHALLENGE-2830: Gacha settlement must not call optional token metadata (name()) during
// reward delivery — ERC1155 has no name(), and malformed metadata must not brick settlement.
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import hre from 'hardhat';
import {
  deployGachaFixture,
  callRandomRewards,
  setRandomResult,
  TypeToken,
} from '../gacha/fixtures';

const { ethers } = hre as any;

describe('CHALLENGE-2830: Gacha settlement without token metadata', function () {
  it('settles ERC1155 rewards from a token contract without name()', async function () {
    const { gacha, owner, challenger, challenge, vrfClassic } =
      await loadFixture(deployGachaFixture);

    const ERC1155NoName = await ethers.getContractFactory('MockGachaERC1155NoName');
    const erc1155NoName = await ERC1155NoName.deploy();
    await erc1155NoName.waitForDeployment();
    await erc1155NoName.mint(await gacha.getAddress(), 3, 100);

    await gacha.connect(owner).updateRewardRateAndMaxAllowed(0, 0, 0);
    await gacha.connect(owner).addNewReward(
      await erc1155NoName.getAddress(),
      100,
      25,
      3,
      TypeToken.ERC1155,
      false,
      5,
      []
    );

    await setRandomResult(vrfClassic, 0);
    await expect(callRandomRewards(challenge, gacha)).to.not.be.reverted;

    expect(await erc1155NoName.balanceOf(challenger.address, 3)).to.equal(25n);

    const info = await gacha.userInfor(challenger.address);
    expect(info.statusRandom).to.equal(true);
    expect(info.nameReward).to.equal('');
    expect(info.tokenAddress).to.equal(await erc1155NoName.getAddress());
  });

  it('emits GachaRewardDelivered with canonical fields for off-chain name resolution', async function () {
    const { gacha, owner, challenger, challenge, erc20Reward, vrfClassic } =
      await loadFixture(deployGachaFixture);

    await gacha.connect(owner).updateRewardRateAndMaxAllowed(0, 0, 0);
    await gacha.connect(owner).addNewReward(
      await erc20Reward.getAddress(),
      100,
      50n,
      0,
      TypeToken.ERC20,
      false,
      5,
      []
    );
    await erc20Reward.mint(await gacha.getAddress(), 1000n);
    await setRandomResult(vrfClassic, 0);

    await expect(challenge.callRandomRewards(await gacha.getAddress(), [5000]))
      .to.emit(gacha, 'GachaRewardDelivered')
      .withArgs(
        challenger.address,
        await erc20Reward.getAddress(),
        TypeToken.ERC20,
        0,
        50n,
        1
      );
  });
});
