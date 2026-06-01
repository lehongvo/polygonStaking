# Deploy a Challenge via the MCP API — AI Agent Integration Guide

This guide is for **AI agents** (Tanimoto-san's MCP server, or any external
automation) that need to deploy a `ChallengeBaseStep` contract programmatically
without running Hardhat scripts or holding any deployer wallet.

The agent calls a small set of HTTP endpoints on the BAP Challenge admin API.
The server validates the request against an admin-defined rule, deploys the
contract on chain, grants the NFT role, funds the contract with the reward
token, and stores the result for the admin UI.

**The agent never handles a private key.** The deployer wallet is held
server-side; callers only need an MCP API key (`CPM_KEY`) to authenticate.

---

## What You Will Get

- Pull the live **validation rule** (what you are allowed to deploy)
- Get a **real-time gas estimate** in JPY before committing
- **Deploy** a `ChallengeBaseStep` contract on Sepolia / Amoy / Polygon
- Receive the **contract address and tx hash** in the same response
- Track promotion of the deployed draft into the production `challenges` table
- Reuse identical deploys via `idempotency_key` (no double-spend)

All side effects (chain deploy, NFT role grant, token funding, draft
promotion) happen on the server. The agent only POSTs structured JSON.

---

## How It Fits Together

```
┌──────────────────┐         X-API-Key          ┌─────────────────────┐
│   AI Agent       │ ─────────────────────────► │  BAP Admin Server   │
│ (MCP wrapper,    │     (CPM_KEY in header)    │  api.espl.jp/...    │
│  cron, n8n, ...) │                            │                     │
└──────────────────┘                            │  ┌───────────────┐  │
                                                │  │ ChallengeBase │  │
                                                │  │ Step deploy   │──┼─► Sepolia / Polygon
                                                │  │ + role grant  │  │
                                                │  │ + token fund  │  │
                                                │  └───────────────┘  │
                                                │                     │
                                                │  draft_challenges   │
                                                │       ↓ cron (2min) │
                                                │  challenges (prod)  │
                                                └─────────────────────┘
```

The agent never touches the chain directly. The server holds the deployer
private key — the agent only authenticates with its MCP API key.

---

## Before You Start — What You Need

### Two environment variables

In your AI agent's `.env`:

| Variable | Purpose | Example |
|---|---|---|
| `URL_SERVER_ADMIN` | Base URL of the BAP admin server | `https://api.espl.jp/api/v1` |
| `CPM_KEY` | The **MCP API key** issued by the admin — used in the `X-API-Key` header on every call | `mcp_<prefix>_<32-hex>` |

The CPM_KEY is **shown ONCE** when the admin creates the key in the UI. If
you lose it, the admin must rotate it (a new key is issued, the old one
stops working immediately).

> `SERVER_ADMIN_TOKEN` (admin JWT) is only needed if you provision new
> rules or API keys programmatically. For deploy / estimate / status calls,
> `CPM_KEY` alone is sufficient.

### A registered sponsor wallet

`/deploy-direct` requires that `sponsor_address` and `challenger_address`
already exist in `user_wallets` (i.e. someone has logged into the BAP app
with that wallet at least once). `/draft` is more permissive — it
auto-registers a placeholder user for an unknown `funding_wallet`.

If you get `wallet_not_registered`, ask the admin to onboard the address.

---

## Step 1 — Get the Rule Your Key Is Bound To

Every CPM_KEY is bound to exactly one **validation rule** that controls
what challenges you may deploy. Pull it first so the agent can self-check
before any chain write.

```bash
curl "$URL_SERVER_ADMIN/admin/mcp/validation-rules" \
  -H "X-API-Key: $CPM_KEY" \
  -H "platform: browser" \
  -H "version: 1.0.0"
```

Response:

```json
{
  "status": 200,
  "data": {
    "version": "v1",
    "last_updated": "2026-05-20T11:17:23.000Z",
    "rules": [
      { "id": "participant_count_range", "min": 0, "max": 100000 },
      { "id": "duration_days_range", "min": 0, "max": 100000 },
      { "id": "step_goal_per_person_range", "min": 0, "max": 100000 },
      { "id": "reward_per_person_jpyc_range", "min": 0, "max": 100000 },
      { "id": "allowed_networks", "values": ["sepolia"] },
      { "id": "allowed_challenge_types", "values": ["Only Step"] },
      { "id": "start_date_future", "required": true },
      { "id": "percent_sum_le_100", "required": true },
      { "id": "wallet_format", "description": "Must match ^0x[a-fA-F0-9]{40}$" }
    ]
  },
  "error": 0
}
```

