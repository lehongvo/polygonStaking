import * as fs from 'fs';
import * as path from 'path';

const hre = require('hardhat');

async function main() {
  console.log('🔨 COMPILING ChallengeGCM CONTRACT');
  console.log('===================================');

  // Compile the contract
  await hre.run('compile');
  console.log('✅ Compilation complete');

  // Get the contract artifact
  const artifact = await hre.artifacts.readArtifact('ChallengeGCM');

  // Prepare bytecode data
  const bytecodeData = {
    bytecode: artifact.bytecode,
    abi: artifact.abi,
  };

  // Save to bytecode.json
  const outputPath = path.join(__dirname, 'bytecode.json');
  fs.writeFileSync(outputPath, JSON.stringify(bytecodeData, null, 2));

  console.log('✅ Bytecode saved to:', outputPath);
  console.log('📊 Bytecode length:', artifact.bytecode.length);
  console.log(
    '📋 ABI functions:',
    artifact.abi.filter((item: any) => item.type === 'function').length
  );
  console.log('\n🎉 COMPLETED SUCCESSFULLY!');
}

main()
  .then(() => process.exit(0))
  .catch((error: any) => {
    console.error('💥 FAILED:', error);
    process.exit(1);
  });
