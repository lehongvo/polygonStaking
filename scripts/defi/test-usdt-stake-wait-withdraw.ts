import hre, { ethers } from 'hardhat';
import * as fs from 'fs';

async function main() {
  console.log('🧪 USDT STAKE → WAIT 60S → WITHDRAW');
  console.log('===================================');

  const [deployer] = await ethers.getSigners();
  console.log('👤 Deployer:', deployer.address);

  const deploymentInfo = JSON.parse(
    fs.readFileSync(
      `${process.cwd()}/deployInfo/polygon-defi-aggregator.json`,
      'utf8'
    )
  );
  const contractAddress: string = deploymentInfo.contractAddress;
  console.log('📋 Aggregator:', contractAddress);

  const aggregator = await ethers.getContractAt(
    'PolygonDeFiAggregator',
    contractAddress
  );

  const USDT = '0xc2132D05D31c914a87C6611C10748AEb04B58e8F';
  const amount = ethers.parseUnits('0.0001', 6); // 100 units

  // Approve if needed
  const usdt = await ethers.getContractAt(
    '@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20',
    USDT
  );
  const bal = await usdt.balanceOf(deployer.address);
  console.log('💳 USDT Balance:', ethers.formatUnits(bal, 6));
  if (bal < amount) {
    throw new Error('Insufficient USDT');
  }

  const allowance = await usdt.allowance(deployer.address, contractAddress);
  if (allowance < amount) {
    console.log('⏳ Approving USDT...');
    const tx = await usdt.approve(contractAddress, amount);
    await tx.wait();
    console.log('✅ Approved');
  }

  console.log('\n🏗️ Staking 0.0001 USDT...');
  const lock = 86400; // 1 day (minimum required by contract)
  // Estimate gas for staking
  const stakeGas = await aggregator.createTimeLockedStake.estimateGas(
    USDT,
    amount,
    'aave_lending',
    lock
  );
  console.log('⛽ Estimated gas (stake):', stakeGas.toString());
  const tx = await aggregator.createTimeLockedStake(
    USDT,
    amount,
    'aave_lending',
    lock,
    {
      gasLimit: (stakeGas * 120n) / 100n,
    }
  );
  const rc = await tx.wait();
  console.log('✅ Staked. Gas:', rc.gasUsed.toString());

  // Find stakeId from event
  let stakeId: bigint | null = null;
  for (const log of rc.logs) {
    try {
      const parsed = aggregator.interface.parseLog(log);
      if (parsed?.name === 'TimeLockedStakeCreated') {
        stakeId = parsed.args.stakeId as bigint;
        break;
      }
    } catch {}
  }
  if (stakeId === null) throw new Error('No stakeId found');
  console.log('🆔 StakeId:', stakeId.toString());

  console.log(
    "⏳ Waiting ~60 seconds before withdrawing (contract doesn't enforce maturity on withdraw)..."
  );
  await new Promise(r => setTimeout(r, 60_000));

  console.log('\n💰 Withdrawing...');
  try {
    // Estimate gas for withdrawal
    const withdrawGas = await aggregator.withdrawTimeLockedStake.estimateGas(
      stakeId,
      deployer.address
    );
    console.log('⛽ Estimated gas (withdraw):', withdrawGas.toString());
    const wtx = await aggregator.withdrawTimeLockedStake(
      stakeId,
      deployer.address,
      {
        gasLimit: (withdrawGas * 120n) / 100n,
      }
    );
    const wrc = await wtx.wait();
    console.log('✅ Withdrawn. Gas:', wrc.gasUsed.toString());

    for (const log of wrc.logs) {
      try {
        const parsed = aggregator.interface.parseLog(log);
        if (parsed?.name === 'TimeLockedStakeWithdrawn') {
          console.log(
            '📊 amountWithdrawn:',
            ethers.formatUnits(parsed.args.amountWithdrawn, 6),
            'USDT'
          );
          console.log(
            '📈 rewards:',
            ethers.formatUnits(parsed.args.rewards, 6),
            'USDT'
          );
          console.log(
            '🏷️ systemFee:',
            ethers.formatUnits(parsed.args.systemFee, 6),
            'USDT'
          );
        }
      } catch {}
    }
  } catch (e: any) {
    console.log('❌ Withdraw failed:', e.message);
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
