# Deploy a Challenge Using an AI Agent — Step-by-Step Guide

This guide shows you how to deploy your own challenge smart contract (a `ChallengeBaseStep` contract) on the Polygon or Sepolia blockchain, even if you are not a developer. You will use an AI coding assistant (such as Claude Code, Cursor, or GitHub Copilot) to do the technical work for you. You only need to follow this guide and tell the AI agent what to do.

The contract you will deploy is **`ChallengeBaseStep`** — a step-counting challenge contract that can be funded either with the native coin (MATIC on Polygon, ETH on Sepolia) or with any ERC20 token (TTJP, JPYC, USDT, etc.). It does **not** use Aave staking, so any ERC20 token works.

---

## What You Will Get

After following this guide, you will have:

- A deployed `ChallengeBaseStep` contract on the chosen network
- A contract address that you can share or use in your application
- The contract source code verified on the block explorer (so anyone can read it)
- The `ALLOWED_CONTRACTS_CHALLENGE` role granted on the related `ExerciseSupplementNFT` contract
- The challenge contract funded with the prize amount (either native coin or ERC20 token)
- A record of the deployment for your reference (in `deployInfo/`)

---

## Before You Start — What You Need

### 1. A computer
Mac, Windows, or Linux. Any modern computer works.

### 2. An internet connection
A stable connection is important — the deployment talks to the blockchain.

### 3. Two crypto wallets

You need **two separate wallets**:

| Wallet | Private key env var | Used for | Required balance |
| ------ | ------------------- | -------- | ---------------- |
| **Deployer** | `PRIVATE_KEY` | Deploys the contract and sends the prize | ~3 MATIC on Polygon for gas, plus the prize amount in either MATIC or the ERC20 token |
| **Admin**    | `ADMIN_PRIVATE_KEY` | Grants the `ALLOWED_CONTRACTS_CHALLENGE` role on `ExerciseSupplementNFT` (this role is already held by the admin wallet on each network) | ~0.5 MATIC on Polygon for gas |

Both wallets must have their private keys in your local `.env` file. **Treat private keys like passwords to a bank account.** Never share them.

### 4. An AI coding assistant

