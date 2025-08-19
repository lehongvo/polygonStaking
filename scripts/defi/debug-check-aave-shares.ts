import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';

const hre = require('hardhat');

async function main() {
  const [signer] = await hre.ethers.getSigners();
  console.log('🔍 Debug Aave Shares vs aToken');
  console.log('==============================');
  console.log(`👤 Signer: ${signer.address}`);

  const deploymentPath = path.join(process.cwd(), 'deployInfo', 'polygon-defi-deployment.json');
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  const contractAddress = deployment.contractAddress;
  console.log(`📋 Contract: ${contractAddress}`);

  const wmatic = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270';
  const aPolWM = '0x6d80113e533a2C0fe82EaBD35f1875DcEA89Ea97';

  const DeFiAggregatorFactory = await hre.ethers.getContractFactory('PolygonDeFiAggregator');
  const contract = DeFiAggregatorFactory.attach(contractAddress).connect(signer);

  const stakes = await contract.getUserTimeLockedStakes(signer.address);
  console.log(`📊 Stakes: ${stakes.length}`);
  if (stakes.length === 0) {
    console.log('❌ No stakes');
    return;
  }
  const lastId = stakes.length - 1;
  const s = stakes[lastId];
  console.log(`🆔 StakeId=${lastId}, amount=${hre.ethers.formatEther(s.amount)}, shares=${s.shares.toString()}, token=${s.stakingToken}, protocol=${s.protocol}`);

  // Read total shares mapping
  const totalShares = await contract.tokenProtocolTotalShares(wmatic, 'aave_lending');
  console.log(`📈 tokenProtocolTotalShares = ${totalShares.toString()}`);

  const aToken = await hre.ethers.getContractAt('IERC20', aPolWM);
  const aTokenBal = await aToken.balanceOf(contractAddress);
  console.log(`🏦 aPolWM balance: ${hre.ethers.formatEther(aTokenBal)}`);

  try {
    const gas = await contract.withdrawTimeLockedStake.estimateGas(lastId);
    console.log(`⛽ withdraw gas estimate: ${gas.toString()}`);
  } catch (e: any) {
    console.log(`❌ withdraw gas estimation failed: ${e.message}`);
  }
}

main().then(()=>process.exit(0)).catch((e)=>{console.error(e);process.exit(1)});

