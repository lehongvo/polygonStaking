import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { ethers, network } from 'hardhat';

interface GachaEntry {
  Name: string;
  Network: string;
  GachaProxyAddress: string;
  ImplementAddress: string;
  ImplementAddressDeployAt: string;
}

interface EtherscanCreationResponse {
  status: string;
  message?: string;
  result?: Array<{ txHash?: string }>;
}

const EIP1967_IMPL_SLOT =
  '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
const POLYGON_CHAIN_ID = 137;
const ETHERSCAN_V2_URL = 'https://api.etherscan.io/v2/api';
const RATE_LIMIT_DELAY_MS = 250;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function getApiKey(): string {
  const key = process.env.ETHERSCAN_API_KEY ?? process.env.POLYGONSCAN_API_KEY;
  if (!key) {
    throw new Error(
      'Missing API key — set ETHERSCAN_API_KEY or POLYGONSCAN_API_KEY in .env'
    );
  }
  return key;
}

async function readImplementationAddress(proxy: string): Promise<string> {
  const raw = await ethers.provider.getStorage(proxy, EIP1967_IMPL_SLOT);
  const impl = ethers.getAddress('0x' + raw.slice(-40));
  if (impl === ethers.ZeroAddress) {
    throw new Error(
      `Proxy ${proxy} returns zero implementation (not a UUPS proxy?)`
    );
  }
  return impl;
}

async function fetchContractCreationTxHash(
  impl: string,
  apiKey: string
): Promise<string> {
  const url =
    `${ETHERSCAN_V2_URL}?chainid=${POLYGON_CHAIN_ID}` +
    `&module=contract&action=getcontractcreation` +
    `&contractaddresses=${impl}&apikey=${apiKey}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Etherscan HTTP ${response.status} for ${impl}`);
  }

  const data: EtherscanCreationResponse = await response.json();

  if (
    data.status !== '1' ||
    !Array.isArray(data.result) ||
    data.result.length === 0 ||
    !data.result[0].txHash
  ) {
    throw new Error(
      `Etherscan API error for ${impl}: ${data.message ?? 'no result'}`
    );
  }
  return data.result[0].txHash;
}

async function fetchDeployTimestamp(txHash: string): Promise<string> {
  const tx = await ethers.provider.getTransaction(txHash);
  if (!tx || tx.blockNumber == null) {
    throw new Error(`Transaction ${txHash} not found or pending`);
  }
  const block = await ethers.provider.getBlock(tx.blockNumber);
  if (!block) {
    throw new Error(`Block ${tx.blockNumber} not found`);
  }
  return new Date(Number(block.timestamp) * 1000).toISOString();
}

async function getGachaImplementations(): Promise<void> {
  if (network.name !== 'polygon') {
    throw new Error(
      `This script only supports network 'polygon', got '${network.name}'`
    );
  }

  const apiKey = getApiKey();

  const jsonPath = path.join(
    process.cwd(),
    'docs',
    'contractAddress',
    'gachaAddress.json'
  );
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`File not found: ${jsonPath}`);
  }

  const entries: GachaEntry[] = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  console.log(`📍 Loaded ${entries.length} entries from ${jsonPath}`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const tag = `[${i + 1}/${entries.length}] ${entry.Name} (${entry.GachaProxyAddress})`;

    if (entry.ImplementAddress && entry.ImplementAddressDeployAt) {
      console.log(`⏭️  ${tag} — already filled, skip`);
      skipped++;
      continue;
    }

    if (entry.Network !== 'polygon') {
      console.log(`⚠️  ${tag} — Network is '${entry.Network}', not polygon, skip`);
      skipped++;
      continue;
    }

    try {
      console.log(`🔄 ${tag} — fetching...`);
      const impl = await readImplementationAddress(entry.GachaProxyAddress);
      const txHash = await fetchContractCreationTxHash(impl, apiKey);
      const deployedAt = await fetchDeployTimestamp(txHash);

      entry.ImplementAddress = impl;
      entry.ImplementAddressDeployAt = deployedAt;
      console.log(`✅ ${tag} — impl ${impl}, deployed ${deployedAt}`);
      updated++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`❌ ${tag} — ${msg}`);
      failed++;
    }

    await sleep(RATE_LIMIT_DELAY_MS);
  }

  fs.writeFileSync(jsonPath, JSON.stringify(entries, null, 2) + '\n');
  console.log(
    `\n📊 Done — updated: ${updated}, skipped: ${skipped}, failed: ${failed}`
  );
  console.log(`💾 Saved to ${jsonPath}`);
}

if (require.main === module) {
  getGachaImplementations().catch((err) => {
    console.error('Fatal:', err);
    process.exit(1);
  });
}

export { getGachaImplementations };
