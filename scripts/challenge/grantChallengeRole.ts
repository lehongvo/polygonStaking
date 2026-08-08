import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { ethers } from 'ethers';

const ExerciseSupplementNFT_ABI = [
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: 'address',
        name: 'previousAdmin',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'address',
        name: 'newAdmin',
        type: 'address',
      },
    ],
    name: 'AdminChanged',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'owner',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'approved',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'uint256',
        name: 'tokenId',
        type: 'uint256',
      },
    ],
    name: 'Approval',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'owner',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'operator',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'bool',
        name: 'approved',
        type: 'bool',
      },
    ],
    name: 'ApprovalForAll',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'beacon',
        type: 'address',
      },
    ],
    name: 'BeaconUpgraded',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: 'uint8',
        name: 'version',
        type: 'uint8',
      },
    ],
    name: 'Initialized',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'bytes32',
        name: 'role',
        type: 'bytes32',
      },
      {
        indexed: true,
        internalType: 'bytes32',
        name: 'previousAdminRole',
        type: 'bytes32',
      },
      {
        indexed: true,
        internalType: 'bytes32',
        name: 'newAdminRole',
        type: 'bytes32',
      },
    ],
    name: 'RoleAdminChanged',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'bytes32',
        name: 'role',
        type: 'bytes32',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'account',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'sender',
        type: 'address',
      },
    ],
    name: 'RoleGranted',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'bytes32',
        name: 'role',
        type: 'bytes32',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'account',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'sender',
        type: 'address',
      },
    ],
    name: 'RoleRevoked',
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
      {
        indexed: true,
        internalType: 'address',
        name: 'to',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'uint256',
        name: 'tokenId',
        type: 'uint256',
      },
    ],
    name: 'Transfer',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'implementation',
        type: 'address',
      },
    ],
    name: 'Upgraded',
    type: 'event',
  },
  {
    inputs: [],
    name: 'ALLOWED_CONTRACTS_CHALLENGE',
    outputs: [
      {
        internalType: 'bytes32',
        name: '',
        type: 'bytes32',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'ALLOWED_CONTRACTS_GACHA',
    outputs: [
      {
        internalType: 'bytes32',
        name: '',
        type: 'bytes32',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'DEFAULT_ADMIN_ROLE',
    outputs: [
      {
        internalType: 'bytes32',
        name: '',
        type: 'bytes32',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'MINTER_ROLE',
    outputs: [
      {
        internalType: 'bytes32',
        name: '',
        type: 'bytes32',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'UPDATER_ACTIVITIES_ROLE',
    outputs: [
      {
        internalType: 'bytes32',
        name: '',
        type: 'bytes32',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'UPGRADER_ROLE',
    outputs: [
      {
        internalType: 'bytes32',
        name: '',
        type: 'bytes32',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'to',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: 'tokenId',
        type: 'uint256',
      },
    ],
    name: 'approve',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'owner',
        type: 'address',
      },
    ],
    name: 'balanceOf',
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
    name: 'baseURI',
    outputs: [
      {
        internalType: 'string',
        name: '',
        type: 'string',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'bytes32',
        name: '_role',
        type: 'bytes32',
      },
      {
        internalType: 'address[]',
        name: '_accounts',
        type: 'address[]',
      },
    ],
    name: 'batchGrantRole',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: 'tokenId',
        type: 'uint256',
      },
    ],
    name: 'burn',
    outputs: [],
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
    ],
    name: 'checkValidSignature',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'donationWalletAddress',
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
    name: 'feeSettingAddress',
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
        name: 'tokenId',
        type: 'uint256',
      },
    ],
    name: 'getApproved',
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
    name: 'getErc20ListAddress',
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
        name: 'tokenId',
        type: 'uint256',
      },
      {
        internalType: 'address',
        name: 'to',
        type: 'address',
      },
    ],
    name: 'getHistoryNFT',
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
    name: 'getListGachaAddress',
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
    inputs: [],
    name: 'getListToleranceAmount',
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
    name: 'getNftListAddress',
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
        internalType: 'bytes32',
        name: 'role',
        type: 'bytes32',
      },
    ],
    name: 'getRoleAdmin',
    outputs: [
      {
        internalType: 'bytes32',
        name: '',
        type: 'bytes32',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getSpecialNftAddress',
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
        internalType: 'address',
        name: '_erc20Address',
        type: 'address',
      },
    ],
    name: 'getTypeTokenErc20',
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
        internalType: 'bytes32',
        name: 'role',
        type: 'bytes32',
      },
      {
        internalType: 'address',
        name: 'account',
        type: 'address',
      },
    ],
    name: 'grantRole',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'bytes32',
        name: 'role',
        type: 'bytes32',
      },
      {
        internalType: 'address',
        name: 'account',
        type: 'address',
      },
    ],
    name: 'hasRole',
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
        internalType: 'string',
        name: '_initBaseURI',
        type: 'string',
      },
      {
        internalType: 'address',
        name: '_donationWalletAddress',
        type: 'address',
      },
      {
        internalType: 'address',
        name: '_feeSettingAddress',
        type: 'address',
      },
      {
        internalType: 'address',
        name: '_returnedNFTWallet',
        type: 'address',
      },
    ],
    name: 'initialize',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'owner',
        type: 'address',
      },
      {
        internalType: 'address',
        name: 'operator',
        type: 'address',
      },
    ],
    name: 'isApprovedForAll',
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
    name: 'listNftSpecialConditionInfo',
    outputs: [
      {
        internalType: 'uint256',
        name: 'targetStepPerDay',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'challengeDuration',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'amountDepositMatic',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'amountDepositTTJP',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'amountDepositJPYC',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'dividendSuccess',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'name',
    outputs: [
      {
        internalType: 'string',
        name: '',
        type: 'string',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'nextTokenIdToMint',
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
        name: 'tokenId',
        type: 'uint256',
      },
    ],
    name: 'ownerOf',
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
    name: 'proxiableUUID',
    outputs: [
      {
        internalType: 'bytes32',
        name: '',
        type: 'bytes32',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'bytes32',
        name: 'role',
        type: 'bytes32',
      },
      {
        internalType: 'address',
        name: 'account',
        type: 'address',
      },
    ],
    name: 'renounceRole',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'returnedNFTWallet',
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
        internalType: 'bytes32',
        name: 'role',
        type: 'bytes32',
      },
      {
        internalType: 'address',
        name: 'account',
        type: 'address',
      },
    ],
    name: 'revokeRole',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'to',
        type: 'address',
      },
    ],
    name: 'safeMint',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '_goal',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: '_duration',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: '_dayRequired',
        type: 'uint256',
      },
      {
        internalType: 'address',
        name: '_createByToken',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: '_totalReward',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: '_awardReceiversPercent',
        type: 'uint256',
      },
      {
        internalType: 'address',
        name: '_awardReceivers',
        type: 'address',
      },
      {
        internalType: 'address',
        name: '_challenger',
        type: 'address',
      },
    ],
    name: 'safeMintNFT',
    outputs: [
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
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '_tokenAddress',
        type: 'address',
      },
      {
        internalType: 'address',
        name: '_challengerAddress',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: '_indexToken',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: '_rewardToken',
        type: 'uint256',
      },
    ],
    name: 'safeMintNFT1155Heper',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '_tokenAddress',
        type: 'address',
      },
      {
        internalType: 'address',
        name: '_challengerAddress',
        type: 'address',
      },
    ],
    name: 'safeMintNFT721Heper',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'from',
        type: 'address',
      },
      {
        internalType: 'address',
        name: 'to',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: 'tokenId',
        type: 'uint256',
      },
    ],
    name: 'safeTransferFrom',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'from',
        type: 'address',
      },
      {
        internalType: 'address',
        name: 'to',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: 'tokenId',
        type: 'uint256',
      },
      {
        internalType: 'bytes',
        name: 'data',
        type: 'bytes',
      },
    ],
    name: 'safeTransferFrom',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'securityAddress',
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
        internalType: 'address',
        name: 'operator',
        type: 'address',
      },
      {
        internalType: 'bool',
        name: 'approved',
        type: 'bool',
      },
    ],
    name: 'setApprovalForAll',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'string',
        name: '_newBaseExtension',
        type: 'string',
      },
    ],
    name: 'setBaseExtension',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'string',
        name: '_newBaseURI',
        type: 'string',
      },
    ],
    name: 'setBaseURI',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'setData',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'bytes4',
        name: 'interfaceId',
        type: 'bytes4',
      },
    ],
    name: 'supportsInterface',
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
    name: 'symbol',
    outputs: [
      {
        internalType: 'string',
        name: '',
        type: 'string',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: 'tokenId',
        type: 'uint256',
      },
    ],
    name: 'tokenURI',
    outputs: [
      {
        internalType: 'string',
        name: '',
        type: 'string',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'from',
        type: 'address',
      },
      {
        internalType: 'address',
        name: 'to',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: 'tokenId',
        type: 'uint256',
      },
    ],
    name: 'transferFrom',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address',
      },
    ],
    name: 'typeNfts',
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
        name: '_donationWalletAddress',
        type: 'address',
      },
    ],
    name: 'updateDonationWalletAddress',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '_feeSettingAddress',
        type: 'address',
      },
    ],
    name: 'updateFeeSettingAddress',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '_gachaContractAddress',
        type: 'address',
      },
      {
        internalType: 'bool',
        name: '_flag',
        type: 'bool',
      },
    ],
    name: 'updateGachaContractAddress',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '_erc20Address',
        type: 'address',
      },
      {
        internalType: 'bool',
        name: '_flag',
        type: 'bool',
      },
    ],
    name: 'updateListERC20Address',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '_nftAddress',
        type: 'address',
      },
      {
        internalType: 'bool',
        name: '_flag',
        type: 'bool',
      },
      {
        internalType: 'bool',
        name: '_isTypeErc721',
        type: 'bool',
      },
    ],
    name: 'updateNftListAddress',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '_returnedNFTWallet',
        type: 'address',
      },
    ],
    name: 'updateReturnedNFTWallet',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: 'targetStepPerDay',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'challengeDuration',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'amountDepositMatic',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'amountDepositTTJP',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'amountDepositJPYC',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'dividendSuccess',
        type: 'uint256',
      },
    ],
    name: 'updateSpecialConditionInfo',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '_nftAddress',
        type: 'address',
      },
      {
        internalType: 'bool',
        name: '_flag',
        type: 'bool',
      },
    ],
    name: 'updateSpecialNftAddress',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '_toleranceAmount',
        type: 'uint256',
      },
      {
        internalType: 'bool',
        name: '_flag',
        type: 'bool',
      },
    ],
    name: 'updateToleranceAmount',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'newImplementation',
        type: 'address',
      },
    ],
    name: 'upgradeTo',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'newImplementation',
        type: 'address',
      },
      {
        internalType: 'bytes',
        name: 'data',
        type: 'bytes',
      },
    ],
    name: 'upgradeToAndCall',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
] as const;

