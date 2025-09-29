import { ethers } from "hardhat";

// Aave v3 PoolAddressesProvider (Polygon)
const ADDRESSES_PROVIDER = "0xa97684ead0e402dc232d5a977953df7ecbab3cdb";

// Common Polygon assets
const WMATIC_POLYGON = "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270";

const ADDR_PROVIDER_ABI = [
  "function getPoolDataProvider() view returns (address)"
];

// AaveProtocolDataProvider v3 minimal ABI (liquidityRate in ray at index 5)
const DATAPROVIDER_ABI = [
  "function getReserveData(address asset) view returns (uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint40)"
];

const SECONDS_PER_YEAR = 365 * 24 * 60 * 60;
const SECONDS_PER_DAY = 24 * 60 * 60;
const SECONDS_PER_MONTH = 30 * SECONDS_PER_DAY; // approx 30-day month

function rayToDecimal(ray: bigint): number {
  return Number(ray) / 1e27;
}

function toPercent(n: number): string {
  return (n * 100).toFixed(4);
}

export async function getAPyRate(asset: string, rpcUrl?: string) {
  const usedProvider = rpcUrl ? new (ethers as any).JsonRpcProvider(rpcUrl) : ethers.provider;

  const ap = new (ethers as any).Contract(ADDRESSES_PROVIDER, ADDR_PROVIDER_ABI, usedProvider);
  const dataProviderAddr: string = await ap.getPoolDataProvider();
  const dp = new (ethers as any).Contract(dataProviderAddr, DATAPROVIDER_ABI, usedProvider);
  const rd = await dp.getReserveData(asset);
  const liquidityRateRay: bigint = rd[5];

  // Base annual nominal rate (per-year) as decimal
  const r = rayToDecimal(liquidityRateRay); // e.g., 0.002621 = 0.2621%

  // Assume per-second compounding consistent with Aave's liquidityIndex accrual
  const perSecond = r / SECONDS_PER_YEAR;
  const yearly = Math.pow(1 + perSecond, SECONDS_PER_YEAR) - 1;
  const monthly = Math.pow(1 + perSecond, SECONDS_PER_MONTH) - 1;
  const daily = Math.pow(1 + perSecond, SECONDS_PER_DAY) - 1;

  return {
    daily, // decimal (e.g., 0.000007)
    monthly, // decimal
    yearly, // decimal
    rNominal: r, // nominal APR from Aave (decimal)
    dataProviderAddr
  };
}

async function main() {
  const assetArg = process.env.ASSET?.toLowerCase();
  const asset = (ethers as any).isAddress(assetArg || "") ? (assetArg as string) : WMATIC_POLYGON;
  const rpc = process.env.RPC || process.env.POLYGON_RPC || process.env.JSON_RPC;

  const apy = await getAPyRate(asset, rpc);

  console.log(`RPC: ${rpc ?? "<hardhat provider>"}`);
  console.log(`DataProvider: ${apy.dataProviderAddr}`);
  console.log(`Asset: ${asset}`);
  console.log(`Nominal APR (Aave rate): ${toPercent(apy.rNominal)} %`);
  console.log(`Effective Daily APY: ${toPercent(apy.daily)} %`);
  console.log(`Effective Monthly APY (~30d): ${toPercent(apy.monthly)} %`);
  console.log(`Effective Yearly APY: ${toPercent(apy.yearly)} %`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
