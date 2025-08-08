# Deployment Information

This directory contains deployment information for all contracts deployed in this project.

## File Structure

### Current Deployments

- **`polygon-defi-deployment.json`** - PolygonDeFiAggregator contract on Polygon mainnet
- **`exercise-nft-deployment.json`** - ExerciseSupplementNFT contract on Polygon mainnet
- **`soulbound-nft-deployment.json`** - SoulBoundNFT contract on Polygon mainnet
- **`yoboweb3walk-polygon.json`** - YOBOWEB3WALK contract on Polygon mainnet
- **`yoboweb3walk-localhost.json`** - YOBOWEB3WALK contract on localhost (testing)

### Legacy Files

- **`deployment-info.json`** - Legacy deployment info with multiple networks (Amoy testnet deployments)

## File Format

Each deployment file follows this structure:

```json
{
  "network": "polygon",
  "chainId": 137,
  "explorer": "https://polygonscan.com",
  "deployer": "0x...",
  "contractName": "ContractName",
  "contractAddress": "0x...",
  "constructorArgs": [...],
  "deploymentDate": "2025-08-08T...",
  "verified": true
}
```

## Usage in Scripts

Scripts reference these files using relative paths:

```typescript
// From scripts/defi/ directory
const deploymentPath = path.join(
  __dirname,
  '../../deployInfo/polygon-defi-deployment.json'
);

// From scripts/verify/ directory
const deploymentPath = path.join(
  __dirname,
  '../../deployInfo/polygon-defi-deployment.json'
);

// From project root
const deploymentPath = './deployInfo/polygon-defi-deployment.json';
```

## Contract Addresses (Polygon Mainnet)

| Contract              | Address                                      | Explorer                                                                           |
| --------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------- |
| PolygonDeFiAggregator | `0x860b1308E5BC214FbCDC00ED481B98fCdCA95Fd5` | [View](https://polygonscan.com/address/0x860b1308E5BC214FbCDC00ED481B98fCdCA95Fd5) |
| ExerciseSupplementNFT | `0x5f6E8dC2E8D99CC81F42200b91C3D4008c71e56F` | [View](https://polygonscan.com/address/0x5f6E8dC2E8D99CC81F42200b91C3D4008c71e56F) |
| SoulBoundNFT          | `0x39E16281D4668b393303c6A03fa75e2f84d6404B` | [View](https://polygonscan.com/address/0x39E16281D4668b393303c6A03fa75e2f84d6404B) |
| YOBOWEB3WALK          | `0xF41D70Bd4aE673A3B62A244cBe39270eccFBb9d9` | [View](https://polygonscan.com/address/0xF41D70Bd4aE673A3B62A244cBe39270eccFBb9d9) |

## Scripts That Use These Files

### DeFi Scripts

- `scripts/defi/test-interest-calculation.ts`
- `scripts/defi/test-stake-withdraw.ts`
- `scripts/defi/test-native-matic-staking.ts`
- `scripts/defi/setup-polygon-defi.ts` (creates file)
- `scripts/verify/verify-polygon-defi.ts`

### NFT Scripts

- `scripts/nft/deploy-yoboweb3walk.ts` (creates file)

### Production Scripts

- `scripts/defi/deploy-production.ts` (creates file)

## Notes

- All deployment files are automatically created by deployment scripts
- Contract verification status is tracked in each file
- Explorer URLs are generated automatically based on network
- Constructor arguments are preserved for verification purposes