// CHALLENGE-2672 (TANIMOTO re-review): minimal AccessControlUpgradeable ABI for granting
// Gacha's CHALLENGE_ROLE. This is a distinct, separately-deployed contract from
// ExerciseSupplementNFT -- the two roles must be granted independently.
const Gacha_ABI = [
  {
    inputs: [],
    name: 'CHALLENGE_ROLE',
    outputs: [{ internalType: 'bytes32', name: '', type: 'bytes32' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'bytes32', name: 'role', type: 'bytes32' },
      { internalType: 'address', name: 'account', type: 'address' },
    ],
    name: 'grantRole',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'bytes32', name: 'role', type: 'bytes32' },
      { internalType: 'address', name: 'account', type: 'address' },
    ],
    name: 'hasRole',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// Hardhat network is resolved lazily at call time so this helper can be
// imported from scripts that run on different networks (polygon/sepolia).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const hre = require('hardhat');

const adminKey = process.env.ADMIN_PRIVATE_KEY;

/** Return the RPC URL for the currently selected hardhat network. */
function getRpcUrl(): string {
  const name = hre.network.name;
  if (name === 'sepolia') return process.env.SEPOLIA_RPC_URL ?? '';
  if (name === 'amoy') return process.env.AMOY_RPC_URL ?? '';
  return process.env.POLYGON_RPC_URL ?? '';
}

