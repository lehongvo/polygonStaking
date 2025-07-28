# 🚀 Polygon DeFi Staking Aggregator

**Contract trung gian cho DeFi yield farming trên Polygon PoS**

## 🎯 Mục đích

**PolygonDeFiAggregator** giúp users stake POL token qua các **DeFi protocols trên Polygon PoS** để earn yield:

- 🟢 **Stader** - MaticX (APY ~10.5%)
- 🟢 **ClayStack** - csMATIC (APY ~9.53%) 
- 🟢 **Ankr** - aMATICb/aMATICc (APY ~9.55%)
- 🔵 **QuickSwap LP** - Liquidity staking (APY ~12%)
- 🟡 **Aave Lending** - Lending protocol (APY ~5%)

## 🏗 Cấu trúc

```
PolygonDeFiAggregator.sol
├── 📝 Main Functions
│   ├── stake(amount, protocol)      // Stake POL qua protocol
│   ├── withdrawImmediately(amount, protocol) // Withdraw ngay  
│   └── claim()                      // Claim rewards từ tất cả
├── 🔧 Admin Functions
│   ├── addProtocol(name, address, type, apy)
│   ├── updateProtocolAPY(protocol, newAPY)
│   └── setProtocolStatus(protocol, active)
└── 📊 View Functions
    ├── getUserTotalPosition(user)
    ├── getUserProtocolPosition(user, protocol)
    └── getAllProtocols()
```

## 🛠 Setup và Deploy

### 1. **Cài đặt dependencies**
```bash
yarn install
```

### 2. **Copy environment file**
```bash
cp .env.example .env
# Edit .env với private key và RPC URLs
```

### 3. **Deploy trên testnet**
```bash
# Deploy với test tokens
DEPLOY_TEST_TOKEN=true npx hardhat run scripts/setup-polygon-defi.ts --network localhost

# Hoặc deploy trên Mumbai testnet
npx hardhat run scripts/setup-polygon-defi.ts --network mumbai
```

### 4. **Deploy trên Polygon mainnet**
```bash
# Update .env với real protocol addresses
DEPLOY_TEST_TOKEN=false npx hardhat run scripts/setup-polygon-defi.ts --network polygon
```

## 💼 Sử dụng Contract

### 🔥 **Stake POL qua protocols**

```javascript
// Approve POL token
await polToken.approve(aggregatorAddress, ethers.parseEther("1000"));

// Stake 100 POL qua Stader
await defiAggregator.stake(ethers.parseEther("100"), "stader");

// Stake 50 POL qua ClayStack  
await defiAggregator.stake(ethers.parseEther("50"), "claystack");

// Stake 75 POL qua Ankr
await defiAggregator.stake(ethers.parseEther("75"), "ankr");
```

### 💰 **Claim rewards**

```javascript
// Claim tất cả rewards từ mọi protocols
await defiAggregator.claim();
```

### 🔄 **Withdraw immediately**

```javascript
// Withdraw 50 POL từ Stader (có penalty nếu < 7 ngày)
await defiAggregator.withdrawImmediately(ethers.parseEther("50"), "stader");
```

### 📊 **Check positions**

```javascript
// Xem tổng position của user
const totalPosition = await defiAggregator.getUserTotalPosition(userAddress);
console.log("Total deposited:", ethers.formatEther(totalPosition.totalDeposited));
console.log("Total claimed:", ethers.formatEther(totalPosition.totalClaimed));
console.log("Estimated value:", ethers.formatEther(totalPosition.estimatedValue));

// Xem position trong protocol cụ thể
const staderPosition = await defiAggregator.getUserProtocolPosition(userAddress, "stader");
console.log("Stader balance:", ethers.formatEther(staderPosition.balance));
console.log("Estimated rewards:", ethers.formatEther(staderPosition.estimatedRewards));

// Xem tất cả protocols
const allProtocols = await defiAggregator.getAllProtocols();
console.log("Protocol names:", allProtocols.names);
console.log("APYs:", allProtocols.apys.map(apy => Number(apy) / 100 + "%"));
console.log("TVLs:", allProtocols.tvls.map(tvl => ethers.formatEther(tvl)));
```

## 🔧 Protocol Types

Contract hỗ trợ **4 loại DeFi protocols**:

### 1. **Liquid Staking** (`"liquid"`)
- Stader, ClayStack, Ankr
- User stake POL → nhận derivative tokens (MaticX, csMATIC...)
- Derivative tokens có thể trade hoặc dùng trong DeFi

### 2. **Lending** (`"lending"`)  
- Aave, Compound-style protocols
- User lend POL → earn interest
- Lower risk, stable returns

### 3. **LP Staking** (`"lp"`)
- QuickSwap, SushiSwap, Uniswap V3
- User provide liquidity → earn trading fees + rewards
- Higher APY but có impermanent loss risk

### 4. **Compound** (`"compound"`)
- Compound-style lending protocols
- Similar to lending nhưng với cToken mechanism

## 🌐 Network Addresses

### **Polygon PoS Mainnet (Chain ID: 137)**
```
POL Token: 0x455e53bd3ba7eCC66C8e1e2c4A1a2A0F4b9A5D0F
DeFi Aggregator: 0x... (deploy khi ready)

Protocol Addresses (update with real ones):
- Stader: 0x...
- ClayStack: 0x...  
- Ankr: 0x...
- QuickSwap: 0x...
- Aave: 0x...
```

### **Mumbai Testnet (Chain ID: 80001)**
```
Test POL: 0x... (deployed during setup)
DeFi Aggregator: 0x... (deployed during setup)
```

## 📊 Performance Tracking

Contract track các metrics quan trọng:

- **TVL per protocol** - Total value locked
- **User positions** - Balance, shares, rewards
- **APY updates** - Real-time APY changes
- **Penalty calculation** - Early withdrawal fees
- **Reward distribution** - Auto-compound logic

## 🔐 Security Features

- ✅ **ReentrancyGuard** - Chống reentrancy attacks
- ✅ **Pausable** - Emergency pause functionality
- ✅ **Ownable** - Admin access control  
- ✅ **SafeERC20** - Safe token transfers
- ✅ **Try-catch** - Graceful error handling khi protocols fail

## 🎯 Roadmap

### Phase 1: Core Features ✅
- [x] Basic staking/withdrawal
- [x] Multi-protocol support
- [x] Reward claiming
- [x] Performance tracking

### Phase 2: Advanced Features 🔄
- [ ] Auto-compound strategies
- [ ] Yield optimization (auto-switch protocols)
- [ ] Slippage protection
- [ ] Batch operations

### Phase 3: Ecosystem Integration 📋
- [ ] Frontend dashboard
- [ ] Mobile app integration
- [ ] Cross-chain bridges
- [ ] Governance token

## 🚨 Risks và Disclaimers

**⚠️ DeFi Risks:**
- **Smart contract risk** - Protocol bugs có thể dẫn đến loss of funds
- **Market risk** - POL price volatility
- **Liquidity risk** - Có thể không withdraw được ngay lập tức
- **Protocol risk** - Third-party protocols có thể fail

**💡 Best Practices:**
- Diversify across multiple protocols
- Only invest what you can afford to lose
- Monitor APY changes và protocol health
- Keep emergency funds for gas fees

## 📞 Support

- **Documentation**: docs/
- **Discord**: [Polygon Discord](https://discord.gg/polygon)
- **Issues**: GitHub Issues tab
- **Security**: security@polygonstaking.xyz

---

**Built for Polygon DeFi Ecosystem 🟣** 