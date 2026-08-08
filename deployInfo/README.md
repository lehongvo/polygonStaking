# Deployment Information

This directory contains deployment information for all contracts deployed in this project.

## ⚠️ CHALLENGE-2735: hardcoded bytecode artifacts are STALE -- do not redeploy from them

The Challenge contract bytecode/ABI hardcoded in three places (this repo's
`scripts/challenge/*/bytecode.json` / `bytecodeAndAbi.json`, ADMIN's `src/assets/byteCode/*.js`,
and BACKEND's `app/abis/ChallengeBaseStep.json`) does **not** contain the security fixes applied
in this review pass (commit `bf1d902` and everything after it in this branch's history) --
confirmed by selector-checking for `relayNonce(address)` (`0x93621656`, added by the
`sendDailyResultViaRelayer` meta-tx relay fix), which is absent from every one of those three
artifact locations as of this note. `yarn gen:bytecode` in this repo only regenerates the two
files here; it does **not** update ADMIN's or BACKEND's copies, and no tooling currently checks
that all three stay in sync.

**Do not use these artifacts to deploy or redeploy a Challenge contract until:**
1. A fresh build-info/bytecode regeneration is run from the exact reviewed commit, AND
2. ADMIN's `src/assets/byteCode/*.js` and BACKEND's `app/abis/ChallengeBaseStep.json` are updated
   from that same regeneration (manually, until CHALLENGE-2735's cross-repo tooling gap is closed),
   AND
3. The resulting artifacts are verified to embed the fixes above (e.g. re-run the selector check)
   before any deploy/verify script is pointed at them.

Separately, BACKEND's Kaia verification input (`app/abis/verify/challenge-standard-input.json`,
sent to Kaiascan) does not byte-match any commit in this repo's available branches -- it contains
a `historyDateIndex` optimization absent from every local revision. Confirming which commit
actually produced the bytecode currently live on Polygon/Kaia mainnet needs the deploying
vendor/owner's input; this cannot be reconstructed from the source available in this clone alone.
See CHALLENGE-2735 for full evidence and the cross-repo regeneration-tooling gap this note does
not by itself close.

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

## Test Coverage (Kaia Mainnet Deployments)

CHALLENGE-2737: mapping each contract deployed to Kaia mainnet (chainId 8217) to the test file(s)
that actually deploy and exercise it, so an untested live deployment is visible at a glance
instead of hiding behind the suite's overall pass count.

| Contract                        | Address (deployInfo file)                                                                    | Test coverage                                                       |
| -------------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| ChallengeFee                     | `0x074a133a378b04FA936A53DAC4049aAa687FB16E` (`challenge-fee-kaia.json`)                       | `test/challengeFee/challenge-fee.test.ts`                             |
| HistoryChallenges                 | `0x8B4a723d12FEe6a45f9FbF3d400FDc8517bB0E9A` (`history-challenges-kaia.json`)                  | `test/historyChallenges/history-challenges-erc20-indexing.test.ts`    |
| ExerciseSupplementNFTSpecial1     | `0x4aEcd6bdb4DCAb9beb8a49F93c04c0C65d060530` (`exercise-supplement-setup-kaia.json`)            | `test/exerciseSupplementSpecial/exercise-supplement-nft-special.test.ts` |
| ExerciseSupplementNFTSpecial2     | `0xC1849D39bb4003039089cC46AC55D480EfF045F0` (`exercise-supplement-setup-kaia.json`)            | `test/exerciseSupplementSpecial/exercise-supplement-nft-special.test.ts` |

Update this table whenever a new contract is deployed to Kaia mainnet, or when its test file
moves/is renamed.

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
