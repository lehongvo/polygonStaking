import { ethers, network } from 'hardhat';

async function main() {
  console.log('🎨 YOBOWEB3WALK NFT MINTING');
  console.log('===========================');

  const [deployer] = await ethers.getSigners();
  console.log(`📍 Network: ${network.name}`);
  console.log(`👤 Minter: ${deployer.address}`);

  // Contract address - update this with your deployed contract address
  const contractAddress = process.env.YOBO_CONTRACT_ADDRESS;
  if (!contractAddress) {
    console.error('❌ Please set YOBO_CONTRACT_ADDRESS environment variable');
    process.exit(1);
  }

  // Recipient address
  const recipientAddress =
    process.env.YOBO_RECIPIENT_ADDRESS ||
    '0xe340371845820cb16Cb8908E0ed07e2E1Ff40024';

  console.log(`📄 Contract: ${contractAddress}`);
  console.log(`🎯 Recipient: ${recipientAddress}`);

  // Connect to contract
  const contract = await ethers.getContractAt('YOBOWEB3WALK', contractAddress);

  // Check contract status
  console.log('\n📊 CONTRACT STATUS');
  console.log('==================');

  try {
    const totalMinted = await contract.totalMinted();
    const remainingSupply = await contract.remainingSupply();
    const maxSupply = await contract.MAX_SUPPLY();
    const recipientBalance = await contract.balanceOf(recipientAddress);

    console.log(`Total Minted: ${totalMinted}/${maxSupply}`);
    console.log(`Remaining Supply: ${remainingSupply}`);
    console.log(`Recipient Balance: ${recipientBalance}`);

    if (remainingSupply === 0n) {
      console.error('❌ No remaining supply to mint');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Failed to check contract status:', error);
    process.exit(1);
  }

  // Mint NFTs
  console.log('\n🎨 MINTING NFTs');
  console.log('===============');

  const mintCount = parseInt(process.env.YOBO_MINT_COUNT || '2');
  console.log(`Minting ${mintCount} NFT(s) to ${recipientAddress}...`);

  try {
    for (let i = 0; i < mintCount; i++) {
      console.log(`⏳ Minting NFT ${i + 1}/${mintCount}...`);

      const tx = await contract.safeMint(recipientAddress);
      const receipt = await tx.wait();

      console.log(`✅ NFT ${i + 1} minted! Transaction: ${tx.hash}`);
      console.log(`   Gas used: ${receipt?.gasUsed.toString()}`);

      // Get the token ID from the event
      const transferEvent = receipt?.logs.find((log: any) => {
        try {
          const parsed = contract.interface.parseLog(log);
          return parsed?.name === 'Transfer';
        } catch {
          return false;
        }
      });

      if (transferEvent) {
        const parsed = contract.interface.parseLog(transferEvent);
        const tokenId = parsed?.args[2];
        console.log(`   Token ID: ${tokenId}`);

        // Get token URI
        const tokenURI = await contract.tokenURI(tokenId);
        console.log(`   Token URI: ${tokenURI}`);
      }
    }

    // Final status
    console.log('\n📊 FINAL STATUS');
    console.log('===============');

    const finalBalance = await contract.balanceOf(recipientAddress);
    const finalTotalMinted = await contract.totalMinted();
    const finalRemainingSupply = await contract.remainingSupply();

    console.log(`Recipient Balance: ${finalBalance}`);
    console.log(
      `Total Minted: ${finalTotalMinted}/${await contract.MAX_SUPPLY()}`
    );
    console.log(`Remaining Supply: ${finalRemainingSupply}`);

    console.log('\n🎉 MINTING COMPLETED SUCCESSFULLY!');
  } catch (error) {
    console.error('❌ Minting failed:', error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('💥 MINTING FAILED:', error);
    process.exit(1);
  });
