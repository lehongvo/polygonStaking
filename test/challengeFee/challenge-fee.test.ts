// CHALLENGE-2737: ChallengeFee.sol is deployed live on Kaia mainnet (chainId 8217, address
// 0x074a133a378b04FA936A53DAC4049aAa687FB16E per deployInfo/challenge-fee-kaia.json) and set as
// ExerciseSupplementNFT's feeSetting -- but had zero test coverage in this suite. Smoke +
// access-control coverage for deployment, fee read-back, and the owner-only setter.
import { expect } from 'chai';
import hre from 'hardhat';

const { ethers } = hre as any;

async function deployFixture() {
  const [owner, other] = await ethers.getSigners();
  const Factory = await ethers.getContractFactory('ChallengeFee');
  const fee = await Factory.deploy(10, 20);
  await fee.waitForDeployment();
  return { fee, owner, other };
}

describe('CHALLENGE-2737: ChallengeFee smoke + access control', function () {
  it('constructor sets and getAmountFee reads back the configured success/fail fees', async function () {
    const { fee } = await deployFixture();
    const [successFee, failFee] = await fee.getAmountFee();
    expect(successFee).to.equal(10);
    expect(failFee).to.equal(20);
  });

  it('constructor rejects an out-of-range success fee (>=100)', async function () {
    const Factory = await ethers.getContractFactory('ChallengeFee');
    await expect(Factory.deploy(100, 10)).to.be.reverted;
  });

  it('constructor rejects an out-of-range fail fee (>=100)', async function () {
    const Factory = await ethers.getContractFactory('ChallengeFee');
    await expect(Factory.deploy(10, 100)).to.be.reverted;
  });

  it('deployer is the initial owner', async function () {
    const { fee, owner } = await deployFixture();
    expect(await fee.owner()).to.equal(owner.address);
  });

  it('owner can update fees via setFees, and getAmountFee reflects the change', async function () {
    const { fee, owner } = await deployFixture();
    await fee.connect(owner).setFees(5, 15);
    const [successFee, failFee] = await fee.getAmountFee();
    expect(successFee).to.equal(5);
    expect(failFee).to.equal(15);
  });

  it('setFees emits AmountFee with the new values', async function () {
    const { fee, owner } = await deployFixture();
    await expect(fee.connect(owner).setFees(7, 8)).to.emit(fee, 'AmountFee').withArgs(7, 8);
  });

  it('non-owner cannot call setFees (access-control negative test)', async function () {
    const { fee, other } = await deployFixture();
    await expect(fee.connect(other).setFees(1, 1)).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );
    // Fees must be unchanged after the rejected call.
    const [successFee, failFee] = await fee.getAmountFee();
    expect(successFee).to.equal(10);
    expect(failFee).to.equal(20);
  });

  it('non-owner cannot transfer ownership', async function () {
    const { fee, other } = await deployFixture();
    await expect(fee.connect(other).transferOwnership(other.address)).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );
  });

  it('owner can transfer ownership; the new owner (not the old one) can then call setFees', async function () {
    const { fee, owner, other } = await deployFixture();
    await fee.connect(owner).transferOwnership(other.address);
    expect(await fee.owner()).to.equal(other.address);
    await expect(fee.connect(owner).setFees(1, 1)).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );
    await expect(fee.connect(other).setFees(1, 1)).to.not.be.reverted;
  });
});
