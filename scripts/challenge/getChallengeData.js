const challengeBaseStepContractAddress =
  '0x4076E70ef7C1D74c6F4c5dF19ef453EA7830c556';
const challengeHIITContractAddress =
  '0x2527486CA8780AB64F9EF52A97DDAd6EcE0cf0Ff';
const originChallengeDetailContractAddress =
  '0x959541f8652704747e92c13b2e7f2b182035942c';
const challengeBaseStepContractABI = [
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
      {
        internalType: 'uint256[]',
        name: '_hiitData',
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
    name: 'getChallengeTypeAndHistory',
    outputs: [
      {
        internalType: 'uint256',
        name: 'challengeType',
        type: 'uint256',
      },
      {
        internalType: 'uint256[]',
        name: 'walkingSpeedDataConfig',
        type: 'uint256[]',
      },
      {
        internalType: 'uint256',
        name: 'highIntensityIntervalsConfig',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'totalHighIntensityTimeConfig',
        type: 'uint256',
      },
      {
        internalType: 'uint256[]',
        name: 'historyDateStep',
        type: 'uint256[]',
      },
      {
        internalType: 'uint256[]',
        name: 'historyDataStep',
        type: 'uint256[]',
      },
      {
        internalType: 'uint256[]',
        name: 'historyWalkingMinutes',
        type: 'uint256[]',
      },
      {
        internalType: 'uint256[]',
        name: 'historyWalkingMets',
        type: 'uint256[]',
      },
      {
        internalType: 'uint256[]',
        name: 'historyHiitIntervals',
        type: 'uint256[]',
      },
      {
        internalType: 'uint256[]',
        name: 'historyHiitTime',
        type: 'uint256[]',
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
    inputs: [
      {
        internalType: 'uint256',
        name: '_day',
        type: 'uint256',
      },
    ],
    name: 'getHIITAchievedOn',
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
    name: 'getHIITConfig',
    outputs: [
      {
        internalType: 'uint256',
        name: '_highIntensityIntervals',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: '_totalHighIntensityTime',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getHIITHistory',
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
      {
        internalType: 'uint256[]',
        name: 'intervals',
        type: 'uint256[]',
      },
      {
        internalType: 'uint256[]',
        name: 'time',
        type: 'uint256[]',
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
        internalType: 'enum ChallengeBaseStep.ChallengeState',
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
    inputs: [],
    name: 'highIntensityIntervals',
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
    name: 'hiitAchievedOn',
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
    name: 'historyIntervals',
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
    inputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    name: 'historyTime',
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
    name: 'isHiitEnabled',
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
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    name: 'metsWalkingSpeed',
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
        name: '_intervals',
        type: 'uint256[]',
      },
      {
        internalType: 'uint256[]',
        name: '_totalSeconds',
        type: 'uint256[]',
      },
      {
        internalType: 'uint256[]',
        name: '_minutesAtTargetSpeed',
        type: 'uint256[]',
      },
      {
        internalType: 'uint256[]',
        name: '_metsWalkingSpeed',
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
    name: 'totalHighIntensityTime',
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
const challengeHIITContractABI = [
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
    inputs: [
      {
        internalType: 'uint256',
        name: '_day',
        type: 'uint256',
      },
    ],
    name: 'getHIITAchievedOn',
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
    name: 'getHIITConfig',
    outputs: [
      {
        internalType: 'uint256',
        name: '_highIntensityIntervals',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: '_totalHighIntensityTime',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getHIITHistory',
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
      {
        internalType: 'uint256[]',
        name: 'intervals',
        type: 'uint256[]',
      },
      {
        internalType: 'uint256[]',
        name: 'time',
        type: 'uint256[]',
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
        internalType: 'enum ChallengeHIIT.ChallengeState',
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
    name: 'highIntensityIntervals',
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
        name: '_intervals',
        type: 'uint256[]',
      },
      {
        internalType: 'uint256[]',
        name: '_totalSeconds',
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
    name: 'totalHighIntensityTime',
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

// Minimal ABI for origin ChallengeDetail contract (only has getChallengeHistory)
const challengeABI = [
  {
    inputs: [],
    name: 'getChallengeHistory',
    outputs: [
      { internalType: 'uint256[]', name: 'date', type: 'uint256[]' },
      { internalType: 'uint256[]', name: 'data', type: 'uint256[]' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
];

function getRpcUrl() {
  if (process.env.RPC_URL && process.env.RPC_URL.trim() !== '') {
    return process.env.RPC_URL.trim();
  }
  throw new Error('Missing RPC_URL env');
}

const provider = new ethers.JsonRpcProvider(getRpcUrl());

function toStringSafe(value) {
  if (value === null || value === undefined) return '0';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'bigint') return value.toString();
  if (value && typeof value.toString === 'function') return value.toString();
  return '0';
}

function toBigIntSafe(value) {
  try {
    return BigInt(toStringSafe(value));
  } catch {
    return 0n;
  }
}

function hasNonZero(arr) {
  if (!Array.isArray(arr)) return false;
  return arr.some(v => toBigIntSafe(v) !== 0n);
}

function buildHistory(dateArray, ...valueArrays) {
  if (!Array.isArray(dateArray) || dateArray.length === 0) return [];
  const len = dateArray.length;
  const records = [];

  for (let i = 0; i < len; i++) {
    const record = { day: toStringSafe(dateArray[i]) };
    valueArrays.forEach((arr, idx) => {
      if (!Array.isArray(arr)) return;
      const val = i < arr.length ? arr[i] : null;
      record[`v${idx + 1}`] = toStringSafe(val);
    });
    records.push(record);
  }

  return records;
}

function mapChallengeTypeNumber(name) {
  switch (name) {
    case 'ONLY BASE STEP':
      return 1;
    case 'BASE STEP AND WALKING':
      return 2;
    case 'BASE STEP AND HIIT':
      return 3;
    case 'BASE STEP AND WALKING AND HIIT':
      return 4;
    case 'ONLY HIIT':
    case 'ONLY_HIIT':
      return 5;
    default:
      return 0;
  }
}

async function readOrigin(contract) {
  const [historyDate, historyData] = await contract.getChallengeHistory();

  const historyDataDate = historyDate.map(toStringSafe).sort((a, b) => {
    return Number(BigInt(a) - BigInt(b));
  });

  const historyStepData =
    historyDate.length > 0
      ? historyDate.map((d, i) => ({
          day: toStringSafe(d),
          steps: toStringSafe(historyData[i]),
        }))
      : null;

  return {
    challengeType: 'ONLY BASE STEP',
    hiitConfigData: null,
    workingConfigData: null,
    historyDataDate,
    historyStepData,
    historyHiitData: null,
    historyWorkingSpeedData: null,
  };
}

async function detectChallengeType(address) {
  const code = await provider.getCode(address);
  if (!code || code === '0x') {
    throw new Error(`No contract code at address ${address}`);
  }

  // Try BaseStep first (has getChallengeTypeAndHistory)
  const baseStep = new ethers.Contract(
    address,
    challengeBaseStepContractABI,
    provider
  );
  try {
    await baseStep.getChallengeTypeAndHistory();
    return { kind: 'BaseStep', contract: baseStep };
  } catch {
    // not BaseStep, try HIIT
  }

  const hiit = new ethers.Contract(address, challengeHIITContractABI, provider);
  try {
    await hiit.getHIITConfig();
    return { kind: 'HIIT', contract: hiit };
  } catch {
    // not HIIT, try origin ChallengeDetail
  }

  const origin = new ethers.Contract(address, challengeABI, provider);
  try {
    await origin.getChallengeHistory();
    return { kind: 'Origin', contract: origin };
  } catch {
    throw new Error(
      `Address ${address} is not ChallengeBaseStep, ChallengeHIIT, or ChallengeDetail (origin)`
    );
  }
}

async function readBaseStep(contract) {
  const [
    ,
    walkingSpeedDataConfig,
    highIntensityIntervalsConfig,
    totalHighIntensityTimeConfig,
    historyDateStep,
    historyDataStep,
    historyWalkingMinutes,
    historyWalkingMets,
    historyHiitIntervals,
    historyHiitTime,
  ] = await contract.getChallengeTypeAndHistory();

  const hasWalking = hasNonZero(walkingSpeedDataConfig);
  const hasHiit =
    toBigIntSafe(highIntensityIntervalsConfig) !== 0n &&
    toBigIntSafe(totalHighIntensityTimeConfig) !== 0n;

  let challengeType;
  if (!hasWalking && !hasHiit) {
    challengeType = 'ONLY BASE STEP';
  } else if (hasWalking && !hasHiit) {
    challengeType = 'BASE STEP AND WALKING';
  } else if (!hasWalking && hasHiit) {
    challengeType = 'BASE STEP AND HIIT';
  } else {
    challengeType = 'BASE STEP AND WALKING AND HIIT';
  }

  const workingConfigData = hasWalking
    ? {
        targetSpeed: toStringSafe(walkingSpeedDataConfig[0]),
        requiredMinutesPerDay: toStringSafe(walkingSpeedDataConfig[1]),
        minAchievementDays: toStringSafe(walkingSpeedDataConfig[2]),
      }
    : null;

  const hiitConfigData = hasHiit
    ? {
        highIntensityIntervals: toStringSafe(highIntensityIntervalsConfig),
        totalHighIntensityTime: toStringSafe(totalHighIntensityTimeConfig),
      }
    : null;

  const historyStepData =
    Array.isArray(historyDateStep) && historyDateStep.length > 0
      ? buildHistory(historyDateStep, historyDataStep).map(row => ({
          day: row.day,
          steps: row.v1,
        }))
      : null;

  const historyWorkingSpeedData =
    hasWalking &&
    Array.isArray(historyWalkingMinutes) &&
    historyWalkingMinutes.length > 0
      ? buildHistory(
          historyDateStep,
          historyWalkingMinutes,
          historyWalkingMets
        ).map(row => ({
          day: row.day,
          minutesAtTargetSpeed: row.v1,
          metsWalkingSpeed: row.v2,
        }))
      : null;

  const historyHiitData =
    hasHiit &&
    Array.isArray(historyHiitIntervals) &&
    historyHiitIntervals.length > 0
      ? buildHistory(
          historyDateStep,
          historyHiitIntervals,
          historyHiitTime
        ).map(row => ({
          day: row.day,
          intervals: row.v1,
          totalSeconds: row.v2,
        }))
      : null;

  return {
    challengeType,
    hiitConfigData,
    workingConfigData,
    historyDataDate:
      Array.isArray(historyDateStep) && historyDateStep.length > 0
        ? historyDateStep.map(d => toStringSafe(d))
        : null,
    historyStepData,
    historyHiitData,
    historyWorkingSpeedData,
  };
}

async function readHiit(contract) {
  const [highIntensityIntervals, totalHighIntensityTime] =
    await contract.getHIITConfig();

  const [historyDate, historyData, historyIntervals, historyTime] =
    await contract.getHIITHistory();

  const hiitConfigData = {
    highIntensityIntervals: toStringSafe(highIntensityIntervals),
    totalHighIntensityTime: toStringSafe(totalHighIntensityTime),
  };

  const historyHiitData =
    Array.isArray(historyDate) && historyDate.length > 0
      ? buildHistory(
          historyDate,
          historyData,
          historyIntervals,
          historyTime
        ).map(row => ({
          day: row.day,
          achievedFlag: row.v1,
          intervals: row.v2,
          totalSeconds: row.v3,
        }))
      : null;

  return {
    challengeType: 'ONLY HIIT',
    hiitConfigData,
    historyDataDate:
      Array.isArray(historyDate) && historyDate.length > 0
        ? historyDate.map(d => toStringSafe(d))
        : null,
    workingConfigData: null,
    historyStepData: null,
    historyHiitData,
    historyWorkingSpeedData: null,
  };
}

async function getOnchainChallengeData(address) {
  const { kind, contract } = await detectChallengeType(address);

  let data;
  if (kind === 'BaseStep') {
    data = await readBaseStep(contract);
  } else if (kind === 'HIIT') {
    data = await readHiit(contract);
  } else {
    data = await readOrigin(contract);
  }

  const challengeTypeName = data.challengeType;
  const challengeTypeNumber = mapChallengeTypeNumber(challengeTypeName);
  const isBaseStep = kind === 'BaseStep' || kind === 'Origin';
  const isOnlyHiit =
    challengeTypeName === 'ONLY HIIT' || challengeTypeName === 'ONLY_HIIT';

  return {
    isBaseStep,
    isOnlyHiit,
    challengeTypeName,
    challengeTypeNumber,
    challengeType: data.challengeType,
    historyDataDate: data.historyDataDate,
    hiitConfigData: data.hiitConfigData,
    workingConfigData: data.workingConfigData,
    historyStepData: data.historyStepData,
    historyHiitData: data.historyHiitData,
    historyWorkingSpeedData: data.historyWorkingSpeedData,
  };
}

// getOnchainChallengeData(challengeBaseStepContractAddress).then(console.log).catch(console.error);
getOnchainChallengeData('0x959541f8652704747e92c13b2e7f2b182035942c')
  .then(console.log)
  .catch(console.error);
