### Staking API Documentation

#### References

- Slide deck: [`staking20250627` (slide id p5)](https://docs.google.com/presentation/d/1P6fSZBXPllAH9RSwPtFjpv5l_FWDfaWK/edit?slide=id.p5#slide=id.p5)

## Overview

- **Base URL**: `https://api.espl.jp`
- **Audience**: Backend services and admin tooling integrating staking discovery, status, and reward calculations.
- **Auth**: JWT Bearer token via `Authorization` header.
- **Formats**: JSON requests and responses.
- **Versioning**: Prefer `v2` endpoints; `v1` maintained for legacy.

## Environments

- **Production**: `https://api.espl.jp`
- **Staging/Sandbox**: liên hệ đội ngũ để cấp `baseURL` và token sandbox

## Headers

- `Authorization: <JWT_TOKEN>` (bắt buộc)
- `Content-Type: application/json`
- `Accept: application/json`

## Quy ước (VI)

- Thời gian: Unix timestamp (giây)
- Số lượng: dạng chuỗi thập phân để tránh tràn số
- Địa chỉ: địa chỉ EVM `0x...` (khuyến nghị checksum)

## Authentication

- Send header: `Authorization: <JWT_TOKEN>`
- Tokens are required on all endpoints below.

## Conventions

- All timestamps use Unix seconds, unless otherwise specified.
- Amounts are decimal strings unless noted. Do not assume integer-safe ranges.
- Addresses are EVM `0x` addresses with checksum recommended but not required.

## Endpoints

### GET /api/v2/staking

- **Purpose**: List available staking options on a given network.
- **Query params**:
  - `networkId` (number, required): EVM network identifier supported by the service.
- **Request example**:

```bash
curl --location 'https://api.espl.jp/api/v2/staking?networkId=5' \
--header 'Authorization: <YOUR_BEARER_TOKEN>' \
--header 'Content-Type: application/json'
```

- **200 Response example**:

```json
{
  "status": 200,
  "data": [
    {
      "id": 1,
      "defi_platform": "Aave Protocol",
      "protocol_name": "Aave V3 Protocal",
      "contract_address": "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
      "type": "POL",
      "apy": {
        "daily": 0.00000714456328343438,
        "monthly": 0.0002143591044634352,
        "yearly": 0.002611159436776145,
        "perSecond": 8.269142467420669e-11
      },
      "operator_fee": 20,
      "same_as_deposit": 80,
      "network_id": 5,
      "created_at": "2025-09-29T17:37:58.000Z",
      "updated_at": "2025-09-29T17:37:58.000Z",
      "type_contract_address": "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
      "address_provider": "0xa97684ead0e402dc232d5a977953df7ecbab3cdb",
      "rpc": "https://polygon-mainnet.g.alchemy.com/v2/xxxx"
    }
  ],
  "message": "success",
  "error": 0
}
```

- **Schema (response item)**:
  - `id` (number): Internal staking option id
  - `defi_platform` (string): Platform label
  - `protocol_name` (string): Market name
  - `contract_address` (string): Protocol contract used
  - `type` (string): Asset symbol within service (e.g., POL)
  - `apy` (object): { `daily`, `monthly`, `yearly` (number), `perSecond` (number) }
  - `operator_fee` (number): Percent (0-100)
  - `same_as_deposit` (number): Percent (0-100)
  - `network_id` (number)
  - `type_contract_address` (string): ERC-20 address for asset
  - `address_provider` (string): Aave V3 PoolAddressesProvider
  - `rpc` (string): Recommended RPC endpoint
  - `created_at`, `updated_at` (ISO string)
- **Errors**:
  - 400: missing/invalid `networkId`
  - 401: unauthorized
  - 5xx: provider/internal

- **JSON Schema (response item)**:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": [
    "id",
    "defi_platform",
    "protocol_name",
    "contract_address",
    "type",
    "apy",
    "operator_fee",
    "same_as_deposit",
    "network_id",
    "type_contract_address",
    "address_provider",
    "rpc",
    "created_at",
    "updated_at"
  ],
  "properties": {
    "id": { "type": "integer", "minimum": 1 },
    "defi_platform": { "type": "string", "minLength": 1 },
    "protocol_name": { "type": "string", "minLength": 1 },
    "contract_address": { "type": "string", "pattern": "^0x[0-9a-fA-F]{40}$" },
    "type": { "type": "string", "minLength": 2, "maxLength": 10 },
    "apy": {
      "type": "object",
      "required": ["daily", "monthly", "yearly", "perSecond"],
      "properties": {
        "daily": { "type": "number" },
        "monthly": { "type": "number" },
        "yearly": { "type": "number" },
        "perSecond": { "type": "number" }
      }
    },
    "operator_fee": { "type": "number", "minimum": 0, "maximum": 100 },
    "same_as_deposit": { "type": "number", "minimum": 0, "maximum": 100 },
    "network_id": { "type": "integer" },
    "created_at": { "type": "string", "format": "date-time" },
    "updated_at": { "type": "string", "format": "date-time" },
    "type_contract_address": {
      "type": "string",
      "pattern": "^0x[0-9a-fA-F]{40}$"
    },
    "address_provider": { "type": "string", "pattern": "^0x[0-9a-fA-F]{40}$" },
    "rpc": { "type": "string", "minLength": 10 }
  }
}
```

### GET /api/v1/users/settings/get-deploy

- **Purpose**: Return deployment configuration (bytecode and metadata).
- **Request example**:

```bash
curl --location 'https://api.espl.jp/api/v1/users/settings/get-deploy' \
--header 'Authorization: <YOUR_BEARER_TOKEN>' \
--header 'Content-Type: application/json'
```

- **Notes**:
  - Fields include `contract_bytecode`, `contract_staking_bytecode`, and lengths.
  - Response is large; store securely if needed, avoid verbose logs.

### GET /api/v2/staking/isStaking

- **Purpose**: Check whether the specified challenge is currently staking.
- **Query params**:
  - `networkId` (number, required)
  - `challengeContract` (string, required): Challenge contract address
- **Request example**:

```bash
curl --location 'https://api.espl.jp/api/v2/staking/isStaking?networkId=5&challengeContract=0xa101c5Fe4835434c25CF73170abA7260c1F20aA7' \
--header 'Authorization: <YOUR_BEARER_TOKEN>' \
--header 'Content-Type: application/json'
```

- **200 Response example**:

```json
{
  "status": 200,
  "data": { "isStaking": true },
  "message": "success",
  "error": 0
}
```

- **Schema**:
  - `data.isStaking` (boolean)
- **Errors**:
  - 400: invalid `challengeContract`
  - 401: unauthorized
  - 404: not found for `networkId`

- **JSON Schema (response)**:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["status", "data", "message", "error"],
  "properties": {
    "status": { "type": "integer" },
    "data": {
      "type": "object",
      "required": ["isStaking"],
      "properties": { "isStaking": { "type": "boolean" } }
    },
    "message": { "type": "string" },
    "error": { "type": "integer" }
  }
}
```