We recommend **Claude Code** (https://claude.com/claude-code). It is a command-line AI tool that can run real commands on your computer with your permission.

Other AI agents like Cursor, Cline, or Aider also work. The examples in this guide use Claude Code, but the concepts are the same.

### 5. A block explorer API key (free)

Sign up at https://etherscan.io and request a free API key (one key works for Etherscan v2 across Ethereum, Polygon, Sepolia, etc.). You need this so the AI agent can verify your contract source code.

---

## Step 1 — Install the Tools

You only do this once. After installation, you can deploy many challenges without repeating this step.

### 1a. Install Node.js
- Go to https://nodejs.org
- Download and install the **LTS** version
- Open a terminal and check it works: `node --version` — you should see `v20.x.x` or newer.

### 1b. Install Git
- Mac: usually pre-installed. Check with `git --version`
- Windows: download from https://git-scm.com
- Linux: `sudo apt install git`

### 1c. Install Yarn

```
npm install -g yarn
```

### 1d. Install Claude Code

```
npm install -g @anthropic-ai/claude-code
```

---

## Step 2 — Download the Project

Open a terminal. Pick a folder where you want the project to live, then run:

```
cd ~/Documents
git clone https://gitlab.com/exercise-supplements/smart-contract
cd smart-contract
```

After this, you should be inside a folder called `smart-contract`.

---

## Step 3 — Install the Project's Helper Libraries

```
yarn install
```

This may take 2–5 minutes the first time. Wait for it to finish. If you see errors, ask your AI agent to help.

---

## Step 4 — Set Up Your Environment File

### 4a. Create the file

```
cp .env.example .env
```

If `.env.example` does not exist, ask the agent: _"Create a .env file template with the variables this project needs."_

### 4b. Open `.env` in a text editor

You will see lines like:

```
PRIVATE_KEY=
ADMIN_PRIVATE_KEY=
EXERCISE_SUPPLEMENT_NFT_ADDRESS=
EXERCISE_SUPPLEMENT_NFT_ADDRESS_SEPOLIA=
POLYGON_RPC_URL=
SEPOLIA_RPC_URL=
ETHERSCAN_API_KEY=
POLYGONSCAN_API_KEY=
SEPOLIA_API_KEY=
```

### 4c. Fill in the values

| Variable | What to fill in |
| -------- | --------------- |
| `PRIVATE_KEY` | Your deployer wallet's private key (64 hex characters, no `0x` prefix needed). |
| `ADMIN_PRIVATE_KEY` | The admin wallet's private key. The admin wallet is the one that holds `UPDATER_ACTIVITIES_ROLE` on the `ExerciseSupplementNFT` contract. |
| `EXERCISE_SUPPLEMENT_NFT_ADDRESS` | Polygon mainnet address of the deployed `ExerciseSupplementNFT` proxy. |
| `EXERCISE_SUPPLEMENT_NFT_ADDRESS_SEPOLIA` | Sepolia testnet address of the deployed `ExerciseSupplementNFT` proxy. |
| `POLYGON_RPC_URL` | Your Polygon RPC endpoint (free from Alchemy, Infura, or `https://polygon-rpc.com`). |
| `SEPOLIA_RPC_URL` | Your Sepolia RPC endpoint (free from Alchemy/Infura). |
| `ETHERSCAN_API_KEY` | Your free Etherscan v2 API key — used for source verification on every network. |
| `POLYGONSCAN_API_KEY` | Backup key for Polygonscan verification (can be the same value). |
| `SEPOLIA_API_KEY` | Backup key for Sepolia Etherscan verification (can be the same value). |

### 4d. Save the file

Make sure the file is named exactly `.env` (with the leading dot).

---

## Step 5 — Configure Your Challenge Parameters

The challenge has settings such as: who plays, how long it lasts, how much the prize is, etc. You tell the AI agent these details, and the agent writes them into your `.env` file under a single configuration variable.

### High-level flow

```
1. Deploy ChallengeBaseStep
   ↓
2. Choose network  (sepolia or polygon)
   ↓
3. Choose prize currency  (Option A native, or Option B ERC20 token)
   ↓
4. Provide parameters     (addresses, duration, prize amount, …)
   ↓
5. CONFIRM data           (agent prints back; you verify every value)
   ↓
6. CHECK & CONFIRM gas    (agent reports gas, balances; you say "go")
   ↓
7. Run npm deploy script  (agent runs; contract is deployed, verified, role granted, funded)
   ↓
8. Verify on explorer
```

Each of the items below corresponds to one of these sub-steps.

### 5a. Choose the network

| Network | Use for | Native coin | Cost |
| ------- | ------- | ----------- | ---- |
| **`sepolia`** | Testing, first deploys, learning | SepoliaETH (free from a faucet) | Practically free (< 0.01 ETH for full flow) |
| **`polygon`** | Real production deploys | MATIC (must buy/transfer) | ~0.3–1.5 MATIC depending on gas |

Tell the agent which one you want, e.g.:

> I want to deploy on `sepolia` first to test, then later on `polygon` for production.

**Strongly recommended: deploy on `sepolia` first, end-to-end, before touching `polygon`.** The contract source, env var schema, npm scripts, and deploy flow are identical; only the network changes.

### 5b. Choose your prize currency

The agent will then ask which currency you want for the prize pool. **You have two options:**

| Option | Prize currency | When to choose |
| ------ | -------------- | -------------- |
| **Option A — Native coin** | MATIC (Polygon) or ETH (Sepolia) | Simplest. The deployer sends the prize during the deploy transaction (`msg.value`). Choose this if you already hold the native coin. |
| **Option B — ERC20 token** | Any ERC20 (TTJP, JPYC, USDT, …) | You hold the prize in a token. The contract is deployed first, then the prize amount is transferred to the contract with a simple `transfer`. |

When you talk to the agent, simply say one of:

> I want to deploy a ChallengeBaseStep with **MATIC** (native coin) as the prize.

…or…

> I want to deploy a ChallengeBaseStep with **JPYC** (ERC20 token) as the prize.

The agent will pick the appropriate deploy script and `.env` config variable based on your **network + option** choices:

| Option | Network | Deploy script | Env config var |
| ------ | ------- | ------------- | -------------- |
| A. Native | sepolia | `scripts/challenge/ChallengeWalkingSpeed/deploy-challenge-detail-v2-not-send-step.ts` | `CONFIG_DEPLOY_CHALLENGE_BASE_ONLY_STEP_SEPOLIA` |
| A. Native | polygon | `scripts/challenge/ChallengeWalkingSpeed/deploy-challenge-detail-v2-not-send-step.ts` | `CONFIG_DEPLOY_CHALLENGE` |
| B. Token  | sepolia | `scripts/challenge/ChallengeWalkingSpeed/deploy-challenge-detail-v2-not-send-step-with-token.ts` | `CONFIG_DEPLOY_CHALLENGE_BASE_ONLY_STEP_WITH_TOKEN_SEPOLIA` |
| B. Token  | polygon | `scripts/challenge/ChallengeWalkingSpeed/deploy-challenge-detail-v2-not-send-step-with-token.ts` | `CONFIG_DEPLOY_CHALLENGE_BASE_ONLY_STEP_WITH_TOKEN` |

### 5c. Decide your parameters

Have these answers ready:

| Setting                  | Example                                            | What it means                                                                                          |
| ------------------------ | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Player's wallet address  | `0x296F5c137b8940776f2E602c6213719bC60f3EF4`       | The person who will play. 42 hex characters starting with `0x`.                                        |
| Sponsor's wallet address | (often same as player)                             | The person who funds the prize. Often the same as the player for personal challenges.                  |
| Network                  | `sepolia` (testnet) or `polygon` (mainnet)         | Where to deploy.                                                                                       |
| Start time               | Now (script computes Unix timestamp automatically) | When the challenge begins.                                                                             |
| Duration                 | 30 days                                            | How many days the challenge runs.                                                                      |
| Required days            | 30 days                                            | How many days the player must complete to win. Usually equals duration.                                |
| End time                 | `start + duration` days                            | When the challenge ends. **Must be at least `start + duration`**, otherwise the player cannot finish.  |
| Step goal per day        | 10000 (real) or 10 (test)                          | The daily step target.                                                                                 |
| Prize amount             | `0.001` for testing, `1` or more for real          | The reward. For 18-decimal tokens / MATIC: 0.001 → `1000000000000000` wei (1 followed by 15 zeros).    |
| Token address (Option B) | A 42-character `0x…` ERC20 contract address        | The ERC20 token used for the prize. Must already be deployed on the chosen network.                    |
| Award split              | `[50, 50]` for two receivers                       | Percentages — sum **must be ≤ 100**.                                                                   |
| allowGiveUp              | `[true, true, true]` for native, `[true, false, true]` for token | Array of three booleans. Index 1 must be **true for native** (sends `msg.value`) and **false for token** (no value sent; transfer happens after deploy). |

### 5d. Talk to your AI agent

Inside the `smart-contract` folder, start the agent:

```
claude
```

Then send the request that matches your option:

#### If you chose Option A (native coin)

> Please add a new MATIC challenge configuration to my .env file. Wallet address: `0x296F5c137b8940776f2E602c6213719bC60f3EF4` for player, sponsor, and award receivers. Start time = now, duration = 30 days, required days = 30, end time = start + 30 days, step goal = 10000, total prize = 0.001 MATIC, 50/50 award split (50% on success, 50% on failure). Use `allowGiveUp = [true, true, true]`. Network: sepolia. Write under `CONFIG_DEPLOY_CHALLENGE_BASE_ONLY_STEP_SEPOLIA`.

#### If you chose Option B (ERC20 token)

> Please add a new JPYC challenge configuration to my .env file. Wallet address: `0x296F5c137b8940776f2E602c6213719bC60f3EF4` for player, sponsor, and award receivers. Token address: `<paste the token contract address here>`. Start time = now, duration = 30 days, required days = 30, end time = start + 30 days, step goal = 10000, total prize = 0.001 JPYC (18 decimals → 1000000000000000 wei), 50/50 award split. Use `allowGiveUp = [true, false, true]`. Network: sepolia. Write under `CONFIG_DEPLOY_CHALLENGE_BASE_ONLY_STEP_WITH_TOKEN_SEPOLIA`.

### 5e. ⚠️ Confirm the data BEFORE you go further

**This is the most important step in the guide. Do not skip it.** Once the contract is deployed, the values are permanent.

Ask the agent:

> Please print back the full configuration you wrote so I can verify each value.

Go through every line carefully. Check each item below:

| Check                | What to confirm                                                                                                            |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Wallet addresses** | Each of the 42 characters matches. A single wrong character means funds go to the wrong wallet — permanently lost.         |
| **Token address (B)** | Ask the agent to look up the token on the block explorer. Confirm the symbol, decimals, and that this is **the real token**, not a scam token with a similar name. |
| **Network**          | sepolia (test, free) vs polygon (mainnet, real money). Confirm before you continue.                                        |
| **Start time**       | The agent should show the date in human-readable form. Check that.                                                          |
| **End time**         | Must be **≥ `start + duration` days** — otherwise the player cannot finish the challenge.                                  |
| **Duration / required days** | Usually equal (e.g. both 30). If they differ, confirm you intended that.                                            |
| **Step goal**        | Sensible value. 10000/day is typical real-world, 10/day is for tests.                                                       |
| **Prize amount**     | Check the agent's wei → token conversion. **0.001 token = 1000000000000000 wei (15 zeros)** for 18-decimal tokens.          |
| **allowGiveUp[1]**   | Native (Option A) = `true`. Token (Option B) = `false`. If this is wrong, deploy will revert.                              |
| **Award split**      | Sum of `awardReceiversPercent` must be **≤ 100**. Two receivers at `[50, 50]` is correct. `[100, 100]` will revert.        |

If anything looks off, tell the agent:

> The value `<which field>` should be `<correct value>`. Please update the config and print it back again so I can re-verify.

Repeat until every value is correct. **Only proceed to Step 6 after the data is confirmed.**

---

## Step 6 — Deploy the Challenge

This step actually creates the contract on the blockchain. There are three sub-steps:

1. Check the cost (gas + balances)
2. **Confirm the gas price** — agree to proceed at the current cost
3. Deploy

Do not skip the confirm step. Once the tx is sent, you cannot undo it.

### 6a. Check the cost

Ask the agent:

> Please check the current gas price on `<sepolia | polygon>` and tell me how much it will cost to deploy a ChallengeBaseStep contract right now. Also check my deployer wallet's MATIC/ETH balance, my admin wallet's MATIC balance, and (if I chose Option B) my deployer's token balance.

The agent will report:

- Current gas price in gwei
- Estimated gas amount for this specific deploy (typically 4.5–5.6 million gas for `ChallengeBaseStep`)
- Estimated cost in MATIC / ETH
- Deployer wallet's native balance
- Admin wallet's native balance (needed for grant role)
- Deployer wallet's token balance (Option B)
- A clear verdict: ✅ OK to deploy, or ❌ Not enough funds / gas too high

**Gas price reference:**

| Gas (gwei) | What it means                                                |
| ---------- | ------------------------------------------------------------ |
| Under 50   | Cheap. Good time to deploy.                                  |
| 50–150     | Normal. Fine to deploy.                                      |
| 150–300    | High. Doable, but waiting may save money.                    |
| 300–1000   | Very high. Strongly consider waiting unless urgent.          |
| Over 1000  | Network congestion. Don't deploy unless emergency.           |

For Sepolia, gas is typically `< 1 gwei` — practically free.

### 6b. ⚠️ Confirm the gas price BEFORE you broadcast

Before saying "go", check all four:

1. **Gas price acceptable?** Compare to the table above.
2. **Deployer balance enough?** Must cover the deploy gas plus, for Option A, the prize amount in MATIC/ETH.
3. **Admin balance enough?** Must cover the grant-role transaction (~0.01 MATIC).
4. **Token balance enough?** (Option B) Deployer must hold at least the `totalAmount` of the token to fund the contract after deploy.

If any check fails, say:

> Wait — gas is too high (or my balance is too low). Please don't deploy. I'll come back when conditions are better.

The agent will stop and not run the deploy.

If everything looks good:

> Looks good. Please proceed with the deployment now using `npm run deploy:challenge:<not-send-step | with-token>:<sepolia | polygon>`.

### 6c. The agent runs the deploy script

The script does these steps in order:

1. **Load config** from the right env var (chosen by your Option A/B and network).
2. **Pre-check balances** (deployer native + token if Option B).
3. **Deploy `ChallengeBaseStep`**. For Option A, sends `msg.value = totalAmount`. For Option B, sends `msg.value = 0`.
4. **Wait for transaction confirmation** (~10–30 s on Polygon, ~12 s on Sepolia).
5. **Verify source code on the block explorer** (waits 5 confirmations, then submits source).
6. **Grant the `ALLOWED_CONTRACTS_CHALLENGE` role** on the `ExerciseSupplementNFT` contract. This transaction is signed by the admin wallet (`ADMIN_PRIVATE_KEY`), not the deployer.
7. **Wait 20 seconds** for the role grant to settle.
8. (Option B only) **Transfer `totalAmount` of the ERC20 token** from the deployer to the new challenge contract. The script verifies the contract's balance after the transfer.
9. **Save a deployment record** to `deployInfo/challenge-walking-speed-<network>.json` (Option A) or `deployInfo/challenge-detail-v2-with-token-<network>.json` (Option B).
10. **Print a summary report** with the contract address and explorer link.

### Example of a successful run (Option B, Sepolia)

```
🚀 CHALLENGE DETAIL V2 (WITH TOKEN) DEPLOYMENT
===============================================
Network: sepolia
Deployer: 0xa826774C…dbf0
Balance: 16.52 ETH

✅ Configuration loaded from ENV (CONFIG_DEPLOY_CHALLENGE_BASE_ONLY_STEP_WITH_TOKEN_SEPOLIA)
✅ Deployer balance sufficient
✅ TTJP balance sufficient (100 TTJP, need 0.001)

🏗️  DEPLOYING CONTRACT
✅ Contract deployed at: 0x9A8Daa58…7c3F

🔍 VERIFY ON BLOCK EXPLORER
✅ Contract verified

🔐 GRANT CHALLENGE ROLE
✅ Transaction hash: 0xa3fdb0d…d18bb4

💸 FUNDING CHALLENGE WITH ERC20 TOKEN
✅ Sent 0.001 TTJP to challenge
   Challenge contract TTJP balance: 0.001

🎉 DEPLOYMENT COMPLETED
```

**Write down the contract address.** This is your challenge contract.

---

## Step 7 — Verify on the Block Explorer

Open the explorer link the agent gave you. You should see:

1. A green checkmark next to **Contract** — meaning the source code is verified.
2. A **Read Contract** tab where you can see all the challenge settings.
3. The deployment transaction, the role-grant transaction, and (Option B) the token transfer transaction.
4. The contract's token balance (Option B) equal to your `totalAmount`.

If anything looks wrong, tell the agent:

> The contract at `<address>` shows `<wrong thing>`. Investigate.

---

## Common Problems and Fixes

### "Insufficient funds for gas"

Your wallet does not have enough native coin.

**Fix:** Add native coin to the wallet shown in the error message (deployer for the deploy step, admin for the grant-role step).

### "Sum of percents exceeds 100"

The `awardReceiversPercent` total is more than 100.

**Fix:** Ask the agent to change the percentages. For two receivers, common splits are `[50, 50]`, `[60, 40]`, or `[100]` for a single receiver.

### "Invalid award"

`totalAmount` does not match what is being sent. This happens when `allowGiveUp[1] = true` for a token deploy (the contract expects `msg.value == totalAmount`, but tokens are transferred separately).

**Fix:** Set `allowGiveUp[1] = false` for ERC20 token deploys.

### "Invalid value0" or "Invalid value1"

One of the calculated reward amounts is zero. This usually happens when `totalAmount` is too small relative to the percentages.

**Fix:** Increase `totalAmount` so each percentage gives a non-zero amount.

### "AccessControl: account ... is missing role"

The admin wallet does not have `UPDATER_ACTIVITIES_ROLE` on `ExerciseSupplementNFT`.

**Fix:** Confirm `ADMIN_PRIVATE_KEY` in `.env` points to the wallet that holds the role on the chosen network. If unsure, ask the agent to check.

### Transaction is stuck for a long time

You may have set the gas price too low.

**Fix:** Wait. The transaction will eventually fail or succeed. To cancel, ask the agent to "send a zero-value self-transfer with higher gas price to replace the stuck transaction." Only do this if you understand the implications.

### "ERC20: insufficient allowance" / "aToken address not found for this token"

You picked the wrong deploy script. These errors only happen with `ChallengeDetailV2` (the Aave-staking variant), not `ChallengeBaseStep`.

**Fix:** Confirm you are running one of the two scripts listed in step 5a — both deploy `ChallengeBaseStep`, which does not use Aave.

---

## Security Checklist

1. **Never share your private keys.** Not in chat, email, or screenshots. Anyone with the key controls the wallet.
2. **Use dedicated wallets for deployment** with small balances (3–5 MATIC). Do not use your main treasury wallet.
3. **Verify addresses before deploying.** Confirm every address in the configuration, especially the player address and the token address.
4. **Test on Sepolia first.** Sepolia is free (use a faucet) and identical in flow to Polygon. Catch mistakes there before spending real money.
5. **Read what the agent will do.** When the agent says "I'm about to run X", confirm X matches your intent before approving.
6. **Save the deployment file.** `deployInfo/<...>.json` has the contract address, tx hashes, and constructor args. You may need this later.
7. **Do not run unknown scripts.** If the agent suggests something you do not understand, ask for an explanation.

---

## Useful Scripts (npm)

The AI agent will pick the right command for you. For reference, these are the deploy scripts:

### Deploy ChallengeBaseStep with native coin (Option A)

```
npm run deploy:challenge:not-send-step:sepolia
npm run deploy:challenge:not-send-step:polygon
```

### Deploy ChallengeBaseStep with ERC20 token (Option B)

```
npm run deploy:challenge:with-token:sepolia
npm run deploy:challenge:with-token:polygon
```

### Verify a contract manually on the explorer

```
npx hardhat verify --network <sepolia|polygon> <contract_address> "<constructor args...>"
```

### Grant `ALLOWED_CONTRACTS_CHALLENGE` role manually

If the grant-role step failed during deploy, the contract exists but is not registered. Ask the agent:

> Please grant the `ALLOWED_CONTRACTS_CHALLENGE` role to `<challenge_address>` on `<network>`.

The agent will call `batchGrantRole` from the admin wallet.

---

## Cost Estimates

| Operation                       | Gas     | Cost at 50 gwei | Cost at 200 gwei |
| ------------------------------- | ------- | --------------- | ---------------- |
| Deploy `ChallengeBaseStep`      | ~4.6 M  | ~0.23 MATIC     | ~0.92 MATIC      |
| Grant role                      | ~80 k   | ~0.004 MATIC    | ~0.016 MATIC     |
| ERC20 transfer (Option B only)  | ~60 k   | ~0.003 MATIC    | ~0.012 MATIC     |
| **Total (Option A)**            | ~4.7 M  | ~0.23 MATIC     | ~0.93 MATIC      |
| **Total (Option B)**            | ~4.7 M  | ~0.24 MATIC     | ~0.95 MATIC      |

**Plus** the prize amount itself (in MATIC for Option A, or the token for Option B).

**Recommended deployer balance:** at least **3 MATIC** on Polygon for safety. On Sepolia, 0.5 SepoliaETH is plenty.

**Recommended admin balance:** at least **0.5 MATIC** on Polygon.

---

## What to Do After Deployment

1. **Open the contract on the explorer.** Verify all settings via "Read Contract".
2. **Share the contract address** with your team or the player.
3. **Monitor progress.** Each day the player sends step data; the contract tracks it.
4. **Close the challenge** when the time period ends. Ask the agent: _"Please close the challenge at `0x...`."_

---

## Getting Help

1. **Ask the AI agent first.** Paste the error message and describe what you tried. The agent can usually figure it out.
2. **Re-read the error.** Most failures come from a typo in `.env` or wrong `allowGiveUp[1]` value.
3. **Check the main project README** for advanced details.
4. **Contact the developer team** if the agent cannot fix it. Share:
   - The exact error message
   - Your `.env` configuration with the private keys **removed**
   - The transaction hash if any
   - What you were trying to do

---

## Quick Reference Card

```
# Open project folder
cd ~/Documents/smart-contract

# Start the AI agent
claude

# Full flow (deploy ChallengeBaseStep):
# 1. CHOOSE network:
#    "I want to deploy on sepolia."     (test, free)
#    "I want to deploy on polygon."     (production, real money)
#
# 2. CHOOSE prize currency:
#    "Use MATIC (native coin) as the prize."     (Option A)
#    "Use JPYC (ERC20 token) as the prize."      (Option B)
#
# 3. CONFIGURE (agent writes to .env):
#    "Please add a new challenge configuration with these settings: …"
#
# 4. CONFIRM the data (MANDATORY before deploy):
#    "Please print back the full configuration so I can verify each value."
#    → Check every address, amount, date, allowGiveUp[1], and percent sum.
#
# 5. CHECK gas + balances:
#    "Please check the current gas price on <network> and tell me how much the
#     deploy will cost. Also check my deployer and admin balances."
#
# 6. CONFIRM the gas (MANDATORY before deploy):
#    Look at the gas price, the cost, and the wallet balances.
#    Say "go" only when everything is acceptable.
#
# 7. DEPLOY:
#    "Looks good. Proceed with
#       npm run deploy:challenge:<not-send-step|with-token>:<sepolia|polygon>"
#
# 8. AFTER DEPLOY:
#    "Verify the contract at 0x… on the explorer."
#    "Close the challenge at 0x… when the period ends."
```

---

## Final Notes

- **Take your time.** Smart contracts are permanent. Spend the extra 5 minutes double-checking values; it is much cheaper than redeploying.
- **Start small.** Your first deployment should use a tiny prize (0.001 token or less) on Sepolia. Confirm the full flow works before scaling up.
- **Trust but verify.** AI agents are very capable, but they can make mistakes. Always read what the agent is about to do, especially right before any on-chain transaction. If anything looks unusual, ask the agent to explain.

Good luck with your deployment.
