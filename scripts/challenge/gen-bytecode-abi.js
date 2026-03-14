/**
 * Generate bytecode + ABI JSON files for challenge contracts.
 * Run after `npx hardhat compile`. Output: bytecode and abi only.
 *
 * Usage: node scripts/challenge/gen-bytecode-abi.js
 * Or:    npm run gen:bytecode
 */

const fs = require('fs');
const path = require('path');

const CONTRACTS = [
  {
    name: 'ChallengeBaseStep',
    artifactPath:
      'artifacts/contracts/ChallengeDetail/ChallengeBaseStep.sol/ChallengeBaseStep.json',
    outputPath: 'scripts/challenge/ChallengeWalkingSpeed/bytecodeAndAbi.json',
    label: 'ChallengeBaseStep (ChallengeWalkingSpeed)',
  },
  {
    name: 'ChallengeHIIT',
    artifactPath:
      'artifacts/contracts/ChallengeDetail/ChallengeHIIT.sol/ChallengeHIIT.json',
    outputPath: 'scripts/challenge/ChallengeHIIT/bytecodeAndAbi.json',
    label: 'ChallengeHIIT',
  },
];

const rootDir = path.join(__dirname, '..', '..');

function getBytecode(artifact) {
  const db = artifact.deployedBytecode;
  if (typeof db === 'string' && db.length > 0)
    return db.startsWith('0x') ? db : '0x' + db;
  if (db && typeof db.object === 'string' && db.object.length > 0)
    return '0x' + db.object;
  return '0x';
}

function main() {
  console.log('Generating bytecode + ABI for challenge contracts...\n');

  for (const c of CONTRACTS) {
    const artifactFullPath = path.join(rootDir, c.artifactPath);
    const outputFullPath = path.join(rootDir, c.outputPath);

    if (!fs.existsSync(artifactFullPath)) {
      console.error(`❌ Artifact not found: ${c.artifactPath}`);
      console.error('   Run "npm run compile" first.');
      process.exit(1);
    }

    const artifact = JSON.parse(fs.readFileSync(artifactFullPath, 'utf8'));
    const out = {
      bytecode: getBytecode(artifact),
      abi: artifact.abi || [],
    };

    const outDir = path.dirname(outputFullPath);
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
    fs.writeFileSync(outputFullPath, JSON.stringify(out, null, 2), 'utf8');
    console.log(`✅ ${c.label} → ${c.outputPath}`);
  }

  console.log(
    '\nDone. Re-run "npm run gen:bytecode" after any contract change and compile.'
  );
}

main();
