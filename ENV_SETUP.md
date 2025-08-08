# Environment Setup Guide

## 📋 Checklist Environment Setup

### 1. **Tạo file .env**

```bash
# Copy template và rename
cp env-template.txt .env
```

### 2. **Cấu hình Private Key**

```bash
# Thêm private key của bạn (không có 0x prefix)
PRIVATE_KEY=your_actual_private_key_here
```

⚠️ **QUAN TRỌNG**:

- Không bao giờ commit private key lên git
- File `.env` đã được thêm vào `.gitignore`

### 3. **Cấu hình RPC URLs**

#### Polygon Mainnet:

```bash
POLYGON_RPC_URL=https://polygon-rpc.com
```

**Alternatives:**

- `https://rpc.ankr.com/polygon`
- `https://polygon.llamarpc.com`
- `https://polygon.drpc.org`

#### Amoy Testnet:

```bash
AMOY_RPC_URL=https://polygon-amoy.drpc.org
```

**Alternatives:**

- `https://rpc-amoy.polygon.technology`

### 4. **Cấu hình API Keys**

#### PolygonScan API Key:

1. Đăng ký tại: https://polygonscan.com/apis
2. Tạo API key mới
3. Thêm vào `.env`:

```bash
POLYGONSCAN_API_KEY=your_api_key_here
```

### 5. **Kiểm tra cấu hình**

#### Test connection:

```bash
# Test Amoy testnet
yarn deploy:localhost

# Test Amoy testnet
yarn deploy:amoy

# Test Polygon mainnet (cần POL tokens)
yarn deploy:polygon
```

## 🔧 Troubleshooting

### Lỗi thường gặp:

#### 1. **"insufficient funds for intrinsic transaction cost"**

```bash
# Cần thêm POL/MATIC vào wallet
# Amoy testnet: https://faucet.polygon.technology/
# Mainnet: Mua POL từ exchange
```

#### 2. **"could not detect network"**

```bash
# Kiểm tra RPC URL
# Thử RPC URL khác
POLYGON_RPC_URL=https://rpc.ankr.com/polygon
```

#### 3. **"invalid private key"**

```bash
# Đảm bảo private key không có 0x prefix
# Đảm bảo private key có 64 ký tự
PRIVATE_KEY=abcd1234... # 64 characters
```

#### 4. **"network does not exist"**

```bash
# Kiểm tra hardhat.config.cjs
# Đảm bảo network name đúng: polygon, amoy, localhost
```

## 📊 Network Information

| Network         | Chain ID | RPC URL                       | Explorer                    |
| --------------- | -------- | ----------------------------- | --------------------------- |
| Polygon Mainnet | 137      | https://polygon-rpc.com       | https://polygonscan.com     |
| Amoy Testnet    | 80002    | https://polygon-amoy.drpc.org | https://www.oklink.com/amoy |
| Localhost       | 1337     | http://127.0.0.1:8545         | -                           |

## 🎯 Deployment Commands

```bash
# Compile contracts
yarn compile

# Deploy to different networks
yarn deploy:localhost    # Local development
yarn deploy:amoy        # Testnet deployment
yarn deploy:polygon     # Mainnet deployment

# Verify contracts
yarn verify:contracts:amoy
yarn verify:contracts:polygon

# Run tests
yarn test
yarn test:coverage
```

## 🔐 Security Best Practices

1. **Never commit `.env` file**
2. **Use different wallets for testnet/mainnet**
3. **Keep private keys secure**
4. **Use hardware wallets for mainnet**
5. **Test on Amoy before mainnet deployment**

## 📝 Example .env file

```bash
# Copy from env-template.txt and fill in your values
PRIVATE_KEY=your_64_character_private_key_without_0x_prefix
POLYGON_RPC_URL=https://polygon-rpc.com
AMOY_RPC_URL=https://polygon-amoy.drpc.org
POLYGONSCAN_API_KEY=your_polygonscan_api_key
POL_TOKEN_ADDRESS=0x455e53bd3ba7eCC66C8e1e2c4A1a2A0F4b9A5D0F
DEPLOY_TEST_TOKEN=true
```
