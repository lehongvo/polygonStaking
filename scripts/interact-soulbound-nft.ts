import * as fs from 'fs';
import { network } from 'hardhat';
import * as path from 'path';

const hre = require('hardhat');

interface DeploymentInfo {
  network: string;
  chainId: number;
  explorer?: string;
  deployer: string;
  contractName: string;
  contractAddress: string;
  constructorArgs: any[];
  deploymentDate: string;
  verified: boolean;
}

async function main() {
  console.log('🤝 Interacting with SoulBoundNFT contract...');

  // Read deployment info
  const deploymentPath = path.join(__dirname, '..', 'soulbound-nft-deployment.json');
  
  if (!fs.existsSync(deploymentPath)) {
    console.error('❌ Deployment file not found! Please deploy the contract first.');
    console.log(`Expected file: ${deploymentPath}`);
    process.exit(1);
  }

  const deploymentInfo: DeploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  
  // Get network info
  const networkInfo = await hre.ethers.provider.getNetwork();
  const networkName = network.name;
  
  console.log(`Network: ${networkName} (Chain ID: ${networkInfo.chainId})`);
  console.log(`Contract Address: ${deploymentInfo.contractAddress}`);

  // Get signers
  const [deployer, user1, user2] = await hre.ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);
  console.log(`User1: ${user1.address}`);
  console.log(`User2: ${user2.address}`);

  // Connect to deployed contract
  const SoulBoundNFT = await hre.ethers.getContractFactory('SoulBoundNFT');
  const contract = SoulBoundNFT.attach(deploymentInfo.contractAddress);

  try {
    console.log('\n📊 Reading Contract Information:');
    console.log('================================');
    
    // Basic contract info
    const name = await contract.name();
    const symbol = await contract.symbol();
    const nextTokenId = await contract.nextTokenIdToMint();
    const isSoulBound = await contract.isSoulBound();
    
    console.log(`Name: ${name}`);
    console.log(`Symbol: ${symbol}`);
    console.log(`Next Token ID: ${nextTokenId}`);
    console.log(`Is Soul Bound: ${isSoulBound}`);

    // Admin information
    const admins = await contract.getAdmins();
    console.log(`Admins: ${admins}`);

    console.log('\n🎯 Testing Admin Functions:');
    console.log('============================');

    // Test safeMint (only admin can do this)
    console.log(`\n1. Minting NFT to ${user1.address}...`);
    const mintTx = await contract.safeMint(user1.address);
    await mintTx.wait();
    console.log(`✅ Minted token to ${user1.address}`);

    // Check balance
    const balance = await contract.balanceOf(user1.address);
    console.log(`User1 balance: ${balance}`);

    // Get token URI
    const tokenURI = await contract.tokenURI(0);
    console.log(`Token URI for token 0: ${tokenURI}`);

    // Test batch mint
    console.log(`\n2. Batch minting 3 NFTs to ${user2.address}...`);
    const batchMintTx = await contract.batchMint(user2.address, 3);
    await batchMintTx.wait();
    console.log(`✅ Batch minted 3 tokens to ${user2.address}`);

    const user2Balance = await contract.balanceOf(user2.address);
    console.log(`User2 balance: ${user2Balance}`);

    console.log('\n🔒 Testing Soul Bound Token Features:');
    console.log('======================================');

    // Try to transfer (should fail)
    console.log('\n3. Attempting transfer (should fail)...');
    try {
      const transferTx = await contract.connect(user1).transferFrom(user1.address, user2.address, 0);
      await transferTx.wait();
      console.log('❌ Transfer should have failed!');
    } catch (error: any) {
      console.log(`✅ Transfer correctly failed: ${error.reason || error.message}`);
    }

    // Test admin management
    console.log('\n🔧 Testing Admin Management:');
    console.log('=============================');

    console.log(`\n4. Adding ${user1.address} as admin...`);
    const addAdminTx = await contract.updateAdmin(user1.address, true);
    await addAdminTx.wait();
    console.log('✅ Added new admin');

    const updatedAdmins = await contract.getAdmins();
    console.log(`Updated admins: ${updatedAdmins}`);

    // Test admin minting by new admin
    console.log(`\n5. Testing mint by new admin...`);
    const adminMintTx = await contract.connect(user1).safeMint(user2.address);
    await adminMintTx.wait();
    console.log('✅ New admin successfully minted NFT');

    // Test transfer enabled (emergency function)
    console.log('\n6. Testing emergency transfer enable...');
    const enableTransferTx = await contract.setTransferEnabled(true);
    await enableTransferTx.wait();
    console.log('✅ Transfer enabled');

    const nowSoulBound = await contract.isSoulBound();
    console.log(`Is Soul Bound now: ${nowSoulBound}`);

    // Try transfer again (should work now)
    console.log('\n7. Attempting transfer (should work now)...');
    const successfulTransferTx = await contract.connect(user1).transferFrom(user1.address, user2.address, 0);
    await successfulTransferTx.wait();
    console.log('✅ Transfer successful after enabling');

    // Disable transfers again
    console.log('\n8. Disabling transfers again...');
    const disableTransferTx = await contract.setTransferEnabled(false);
    await disableTransferTx.wait();
    console.log('✅ Transfers disabled again');

    console.log('\n📈 Final Contract State:');
    console.log('========================');
    const finalUser1Balance = await contract.balanceOf(user1.address);
    const finalUser2Balance = await contract.balanceOf(user2.address);
    const finalNextTokenId = await contract.nextTokenIdToMint();
    const finalIsSoulBound = await contract.isSoulBound();
    const finalAdmins = await contract.getAdmins();

    console.log(`User1 final balance: ${finalUser1Balance}`);
    console.log(`User2 final balance: ${finalUser2Balance}`);
    console.log(`Next token ID: ${finalNextTokenId}`);
    console.log(`Is Soul Bound: ${finalIsSoulBound}`);
    console.log(`Final admins: ${finalAdmins}`);

    if (deploymentInfo.explorer) {
      console.log('\n🔗 Explorer Links:');
      console.log(`- Contract: ${deploymentInfo.explorer}/address/${deploymentInfo.contractAddress}`);
    }

  } catch (error) {
    console.error('❌ Interaction failed:', error);
    process.exit(1);
  }
}

main()
  .then(() => {
    console.log('\n🎉 Contract interaction completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Interaction error:', error);
    process.exit(1);
  }); 