Any value that violates a rule will cause the next steps to reject with
`VALIDATION_FAILED` + the offending field.

---

## Step 2 — Estimate Gas Cost (Optional but Recommended)

Two endpoints. Pick by use case.

### 2a. High-level (`/estimate`) — simple inputs

For the "X participants, Y days, Z step goal, W JPYC reward each" case:

```bash
curl -X POST "$URL_SERVER_ADMIN/admin/mcp/estimate" \
  -H "X-API-Key: $CPM_KEY" \
  -H "platform: browser" \
  -H "version: 1.0.0" \
  -H "Content-Type: application/json" \
  -d '{
    "participant_count": 5,
    "duration_days": 7,
    "step_goal_per_person": 8000,
    "reward_per_person_jpyc": 10,
    "network": "sepolia"
  }'
```

### 2b. Direct (`/estimate-direct`) — full body, live RPC

When the agent wants the **real on-chain gas cost** at the current gas
price, post the same rich body it will deploy with:

```bash
curl -X POST "$URL_SERVER_ADMIN/admin/mcp/estimate-direct" \
  -H "X-API-Key: $CPM_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Corporate Walking Challenge",
    "amount": 0.00001,
    "execute_time": 7,
    "type_challenge": "Only Step",
    "daily_min_step_require": 1000,
    "min_day_require": 7,
    "date_start": 1779222000,
    "date_end": 1779826800,
    "sponsor_address": "0x...",
    "challenger_address": "0x...",
    "token_type": 2,
    "address": "0x6F7E7dE8eA666174AB2dcAF742f1F64d6aFB3251",
    "receivers": [
      {"address":"0x...","amount":0.000005,"percent":"50","type":1},
      {"address":"0x...","amount":0.000005,"percent":"50","type":2}
    ],
    "network_id": 12,
    "generate_nft": true,
    "timezone_create": "Asia/Tokyo"
  }'
```

Response:

```json
{
  "status": 200,
  "data": {
    "reward_pool_total_jpyc": 0.00001,
    "gas_units": "4553779",
    "gas_price_wei": "1173597040",
    "gas_cost_native": "0.005344301555214160",
    "native_price_jpy": 600000,
    "estimated_gas_jpy": 3207,
    "total_cost_jpy_approx": 3207.00001,
    "network": "sepolia",
    "network_id": 12,
    "notes": "sepolia is a testnet; values shown are for reference, no real money."
  },
  "error": 0
}
```

---

## Step 3 — Deploy the Challenge

Both endpoints use the **server's** deployer key. Pick by input shape, not
by who holds the key.

### 3a. High-level (`/draft`) — simple input

```bash
curl -X POST "$URL_SERVER_ADMIN/admin/mcp/draft" \
  -H "X-API-Key: $CPM_KEY" \
  -H "platform: browser" \
  -H "version: 1.0.0" \
  -H "Content-Type: application/json" \
  -d '{
    "participant_count": 5,
    "duration_days": 7,
    "start_date": 1779222000,
    "step_goal_per_person": 8000,
    "reward_per_person_jpyc": 10,
    "funding_wallet": "0xa826774CA92237635421FeBe045CA2f3D1D4dbf0",
    "receivers": [
      {"address":"0xa826774CA92237635421FeBe045CA2f3D1D4dbf0","amount":0.000005,"percent":"50","type":1},
      {"address":"0xa826774CA92237635421FeBe045CA2f3D1D4dbf0","amount":0.000005,"percent":"50","type":2}
    ],
    "network": "sepolia",
    "idempotency_key": "your-uuid-here-at-least-16-chars"
  }'
```

### 3b. Direct (`/deploy-direct`) — full ChallengeBaseStep body

Use this when you need the full constructor surface (`receivers[]`,
`token_type`, `address` as createByToken, walking-speed / HIIT data, etc.).
The deployer key still lives on the server — the agent never holds or
transmits it.

