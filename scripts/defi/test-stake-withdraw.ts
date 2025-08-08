import * as fs from 'fs';
import { ethers } from 'hardhat';
import * as path from 'path';

async function main() {
  console.log('🧪 Testing Stake and Withdraw Immediately');
  console.log('=========================================');

  const [signer] = await ethers.getSigners();
  console.log(`👤 Signer: ${signer.address}`);
  console.log(
    `💰 Balance: ${ethers.formatEther(await ethers.provider.getBalance(signer.address))} MATIC`
  );

  // Load deployment info
  const deploymentPath = path.join(
    __dirname,
    '../../deployInfo/polygon-defi-deployment.json'
  );
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));

  const contractAddress = deployment.contractAddress;
  const ttjpAddress = deployment.tokens.TTJP;
  const polAddress = deployment.tokens.POL;

  console.log(`📋 Contract: ${contractAddress}`);
  console.log(`🪙 TTJP: ${ttjpAddress}`);
  console.log(`🪙 POL: ${polAddress}`);

  // Connect to contracts
  const defiAggregator = await ethers.getContractAt(
    'PolygonDeFiAggregator',
    contractAddress
  );
  const ttjpToken = await ethers.getContractAt('IERC20', ttjpAddress);
  const polToken = await ethers.getContractAt('IERC20', polAddress);

  // Check balances
  console.log('\n💰 Current Token Balances:');
  const ttjpBalance = await ttjpToken.balanceOf(signer.address);
  const polBalance = await polToken.balanceOf(signer.address);
  console.log(`TTJP: ${ethers.formatEther(ttjpBalance)}`);
  console.log(`POL: ${ethers.formatEther(polBalance)}`);

  // Choose token to stake (use POL if available, otherwise TTJP)
  let tokenToStake, tokenContract, tokenSymbol;
  const stakeAmount = ethers.parseEther('0.01'); // 1 token

  if (polBalance >= stakeAmount) {
    tokenToStake = polAddress;
    tokenContract = polToken;
    tokenSymbol = 'POL';
  } else if (ttjpBalance >= stakeAmount) {
    tokenToStake = ttjpAddress;
    tokenContract = ttjpToken;
    tokenSymbol = 'TTJP';
  } else {
    console.error('❌ Insufficient token balance for staking');
    return;
  }

  console.log(`\n🎯 Using ${tokenSymbol} for staking`);

  // Step 1: Approve tokens
  console.log('\n📝 Step 1: Approving tokens...');
  const approveTx = await tokenContract.approve(contractAddress, stakeAmount);
  await approveTx.wait();
  console.log('✅ Tokens approved');

  // Check allowance
  const allowance = await tokenContract.allowance(
    signer.address,
    contractAddress
  );
  console.log(`💳 Allowance: ${ethers.formatEther(allowance)} ${tokenSymbol}`);

  // Step 2: Stake tokens
  console.log('\n🚀 Step 2: Staking tokens...');
  const stakeTx = await defiAggregator.stake(
    tokenToStake,
    stakeAmount,
    'aave_lending'
  );
  await stakeTx.wait();
  console.log(`✅ Staked ${ethers.formatEther(stakeAmount)} ${tokenSymbol}`);

  // Check stake info
  const stakeInfo = await defiAggregator.getUserTokenProtocolPosition(
    signer.address,
    tokenToStake,
    'aave_lending'
  );
  console.log(
    `📊 Stake Amount: ${ethers.formatEther(stakeInfo.balance)} ${tokenSymbol}`
  );
  console.log(
    `⏰ Stake Time: ${new Date(Number(stakeInfo.timestamp) * 1000).toLocaleString()}`
  );

  // Step 3: Wait a moment (optional)
  console.log('\n⏳ Waiting 5 seconds...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Step 4: Withdraw immediately
  console.log('\n💸 Step 3: Withdrawing immediately...');
  const withdrawTx = await defiAggregator.withdrawImmediately(
    tokenToStake,
    stakeAmount,
    'aave_lending'
  );
  await withdrawTx.wait();
  console.log(
    `✅ Withdrew ${ethers.formatEther(stakeAmount)} ${tokenSymbol} immediately`
  );

  // Check final balances
  console.log('\n💰 Final Token Balances:');
  const finalTtjpBalance = await ttjpToken.balanceOf(signer.address);
  const finalPolBalance = await polToken.balanceOf(signer.address);
  console.log(`TTJP: ${ethers.formatEther(finalTtjpBalance)}`);
  console.log(`POL: ${ethers.formatEther(finalPolBalance)}`);

  // Check if stake is cleared
  const finalStakeInfo = await defiAggregator.getUserTokenProtocolPosition(
    signer.address,
    tokenToStake,
    'aave_lending'
  );
  console.log(
    `📊 Final Stake Amount: ${ethers.formatEther(finalStakeInfo.balance || 0)} ${tokenSymbol}`
  );

  console.log('\n🎉 Stake and Withdraw test completed!');
  console.log('=====================================');
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('💥 Test failed:', error);
    process.exit(1);
  });