### GET /api/v2/staking/calReward

- **Purpose**: Calculate rewards for a challenge up to a cutoff time.
- **Query params**:
  - `networkId` (number, required)
  - `challengeContract` (string, required)
  - `endTime` (number, required): Unix seconds
- **Request example**:

```bash
curl --location 'https://api.espl.jp/api/v2/staking/calReward?networkId=5&challengeContract=0xa101c5Fe4835434c25CF73170abA7260c1F20aA7&endTime=1752842658' \
--header 'Authorization: <YOUR_BEARER_TOKEN>' \
--header 'Content-Type: application/json'
```

- **200 Response example**:

```json
{
  "status": 200,
  "data": {
    "listReceiversSuccess": [],
    "listReceiversFailed": ["0.00000661538007314", "0.00000661538007314"],
    "totalReward": "0.000008269225091424",
    "totalFeeSystem": "0.000001653845018284",
    "totalReceiver": "0.00000661538007314",
    "indexSplit": 0
  },
  "message": "success",
  "error": 0
}
```

- **Schema**:
  - `data.listReceiversSuccess` (array)
  - `data.listReceiversFailed` (array)
  - `data.totalReward` (string)
  - `data.totalFeeSystem` (string)
  - `data.totalReceiver` (string)
  - `data.indexSplit` (number)
- **Errors**:
  - 400: invalid parameters (e.g., `endTime`)
  - 401: unauthorized
  - 429: rate limited
  - 5xx: provider/internal

