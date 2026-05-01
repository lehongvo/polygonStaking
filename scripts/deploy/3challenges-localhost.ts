import hre from 'hardhat';

/**
 * Deploys MockExerciseSupplementNFT + 3 patched Challenge contracts to localhost.
 * Used to verify deployment flow works end-to-end on a real Hardhat network.
 */
async function main() {
  const signers = await hre.ethers.getSigners();
  const [sponsor, challenger, feeAddr, returnedNFTWallet, recv1, recv2] =
    signers;

  console.log('Deployer:', sponsor.address);

  const MockNFT = await hre.ethers.getContractFactory(
    'MockExerciseSupplementNFT'
  );
  const nft = await MockNFT.deploy(returnedNFTWallet.address, 5, 10);
  await nft.waitForDeployment();
  console.log('MockExerciseSupplementNFT:', await nft.getAddress());

  const now = Math.floor(Date.now() / 1000);
  const startTime = now + 60;
  const duration = 30;
  const endTime = startTime + duration * 86400;

  const stakeHolders = [sponsor.address, challenger.address, feeAddr.address];
  const erc721 = [await nft.getAddress()];
  const awardReceivers = [recv1.address, recv2.address];
  const totalAmount = hre.ethers.parseEther('100');
  const allowGiveUp = [true, true, false];
  const gasData = [0, 0, 0];

  // ChallengeBaseStep
  const BaseStep = await hre.ethers.getContractFactory('ChallengeBaseStep');
  const c1 = await BaseStep.deploy(
    stakeHolders,
    hre.ethers.ZeroAddress,
    erc721,
    [duration, startTime, endTime, 1000, 20],
    awardReceivers,
    1,
    allowGiveUp,
    gasData,
    false,
    [50, 40],
    totalAmount,
    [],
    [],
    { value: totalAmount }
  );
  await c1.waitForDeployment();
  console.log('ChallengeBaseStep:', await c1.getAddress());

  // ChallengeDetail
  const Detail = await hre.ethers.getContractFactory('ChallengeDetail');
  const c2 = await Detail.deploy(
    stakeHolders,
    hre.ethers.ZeroAddress,
    erc721,
    [duration, startTime, endTime, 1000, 20],
    awardReceivers,
    1,
    allowGiveUp,
    gasData,
    false,
    [50, 40],
    totalAmount,
    { value: totalAmount }
  );
  await c2.waitForDeployment();
  console.log('ChallengeDetail:   ', await c2.getAddress());

  // ChallengeHIIT
  const HIIT = await hre.ethers.getContractFactory('ChallengeHIIT');
  const c3 = await HIIT.deploy(
    stakeHolders,
    hre.ethers.ZeroAddress,
    erc721,
    [duration, startTime, endTime, 0, 5, 20],
    awardReceivers,
    1,
    allowGiveUp,
    gasData,
    false,
    [50, 40],
    totalAmount,
    { value: totalAmount }
  );
  await c3.waitForDeployment();
  console.log('ChallengeHIIT:     ', await c3.getAddress());

  // Sanity reads
  console.log('---- Sanity reads ----');
  console.log('C1 challenger:', await c1.challenger());
  console.log('C1 isFinished:', await c1.isFinished());
  console.log('C2 challenger:', await c2.challenger());
  console.log('C3 challenger:', await c3.challenger());
  console.log('C3 highIntensityIntervals:', await c3.highIntensityIntervals());

  // Sanity: try to deploy with bad percent → should revert
  console.log('---- N1 invariant negative test ----');
  try {
    const bad = await BaseStep.deploy(
      stakeHolders,
      hre.ethers.ZeroAddress,
      erc721,
      [duration, startTime, endTime, 1000, 20],
      awardReceivers,
      1,
      allowGiveUp,
      gasData,
      false,
      [60, 60],
      totalAmount,
      [],
      [],
      { value: totalAmount }
    );
    await bad.waitForDeployment();
    console.error('ERROR: deploy with sum 120 should have reverted');
    process.exit(1);
  } catch (e: any) {
    if (e.message.includes('Sum of percents exceeds 100')) {
      console.log('OK: N1 invariant fired correctly');
    } else {
      console.error('Unexpected error:', e.message);
      process.exit(1);
    }
  }

  console.log('All deployments + sanity checks passed');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
