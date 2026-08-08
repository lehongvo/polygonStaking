import 'dotenv/config';
import * as fs from 'fs';
import { network, run } from 'hardhat';
import * as path from 'path';
import { grantAllChallengeRoles } from '../grantChallengeRole';

const hre = require('hardhat');

interface ChallengeDeploymentConfig {
  stakeHolders: string[];
  createByToken: string;
  erc721Addresses: string[];
  primaryRequired: number[];
  awardReceivers: string[];
  index: number;
  allowGiveUp: boolean[];
  gasData: string[];
  allAwardToSponsorWhenGiveUp: boolean;
  awardReceiversPercent: number[];
  totalAmount: string;
  // ChallengeBaseStep extras. Optional; default to empty arrays.
  walkingSpeedData?: number[];
  hiitData?: number[];
}

const ERC20_ABI = [
  'function transfer(address to, uint256 value) returns (bool)',
  'function approve(address spender, uint256 value) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
];

async function main() {
  console.log('🚀 CHALLENGE DETAIL V2 (WITH TOKEN) DEPLOYMENT');
  console.log('===============================================');

  const [deployer] = await hre.ethers.getSigners();
  console.log(`📍 Network: ${network.name}`);
  console.log(`👤 Deployer: ${deployer.address}`);
  console.log(
    `💰 Balance: ${hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address))} ETH`
  );

  let config: ChallengeDeploymentConfig | any;

  // Pick the env var name based on network: polygon uses the legacy name,
  // sepolia uses the _SEPOLIA suffix.
  const ENV_KEY =
    network.name === 'sepolia'
      ? 'CONFIG_DEPLOY_CHALLENGE_BASE_ONLY_STEP_WITH_TOKEN_SEPOLIA'
      : 'CONFIG_DEPLOY_CHALLENGE_BASE_ONLY_STEP_WITH_TOKEN';

  try {
    const envConfigRaw = process.env[ENV_KEY];
    if (envConfigRaw && envConfigRaw.trim().length > 0) {
      const parsed = parseEnvConfig(envConfigRaw);
      config = normalizeConfig(parsed);
      console.log(`✅ Configuration loaded from ENV (${ENV_KEY})`);
    } else {
      console.error(
        `❌ ${ENV_KEY} not found in environment variables (network=${network.name})`
      );
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Failed to load configuration:', error);
    process.exit(1);
  }

  // Sanity: for token-based deploys createByToken must be a real ERC20 (not zero)
  if (
    !config.createByToken ||
    config.createByToken === hre.ethers.ZeroAddress
  ) {
    console.error(
      '❌ createByToken is zero address. Use deploy-challenge-detail-v2-not-send-step.ts for native MATIC deploys.'
    );
    process.exit(1);
  }

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  const minBalance = hre.ethers.parseEther('0.1');
  if (balance < minBalance) {
    console.error(
      `❌ Insufficient balance. Need at least ${hre.ethers.formatEther(minBalance)} ETH for gas`
    );
    process.exit(1);
  }
  console.log('✅ Deployer balance sufficient');

  // Pre-check deployer's ERC20 balance (need >= totalAmount to fund the challenge after deploy)
  console.log('\n🔍 PRE-CHECK ERC20 BALANCE');
  console.log('==========================');
  const tokenForCheck = new hre.ethers.Contract(
    config.createByToken,
    ERC20_ABI,
    deployer
  );
  let tokenSymbol = 'TOKEN';
  let tokenDecimals = 18;
  try {
    tokenSymbol = await tokenForCheck.symbol();
    tokenDecimals = Number(await tokenForCheck.decimals());
  } catch {
    console.warn(
      '⚠️  Could not read symbol/decimals — proceeding with defaults'
    );
  }
  const tokenBalance: bigint = await tokenForCheck.balanceOf(deployer.address);
  const requiredAmount = BigInt(config.totalAmount);
  console.log(
    `   ${tokenSymbol} balance: ${hre.ethers.formatUnits(tokenBalance, tokenDecimals)}`
  );
  console.log(
    `   Required: ${hre.ethers.formatUnits(requiredAmount, tokenDecimals)}`
  );
  if (tokenBalance < requiredAmount) {
    console.error(
      `❌ Deployer ${tokenSymbol} balance is less than totalAmount. Top up before deploying.`
    );
    process.exit(1);
  }
  console.log(`✅ ${tokenSymbol} balance sufficient`);

  const constructorArgs = [
    config.stakeHolders,
    config.createByToken,
    config.erc721Addresses,
    config.primaryRequired,
    config.awardReceivers,
    config.index,
    config.allowGiveUp,
    config.gasData,
    config.allAwardToSponsorWhenGiveUp,
    config.awardReceiversPercent,
    config.totalAmount,
    config.walkingSpeedData ?? [],
    config.hiitData ?? [],
  ];

  // ChallengeBaseStep does NOT pull tokens via transferFrom in the constructor.
  // For token deploys (allowGiveUp[1]=false), the contract is deployed without
  // msg.value and the prize tokens are sent with a plain transfer AFTER deploy
  // (mirrors the admin UI's ChallengeTable.js pattern).
  console.log('\n🏗️  DEPLOYING CONTRACT');
  console.log('======================');

  const ContractFactory =
    await hre.ethers.getContractFactory('ChallengeBaseStep');

  console.log('⏳ Deploying ChallengeBaseStep...', constructorArgs);
  let contract: any;
  try {
    // For token-based deploys, msg.value must be 0 (constructor pulls tokens
    // via the approve we just set up). allowGiveUp[1] should be false in config.
    const baseOverrides =
      config.allowGiveUp && config.allowGiveUp[1]
        ? { value: BigInt(config.totalAmount) }
        : {};
    console.log('baseOverrides', baseOverrides);

    // Estimate gas and fees
    const unsignedTx = await ContractFactory.getDeployTransaction(
      ...constructorArgs,
      baseOverrides
    );
    const [signer] = await hre.ethers.getSigners();
    const estimatedGas = await signer.estimateGas(unsignedTx);

    const feeData = await hre.ethers.provider.getFeeData();
    const defaultGasPrice = hre.ethers.parseUnits('40', 'gwei');
    const gasPrice = feeData.gasPrice ?? defaultGasPrice;
    const estCostWei = estimatedGas * gasPrice;

    console.log(`Estimated gas: ${estimatedGas.toString()}`);
    console.log(`Gas price: ${hre.ethers.formatUnits(gasPrice, 'gwei')} gwei`);
    console.log(`Estimated cost: ${hre.ethers.formatEther(estCostWei)} ETH`);

    const gasLimit = Math.ceil(Number(estimatedGas) * 1.01);
    const overrides =
      feeData.maxFeePerGas && feeData.maxPriorityFeePerGas
        ? {
            ...baseOverrides,
            gasLimit,
            maxFeePerGas: feeData.maxFeePerGas,
            maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
          }
        : { ...baseOverrides, gasLimit, gasPrice };

    console.log(
      `Using gas limit: ${gasLimit} (${Math.round((gasLimit / Number(estimatedGas) - 1) * 100)}% buffer)`
    );

    contract = await ContractFactory.deploy(...constructorArgs, overrides);
    await contract.waitForDeployment();
  } catch (error) {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  }

  const contractAddress = await contract.getAddress();
  console.log(`✅ Contract deployed at: ${contractAddress}`);

  // Verify deployment on-chain
  console.log('\n🔍 VERIFYING DEPLOYMENT');
  console.log('=======================');
  const deployedCode = await hre.ethers.provider.getCode(contractAddress);
  if (deployedCode === '0x') {
    console.error('❌ Contract deployment failed - no code at address');
    process.exit(1);
  }
  console.log('✅ Contract code verified');

  // Test basic functionality
  console.log('\n🧪 TESTING BASIC FUNCTIONALITY');
  console.log('===============================');

  try {
    const sponsor = await contract.sponsor();
    const challenger = await contract.challenger();
    const startTime = await contract.startTime();
    const endTime = await contract.endTime();
    const goal = await contract.goal();
    const dayRequired = await contract.dayRequired();
    const createByToken = await contract.createByToken();

    console.log(`✅ Sponsor: ${sponsor}`);
    console.log(`✅ Challenger: ${challenger}`);
    console.log(
      `✅ Start Time: ${new Date(Number(startTime) * 1000).toISOString()}`
    );
    console.log(
      `✅ End Time: ${new Date(Number(endTime) * 1000).toISOString()}`
    );
    console.log(`✅ Goal: ${goal} steps`);
    console.log(`✅ Day Required: ${dayRequired} days`);
    console.log(`✅ Create By Token: ${createByToken}`);

    console.log('✅ All basic functionality tests passed');
  } catch (error) {
    console.error('❌ Basic functionality test failed:', error);
    process.exit(1);
  }

  // Contract verification on block explorer
  if (network.name !== 'hardhat' && network.name !== 'localhost') {
    await new Promise(resolve => setTimeout(resolve, 10000));
    console.log('\n🔍 VERIFYING ON BLOCK EXPLORER');
    console.log('===============================');

    try {
      console.log('⏳ Waiting for block confirmations...');
      await contract.deploymentTransaction()?.wait(5);

      console.log('⏳ Verifying contract source code...');
      await run('verify:verify', {
        address: contractAddress,
        constructorArguments: constructorArgs,
      });
      console.log('✅ Contract verified on block explorer');
    } catch (error) {
      console.warn('⚠️  Contract verification failed:', error);
    }
  }

  // Grant ALLOWED_CONTRACTS_CHALLENGE role on ExerciseSupplementNFT + Gacha CHALLENGE_ROLE.
  // grantAllChallengeRoles signs with ADMIN_PRIVATE_KEY (admin holds both roles).
  // CHALLENGE-2672 (TANIMOTO re-review): both grants must succeed, or this Challenge is NOT
  // ready to use -- no longer swallowed into a warning.
  console.log('\n🔐 GRANTING CHALLENGE ROLE');
  console.log('==========================');

  let roleGrantTxHash: string | null = null;
  const grantedRoles = await grantAllChallengeRoles(contractAddress);
  roleGrantTxHash = grantedRoles.exerciseSupplementNFT;
  console.log('✅ Challenge roles granted:', grantedRoles);
  console.log('Waiting for 20 seconds...');
  await new Promise(resolve => setTimeout(resolve, 20000));
  const roleGranted = roleGrantTxHash !== null;

  // Fund the challenge: simple ERC20 transfer from deployer to the contract.
  // ChallengeBaseStep does not pull tokens in its constructor, so we transfer
  // them explicitly here (matches the admin UI flow).
  console.log('\n💸 FUNDING CHALLENGE WITH ERC20 TOKEN');
  console.log('======================================');

  let tokenSent = false;
  let tokenTransferTxHash: string | null = null;
  if (requiredAmount === 0n) {
    console.log('ℹ️  totalAmount is 0 — skipping token transfer');
  } else {
    try {
      const token = new hre.ethers.Contract(
        config.createByToken,
        ERC20_ABI,
        deployer
      );
      const tx = await token.transfer(contractAddress, requiredAmount);
      console.log(`⏳ Token transfer tx: ${tx.hash}`);
      const receipt = await tx.wait();
      tokenTransferTxHash = tx.hash;
      tokenSent = true;
      console.log(
        `✅ Sent ${hre.ethers.formatUnits(requiredAmount, tokenDecimals)} ${tokenSymbol} to challenge (gas used: ${receipt.gasUsed})`
      );

      const contractTokenBalance = await token.balanceOf(contractAddress);
      console.log(
        `   Challenge contract ${tokenSymbol} balance: ${hre.ethers.formatUnits(contractTokenBalance, tokenDecimals)}`
      );
      if (contractTokenBalance < requiredAmount) {
        console.warn(
          `⚠️  Contract balance is less than totalAmount — investigate before using the challenge`
        );
      }
    } catch (err) {
      console.error('❌ Token transfer failed:', err);
      console.warn(
        '   The challenge contract was deployed but is NOT funded. Send the tokens manually.'
      );
    }
  }

  // Save deployment information
  console.log('\n💾 SAVING DEPLOYMENT INFO');
  console.log('==========================');

  const deploymentInfo = {
    network: network.name,
    contractName: 'ChallengeBaseStep',
    contractAddress: contractAddress,
    deployer: deployer.address,
    deploymentTime: new Date().toISOString(),
    blockNumber: await hre.ethers.provider.getBlockNumber(),
    constructorArgs: {
      stakeHolders: config.stakeHolders,
      createByToken: config.createByToken,
      erc721Addresses: config.erc721Addresses,
      primaryRequired: config.primaryRequired,
      awardReceivers: config.awardReceivers,
      index: config.index,
      allowGiveUp: config.allowGiveUp,
      gasData: config.gasData,
      allAwardToSponsorWhenGiveUp: config.allAwardToSponsorWhenGiveUp,
      awardReceiversPercent: config.awardReceiversPercent,
      totalAmount: config.totalAmount,
      walkingSpeedData: config.walkingSpeedData ?? [],
      hiitData: config.hiitData ?? [],
    },
    contractDetails: {
      sponsor: await contract.sponsor(),
      challenger: await contract.challenger(),
      startTime: Number(await contract.startTime()),
      endTime: Number(await contract.endTime()),
      goal: Number(await contract.goal()),
      dayRequired: Number(await contract.dayRequired()),
      createByToken: await contract.createByToken(),
    },
    tokenInfo: {
      tokenType: 'ERC20',
      tokenAddress: config.createByToken,
      tokenSymbol,
      tokenDecimals,
      duration:
        Number(await contract.endTime()) - Number(await contract.startTime()),
    },
    verification: {
      verified: network.name !== 'hardhat' && network.name !== 'localhost',
      explorerUrl: getExplorerUrl(network.name, contractAddress),
    },
    roleGranted: {
      challengeRole: roleGranted,
      transactionHash: roleGrantTxHash,
      timestamp: new Date().toISOString(),
    },
    tokenFunding: {
      sent: tokenSent,
      transactionHash: tokenTransferTxHash,
      tokenAddress: config.createByToken,
      tokenSymbol,
      amount: config.totalAmount,
      amountFormatted: hre.ethers.formatUnits(requiredAmount, tokenDecimals),
      timestamp: new Date().toISOString(),
    },
    transactionSendStep: {
      sent: false,
      transactionHash: null,
      timestamp: new Date().toISOString(),
      testData: {
        days: [10],
        stepIndex: [1000],
        timeRange: [1, 100],
      },
    },
  };

  const outputPath = path.join(
    process.cwd(),
    `deployInfo/challenge-detail-v2-with-token-${network.name}.json`
  );
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`✅ Deployment info saved to: ${outputPath}`);

  // Generate deployment report
  console.log('\n📊 DEPLOYMENT REPORT');
  console.log('====================');
  console.log(`Network: ${network.name}`);
  console.log(`Contract: ChallengeBaseStep (with token)`);
  console.log(`Address: ${contractAddress}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Block: ${deploymentInfo.blockNumber}`);
  console.log(`Time: ${deploymentInfo.deploymentTime}`);
  console.log(`Token: ${tokenSymbol} (${config.createByToken})`);
  console.log(
    `Funding amount: ${hre.ethers.formatUnits(requiredAmount, tokenDecimals)} ${tokenSymbol}`
  );
  console.log(`Explorer: ${deploymentInfo.verification.explorerUrl}`);
  console.log(`Challenge Role: ${roleGranted ? 'Granted' : 'Not Granted'}`);
  if (roleGrantTxHash) {
    console.log(`Role Grant TX: ${roleGrantTxHash}`);
  }
  console.log(`Token Funding: ${tokenSent ? 'Sent' : 'Not Sent'}`);
  if (tokenTransferTxHash) {
    console.log(`Token Transfer TX: ${tokenTransferTxHash}`);
  }

  console.log('\n🎉 DEPLOYMENT COMPLETED');
  console.log('=======================');
  console.log('Next steps:');
  console.log(
    '1. Verify challenge is funded — check the contract balance on the explorer'
  );
  console.log('2. Test challenge functionality with the challenger');
  console.log('3. Monitor staking rewards (if auto-staking is enabled)');
}

