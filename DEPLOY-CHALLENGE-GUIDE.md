# Deploy a Challenge Using an AI Agent — Step-by-Step Guide

This guide shows you how to deploy your own challenge smart contract on the Polygon blockchain, even if you are not a developer. You will use an AI coding assistant (such as Claude Code, Cursor, or GitHub Copilot) to do the technical work for you. You only need to follow this guide and tell the AI agent what to do.

---

## What You Will Get

After following this guide, you will have:

- A deployed challenge contract on the Polygon blockchain
- A contract address that you can share or use in your application
- The contract source code verified on Polygonscan (so anyone can read it)
- A record of the deployment for your reference

---

## Before You Start — What You Need

### 1. A computer

Mac, Windows, or Linux. Any modern computer works.

### 2. An internet connection

A stable connection is important — the deployment talks to the Polygon network.

### 3. A crypto wallet with MATIC tokens

You will pay a gas fee to deploy the contract. Plan for **at least 3 MATIC** in your wallet for safety. (At normal gas prices, deployment costs around 0.3–1.5 MATIC, but gas spikes can push this higher.)

You also need the **private key** of this wallet — this is a long string that proves you own the wallet. **Treat it like a password to your bank account.** Never share it with anyone.

### 4. An AI coding assistant

We recommend **Claude Code** (https://claude.com/claude-code). It is a command-line AI tool that can run real commands on your computer with your permission.

Other AI agents like Cursor, Cline, or Aider also work. The examples in this guide use Claude Code, but the concepts are the same.

### 5. A Polygonscan API key (free)

Sign up at https://polygonscan.com and request a free API key. You need this so the AI agent can verify your contract source code on the blockchain explorer.

---

## Step 1 — Install the Tools

You only do this once. After installation, you can deploy many challenges without repeating this step.

### 1a. Install Node.js

Node.js lets your computer run the deployment scripts.

- Go to https://nodejs.org
- Download and install the **LTS** (Long Term Support) version
- Open a terminal and check it works:

```
node --version
```

You should see something like `v20.x.x`. If not, restart your computer and try again.

### 1b. Install Git

Git lets you download the project code.

- Mac: usually pre-installed. Check with `git --version`
- Windows: download from https://git-scm.com
- Linux: `sudo apt install git`

### 1c. Install Yarn (recommended) or use npm

Yarn manages the project's helper libraries.

```
npm install -g yarn
```

### 1d. Install your AI coding assistant

Follow the instructions on the AI tool's website. For Claude Code:

```
npm install -g @anthropic-ai/claude-code
```

---

## Step 2 — Download the Project

Open a terminal. Pick a folder where you want the project to live (for example, your Documents folder), then run:

```
cd ~/Documents
git clone https://gitlab.com/exercise-supplements/smart-contract
cd smart-contract
```

After this, you should be inside a folder called `smart-contract`.

---

## Step 3 — Install the Project's Helper Libraries

Still in the same terminal, inside the `smart-contract` folder, run:

```
yarn install
```

This may take 2–5 minutes the first time. You will see lots of text scrolling by. Wait for it to finish. If you see errors, scroll up to find the first error and ask your AI agent to help fix it.

---

## Step 4 — Set Up Your Environment File

The environment file (`.env`) holds your private keys and settings. The project will not commit this file to the repository (so your secrets stay safe on your computer).

### 4a. Create the file

Copy the example file to a new file called `.env`:

```
cp .env.example .env
```

If there is no `.env.example`, ask your AI agent: _"Create a .env file template with the variables this project needs."_

### 4b. Open the .env file

Open `.env` in any text editor (TextEdit, Notepad, VS Code, etc.). You will see lines like:

```
PRIVATE_KEY=
POLYGONSCAN_API_KEY=
POLYGON_RPC_URL=
```

### 4c. Fill in the values

**PRIVATE_KEY** — The private key of the wallet you will use to deploy. It starts with `0x` and is 64 hexadecimal characters long. Get this from your wallet app (MetaMask: Account Details → Show Private Key). **Never share this with anyone.**

**POLYGONSCAN_API_KEY** — The free API key you got from polygonscan.com.

**POLYGON_RPC_URL** — The address used to talk to the Polygon network. You can use a free public one:

```
POLYGON_RPC_URL=https://polygon-rpc.com
```

For better reliability, sign up for a free account at https://www.alchemy.com or https://www.infura.io and use the URL they give you.

### 4d. Save the file

Make sure the file is named exactly `.env` (with the dot at the start). Some text editors hide files that start with a dot — that is normal.

---

## Step 5 — Configure Your Challenge Parameters

Your challenge has settings such as: who is the player, how long it lasts, how much the prize is, etc. You will tell your AI agent these details, and the agent will write them into your `.env` file.

### What you need to decide before talking to the agent

Have these answers ready:

| Setting                  | Example                                      | What it means                                                                                           |
| ------------------------ | -------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Player's wallet address  | `0x296F5c137b8940776f2E602c6213719bC60f3EF4` | The person who will play the challenge. A blockchain wallet address — 42 characters starting with `0x`. |
| Sponsor's wallet address | (same as player)                             | The person who funds the prize pool. Often the same as the player for personal challenges.              |
| Start time               | Now, or a specific date                      | When the challenge begins.                                                                              |
| Duration                 | 30 days                                      | How many days the challenge runs.                                                                       |
| Required days            | 30 days                                      | How many days the player must complete to win. Usually equals duration.                                 |
| Step goal per day        | 10000 steps                                  | The daily target.                                                                                       |
| Prize amount             | 0.000001 MATIC (test) or 1 MATIC (real)      | The reward locked in the contract. Will be returned/distributed based on outcome.                       |
| Token type               | MATIC (native) or USDT, etc.                 | What currency the prize is in. MATIC is the default.                                                    |

### Talk to your AI agent

In your terminal, inside the `smart-contract` folder, start your AI agent:

```
claude
```

Then type a clear request like:

> Please add a new challenge configuration to my .env file. The challenge is for a single player whose wallet is `0x296F5c137b8940776f2E602c6213719bC60f3EF4`. The same wallet is the sponsor and receives any refund. Start time should be now, duration 30 days, required days 30, step goal per day 10000, total prize 0.001 MATIC, currency is native MATIC. Use the standard award split (50% on success, 50% on failure, both going back to the same wallet).

The agent will:

1. Read your existing `.env`
2. Calculate the timestamps
3. Add a configuration line called `CONFIG_DEPLOY_CHALLENGE_BASE_ONLY_STEP`
4. Confirm what it wrote

Review what the agent shows you. If any value looks wrong, ask the agent to fix it before deploying.

---

## Step 6 — Deploy the Challenge

This is the step that actually creates the contract on the blockchain. **It will cost real MATIC** — make sure your wallet has enough.

### 6a. Check the cost before deploying

In your AI agent, type:

> Please check the current Polygon gas price and tell me roughly how much it will cost to deploy a ChallengeBaseStep contract right now. Compare to my deployer wallet balance.

The agent should report:

- Current gas price (in "gwei" — lower is cheaper)
- Estimated cost in MATIC
- Your wallet balance
- Whether you have enough

**Gas price guide for Polygon:**

| Gas (gwei) | What it means                          |
| ---------- | -------------------------------------- |
| Under 50   | Cheap. Good time to deploy.            |
| 50–150     | Normal. Fine to deploy.                |
| 150–300    | High. You may want to wait.            |
| Over 300   | Very high. Best to wait unless urgent. |

If gas is high, wait 30 minutes to a few hours and try again. Check the live tracker: https://polygonscan.com/gastracker

### 6b. Deploy via the agent

When you are ready, tell the agent:

> Please deploy the ChallengeBaseStep contract on Polygon mainnet using the configuration in my .env file.

The agent will:

1. Load the configuration
2. Estimate the gas cost one more time
3. Pause for a few seconds (you can stop here if anything looks wrong — press Ctrl+C)
4. Send the deployment transaction to Polygon
5. Wait for the transaction to confirm (about 10–30 seconds)
6. Wait for 5 more blocks (about 30 seconds) for safety
7. Submit your contract source code to Polygonscan for verification
8. Save the deployment information to a local file in `deployInfo/`
9. Print the contract address and a Polygonscan link

### What success looks like

You will see output similar to:

```
CHALLENGE BASE STEP DEPLOYMENT
==============================
Network: polygon
Deployer: 0xa826...dbf0
Balance: 3.45 MATIC

STEP 1: LOAD CONFIG
Configuration loaded from ENV

STEP 2: DEPLOY
Estimated gas: 4641379
Gas price: 80 gwei
Estimated cost: 0.37 MATIC
Deploying...
Contract deployed at: 0xABC123...
Block: 12345678

STEP 3: VERIFY ON POLYGONSCAN
Source verified successfully

DEPLOYMENT COMPLETE
===================
Address: 0xABC123...
Explorer: https://polygonscan.com/address/0xABC123...
```

**Write down the contract address.** This is your challenge contract.

---

## Step 7 — Verify on Polygonscan

Open the explorer link the agent gave you. You should see:

1. A green checkmark next to "Contract" — meaning the source code is verified
2. A "Read Contract" tab where you can see the challenge settings
3. The deployment transaction in the "Transactions" tab

If verification failed (no green checkmark), ask your agent:

> The contract is deployed at `<address>` but source verification failed. Please run verification manually.

---

## Common Problems and Fixes

### "Insufficient funds for gas"

Your wallet does not have enough MATIC to pay for the deployment.

**Fix:** Add more MATIC to the deployer wallet, then ask the agent to try again. Or wait for gas prices to drop.

### "Sum of percents exceeds 100"

The reward split is invalid. The total percentages must add up to 100 or less.

**Fix:** Ask the agent to check `awardReceiversPercent` in your `.env`. For two receivers, common splits are `[50, 50]`, `[60, 40]`, or `[100]` for a single receiver.

### "Invalid award"

The `totalAmount` you specified does not match what is being sent.

**Fix:** Ask the agent to verify `totalAmount` is set correctly and matches the value sent during deployment.

### "Invalid value0" or "Invalid value1"

One of the reward percentages calculates to zero, which is not allowed.

**Fix:** Increase `totalAmount` or change `awardReceiversPercent` so each receiver gets a non-zero amount.

### "Sender doesn't have enough funds to send tx"

Same as "Insufficient funds for gas" — add more MATIC.

### Transaction stuck for a long time

You may have set the gas price too low.

**Fix:** Wait. The transaction will eventually fail or succeed. If you want to cancel, ask the agent to send a "zero-value self-transfer with higher gas price" to replace the stuck transaction. Only do this if you understand the implications.

### "Network error" or "RPC error"

The RPC endpoint is overloaded or down.

**Fix:** Switch to a different RPC URL in `.env`. Try Alchemy or Infura if you were using the public endpoint.

---

## Security Checklist

Before you deploy, read this carefully.

1. **Never share your private key.** Not in chat, not in email, not in screenshots. If anyone asks for it, they are trying to steal your funds.

2. **Use a dedicated deployer wallet** with a small balance (3–5 MATIC). Do not use your main wallet that holds significant funds. If something goes wrong, your loss is limited.

3. **Verify addresses before deploying.** When the agent shows you the configuration, confirm every address is correct. A typo means funds go to the wrong place.

4. **Test on Amoy testnet first** if you are deploying high-value challenges. Amoy is the Polygon test network where MATIC is free (you can request from a faucet). Ask the agent: _"Deploy this challenge on Amoy testnet first so I can verify it works."_

5. **Check the contract on Polygonscan** after deployment. Look at the constructor arguments — these are recorded permanently and tell the whole story.

6. **Save the deployment information** that the agent stores in `deployInfo/`. This file contains the contract address, the transaction hash, and the block number — you may need these later.

7. **Do not run unknown scripts.** If the agent suggests running something you do not understand, ask it to explain step by step before you approve.

---

## Useful Scripts Available in the Project

Your AI agent can run any of these. You do not need to remember the file paths — just describe what you want.

### Deploy a step-only challenge (most common)

File: `scripts/challenge/ChallengeWalkingSpeed/deploy-challenge-walking-speed-not-send-step.ts`

Tell the agent: _"Deploy a step-only challenge on Polygon."_

### Deploy a walking-speed challenge (requires walking speed data)

File: `scripts/challenge/ChallengeWalkingSpeed/deploy-challenge-walking-speed.ts`

Tell the agent: _"Deploy a walking-speed challenge on Polygon with the configuration in my .env."_

### Deploy a HIIT challenge

File: `scripts/challenge/ChallengeHIIT/`

Tell the agent: _"Deploy a HIIT challenge on Polygon."_

### Deploy a USDT-based challenge (uses USDT instead of MATIC)

File: `scripts/challenge/deploy-challenge-detail-v2-with-usdt.ts`

Tell the agent: _"Deploy a USDT challenge on Polygon."_

### Verify an existing contract on Polygonscan

File: `scripts/challenge/verify-challenge-detail-v2.ts`

Tell the agent: _"Verify the contract at address `0x...` on Polygonscan."_

### Grant a permission role to an account (advanced)

File: `scripts/challenge/grantChallengeRole.ts`

Tell the agent: _"Grant the ALLOWED_CONTRACTS_CHALLENGE role to address `0x...` on the ExerciseSupplementNFT contract."_

---

## Cost Estimates (as of writing)

These are rough estimates for Polygon mainnet. Actual cost depends on the gas price at the moment you deploy.

| Operation                | Gas   | Cost at 50 gwei | Cost at 200 gwei |
| ------------------------ | ----- | --------------- | ---------------- |
| Deploy ChallengeBaseStep | ~4.6M | 0.23 MATIC      | 0.92 MATIC       |
| Deploy ChallengeHIIT     | ~5M   | 0.25 MATIC      | 1.00 MATIC       |
| Verify on Polygonscan    | 0     | Free            | Free             |
| Grant role               | ~80K  | 0.004 MATIC     | 0.016 MATIC      |

**Total budget recommendation:** Keep at least **3 MATIC** in your deployer wallet at all times.

---

## What to Do After Deployment

1. **Test the challenge.** Open the contract on Polygonscan, go to the "Read Contract" tab, and verify the settings are correct.

2. **Share the contract address** with your team or users who need to interact with the challenge.

3. **Monitor the challenge.** During the challenge period, the player sends step data and the contract tracks progress. You or your operator should monitor for any issues.

4. **Close the challenge** when it ends. There is a `closeChallenge()` function that finalizes the result and distributes rewards. Tell your agent: _"Please close the challenge contract at `0x...`."_

---

## Getting Help

If you get stuck:

1. **Ask your AI agent first.** Describe what you tried, what happened, and paste any error messages. The agent can usually figure out the problem.

2. **Check the agent's output carefully.** Most issues come from a typo in `.env` or a missing field. The agent's error messages point to the line.

3. **Check the project's main README** at `README.md` for advanced information.

4. **Contact the developer team** if the agent cannot fix it. Share:
   - The error message
   - Your `.env` configuration (with the `PRIVATE_KEY` line REMOVED)
   - The transaction hash if any
   - What you were trying to do

---

## Quick Reference Card

```
# Open project folder
cd ~/Documents/smart-contract

# Start AI agent
claude

# Common requests to the agent:
# 1. "Configure a new step challenge with these settings: ..."
# 2. "Check the current gas price and my balance"
# 3. "Deploy a step challenge on Polygon"
# 4. "Verify the contract at 0x... on Polygonscan"
# 5. "Close the challenge at 0x..."
```

---

## Final Notes

- **Take your time.** Smart contracts are permanent. Once deployed, you cannot edit them. Better to spend 5 extra minutes double-checking than to deploy a contract with the wrong settings.

- **Start small.** Your first deployment should use a tiny amount (0.001 MATIC or less). Confirm everything works before deploying larger challenges.

- **Trust but verify.** AI agents are very capable, but they can make mistakes. Always read what the agent is about to do, especially before signing a blockchain transaction. If something looks unusual, ask the agent to explain.

Good luck with your deployment.
