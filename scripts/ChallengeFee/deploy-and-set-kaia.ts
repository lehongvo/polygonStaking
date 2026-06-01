/**
 * Deploy ChallengeFee(0, 0) on Kaia mainnet, then call
 * ExerciseSupplementNFT.updateFeeSettingAddress(<new ChallengeFee>).
 *
 * Required because the prior placeholder feeSettingAddress
 * (0x34E26EBc...d3Dc) was an EOA — IChallengeFee(...).getAmountFee()
 * in ChallengeBaseStep constructor would revert.
 *
 * Run:
 *   npm run deploy:fee:kaia
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { ethers, network } from 'hardhat';

const ESN_PROXY = '0x4A0dB5c68d0f7a76D6dBDD7ecf0e96AdEB7027c7';
const SUCCESS_FEE = 0;
const FAIL_FEE = 0;

const KAIA_JSON_PATH = path.join(
  process.cwd(),
  'scripts',
  'contract',
  'kaia.json'
);

async function main() {
  console.log('🚀 CHALLENGE FEE — DEPLOY + WIRE TO ESN (KAIA MAINNET)');
  console.log('=======================================================');

  if (network.name !== 'kaia') {
    console.error(`❌ Only 'kaia', got '${network.name}'`);
    process.exit(1);
  }

  const [deployer] = await ethers.getSigners();
  console.log(`📍 Network:  ${network.name}`);
  console.log(`👤 Deployer: ${deployer.address}`);
  console.log(
    `💰 Balance:  ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} KAIA`
  );

  // 1. Deploy ChallengeFee
  console.log(`\n[1/3] Deploy ChallengeFee(${SUCCESS_FEE}, ${FAIL_FEE})`);
  const Factory = await ethers.getContractFactory('ChallengeFee');
  const fee = await Factory.deploy(SUCCESS_FEE, FAIL_FEE);
  await fee.waitForDeployment();
  const feeAddr = await fee.getAddress();
  const dTx = fee.deploymentTransaction();
  const dRcpt = await dTx?.wait();
  console.log(`     address: ${feeAddr}`);
  console.log(`     tx:      ${dTx?.hash}`);
  console.log(`     gas:     ${dRcpt?.gasUsed?.toString()}`);

  // 2. Verify ChallengeFee on-chain
  console.log('\n[2/3] On-chain verify ChallengeFee.getAmountFee()');
  const r = await (fee as any).getAmountFee();
  console.log(`     successFee: ${r[0]}, failFee: ${r[1]}`);
  if (Number(r[0]) !== SUCCESS_FEE || Number(r[1]) !== FAIL_FEE) {
    console.error('❌ getAmountFee mismatch');
    process.exit(1);
  }

  // 3. ESN.updateFeeSettingAddress(<new>)
  console.log(`\n[3/3] ESN.updateFeeSettingAddress(${feeAddr})`);
  const esn = await ethers.getContractAt(
    'contracts/ExerciseSupplementNFT.sol:ExerciseSupplementNFT',
    ESN_PROXY
  );
  const utx = await esn.updateFeeSettingAddress(feeAddr);
  console.log(`     tx: ${utx.hash}`);
  const urcpt = await utx.wait();
  console.log(`     gas: ${urcpt?.gasUsed?.toString()}`);

  // 4. Read back from ESN
  const onchain = await esn.feeSettingAddress();
  console.log(`\n🔍 ESN.feeSettingAddress() = ${onchain}`);
  if (onchain.toLowerCase() !== feeAddr.toLowerCase()) {
    console.error('❌ ESN feeSettingAddress mismatch!');
    process.exit(1);
  }
  console.log('     ✅ matches new ChallengeFee');

  // 5. Update kaia.json
  const kaiaJson = JSON.parse(fs.readFileSync(KAIA_JSON_PATH, 'utf8'));
  kaiaJson.ChallengeFee = feeAddr;
  fs.writeFileSync(KAIA_JSON_PATH, JSON.stringify(kaiaJson, null, 4) + '\n');
  console.log(`\n💾 kaia.json updated with ChallengeFee: ${feeAddr}`);

  // 6. Audit
  const auditPath = path.join(
    process.cwd(),
    'deployInfo',
    'challenge-fee-kaia.json'
  );
  fs.mkdirSync(path.dirname(auditPath), { recursive: true });
  fs.writeFileSync(
    auditPath,
    JSON.stringify(
      {
        network: network.name,
        chainId: '8217',
        contractName: 'ChallengeFee',
        address: feeAddr,
        constructorArgs: [SUCCESS_FEE, FAIL_FEE],
        deployer: deployer.address,
        deploymentTime: new Date().toISOString(),
        deployTx: dTx?.hash,
        updateFeeSettingTx: utx.hash,
        esnFeeSettingAfter: onchain,
      },
      null,
      2
    ) + '\n'
  );
  console.log(`💾 Audit:    ${auditPath}`);
  console.log(`\n🔗 Explorer: https://kaiascan.io/address/${feeAddr}`);
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('💥 FAILED:', err);
    process.exit(1);
  });