- **JSON Schema (response)**:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["status", "data", "message", "error"],
  "properties": {
    "status": { "type": "integer" },
    "data": {
      "type": "object",
      "required": [
        "listReceiversSuccess",
        "listReceiversFailed",
        "totalReward",
        "totalFeeSystem",
        "totalReceiver",
        "indexSplit"
      ],
      "properties": {
        "listReceiversSuccess": { "type": "array" },
        "listReceiversFailed": { "type": "array" },
        "totalReward": { "type": "string" },
        "totalFeeSystem": { "type": "string" },
        "totalReceiver": { "type": "string" },
        "indexSplit": { "type": "integer", "minimum": 0 }
      }
    },
    "message": { "type": "string" },
    "error": { "type": "integer" }
  }
}
```

## Error Model

- Standard error body:

```json
{
  "status": <http_code>,
  "message": "<error_message>",
  "error": <error_code_numeric>
}
```

- `status`: mirrors HTTP status
- `message`: human-readable description
- `error`: service-specific numeric code (0 on success)

### Common error codes

- **0**: success
- **1001**: invalid parameter
- **1002**: unauthorized or token expired
- **1004**: not found
- **1099**: provider/internal error

### Error examples

```json
{ "status": 400, "message": "missing networkId", "error": 1001 }
```

```json
{ "status": 401, "message": "invalid token", "error": 1002 }
```

## Rate Limits and Retries

- Some endpoints may return 429 on high volume.
- Use exponential backoff: 250ms, 500ms, 1s, 2s (jittered).
- Avoid parallel fan-out beyond 5 concurrent requests per token.
- Honor `Retry-After` header (seconds) if present on 429.

## Security Notes

- Treat the bearer token as a secret. Do not store in client apps.
- Validate addresses and parameters before sending.
- Prefer HTTPS. Do not use query params for sensitive data other than addresses/ids.

## TypeScript typings (SDK for app)

Define shared types to integrate safely on client/app.

```ts
export type ApySnapshot = {
  daily: number;
  monthly: number;
  yearly: number;
  perSecond: number;
};

export type StakingItem = {
  id: number;
  defi_platform: string;
  protocol_name: string;
  contract_address: string;
  type: string;
  apy: ApySnapshot;
  operator_fee: number;
  same_as_deposit: number;
  network_id: number;
  created_at: string;
  updated_at: string;
  type_contract_address: string;
  address_provider: string;
  rpc: string;
};

export type ApiEnvelope<T> = {
  status: number;
  data: T;
  message: string;
  error: number;
};
```

### Client helpers

```ts
import axios from 'axios';

const api = axios.create({
  baseURL: 'https://api.espl.jp',
  headers: {
    Authorization: process.env.ESPL_TOKEN || '',
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 10000,
});

export async function fetchStaking(
  networkId: number
): Promise<ApiEnvelope<StakingItem[]>> {
  const { data } = await api.get('/api/v2/staking', { params: { networkId } });
  return data;
}

export async function fetchIsStaking(
  networkId: number,
  challengeContract: string
): Promise<ApiEnvelope<{ isStaking: boolean }>> {
  const { data } = await api.get('/api/v2/staking/isStaking', {
    params: { networkId, challengeContract },
  });
  return data;
}

export async function fetchCalReward(
  networkId: number,
  challengeContract: string,
  endTime: number
): Promise<
  ApiEnvelope<{
    listReceiversSuccess: unknown[];
    listReceiversFailed: unknown[];
    totalReward: string;
    totalFeeSystem: string;
    totalReceiver: string;
    indexSplit: number;
  }>
> {
  const { data } = await api.get('/api/v2/staking/calReward', {
    params: { networkId, challengeContract, endTime },
  });
  return data;
}
```

## Glossary

- **PoolAddressesProvider**: Aave V3 registry contract exposing addresses for Pool and related components.
- **APY perSecond**: Tốc độ lãi theo giây dùng cho tính toán liên tục.
- **Operator fee**: Phần trăm phí hệ thống giữ lại trước khi phân phối.

## Node.js Examples (TypeScript)

- Install deps with yarn:

```bash
yarn add axios
```

- Create a client:

```ts
import axios from 'axios';

const api = axios.create({
  baseURL: 'https://api.espl.jp',
  headers: {
    Authorization: process.env.ESPL_TOKEN || '',
    'Content-Type': 'application/json',
  },
});

export async function listStaking(networkId: number) {
  const { data } = await api.get(`/api/v2/staking`, { params: { networkId } });
  return data;
}

export async function isStaking(networkId: number, challengeContract: string) {
  const { data } = await api.get(`/api/v2/staking/isStaking`, {
    params: { networkId, challengeContract },
  });
  return data;
}

export async function calReward(
  networkId: number,
  challengeContract: string,
  endTime: number
) {
  const { data } = await api.get(`/api/v2/staking/calReward`, {
    params: { networkId, challengeContract, endTime },
  });
  return data;
}
```

## Changelog

- 2025-09-29: Added `address_provider` and `rpc` to response docs; expanded error model; added examples. Source: slide [`staking20250627` p5](https://docs.google.com/presentation/d/1P6fSZBXPllAH9RSwPtFjpv5l_FWDfaWK/edit?slide=id.p5#slide=id.p5).
