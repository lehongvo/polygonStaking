# Flattened Contracts

Single-file output cho 3 challenge contract đã patched. Dùng để verify on Polygonscan/Etherscan hoặc manual audit.

## Files

| File | Lines | Source |
|---|---|---|
| `ChallengeBaseStep.flat.sol` | ~1924 | `contracts/ChallengeDetail/ChallengeBaseStep.sol` |
| `ChallengeDetail.flat.sol` | ~1622 | `contracts/ChallengeDetail/ChallengeDetail.sol` |
| `ChallengeHIIT.flat.sol` | ~1636 | `contracts/ChallengeDetail/ChallengeHIIT.sol` |

## Properties

- **SPDX:** 1 per file (canonical)
- **pragma:** 9 per file (1 per inlined sub-file, all compatible 0.8.x)
- **Imports:** 0 (mọi interface/library đã inline)
- **Compile:** `solc 0.8.28 --optimize --via-ir` clean standalone

## Regenerate

Source contracts đổi → re-run:

```bash
npm run flatten
```

Hoặc manual:

```bash
PRIVATE_KEY="" npx hardhat flatten contracts/ChallengeDetail/ChallengeBaseStep.sol \
  | sed '/^WARNING:/d' > flattened/ChallengeBaseStep.flat.sol
```

## Verify on Polygonscan

1. Mở `https://polygonscan.com/address/<deployed_address>#code`
2. Click "Verify and Publish"
3. Compiler: `0.8.28+commit.7893614a`
4. Optimization: `Yes`, runs: `1`
5. EVM Version: `paris`
6. Other settings: `viaIR: true`
7. Upload single file from `flattened/` folder
8. Constructor args: ABI-encoded từ deploy tx

## Patches applied

3 contract đã apply 10 fix theo `newRequirement/sun2642026.txt` review:

| ID | Fix | Location |
|---|---|---|
| F1-A | `sumAward` dùng `+=` thay `=` | `updateRewardSuccessAndfail` |
| F1-B | Success loop `0..index` thay `0..length` | `updateRewardSuccessAndfail` |
| F2 | `isSendFailWithSameDay` inverted bool + length>1 guard (chỉ C1/C2; C3 đã đúng) | `sendDailyResult` |
| F3 | `nonReentrant` modifier + CEI state writes | 4 entry points |
| F4 | `tranferCoinNative` revert thay silent skip | `tranferCoinNative` |
| F6 | `onTimeSendResult` upper bound `endTime + 2 days` | modifier |
| N1 | Constructor enforce `sum(percent) <= 100` | constructor |
| F-A10 | `receive()` guard `_reentrancyStatus != 2` | `receive()` |

Chi tiết xem `newRequirement/review_output/REVIEW_REPORT_sun2642026.md`.