/** Return the ExerciseSupplementNFT proxy address for the current network. */
function getExerciseSupplementNFTAddress(): string {
  const name = hre.network.name;
  if (name === 'sepolia')
    return process.env.EXERCISE_SUPPLEMENT_NFT_ADDRESS_SEPOLIA ?? '';
  return process.env.EXERCISE_SUPPLEMENT_NFT_ADDRESS ?? '';
}

// CHALLENGE-2672 (TANIMOTO re-review): a Challenge contract is not tied to a single Gacha
// instance at deploy time -- it passes whichever Gacha address it wants at sendDailyResult
// call time, so every legitimate reward-pool Gacha proxy on a network must grant this
// Challenge its CHALLENGE_ROLE for daily settlement to succeed against any of them.
//
// The authoritative inventory of deployed Gacha proxies already exists at
// docs/contractAddress/gachaAddress.json (the same file scripts/gacha/upgrade-gacha-proxies.ts
// reads) -- deriving from it here, rather than a separately-maintained env var, avoids a second
// source of truth that can silently drift from what's actually deployed (per TANIMOTO's
// acceptance criterion: "Derive every legitimate Gacha<->Challenge relationship from an
// authoritative registry"). GACHA_ADDRESSES[_SEPOLIA] remains as an override/addition for
// networks (e.g. amoy/sepolia test deployments) not yet present in that registry.
/** Return every known Gacha proxy address for the current network. */
export function getGachaAddresses(): string[] {
  const name = hre.network.name;

  const registryPath = path.join(
    process.cwd(),
    'docs',
    'contractAddress',
    'gachaAddress.json'
  );
  const fromRegistry: string[] = fs.existsSync(registryPath)
    ? (JSON.parse(fs.readFileSync(registryPath, 'utf8')) as Array<{
        Network: string;
        GachaProxyAddress: string;
      }>)
        .filter(entry => entry.Network === name)
        .map(entry => entry.GachaProxyAddress)
    : [];

  const fromEnvRaw =
    (name === 'sepolia'
      ? process.env.GACHA_ADDRESSES_SEPOLIA
      : process.env.GACHA_ADDRESSES) ?? '';
  const fromEnv = fromEnvRaw
    .split(',')
    .map(addr => addr.trim())
    .filter(addr => addr.length > 0);

  return Array.from(new Set([...fromRegistry, ...fromEnv]));
}

