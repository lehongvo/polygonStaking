# Polygon Staking — Challenge Contracts

Smart contracts cho fitness challenge platform trên Polygon: Step, Walking-Speed, HIIT, GCM, GCMAndSpeed. Includes ExerciseSupplementNFT registry, DeFi aggregator, and gacha rewards.

**Solidity:** 0.8.28 | **Optimizer:** enabled (runs=1, viaIR=true) | **EVM:** paris

---

## Quick start

```bash
cp .env.example .env             # Setup env (then edit PRIVATE_KEY, RPC URLs, ...)
yarn install --ignore-engines    # Install deps (Node 23 needs --ignore-engines)
yarn compile                     # Compile all contracts
yarn test                        # Run 84 unit tests (~2s)
yarn flatten                     # Regenerate flattened/*.flat.sol
```

---

## Folder structure

```
polygonStaking/
├── contracts/
│   ├── ChallengeDetail/             # 6 challenge variants
│   │   ├── ChallengeBaseStep.sol    # Step + optional walking speed + optional HIIT
│   │   ├── ChallengeDetail.sol      # Step-only
│   │   ├── ChallengeDetailV2.sol
│   │   ├── ChallengeGCM.sol
│   │   ├── ChallengeGCMAndSpeed.sol
│   │   └── ChallengeHIIT.sol        # HIIT (intervals + total seconds)
│   ├── ExerciseSupplementNFT.sol    # NFT registry + signature verification
│   ├── PolygonDeFiAggregator.sol    # DeFi staking aggregator
│   ├── YOBOWEB3WALK.sol             # YOBO NFT
│   ├── TestToken.sol
│   ├── examples/                    # ConstructorStakeExample
│   ├── gacha/                       # Gacha rewards
│   └── mocks/                       # 6 test mocks (ERC20/721/1155, Reentrancy/Bouncing attackers)
│
├── test/                            # 84 passing tests
│   ├── basic.test.ts                # Core invariant tests
│   ├── helpers/deployHelpers.ts     # Shared test factory
│   ├── per-contract/                # Per-contract flow tests
│   │   ├── BaseStep/                # giveup, close-fail, range-reset, dos-bounce
│   │   ├── Detail/
│   │   └── HIIT/                    # + hiit-achieved, intervals-time
│   ├── erc20/                       # ERC20 payout flows
│   ├── nft/                         # NFT transfer flows
│   ├── walking-speed/               # walkingSpeedData logic
│   ├── edge-cases/                  # index/dayRequired/percent boundaries
│   └── gas-bounds/                  # large-receivers, history-bounds, many-erc20
│
├── scripts/
│   ├── challenge/                   # Per-challenge deploy/verify scripts
│   ├── deploy/                      # Generic deploy (3challenges-localhost)
│   ├── debug/                       # check-tx, aave-call, protocol, withdraw
│   ├── e2e/                         # End-to-end verify
│   ├── defi/                        # DeFi-specific
│   ├── nft/                         # NFT scripts
│   ├── verify/                      # Polygonscan verify
│   ├── config/
│   ├── utils/
│   └── legacy/                      # Older deploy helpers
│
├── flattened/                       # Single-file output for Polygonscan verification
│   ├── ChallengeBaseStep.flat.sol
│   ├── ChallengeDetail.flat.sol
│   └── ChallengeHIIT.flat.sol
│
├── deployInfo/                      # Deployment metadata (addresses, ABIs)
├── ignition/                        # Hardhat Ignition modules
├── docs/                            # Internal docs (gitignored)
│   ├── api/
│   └── notes/
└── config/
```

---

## Networks

| Network                  | Chain ID | RPC env var             |
| ------------------------ | -------- | ----------------------- |
| `localhost`              | 1337     | `http://127.0.0.1:8545` |
| `hardhat`                | 1337     | in-memory               |
| `polygon` (mainnet)      | 137      | `POLYGON_RPC_URL`       |
| `amoy` (Polygon testnet) | 80002    | `AMOY_RPC_URL`          |

Setup `.env` from `.env.example`:

```bash
cp .env.example .env
# Edit: PRIVATE_KEY, POLYGON_RPC_URL, AMOY_RPC_URL, ETHERSCAN_API_KEY
```

---

## Yarn scripts

