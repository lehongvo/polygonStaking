const contractAddress1 = '0xB8dF4ff3ca5Eb533b27E8B1653130cAEf449acFF'; // true
const contractAddress2 = '0x9a9f18ab74eda104dfa8cc2d1a6e83888c2060ef'; // false
const abiChallengeWalkingSpeed = [
  {
    inputs: [
      {
        internalType: 'address payable[]',
        name: '_stakeHolders',
        type: 'address[]',
      },
      {
        internalType: 'address',
        name: '_createByToken',
        type: 'address',
      },
      {
        internalType: 'address[]',
        name: '_erc721Address',
        type: 'address[]',
      },
      {
        internalType: 'uint256[]',
        name: '_primaryRequired',
        type: 'uint256[]',
      },
      {
        internalType: 'address payable[]',
        name: '_awardReceivers',
        type: 'address[]',
      },
      {
        internalType: 'uint256',
        name: '_index',
        type: 'uint256',
      },
      {
        internalType: 'bool[]',
        name: '_allowGiveUp',
        type: 'bool[]',
      },
      {
        internalType: 'uint256[]',
        name: '_gasData',
        type: 'uint256[]',
      },
      {
        internalType: 'bool',
        name: '_allAwardToSponsorWhenGiveUp',
        type: 'bool',
      },
      {
        internalType: 'uint256[]',
        name: '_awardReceiversPercent',
        type: 'uint256[]',
      },
      {
        internalType: 'uint256',
        name: '_totalAmount',
        type: 'uint256',
      },
      {
        internalType: 'uint256[]',
        name: '_walkingSpeedData',
        type: 'uint256[]',
      },
    ],
    stateMutability: 'payable',
    type: 'constructor',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'bool',
        name: 'challengeStatus',
        type: 'bool',
      },
    ],
    name: 'CloseChallenge',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'to',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'uint256',
        name: 'valueSend',
        type: 'uint256',
      },
    ],
    name: 'FundTransfer',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'from',
        type: 'address',
      },
    ],
    name: 'GiveUp',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'uint256',
        name: 'currentStatus',
        type: 'uint256',
      },
    ],
    name: 'SendDailyResult',
    type: 'event',
  },
  {
    inputs: [],
    name: 'allContractERC20',
    outputs: [
      {
        internalType: 'address[]',
        name: '',
        type: 'address[]',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    name: 'allowGiveUp',
    outputs: [
      {
        internalType: 'bool',
        name: '',
        type: 'bool',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'challenger',
    outputs: [
      {
        internalType: 'address payable',
        name: '',
        type: 'address',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address[]',
        name: '_listNFTAddress',
        type: 'address[]',
      },
      {
        internalType: 'uint256[][]',
        name: '_listIndexNFT',
        type: 'uint256[][]',
      },
      {
        internalType: 'address[][]',
        name: '_listSenderAddress',
        type: 'address[][]',
      },
      {
        internalType: 'bool[]',
        name: '_statusTypeNft',
        type: 'bool[]',
      },
    ],
    name: 'closeChallenge',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'createByToken',
    outputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'currentStatus',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'dayRequired',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'duration',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'endTime',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    name: 'erc721Address',
    outputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '_index',
        type: 'uint256',
      },
      {
        internalType: 'bool',
        name: '_isAddressSuccess',
        type: 'bool',
      },
    ],
    name: 'getAwardReceiversAtIndex',
    outputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getAwardReceiversPercent',
    outputs: [
      {
        internalType: 'uint256[]',
        name: '',
        type: 'uint256[]',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getBalanceToken',
    outputs: [
      {
        internalType: 'uint256[]',
        name: '',
        type: 'uint256[]',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getChallengeHistory',
    outputs: [
      {
        internalType: 'uint256[]',
        name: 'date',
        type: 'uint256[]',
      },
      {
        internalType: 'uint256[]',
        name: 'data',
        type: 'uint256[]',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getChallengeInfo',
    outputs: [
      {
        internalType: 'uint256',
        name: 'challengeCleared',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'challengeDayRequired',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'daysRemained',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getContractBalance',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getState',
    outputs: [
      {
        internalType: 'enum ChallengeWalkingSpeed.ChallengeState',
        name: '',
        type: 'uint8',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address[]',
        name: '_listNFTAddress',
        type: 'address[]',
      },
      {
        internalType: 'uint256[][]',
        name: '_listIndexNFT',
        type: 'uint256[][]',
      },
      {
        internalType: 'address[][]',
        name: '_listSenderAddress',
        type: 'address[][]',
      },
      {
        internalType: 'bool[]',
        name: '_statusTypeNft',
        type: 'bool[]',
      },
    ],
    name: 'giveUp',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'goal',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    name: 'historyMinutesAtTargetSpeed',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'indexNft',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'isFinished',
    outputs: [
      {
        internalType: 'bool',
        name: '',
        type: 'bool',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'isSuccess',
    outputs: [
      {
        internalType: 'bool',
        name: '',
        type: 'bool',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address',
      },
      {
        internalType: 'address',
        name: '',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
      {
        internalType: 'bytes',
        name: '',
        type: 'bytes',
      },
    ],
    name: 'onERC1155Received',
    outputs: [
      {
        internalType: 'bytes4',
        name: '',
        type: 'bytes4',
      },
    ],
    stateMutability: 'pure',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address',
      },
      {
        internalType: 'address',
        name: '',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
      {
        internalType: 'bytes',
        name: '',
        type: 'bytes',
      },
    ],
    name: 'onERC721Received',
    outputs: [
      {
        internalType: 'bytes4',
        name: '',
        type: 'bytes4',
      },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256[]',
        name: '_day',
        type: 'uint256[]',
      },
      {
        internalType: 'uint256[]',
        name: '_stepIndex',
        type: 'uint256[]',
      },
      {
        internalType: 'uint64[2]',
        name: '_data',
        type: 'uint64[2]',
      },
      {
        internalType: 'bytes',
        name: '_signature',
        type: 'bytes',
      },
      {
        internalType: 'address[]',
        name: '_listGachaAddress',
        type: 'address[]',
      },
      {
        internalType: 'address[]',
        name: '_listNFTAddress',
        type: 'address[]',
      },
      {
        internalType: 'uint256[][]',
        name: '_listIndexNFT',
        type: 'uint256[][]',
      },
      {
        internalType: 'address[][]',
        name: '_listSenderAddress',
        type: 'address[][]',
      },
      {
        internalType: 'bool[]',
        name: '_statusTypeNft',
        type: 'bool[]',
      },
      {
        internalType: 'uint64[2]',
        name: '_timeRange',
        type: 'uint64[2]',
      },
      {
        internalType: 'uint256[]',
        name: '_minutesAtTargetSpeed',
        type: 'uint256[]',
      },
    ],
    name: 'sendDailyResult',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'sponsor',
    outputs: [
      {
        internalType: 'address payable',
        name: '',
        type: 'address',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'startTime',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalBalanceBaseToken',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalReward',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    name: 'walkingSpeedData',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address[]',
        name: '_listTokenErc20',
        type: 'address[]',
      },
      {
        internalType: 'address[]',
        name: '_listNFTAddress',
        type: 'address[]',
      },
      {
        internalType: 'uint256[][]',
        name: '_listIndexNFT',
        type: 'uint256[][]',
      },
      {
        internalType: 'bool[]',
        name: '_statusTypeNft',
        type: 'bool[]',
      },
    ],
    name: 'withdrawTokensOnCompletion',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    stateMutability: 'payable',
    type: 'receive',
  },
];

const { ethers } = require('ethers');
require('dotenv/config');

/**
 * Check if a contract address is a ChallengeWalkingSpeed contract
 * @param {string} contractAddress - The contract address to check
 * @param {string} rpc - The RPC URL to connect to the blockchain
 * @returns {Promise<{bool: boolean, data: {targetSpeed: number, requiredMinutesPerDay: number, minAchievementDays: number}}} - True if the contract has walkingSpeedData, false otherwise
 */
const isChallengeWalkingSpeed = async (contractAddress, rpc) => {
  try {
    // Create provider with provided RPC URL
    const provider = new ethers.JsonRpcProvider(rpc);

    // Create contract instance
    const contract = new ethers.Contract(
      contractAddress,
      abiChallengeWalkingSpeed,
      provider
    );

    // Check if walkingSpeedData has data by calling walkingSpeedData(0)
    // If it's a ChallengeWalkingSpeed contract, this should return a value
    const targetSpeed = await contract.walkingSpeedData(0);
    const requiredMinutesPerDay = await contract.walkingSpeedData(1);
    const minAchievementDays = await contract.walkingSpeedData(2);
    
    // If we get here without error and have a value, it's likely a ChallengeWalkingSpeed contract
    // Check if the value is not zero (or just check that it exists)
    return {isChallengeWalkingSpeed: true, data: {targetSpeed, requiredMinutesPerDay, minAchievementDays}};
  } catch (error) {
    // If any error occurs (function doesn't exist, contract doesn't exist, etc.), return false
    return {isChallengeWalkingSpeed: false, data: {targetSpeed: 0, requiredMinutesPerDay: 0, minAchievementDays: 0}};
  }
};

const main = async () => {
  console.log('Testing contract addresses...\n');
  
  // Use RPC from env or default to Polygon RPC
  const rpcUrl = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com';
  
  const result1 = await isChallengeWalkingSpeed(contractAddress1, rpcUrl);
  console.log(`Contract ${contractAddress1}: ${result1.isChallengeWalkingSpeed ? '✅ IS ChallengeWalkingSpeed' : '❌ NOT ChallengeWalkingSpeed'}`);
  
  const result2 = await isChallengeWalkingSpeed(contractAddress2, rpcUrl);
  console.log(`Contract ${contractAddress2}: ${result2.isChallengeWalkingSpeed ? '✅ IS ChallengeWalkingSpeed' : '❌ NOT ChallengeWalkingSpeed'}`);
};

// Export for use in other modules
module.exports = {
  isChallengeWalkingSpeed,
  abiChallengeWalkingSpeed,
};

// Run if called directly
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Error:', error);
      process.exit(1);
    });
}