/**
 * Grant Gacha's CHALLENGE_ROLE to `challengeAddress` on every configured Gacha proxy for the
 * current network. Idempotent per-address (skips one that already has the role). Throws on the
 * first failure -- callers must NOT treat a Challenge as ready if this rejects.
 */
const grantGachaChallengeRole = async (
  challengeAddress: string
): Promise<string[]> => {
  const gachaAddresses = getGachaAddresses();
  if (gachaAddresses.length === 0) {
    throw new Error(
      `No Gacha proxy addresses found for network ${hre.network.name}: none in docs/contractAddress/gachaAddress.json and GACHA_ADDRESSES[_SEPOLIA] is unset. If this network genuinely has no Gacha deployments, this should not have been reached; otherwise add the missing address(es).`
    );
  }

  const rpcUrl = getRpcUrl();
  if (!rpcUrl) {
    throw new Error(
      `Missing RPC URL for network ${hre.network.name}. Set the appropriate *_RPC_URL env var in .env.`
    );
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(adminKey?.toString() || '', provider);

  const results: string[] = [];
  for (const gachaAddress of gachaAddresses) {
    console.log('\n================================================');
    console.log(
      `Granting Gacha CHALLENGE_ROLE on network=${hre.network.name} gacha=${gachaAddress} to challenge address`,
      challengeAddress
    );

    const gacha = new ethers.Contract(gachaAddress, Gacha_ABI, signer);
    const challengeRole = await gacha.CHALLENGE_ROLE();
    const alreadyHasRole = await gacha.hasRole(challengeRole, challengeAddress);
    if (alreadyHasRole) {
      console.log('✅ Challenge address already has CHALLENGE_ROLE on this Gacha — skip grant');
      console.log('================================================\n');
      results.push('already_granted');
      continue;
    }

    const grantTx = await gacha.grantRole(challengeRole, challengeAddress);
    const receipt = await grantTx.wait();
    console.log(`✅ Transaction hash: ${grantTx.hash}`);
    console.log('================================================\n');
    results.push(grantTx.hash);
  }

  return results;
};

/**
 * Grant every role a new Challenge contract needs to operate: ALLOWED_CONTRACTS_CHALLENGE on
 * ExerciseSupplementNFT, and CHALLENGE_ROLE on every configured Gacha proxy. Deliberately does
 * NOT swallow errors (unlike the two individual grant functions' internal try/catch, which only
 * exists to log context before rethrowing) -- a deploy script calling this must halt and refuse
 * to treat the Challenge as ready if any registration fails, per CHALLENGE-2672's re-review.
 */
export const grantAllChallengeRoles = async (
  challengeAddress: string
): Promise<{ exerciseSupplementNFT: string; gacha: string[] }> => {
  const exerciseSupplementNFT = await batchGrantRole(challengeAddress);
  const gacha = await grantGachaChallengeRole(challengeAddress);
  return { exerciseSupplementNFT, gacha };
};

const batchGrantRole = async (challengeAddress: string): Promise<string> => {
  try {
    console.log('\n================================================');
    console.log(
      `Batch grant role on network=${hre.network.name} to challenge address`,
      challengeAddress
    );

    const rpcUrl = getRpcUrl();
    const ExerciseSupplementNFTAddress = getExerciseSupplementNFTAddress();
    if (!rpcUrl) {
      throw new Error(
        `Missing RPC URL for network ${hre.network.name}. Set the appropriate *_RPC_URL env var in .env.`
      );
    }
    if (!ExerciseSupplementNFTAddress) {
      throw new Error(
        `Missing ExerciseSupplementNFT address for network ${hre.network.name}. Set the appropriate EXERCISE_SUPPLEMENT_NFT_ADDRESS[_SEPOLIA] env var in .env.`
      );
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const signer = new ethers.Wallet(adminKey?.toString() || '', provider);
    const listChallengeAddress = [challengeAddress.toString()];

    console.log('Active by account', signer.address);

    const exerciseSupplementNFT = new ethers.Contract(
      ExerciseSupplementNFTAddress || '',
      ExerciseSupplementNFT_ABI,
      signer
    );

    const allowedContractChallengeRole =
      await exerciseSupplementNFT.ALLOWED_CONTRACTS_CHALLENGE();

    const alreadyHasRole = await exerciseSupplementNFT.hasRole(
      allowedContractChallengeRole,
      challengeAddress
    );
    if (alreadyHasRole) {
      console.log(
        '✅ Challenge address already has ALLOWED_CONTRACTS_CHALLENGE role — skip grant'
      );
      console.log('================================================\n');
      return 'already_granted';
    }

    const gasPrice = await provider.getFeeData();

    const etmBatchGrantRole =
      await exerciseSupplementNFT.batchGrantRole.estimateGas(
        allowedContractChallengeRole,
        listChallengeAddress
      );

    const batchGrantRoleTx = await exerciseSupplementNFT.batchGrantRole(
      allowedContractChallengeRole,
      listChallengeAddress,
      {
        gasLimit: ethers.toBeHex(Math.ceil(Number(etmBatchGrantRole) * 1.1)),
        gasPrice: ethers.toBeHex(Math.ceil(Number(gasPrice.gasPrice) * 1.1)),
      }
    );

    const receipt = await batchGrantRoleTx.wait();
    console.log(`✅ Transaction hash: ${batchGrantRoleTx.hash}`);
    console.log('================================================\n');

    return batchGrantRoleTx.hash;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

export default batchGrantRole;