function getExplorerUrl(networkName: string, address: string): string {
  const explorers: { [key: string]: string } = {
    polygon: `https://polygonscan.com/address/${address}`,
    amoy: `https://amoy.polygonscan.com/address/${address}`,
    mumbai: `https://mumbai.polygonscan.com/address/${address}`,
    ethereum: `https://etherscan.io/address/${address}`,
    goerli: `https://goerli.etherscan.io/address/${address}`,
    sepolia: `https://sepolia.etherscan.io/address/${address}`,
  };

  return explorers[networkName] || `Unknown network: ${networkName}`;
}

function parseEnvConfig(raw: string): any {
  try {
    // Accept JSON or JS-like object from .env. Strip any leading "KEY=" prefix.
    const normalized = raw.trim().startsWith('{')
      ? raw
      : raw.replace(/^[A-Z0-9_]+\s*=\s*/, '');
    return JSON.parse(normalized);
  } catch (e) {
    throw new Error('Invalid challenge config JSON in .env');
  }
}

function normalizeConfig(input: any): ChallengeDeploymentConfig {
  const toBool = (v: any) =>
    typeof v === 'boolean' ? v : String(v).toLowerCase() === 'true';
  const toNum = (v: any) => (typeof v === 'number' ? v : Number(v));
  return {
    stakeHolders: input.stakeHolders,
    createByToken: input.createByToken,
    erc721Addresses: input.erc721Addresses,
    primaryRequired: input.primaryRequired.map((n: any) => toNum(n)),
    awardReceivers: input.awardReceivers,
    index: toNum(input.index),
    allowGiveUp: input.allowGiveUp.map((b: any) => toBool(b)),
    gasData: input.gasData.map((g: any) => String(g)),
    allAwardToSponsorWhenGiveUp: toBool(input.allAwardToSponsorWhenGiveUp),
    awardReceiversPercent: input.awardReceiversPercent.map((n: any) =>
      toNum(n)
    ),
    totalAmount: String(input.totalAmount),
    walkingSpeedData: Array.isArray(input.walkingSpeedData)
      ? input.walkingSpeedData.map((n: any) => toNum(n))
      : [],
    hiitData: Array.isArray(input.hiitData)
      ? input.hiitData.map((n: any) => toNum(n))
      : [],
  };
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('💥 DEPLOYMENT FAILED:', error);
    process.exit(1);
  });
