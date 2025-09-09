# ChallengeDetailV2 Deployment Scripts

Scripts để deploy, verify và quản lý ChallengeDetailV2 contract với PolygonDeFi integration.

## 📁 Files

- `deploy-challenge-detail-v2.ts` - Script deploy contract
- `verify-challenge-detail-v2.ts` - Script verify contract
- `config/challenge-deployment.{network}.json` - Config files cho từng network

## 🚀 Usage

### 1. Deploy Contract

```bash
# Deploy trên Amoy testnet
yarn deploy:challenge:amoy

# Deploy trên Polygon mainnet
yarn deploy:challenge:polygon
```

### 2. Verify Contract

```bash
# Verify trên Amoy testnet
yarn verify:challenge:amoy

# Verify trên Polygon mainnet
yarn verify:challenge:polygon
```

## ⚙️ Configuration

### Environment Variables

Tạo file `.env` với các biến sau:

```env
# Deployer address
DEPLOYER_ADDRESS=0x...

# ExerciseSupplementNFT contract address
EXERCISE_SUPPLEMENT_NFT=0x...

# Challenge fee contract address
CHALLENGE_FEE=0x...

# TTJP token address (optional)
TTJP_TOKEN=0x...
```

### Config Files

Chỉnh sửa file config trong `scripts/config/`:

```json
{
  "stakeHolders": [
    "0x...", // sponsor
    "0x...", // challenger
    "0x..."  // feeAddress
  ],
  "createByToken": "0x0000000000000000000000000000000000000000", // address(0) for MATIC
  "erc721Addresses": ["0x..."],
  "awardReceivers": ["0x..."],
  "totalAmount": "1.0", // in ETH/MATIC
  "exerciseSupplementNFT": "0x..."
}
```

## 📊 Deployment Info

Sau khi deploy, thông tin sẽ được lưu trong `deployInfo/challenge-detail-v2-{network}.json`:

```json
{
  "network": "polygon",
  "contractName": "ChallengeDetailV2",
  "contractAddress": "0x...",
  "deployer": "0x...",
  "deploymentTime": "2024-01-01T00:00:00.000Z",
  "blockNumber": 12345678,
  "contractDetails": {
    "sponsor": "0x...",
    "challenger": "0x...",
    "startTime": 1704067200,
    "endTime": 1704672000,
    "goal": 1000,
    "dayRequired": 7,
    "stakingStakeId": 123,
    "autoStaking": true
  },
  "stakingInfo": {
    "enabled": true,
    "stakeId": 123,
    "tokenType": "MATIC",
    "protocol": "aave_lending",
    "duration": 604800
  },
  "verification": {
    "verified": true,
    "explorerUrl": "https://polygonscan.com/address/0x..."
  }
}
```

## 🔧 Features

### Auto-staking
- Contract tự động stake khi deploy
- Duration = endTime - startTime
- Protocol tự động xác định dựa trên token type

### Token Support
- **MATIC**: `createByToken = address(0)`
- **ERC20**: `createByToken = token address`

### Events
- `StakingCreated(stakeId, amount, duration)`
- `StakingWithdrawn(stakeId)`

## 🧪 Testing

Sau khi deploy, contract sẽ:
1. ✅ Tự động stake với PolygonDeFi
2. ✅ Track challenge duration
3. ✅ Emit events cho staking operations
4. ✅ Support cả MATIC và ERC20 staking

## 📝 Notes

- Contract sẽ tự động stake ngay khi deploy
- Staking duration = challenge duration (endTime - startTime)
- Protocol luôn là "aave_lending"
- Cần đủ balance để stake (MATIC hoặc ERC20 tokens)