```bash
curl -X POST "$URL_SERVER_ADMIN/admin/mcp/deploy-direct" \
  -H "X-API-Key: $CPM_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Corporate Walking Challenge — Q2",
    "description": "",
    "amount": 0.00001,
    "execute_time": 7,
    "type_challenge": "Only Step",
    "daily_min_step_require": 1000,
    "min_day_require": 7,
    "gas_fee": 0,
    "fee_success": 0,
    "fee_error": 0,
    "give_up": false,
    "give_up_type": 0,
    "date_start": 1779222000,
    "date_end": 1779826800,
    "sponsor_address": "0x296F5c137b8940776f2E602c6213719bC60f3EF4",
    "challenger_address": "0xe340371845820cb16Cb8908E0ed07e2E1Ff40024",
    "token_type": 2,
    "address": "0x6F7E7dE8eA666174AB2dcAF742f1F64d6aFB3251",
    "receivers": [
      {"address":"0xe340371845820cb16Cb8908E0ed07e2E1Ff40024","amount":0.000005,"percent":"50","type":1},
      {"address":"0x296F5c137b8940776f2E602c6213719bC60f3EF4","amount":0.000005,"percent":"50","type":2}
    ],
    "network_id": 12,
    "generate_nft": true,
    "timezone_create": "Asia/Tokyo",
    "idempotency_key": "your-uuid-here-at-least-16-chars"
  }'
```

Response (success, both endpoints):

```json
{
  "status": 200,
  "data": {
    "draft_id": 19,
    "status": "deployed",
    "contract_address": "0xeF5cf2d75C4305f072481842eCBbAC561277dAE7",
    "tx_hash": "0xce9d2f547545341ceae3486d94a45f2baec7119d58e80c40f490f30d2a0de996",
    "deployer_address": "0xa826774CA92237635421FeBe045CA2f3D1D4dbf0",
    "network": "https://eth-sepolia.g.alchemy.com/v2/...",
    "estimated_promotion_time": "2026-05-20T15:24:14.152Z"
  },
  "message": "success",
  "error": 0
}
```

`deployer_address` is the server-side wallet — always the same value across
calls. Save `draft_id`, `contract_address`, and `tx_hash`.

### Key rules

- **`receivers[]` percent sum must be ≤ 100.** `[50, 50]` works.
  `[100, 100]` reverts on chain with `Sum of percents exceeds 100`.
- **Each receiver's effective amount must be > 0.** Don't include a
  receiver with `percent: "0"`.
- **`token_type`**: 0 = native (ETH/MATIC), 2 = ERC20 (set `address` to the
  token contract).
- **`network_id`**: 5 = Polygon mainnet, 12 = Sepolia, 13 = Amoy.
- **`sponsor_address` and `challenger_address`** must be registered in
  `user_wallets` for `/deploy-direct`. Receivers do not need to be
  registered.
- **`idempotency_key`**: 16–64 chars. A duplicate call with the same key
  returns the cached deploy (no re-spend).

---

## Step 4 — Track Promotion to Production

`/deploy-direct` returns `status: "deployed"`. A background cron runs every
2 minutes and:

1. Re-verifies the tx receipt on chain
2. Confirms NFT role grant + reward token funding (Phase B)
3. Inserts a row into the production `challenges` table
4. Updates the draft to `status: "promoted", is_sync: 1`

Poll status:

```bash
curl "$URL_SERVER_ADMIN/admin/mcp/draft/19/status" \
  -H "X-API-Key: $CPM_KEY"
```

States:

| Status | Meaning |
|---|---|
| `deploying` | Tx submitted, awaiting receipt |
| `deployed`  | On chain; waiting for cron to promote |
| `promoting` | Cron started promotion (soft lock) |
| `promoted`  | Live in `challenges` table — visible to mobile users |
| `rejected`  | Phase B failed — see `failure_reason` |

---

## Error Codes the Agent Should Handle

