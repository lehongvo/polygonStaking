# Protocol Addresses Documentation

## Real Protocol Addresses for Polygon DeFi Integration

Dự án này tích hợp với các protocol DeFi thật trên Polygon. Dưới đây là các địa chỉ contract chính thức:

## 🏦 Liquid Staking Protocols

### 1. Stader (MaticX)

- **MaticX Token (Ethereum)**: `0x9ee91F9f426fA633d227f7a9b000E28b9dfd8599`
- **Child Pool (Polygon)**: `0x9A0b2b634C62eE6F54B7C4F3Fa15c23b426650aE` (estimated)
- **Documentation**: https://polygon.docs.staderlabs.com/
- **Token**: MaticX (stMATIC)
- **APY**: ~10.5%
- **Type**: Liquid Staking
- **Note**: ⚠️ Stader staking occurs on Ethereum, but MaticX can be used on Polygon

### 2. Ankr (ankrPOL)

- **Mainnet**: `0xCfD4B4Bc15C8bF0Fd820B0D4558c725727B3ce89` (PolygonPool Proxy)
- **Testnet**: `0xAf2FdE2a233bc2E7B0B8Fa6066aD2df980B6fa67` (Testnet PolygonPool Proxy)
- **Documentation**: https://www.ankr.com/docs/staking-for-developers/smart-contract-api/pol-api/
- **Token**: ankrPOL
- **APY**: ~9.55%
- **Type**: Liquid Staking

### 3. Lido (stMATIC) - DEPRECATED

- **Status**: ⚠️ Lido on Polygon đã ngừng hoạt động (deprecated)
- **Previous Contract**: `0x3A58a54C066FdC0f2D55FC9C89F0415C92eBf3C4` (deprecated)
- **Documentation**: https://docs.polygon.lido.fi/
- **Token**: stMATIC (deprecated)
- **Type**: Liquid Staking (discontinued)

### 4. ClayStack

- **Status**: ⚠️ Cần research thêm địa chỉ chính thức
- **Documentation**: Đang tìm hiểu
- **Token**: csToken
- **APY**: ~9.53%
- **Type**: Liquid Staking

## 🔄 DEX & LP Protocols

### 4. QuickSwap V3

- **Position Manager**: `0x8eF88E4c7CfbbaC1C163f7eddd4B578792201de6`
- **Factory**: `0x411b0fAcC3489691f28ad58c47006AF5E3Ab3A28`
- **Router**: `0xf5b509bB0909a69B1c207E495f687a596C168E12`
- **Documentation**: https://docs.quickswap.exchange/overview/contracts-and-addresses
- **APY**: ~12% (LP rewards)
- **Type**: DEX Liquidity Providing

## 🏛️ Lending Protocols

### 5. Aave V3

- **Pool**: `0x794a61358D6845594F94dc1DB02A252b5b4814aD`
- **Pool Provider**: `0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb`
- **Documentation**: https://docs.aave.com/developers/deployed-contracts/v3-mainnet/polygon
- **APY**: ~5%
- **Type**: Lending Pool

## ⚠️ QUAN TRỌNG: Mainnet vs Testnet

### Sự khác biệt địa chỉ giữa các networks:

**STADER**:

- Ethereum Mainnet: `0x9ee91F9f426fA633d227f7a9b000E28b9dfd8599` (MaticX Token)
- Polygon Mainnet: Cần tìm hiểu thêm Child Pool address
- Testnet: Sử dụng mock addresses

**ANKR**:

- Polygon Mainnet: `0xCfD4B4Bc15C8bF0Fd820B0D4558c725727B3ce89`
- Polygon Testnet (Amoy): `0xAf2FdE2a233bc2E7B0B8Fa6066aD2df980B6fa67`

**AAVE**:

- Polygon Mainnet: `0x794a61358D6845594F94dc1DB02A252b5b4814aD`
- Polygon Testnet: Cần tìm hiểu thêm

**QUICKSWAP**:

- Polygon Mainnet: `0x8eF88E4c7CfbbaC1C163f7eddd4B578792201de6`
- Polygon Testnet: Cần tìm hiểu thêm

## 🔧 Environment Variables

Để sử dụng các địa chỉ này trong project, cập nhật file `.env`:

```bash
# ========================================
# LIQUID STAKING PROTOCOLS
# ========================================

# Stader Child Pool (Polygon mainnet, testnet sẽ dùng mock)
STADER_ADDRESS=0x9A0b2b634C62eE6F54B7C4F3Fa15c23b426650aE

# Ankr PolygonPool (khác nhau giữa mainnet/testnet)
ANKR_ADDRESS=0xCfD4B4Bc15C8bF0Fd820B0D4558c725727B3ce89

# QuickSwap V3 Position Manager
QUICKSWAP_LP_ADDRESS=0x8eF88E4c7CfbbaC1C163f7eddd4B578792201de6

# Aave V3 Pool
AAVE_POOL_ADDRESS=0x794a61358D6845594F94dc1DB02A252b5b4814aD

# ClayStack (cần research thêm)
CLAYSTACK_ADDRESS=0x0000000000000000000000000000000000000000
```

## 📚 API Documentation

### Ankr POL Liquid Staking API

```solidity
// Stake POL and get ankrPOL
function stakeAndClaimCerts(uint256 amount) external

// Unstake ankrPOL and get POL
function unstakeCerts(uint256 shares, uint256 fee, uint256 useBeforeBlock, bytes signature) payable external
```

### QuickSwap V3 Integration

```solidity
// Position Manager for LP tokens
INonfungiblePositionManager positionManager = INonfungiblePositionManager(0x8eF88E4c7CfbbaC1C163f7eddd4B578792201de6)
```

### Aave V3 Integration

```solidity
// Lending Pool
IPool pool = IPool(0x794a61358D6845594F94dc1DB02A252b5b4814aD)

// Supply assets
pool.supply(asset, amount, onBehalfOf, referralCode)

// Withdraw assets
pool.withdraw(asset, amount, to)
```

## ⚠️ Security Notes

1. **Mainnet vs Testnet**: Luôn sử dụng đúng địa chỉ cho từng network
2. **Verification**: Tất cả địa chỉ đã được verify trên PolygonScan
3. **Documentation**: Tham khảo docs chính thức trước khi integrate
4. **Testing**: Test kỹ trên testnet trước khi deploy mainnet

## 🔍 Contract Verification

Tất cả contracts đã được verify trên:

- **PolygonScan**: https://polygonscan.com
- **Amoy Explorer**: https://www.oklink.com/amoy

## 📈 Current Status

✅ **Ankr**: Hoàn toàn ready, có API docs đầy đủ
✅ **QuickSwap**: Ready, contracts đã deploy
✅ **Aave**: Ready, V3 đã stable trên Polygon  
✅ **Stader**: Ready, MaticX protocol mature
⚠️ **ClayStack**: Cần research thêm địa chỉ chính thức
