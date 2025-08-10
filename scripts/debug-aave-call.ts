import 'dotenv/config';

const hre = require('hardhat');

async function main() {
  console.log('🔍 Testing Aave Pool Call Directly...');
  console.log('====================================');

  const [signer] = await hre.ethers.getSigners();
  console.log(`👤 Signer: ${signer.address}`);

  const WMATIC_ADDRESS = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270';
  const AAVE_POOL_ADDRESS = '0x794a61358D6845594F94dc1DB02A252b5b4814aD';
  const testAmount = hre.ethers.parseEther('0.001');

  console.log(`🪙 WMATIC: ${WMATIC_ADDRESS}`);
  console.log(`🏦 Aave Pool: ${AAVE_POOL_ADDRESS}`);
  console.log(`💰 Test Amount: ${hre.ethers.formatEther(testAmount)} WMATIC`);

  try {
    // Get WMATIC contract
    const wmatic = await hre.ethers.getContractAt('IWMATIC', WMATIC_ADDRESS);
    
    // Wrap some MATIC to WMATIC first
    console.log('\n🔄 Wrapping MATIC to WMATIC...');
    const wrapTx = await wmatic.deposit({ value: testAmount });
    await wrapTx.wait();
    console.log('✅ MATIC wrapped to WMATIC');

    // Check WMATIC balance
    const wmaticBalance = await wmatic.balanceOf(signer.address);
    console.log(`💰 WMATIC Balance: ${hre.ethers.formatEther(wmaticBalance)} WMATIC`);

    // Get Aave Pool contract
    const aavePool = await hre.ethers.getContractAt('IAavePool', AAVE_POOL_ADDRESS);

    // Approve WMATIC for Aave Pool
    console.log('\n📝 Approving WMATIC for Aave Pool...');
    const approveTx = await wmatic.approve(AAVE_POOL_ADDRESS, testAmount);
    await approveTx.wait();
    console.log('✅ WMATIC approved for Aave Pool');

    // Check allowance
    const allowance = await wmatic.allowance(signer.address, AAVE_POOL_ADDRESS);
    console.log(`📋 Allowance: ${hre.ethers.formatEther(allowance)} WMATIC`);

    // Try to supply to Aave
    console.log('\n🏦 Supplying WMATIC to Aave Pool...');
    
    try {
      const supplyTx = await aavePool.supply(
        WMATIC_ADDRESS,
        testAmount,
        signer.address,
        0
      );
      
      console.log(`⏳ Supply Transaction: ${supplyTx.hash}`);
      const receipt = await supplyTx.wait();
      console.log(`✅ Supply confirmed in block: ${receipt.blockNumber}`);
      
      console.log('\n🎉 SUCCESS! Aave Pool call worked!');
      
    } catch (supplyError) {
      console.log('❌ Supply to Aave failed:', supplyError.message);
      
      // Try to get more details
      if (supplyError.reason) {
        console.log(`Reason: ${supplyError.reason}`);
      }
      if (supplyError.code) {
        console.log(`Code: ${supplyError.code}`);
      }
    }

  } catch (error) {
    console.log('❌ Test failed:', error.message);
  }

  console.log('\n✅ AAVE CALL TEST COMPLETED!');
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('💥 Test failed:', error);
    process.exit(1);
  });
