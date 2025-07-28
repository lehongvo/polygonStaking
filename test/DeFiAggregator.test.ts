import { expect } from 'chai';
import { ethers } from 'hardhat';

describe('PolygonDeFiAggregator', function () {
  let defiAggregator: any;
  let testToken: any;
  let owner: any;
  let user: any;

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();

    // Deploy test token
    const TestTokenFactory = await ethers.getContractFactory('TestToken');
    testToken = await TestTokenFactory.deploy(
      'Polygon Test',
      'POL',
      18,
      1000000
    );
    await testToken.waitForDeployment();

    // Deploy DeFi Aggregator
    const DeFiAggregatorFactory = await ethers.getContractFactory(
      'PolygonDeFiAggregator'
    );
    defiAggregator = await DeFiAggregatorFactory.deploy(
      await testToken.getAddress()
    );
    await defiAggregator.waitForDeployment();
  });

  describe('Deployment', function () {
    it('Should deploy with correct POL token address', async function () {
      const polTokenAddress = await defiAggregator.polToken();
      const testTokenAddress = await testToken.getAddress();
      expect(polTokenAddress).to.equal(testTokenAddress);
    });

    it('Should set owner correctly', async function () {
      const contractOwner = await defiAggregator.owner();
      expect(contractOwner).to.equal(owner.address);
    });
  });

  describe('Protocol Management', function () {
    it('Should add protocol successfully', async function () {
      const protocolName = 'test-protocol';
      const protocolAddress = '0x1234567890123456789012345678901234567890';
      const rewardToken = await testToken.getAddress();
      const protocolType = 'liquid';
      const initialAPY = 1000; // 10%

      await defiAggregator.addProtocol(
        protocolName,
        protocolAddress,
        rewardToken,
        protocolType,
        initialAPY
      );

      const protocolInfo = await defiAggregator.getProtocolInfo(protocolName);
      expect(protocolInfo.contractAddress).to.equal(protocolAddress);
      expect(protocolInfo.isActive).to.be.true;
      expect(protocolInfo.currentAPY).to.equal(initialAPY);
    });

    it('Should fail when non-owner tries to add protocol', async function () {
      const protocolName = 'test-protocol';
      const protocolAddress = '0x1234567890123456789012345678901234567890';
      const rewardToken = await testToken.getAddress();
      const protocolType = 'liquid';
      const initialAPY = 1000;

      await expect(
        defiAggregator
          .connect(user)
          .addProtocol(
            protocolName,
            protocolAddress,
            rewardToken,
            protocolType,
            initialAPY
          )
      ).to.be.revertedWithCustomError(
        defiAggregator,
        'OwnableUnauthorizedAccount'
      );
    });
  });

  describe('Staking', function () {
    beforeEach(async function () {
      // Add a test protocol
      await defiAggregator.addProtocol(
        'test-protocol',
        '0x1234567890123456789012345678901234567890',
        await testToken.getAddress(),
        'liquid',
        1000
      );

      // Mint tokens to user
      await testToken.mint(user.address, ethers.parseEther('1000'));
    });

    it('Should stake tokens successfully', async function () {
      const stakeAmount = ethers.parseEther('100');

      await testToken
        .connect(user)
        .approve(await defiAggregator.getAddress(), stakeAmount);

      await defiAggregator.connect(user).stake(stakeAmount, 'test-protocol');

      const userPosition = await defiAggregator.getUserPosition(
        user.address,
        'test-protocol'
      );
      expect(userPosition.stakedAmount).to.equal(stakeAmount);
    });

    it('Should fail when staking to non-existent protocol', async function () {
      const stakeAmount = ethers.parseEther('100');

      await testToken
        .connect(user)
        .approve(await defiAggregator.getAddress(), stakeAmount);

      await expect(
        defiAggregator.connect(user).stake(stakeAmount, 'non-existent')
      ).to.be.revertedWith('Protocol not found');
    });
  });
});