| HTTP `error` | Message | What to do |
|---|---|---|
| `100` | `INVALID_API_KEY` | Header missing / key revoked. Ask admin for a new one. |
| `101` | `KEY_INACTIVE` | Key was disabled. Same fix. |
| `102` | `API_KEY_EXPIRED` | `expires_at` passed. Same fix. |
| `103` | `VALIDATION_FAILED` | Check `data.failed_rules[]` — fix the offending field. |
| `104` | `QUOTA_LIFETIME_EXCEEDED` | Used `max_deployments`. Ask admin to raise. |
| `105` | `QUOTA_MONTHLY_EXCEEDED` | Same, monthly cap. |
| `106` | `DRAFT_NOT_FOUND` | Wrong id, or the draft belongs to another key. |
| `107` | `CONTRACT_DEPLOY_FAILED` | Chain rejected (sum percents, balance, etc.). See `data.error_detail`. |

`VALIDATION_FAILED` data example:

```json
{
  "failed_rules": [
    { "id": "duration_days_range", "actual": 400, "max": 365 },
    { "id": "wallet_not_registered", "address": "0x0000..." }
  ]
}
```

---

## Admin-Side Setup (one-time, done in the UI)

Admins do this once via the Admin dashboard at the **AI Agent** sidebar
section. The agent does not call these endpoints.

- **Create a validation rule** → `POST /admin/mcp/validate-rules`
- **Create an API key** → `POST /admin/mcp/challenge-access` (response
  includes `api_key` **shown once** — this is the `CPM_KEY` to hand to the
  AI agent)
- **Rotate / disable** → `POST /admin/mcp/challenge-access/:id/rotate-key`
  immediately revokes the old key and issues a new one (also shown once)

---

## Putting It Together — A 30-Line Python Agent

```python
import os, requests, uuid, time

BASE = os.environ['URL_SERVER_ADMIN']
KEY  = os.environ['CPM_KEY']
H    = {'X-API-Key': KEY, 'Content-Type': 'application/json', 'platform': 'browser'}

# 1. Sanity-check we have a rule
rules = requests.get(f"{BASE}/admin/mcp/validation-rules", headers=H).json()
assert rules['error'] == 0

# 2. Estimate
body = {
    "participant_count": 5,
    "duration_days": 7,
    "start_date": int(time.time()) + 3600,
    "step_goal_per_person": 8000,
    "reward_per_person_jpyc": 10,
    "funding_wallet": "0xa826774CA92237635421FeBe045CA2f3D1D4dbf0",
    "receivers": [
        {"address": "0xa826774CA92237635421FeBe045CA2f3D1D4dbf0", "amount": 0.000005, "percent": "50", "type": 1},
        {"address": "0xa826774CA92237635421FeBe045CA2f3D1D4dbf0", "amount": 0.000005, "percent": "50", "type": 2},
    ],
    "network": "sepolia",
}
est = requests.post(f"{BASE}/admin/mcp/estimate", headers=H, json=body).json()
print("Cost ≈", est['data']['total_cost_jpy_approx'], "JPY")

# 3. Deploy (idempotency_key MUST be unique per logical request)
body['idempotency_key'] = f"agent-{uuid.uuid4()}"
res = requests.post(f"{BASE}/admin/mcp/draft", headers=H, json=body).json()
draft_id = res['data']['draft_id']
print("Deployed:", res['data']['contract_address'])

# 4. Wait for promotion
while True:
    st = requests.get(f"{BASE}/admin/mcp/draft/{draft_id}/status", headers=H).json()
    s = st['data']['status']
    print("status:", s)
    if s in ('promoted', 'rejected'):
        break
    time.sleep(15)
```

That is the full integration. Everything else — UI, NFT setup, JPYC
funding, cron promotion — is handled server-side.

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `INVALID_API_KEY` on every call | `CPM_KEY` typo, or admin disabled the key. |
| `wallet_not_registered` | Sponsor / challenger address has never logged into the BAP app. Onboard first. |
| `Sum of percents exceeds 100` in `error_detail` | Receivers' `percent` total > 100. Contract enforces ≤ 100. |
| Deploy returns `deployed` but never reaches `promoted` | Phase B failed — check `failure_reason` (usually `nft_role_grant` or `jpyc_funded`). |
| Draft stuck on `deploying` for > 30 min | Tx never mined or RPC dropped. Cron will mark it `rejected` with `tx_stuck_30min`. |

If `failure_reason` is empty and the draft is older than 5 minutes, ping
ops — there is a chain or RPC issue, not an integration bug.
