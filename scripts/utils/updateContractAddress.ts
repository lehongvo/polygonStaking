import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { getPolygonDeFiAddress } from './readDeploymentInfo';

async function updateContractAddress() {
  try {
    console.log('🔄 Updating contract address in ChallengeDetailV2.sol...');
    
    // Get the current address from JSON
    const contractAddress = getPolygonDeFiAddress();
    console.log(`📍 Current PolygonDeFi address: ${contractAddress}`);
    
    // Read the Solidity file
    const contractPath = path.join(
      process.cwd(),
      'contracts',
      'ChallengeDetail',
      'ChallengeDetailV2.sol'
    );
    
    if (!fs.existsSync(contractPath)) {
      throw new Error('ChallengeDetailV2.sol not found');
    }
    
    let contractContent = fs.readFileSync(contractPath, 'utf8');
    
    // Find and replace the contract address
    const addressRegex = /address public constant AAVE_DEFI_CONTRACT_ADDRESS = 0x[a-fA-F0-9]{40};/;
    const newAddressLine = `address public constant AAVE_DEFI_CONTRACT_ADDRESS = ${contractAddress};`;
    
    if (addressRegex.test(contractContent)) {
      contractContent = contractContent.replace(addressRegex, newAddressLine);
      
      // Write the updated content back
      fs.writeFileSync(contractPath, contractContent);
      console.log('✅ Contract address updated successfully!');
      console.log(`📍 New address: ${contractAddress}`);
    } else {
      console.log('⚠️ Could not find the address pattern to replace');
    }
    
  } catch (error) {
    console.error('❌ Error updating contract address:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  updateContractAddress();
}

export { updateContractAddress };
