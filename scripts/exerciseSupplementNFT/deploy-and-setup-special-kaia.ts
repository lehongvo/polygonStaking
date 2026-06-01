/**
 * Deploy ExerciseSupplementNFTSpecial1 + Special2 on Kaia mainnet AND
 * fully configure the existing ExerciseSupplementNFT proxy.
 *
 * 16 sequential txs:
 *   Phase 1 (2 deploys):
 *     1. Deploy Special1 (constructor: baseURI1)
 *     2. Deploy Special2 (constructor: baseURI2)
 *   Phase 2 (grant admin on each Special so ESN proxy can mint):
 *     3. Special1.updateAdmin(ESN_proxy, true)
 *     4. Special2.updateAdmin(ESN_proxy, true)
 *   Phase 3 (configure ESN proxy):
 *     5.  updateSecurityAddress
 *     6.  updateSpecialNftAddress(S1, true)
 *     7.  updateSpecialNftAddress(S2, true)
 *     8.  setBaseURI
 *     9.  updateToleranceAmount(1,1)
 *     10. updateListERC20Address(TTJP, true)
 *     11. updateNftListAddress(ESN_proxy, true, true)
 *     12. updateDonationWalletAddress
 *     13. updateFeeSettingAddress
 *     14. updateReturnedNFTWallet
 *     15. updateSpecialConditionInfo(...)
 *     16. grantRole(UPDATER_ACTIVITIES_ROLE, ...)
 *
 * Run:
 *   npm run deploy:special:kaia
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { ethers, network } from 'hardhat';

// ------------------------------------------------------------------
// HARD-CODED CONFIG (mainnet, must match user instructions exactly)
// ------------------------------------------------------------------
const ESN_PROXY = '0x4A0dB5c68d0f7a76D6dBDD7ecf0e96AdEB7027c7';
const TTJP_PROXY = '0x78627D9a195eaceCcf33A550D0d9EB857Ed98Ac1';

const SPECIAL1_BASE_URI =
  'ipfs://QmTTVzAyvbsUS2jbCLCXAuQ7Gy3vDbRxzKS2jnD8xjGZwp/';
const SPECIAL2_BASE_URI =
  'ipfs://QmNjBQidKr3z1KxEWzq8zGf8S3dt2usHgxxqSjSZeMkCYo/';

const ESN_BASE_URI = 'ipfs://QmWkeGA2DCkKZMwLU2M7H6eGPTy6hT8siTjC8PSS76m1h2/';

const SECURITY_ADDRESS = '0x9A266044a5e5010C101169766F9cC7BE18bB111e';
const DONATION_WALLET = '0xe400DAC7164A042288eaa9FE5CD63f9F974c30a6';
const FEE_SETTING_ADDRESS = '0x34E26EBc7659D489e40bAfBC1B41ab8f70FBd3Dc';
const RETURNED_NFT_WALLET = '0x1B224b4da437d26d0b47c185A58163D1319335B2';

const UPDATER_GRANTEE = '0xe9c11C331fC68230fC900349b2d290b48c5A0862';

const SPECIAL_COND = {
  targetStepPerDay: 1_000_000n,
  challengeDuration: 10_000n,
  amountDepositMatic: 100n,
  amountDepositTTJP: 100n,
  amountDepositJPYC: 100n,
  dividendSuccess: 98n,
};

const TOLERANCE_AMOUNT_SUCCESS = 1n;
const TOLERANCE_AMOUNT_FAILED = 1n;

const KAIA_JSON_PATH = path.join(
  process.cwd(),
  'scripts',
  'contract',
  'kaia.json'
);
const AUDIT_PATH = path.join(
  process.cwd(),
  'deployInfo',
  'exercise-supplement-setup-kaia.json'
);

const txLog: Array<{ step: number; label: string; hash: string; gasUsed: string }> = [];

async function step<T>(
  num: number,
  label: string,
  fn: () => Promise<{ tx: { hash: string }; receipt: { gasUsed: bigint } } | T>
): Promise<T> {
  console.log(`\n[${num}/16] ${label}`);
  const start = Date.now();
  const result: any = await fn();
  if (result && result.tx && result.receipt) {
    const { tx, receipt } = result;
    txLog.push({
      step: num,
      label,
      hash: tx.hash,
      gasUsed: receipt.gasUsed.toString(),
    });
    console.log(`     tx: ${tx.hash}`);
    console.log(
      `     gas used: ${receipt.gasUsed.toString()}, took ${((Date.now() - start) / 1000).toFixed(1)}s`
    );
  }
  return result as T;
}

async function main() {
  console.log(
    '🚀 EXERCISE SUPPLEMENT — SPECIAL DEPLOY + ESN PROXY SETUP (KAIA MAINNET)'
  );
  console.log(
    '========================================================================'
  );

  if (network.name !== 'kaia') {
    console.error(`❌ This script only supports network 'kaia', got '${network.name}'`);
    process.exit(1);
  }

  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`📍 Network:  ${network.name} (8217)`);
  console.log(`👤 Deployer: ${deployer.address}`);
  console.log(`💰 Balance:  ${ethers.formatEther(balance)} KAIA`);
  console.log(`🎯 ESN Proxy:  ${ESN_PROXY}`);
  console.log(`🎯 TTJP Proxy: ${TTJP_PROXY}`);

  if (balance < ethers.parseEther('0.5')) {
    console.error(`❌ Need at least 0.5 KAIA`);
    process.exit(1);
  }

  // ----------------------------------------------------------------
  // PHASE 1 — Deploy Special1 + Special2
  // ----------------------------------------------------------------
  console.log('\n🏗️  PHASE 1 — DEPLOY SPECIAL1 + SPECIAL2');
  console.log('=========================================');

  const FQN1 =
    'contracts/ExerciseSupplementNFTSpecial1/ExerciseSupplementNFTSpecial1.sol:ExerciseSupplementNFTSpecial';
  const FQN2 =
    'contracts/ExerciseSupplementNFTSpecial1/ExerciseSupplementNFTSpecial2.sol:ExerciseSupplementNFTSpecial';

  const F1 = await ethers.getContractFactory(FQN1);
  const F2 = await ethers.getContractFactory(FQN2);

  const special1 = await step(1, `Deploy Special1 (baseURI=${SPECIAL1_BASE_URI})`, async () => {
    const c = await F1.deploy(SPECIAL1_BASE_URI);
    await c.waitForDeployment();
    const tx = c.deploymentTransaction()!;
    const receipt = (await tx.wait())!;
    console.log(`     address: ${await c.getAddress()}`);
    return { c, tx, receipt };
  });
  const S1_ADDR = await (special1 as any).c.getAddress();

  const special2 = await step(2, `Deploy Special2 (baseURI=${SPECIAL2_BASE_URI})`, async () => {
    const c = await F2.deploy(SPECIAL2_BASE_URI);
    await c.waitForDeployment();
    const tx = c.deploymentTransaction()!;
    const receipt = (await tx.wait())!;
    console.log(`     address: ${await c.getAddress()}`);
    return { c, tx, receipt };
  });
  const S2_ADDR = await (special2 as any).c.getAddress();

  // ----------------------------------------------------------------
  // PHASE 2 — Grant admin on Special1/2 to ESN proxy
  // ----------------------------------------------------------------
  console.log('\n🔑 PHASE 2 — GRANT ADMIN ON SPECIALS → ESN PROXY');
  console.log('=================================================');

  const s1 = (special1 as any).c;
  const s2 = (special2 as any).c;

  await step(3, `Special1.updateAdmin(${ESN_PROXY}, true)`, async () => {
    const tx = await s1.updateAdmin(ESN_PROXY, true);
    const receipt = await tx.wait();
    return { tx, receipt };
  });

  await step(4, `Special2.updateAdmin(${ESN_PROXY}, true)`, async () => {
    const tx = await s2.updateAdmin(ESN_PROXY, true);
    const receipt = await tx.wait();
    return { tx, receipt };
  });

  // ----------------------------------------------------------------
  // PHASE 3 — Configure ESN proxy
  // ----------------------------------------------------------------
  console.log('\n⚙️  PHASE 3 — CONFIGURE ESN PROXY');
  console.log('=================================');

  const esn = await ethers.getContractAt(
    'contracts/ExerciseSupplementNFT.sol:ExerciseSupplementNFT',
    ESN_PROXY
  );

  await step(5, `updateSecurityAddress(${SECURITY_ADDRESS})`, async () => {
    const tx = await esn.updateSecurityAddress(SECURITY_ADDRESS);
    const receipt = await tx.wait();
    return { tx, receipt };
  });

  await step(6, `updateSpecialNftAddress(${S1_ADDR}, true)`, async () => {
    const tx = await esn.updateSpecialNftAddress(S1_ADDR, true);
    const receipt = await tx.wait();
    return { tx, receipt };
  });

  await step(7, `updateSpecialNftAddress(${S2_ADDR}, true)`, async () => {
    const tx = await esn.updateSpecialNftAddress(S2_ADDR, true);
    const receipt = await tx.wait();
    return { tx, receipt };
  });

  await step(8, `setBaseURI(${ESN_BASE_URI})`, async () => {
    const tx = await esn.setBaseURI(ESN_BASE_URI);
    const receipt = await tx.wait();
    return { tx, receipt };
  });

  await step(
    9,
    `updateToleranceAmount(${TOLERANCE_AMOUNT_SUCCESS}, ${TOLERANCE_AMOUNT_FAILED})`,
    async () => {
      const tx = await esn.updateToleranceAmount(
        TOLERANCE_AMOUNT_SUCCESS,
        TOLERANCE_AMOUNT_FAILED
      );
      const receipt = await tx.wait();
      return { tx, receipt };
    }
  );

  await step(10, `updateListERC20Address(TTJP=${TTJP_PROXY}, true)`, async () => {
    const tx = await esn.updateListERC20Address(TTJP_PROXY, true);
    const receipt = await tx.wait();
    return { tx, receipt };
  });

  await step(
    11,
    `updateNftListAddress(ESN_proxy=${ESN_PROXY}, true, true)`,
    async () => {
      const tx = await esn.updateNftListAddress(ESN_PROXY, true, true);
      const receipt = await tx.wait();
      return { tx, receipt };
    }
  );

  await step(12, `updateDonationWalletAddress(${DONATION_WALLET})`, async () => {
    const tx = await esn.updateDonationWalletAddress(DONATION_WALLET);
    const receipt = await tx.wait();
    return { tx, receipt };
  });

  await step(13, `updateFeeSettingAddress(${FEE_SETTING_ADDRESS})`, async () => {
    const tx = await esn.updateFeeSettingAddress(FEE_SETTING_ADDRESS);
    const receipt = await tx.wait();
    return { tx, receipt };
  });

  await step(14, `updateReturnedNFTWallet(${RETURNED_NFT_WALLET})`, async () => {
    const tx = await esn.updateReturnedNFTWallet(RETURNED_NFT_WALLET);
    const receipt = await tx.wait();
    return { tx, receipt };
  });

  await step(
    15,
    `updateSpecialConditionInfo(${SPECIAL_COND.targetStepPerDay}, ${SPECIAL_COND.challengeDuration}, ${SPECIAL_COND.amountDepositMatic}, ${SPECIAL_COND.amountDepositTTJP}, ${SPECIAL_COND.amountDepositJPYC}, ${SPECIAL_COND.dividendSuccess})`,
    async () => {
      const tx = await esn.updateSpecialConditionInfo(
        SPECIAL_COND.targetStepPerDay,
        SPECIAL_COND.challengeDuration,
        SPECIAL_COND.amountDepositMatic,
        SPECIAL_COND.amountDepositTTJP,
        SPECIAL_COND.amountDepositJPYC,
        SPECIAL_COND.dividendSuccess
      );
      const receipt = await tx.wait();
      return { tx, receipt };
    }
  );

  const UPDATER_ROLE = await esn.UPDATER_ACTIVITIES_ROLE();
  await step(16, `grantRole(UPDATER_ACTIVITIES_ROLE, ${UPDATER_GRANTEE})`, async () => {
    const tx = await esn.grantRole(UPDATER_ROLE, UPDATER_GRANTEE);
    const receipt = await tx.wait();
    return { tx, receipt };
  });

  // ----------------------------------------------------------------
  // PERSIST: kaia.json + audit
  // ----------------------------------------------------------------
  console.log('\n💾 PERSIST');
  console.log('==========');

  const kaiaJson = JSON.parse(fs.readFileSync(KAIA_JSON_PATH, 'utf8'));
  kaiaJson.ExerciseSupplementNFTSpecial1 = S1_ADDR;
  kaiaJson.ExerciseSupplementNFTSpecial2 = S2_ADDR;
  fs.writeFileSync(KAIA_JSON_PATH, JSON.stringify(kaiaJson, null, 4) + '\n');
  console.log(`   updated ${KAIA_JSON_PATH}`);
  console.log(`     ExerciseSupplementNFTSpecial1: ${S1_ADDR}`);
  console.log(`     ExerciseSupplementNFTSpecial2: ${S2_ADDR}`);

  const auditInfo = {
    network: network.name,
    chainId: '8217',
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      ExerciseSupplementNFTProxy: ESN_PROXY,
      ExerciseSupplementNFTSpecial1: S1_ADDR,
      ExerciseSupplementNFTSpecial2: S2_ADDR,
      TTJPProxy: TTJP_PROXY,
    },
    config: {
      SECURITY_ADDRESS,
      DONATION_WALLET,
      FEE_SETTING_ADDRESS,
      RETURNED_NFT_WALLET,
      UPDATER_GRANTEE,
      ESN_BASE_URI,
      SPECIAL1_BASE_URI,
      SPECIAL2_BASE_URI,
      SPECIAL_COND: {
        targetStepPerDay: SPECIAL_COND.targetStepPerDay.toString(),
        challengeDuration: SPECIAL_COND.challengeDuration.toString(),
        amountDepositMatic: SPECIAL_COND.amountDepositMatic.toString(),
        amountDepositTTJP: SPECIAL_COND.amountDepositTTJP.toString(),
        amountDepositJPYC: SPECIAL_COND.amountDepositJPYC.toString(),
        dividendSuccess: SPECIAL_COND.dividendSuccess.toString(),
      },
      TOLERANCE_AMOUNT_SUCCESS: TOLERANCE_AMOUNT_SUCCESS.toString(),
      TOLERANCE_AMOUNT_FAILED: TOLERANCE_AMOUNT_FAILED.toString(),
    },
    txs: txLog,
  };
  fs.mkdirSync(path.dirname(AUDIT_PATH), { recursive: true });
  fs.writeFileSync(AUDIT_PATH, JSON.stringify(auditInfo, null, 2) + '\n');
  console.log(`   audit saved → ${AUDIT_PATH}`);

  // ----------------------------------------------------------------
  // FINAL REPORT
  // ----------------------------------------------------------------
  console.log('\n📊 FINAL REPORT');
  console.log('===============');
  console.log(`Special1:          ${S1_ADDR}`);
  console.log(`Special2:          ${S2_ADDR}`);
  console.log(`Explorer Special1: https://kaiascan.io/address/${S1_ADDR}`);
  console.log(`Explorer Special2: https://kaiascan.io/address/${S2_ADDR}`);
  console.log(`\nAll 16 txs logged in ${AUDIT_PATH}`);

  const totalGas = txLog.reduce((sum, t) => sum + BigInt(t.gasUsed), 0n);
  console.log(`Total gas used:    ${totalGas.toString()}`);

  const finalBalance = await ethers.provider.getBalance(deployer.address);
  console.log(
    `Deployer balance:  ${ethers.formatEther(balance)} → ${ethers.formatEther(finalBalance)} KAIA (spent ${ethers.formatEther(balance - finalBalance)})`
  );
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('💥 SETUP FAILED:', err);
    console.error('\n⚠️  Partial state on-chain. Last successful txs:');
    for (const t of txLog) console.error(`  [${t.step}] ${t.label} → ${t.hash}`);
    process.exit(1);
  });