| Script                                     | Purpose                                                  |
| ------------------------------------------ | -------------------------------------------------------- |
| `yarn compile`                             | `hardhat compile`                                        |
| `yarn test`                                | Run all tests recursively (`find` + `hardhat test`)      |
| `yarn test:coverage`                       | Solidity coverage (currently broken — tooling)           |
| `yarn flatten`                             | Regenerate `flattened/*.flat.sol` for Polygonscan verify |
| `yarn lint` / `yarn lint:fix`              | ESLint                                                   |
| `yarn format` / `yarn format:check`        | Prettier (sol + ts + json + md)                          |
| `yarn deploy:amoy` / `yarn deploy:polygon` | Deploy DeFi aggregator                                   |
| `yarn withdraw` / `yarn withdraw:amoy`     | Test DeFi withdraw                                       |

---

## Security patches

3 challenge contracts (`ChallengeBaseStep`, `ChallengeDetail`, `ChallengeHIIT`) have applied security patches per third-party AI review (`sun2642026.txt`). **CHALLENGE-2738: the original review input (`sun2642026.txt`) and its report (`REVIEW_REPORT_sun2642026.md`) were never committed to this repository and cannot be located in any ref's history — the table below is only what could be reconstructed from the 7 finding IDs actually present in this repo's own commits/tests. It is NOT a verified reproduction of the original review's full finding list.** A separate revision of this document (`flattened/README.md` at commit `5001740`, since removed) stated 10 fixes against an 8-row table; that discrepancy, and the disposition of `F5` (referenced by the original numbering but never described or fixed in any delivered revision of this repo), are unresolved and need the reviewing vendor's input — see CHALLENGE-2738.

| ID        | Description                                                                                                                                              |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **F1**    | `updateRewardSuccessAndfail` — fix loop range (`0..index`) and `+=` accumulator                                                                          |
| **F2**    | `sendDailyResult` — fix `isSendFailWithSameDay` inverted bool + `length>1` guard (C1/C2 only; C3 already correct)                                        |
| **F3**    | Inline `ReentrancyGuard` + `nonReentrant` on `giveUp/sendDailyResult/closeChallenge/withdrawTokensOnCompletion` + CEI state writes before external calls |
| **F4**    | `tranferCoinNative` reverts on insufficient balance instead of silent skip                                                                               |
| **F5**    | **Unknown/undelivered.** Referenced by the original review's numbering (the gap between F4 and F6) but no description or corresponding fix was ever committed to this repo under this ID.                                                              |
| **F6**    | `onTimeSendResult` enforces `endTime + 2 days` upper bound                                                                                               |
| **N1**    | Constructor enforces `sum(awardReceiversPercent) <= 100`                                                                                                 |
| **F-A10** | `receive()` guard `_reentrancyStatus != 2` to prevent CEI+receive() infinite-loop DoS                                                                    |

Verified by **84 unit tests** (28 test files across 7 categories) — this count is not tied to individual finding IDs above; only `N1` and `F6` have tests named for their specific finding ID, `F1`-`F4`/`F-A10` are covered by general-purpose tests not labeled by ID.

---

## Polygonscan verification

Use `flattened/*.flat.sol`:

1. Visit `https://polygonscan.com/address/<deployed_address>#code`
2. Click "Verify and Publish"
3. **Compiler:** `0.8.28+commit.7893614a`
4. **Optimization:** Yes, runs: 1
5. **EVM Version:** paris
6. **Other settings:** `viaIR: true`
7. Upload single file from `flattened/`
8. Constructor args: ABI-encoded from deploy tx

Detailed guide in `flattened/README.md`.

---

## Branch strategy

- `develop` → development server
- `stag` → staging server
- `staging` → main PR target branch
- `master` → production
- `master-review` → active security-patch/audit-remediation branch for this review (CHALLENGE-2739/2650). `fix/sun2642026-security-patches`, previously referenced here, does not exist on this repository or its origin remote — corrected per CHALLENGE-2738.

---

## Notes

- **Node version:** Hardhat officially supports 18, 20, 22. Node 23 works with `--ignore-engines`. Node 24+ may have issues.
- **OZ pinned:** `@openzeppelin/contracts-upgradeable@5.0.2` (5.6+ removed `ReentrancyGuardUpgradeable` used by `PolygonDeFiAggregator`).
- **PRIVATE_KEY in `.env`:** if longer than 64 hex chars, hardhat fails at config-load. `yarn test` strips it via `env PRIVATE_KEY=` to bypass.
- **Test discovery:** `yarn test` uses `find test -name '*.test.ts'` for recursive discovery (Mocha default doesn't recurse).
