/**
 * Verify ChallengeHIIT contract on block explorer.
 * Always reads contract address and constructor args from deployInfo/challenge-hiit-{network}.json.
 *
 * Usage:
 *   npx hardhat run scripts/challenge/ChallengeHIIT/verify-challenge-hiit.ts --network polygon
 */
import 'dotenv/config';
import * as fs from 'fs';
import { run, network } from 'hardhat';
import * as path from 'path';

const hre = require('hardhat');

async function main() {
  if (network.name === 'hardhat' || network.name === 'localhost') {
    console.log('Skip verification on local network');
    return;
  }

  const deployInfoPath = path.join(
    process.cwd(),
    `deployInfo/challenge-hiit-${network.name}.json`
  );

  if (!fs.existsSync(deployInfoPath)) {
    console.error('Deploy info not found at', deployInfoPath);
    console.error('Deploy the contract first so this file exists.');
    process.exit(1);
  }

  const deployInfo = JSON.parse(fs.readFileSync(deployInfoPath, 'utf-8'));
  const address = deployInfo.contractAddress;
  const c = deployInfo.constructorArgs;

  if (!address || !c) {
    console.error('Deploy info missing contractAddress or constructorArgs.');
    process.exit(1);
  }

  const constructorArgs = [
    c.stakeHolders,
    c.createByToken,
    c.erc721Addresses,
    c.primaryRequired,
    c.awardReceivers,
    c.index,
    c.allowGiveUp,
    c.gasData,
    c.allAwardToSponsorWhenGiveUp,
    c.awardReceiversPercent,
    c.totalAmount,
  ];

  console.log('Using deploy info:', deployInfoPath);
  console.log('Contract address:', address);
  console.log('Verifying on', network.name, '...');

  try {
    await run('verify:verify', {
      address,
      constructorArguments: constructorArgs,
    });
    console.log('Contract verified successfully');
  } catch (error: any) {
    if (error.message?.includes('Already Verified')) {
      console.log('Contract is already verified');
    } else {
      console.error('Verification failed:', error.message);
      process.exit(1);
    }
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
