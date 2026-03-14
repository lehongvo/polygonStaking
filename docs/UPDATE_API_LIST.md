# API Update — Cho team App

Tài liệu này mô tả **2 API được cập nhật** và **các API mới** (estimate gas create challenge, estimate gas send step BaseStep/HIIT) để team App đọc và cập nhật tích hợp.

**Base URL:** `https://<domain>` — thay bằng domain API thật.

**Header chung:** Cần gửi `Authorization: xxx` (JWT token) và `Content-Type: application/json` cho các API có auth.

---

## 1. API được cập nhật

### 1.1 GET Settings — Lấy thông tin deploy (bytecode)

**Mục đích:** Lấy cấu hình deploy (contract bytecode, v.v.). Response đã được **bổ sung** các field mới cho Challenge BaseStep và HIIT.

**Endpoint:** `GET /api/v1/users/settings/get-deploy`

**Thay đổi response:**  
- Thêm `challenge_base_step` (bytecode ChallengeBaseStep)  
- Thêm `challenge_base_step_length`  
- Thêm `challenge_hiit` (bytecode ChallengeHIIT)  
- Thêm `challenge_hiit_length`  

**Curl mẫu:**

```bash
curl --location 'https://<domain>/api/v1/users/settings/get-deploy' \
--header 'Authorization: xxx' \
--header 'Content-Type: application/json'
```

**App cần:**  
- Parse response như hiện tại.  
- Nếu dùng bytecode deploy challenge mới (BaseStep / HIIT), dùng thêm các field `challenge_base_step`, `challenge_base_step_length`, `challenge_hiit`, `challenge_hiit_length` theo đúng loại challenge.

---

### 1.2 GET Profile by Wallet

**Mục đích:** Lấy profile user theo địa chỉ ví. Response đã được **bổ sung** field `hiitAge`.

**Endpoint:** `GET /api/v1/users/get-profile-by-wallet/:address`

**Tham số:**  
- `address` — địa chỉ ví (path), có thể có prefix `ethereum:` hoặc không.

**Thay đổi response:**  
- Thêm field `hiitAge`: giá trị `birthday` từ bảng `chat_bot_setting_v2` của user. Nếu không có bản ghi hoặc không có `birthday` thì `hiitAge` = `null`.

**Curl mẫu:**

```bash
curl --location 'https://<domain>/api/v1/users/get-profile-by-wallet/0xe340371845820cb16Cb8908E0ed07e2E1Ff40024' \
--header 'Authorization: xxx' \
--header 'Content-Type: application/json'
```

**App cần:**  
- Trong response `data`, sử dụng thêm field `hiitAge` (string hoặc null) cho màn hình/flow cần hiển thị hoặc gửi “hiit age” / birthday từ chatbot setting.

---

## 2. API mới — Estimate gas tạo challenge (BaseStep & HIIT)

Cả 4 API đều **POST**, cần **Authorization** và **Content-Type: application/json**.  
Response thành công: `{ "status": 200, "data": [ list_gas ], "message": "success", "error": 0 }` — `data` là mảng gas level (low, standard, fast, fastest).

---

### 2.1 Estimate gas — Challenge BaseStep (Token)

Deploy challenge **BaseStep** thanh toán bằng **token** (ERC20). Cần gửi `erc20_list_address` (địa chỉ token).

**Endpoint:** `POST /api/v1/challenges/estimate-gas-create-challenge-base-step-token`

**Body (JSON):**

| Field | Kiểu | Bắt buộc | Ghi chú |
|-------|------|----------|---------|
| network_id | number | Có | VD: 5 (testnet); Polygon mainnet = 137 |
| stake_holders | string[] | Có | [sponsor, challenger, fee] |
| erc20_list_address | string | Có | Địa chỉ token (hoặc phần tử đầu nếu gửi array) |
| erc721_address | string[] | Có | Danh sách địa chỉ NFT |
| primary_required | number[] | Có | [duration, startTime, endTime, goal, dayRequired] — 5 phần tử |
| award_receivers | string[] | Có | Địa chỉ nhận thưởng |
| index | number | Có | Số receiver nhận khi success |
| allow_give_up | boolean[] | Có | [sponsor, challenger, ...] — 3 phần tử |
| gas_data | string[] | Có | VD: ["200000000000000000", "200000000000000000", "0"] |
| all_award_to_sponsor | boolean | Có | |
| award_receivers_percent | number[] | Có | VD: [100, 100] |
| total_amount | string | Có | Wei (string) |
| walking_speed_data | number[] | Có | [targetSpeed, requiredMinutes, minDays] hoặc [] |
| hiit_data | number[] | Có | [intervals, totalSeconds] hoặc [] |

**Curl mẫu:**

```bash
curl --location 'https://<domain>/api/v1/challenges/estimate-gas-create-challenge-base-step-token' \
--header 'Authorization: xxx' \
--header 'Content-Type: application/json' \
--data '{
  "network_id": 5,
  "stake_holders": ["0xa826774CA92237635421FeBe045CA2f3D1D4dbf0", "0xa826774CA92237635421FeBe045CA2f3D1D4dbf0", "0xa826774CA92237635421FeBe045CA2f3D1D4dbf0"],
  "erc20_list_address": "0x4b367dE58312a51e5c2Cb6BB2b817bF45e4712DF",
  "erc721_address": ["0x55285EcCef5487E87C5980C880131aCadDE7767C"],
  "primary_required": [3, 1771368487, 1967062887, 100, 3],
  "award_receivers": ["0xa826774CA92237635421FeBe045CA2f3D1D4dbf0", "0xa826774CA92237635421FeBe045CA2f3D1D4dbf0"],
  "index": 1,
  "allow_give_up": [true, true, true],
  "gas_data": ["200000000000000000", "200000000000000000", "0"],
  "all_award_to_sponsor": true,
  "award_receivers_percent": [100, 100],
  "total_amount": "1000000000000",
  "walking_speed_data": [50, 30, 2],
  "hiit_data": [3, 120]
}'
```

---

### 2.2 Estimate gas — Challenge BaseStep (Coin)

Deploy challenge **BaseStep** thanh toán bằng **native coin** (MATIC/ETH...). Không gửi `erc20_list_address`.

**Endpoint:** `POST /api/v1/challenges/estimate-gas-create-challenge-base-step-coin`

**Body:** Giống BaseStep Token nhưng **không có** `erc20_list_address`.

**Curl mẫu:**

```bash
curl --location 'https://<domain>/api/v1/challenges/estimate-gas-create-challenge-base-step-coin' \
--header 'Authorization: xxx' \
--header 'Content-Type: application/json' \
--data '{
  "network_id": 5,
  "stake_holders": ["0xa826774CA92237635421FeBe045CA2f3D1D4dbf0", "0xa826774CA92237635421FeBe045CA2f3D1D4dbf0", "0xa826774CA92237635421FeBe045CA2f3D1D4dbf0"],
  "erc721_address": ["0x55285EcCef5487E87C5980C880131aCadDE7767C"],
  "primary_required": [3, 1771368487, 1967062887, 100, 3],
  "award_receivers": ["0xa826774CA92237635421FeBe045CA2f3D1D4dbf0", "0xa826774CA92237635421FeBe045CA2f3D1D4dbf0"],
  "index": 1,
  "allow_give_up": [true, true, true],
  "gas_data": ["200000000000000000", "200000000000000000", "0"],
  "all_award_to_sponsor": true,
  "award_receivers_percent": [100, 100],
  "total_amount": "1000000000000",
  "walking_speed_data": [50, 30, 2],
  "hiit_data": [3, 120]
}'
```

---

### 2.3 Estimate gas — Challenge HIIT (Token)

Deploy challenge **chỉ HIIT** (không step, không walking), thanh toán bằng **token**.  
`primary_required` có **6 phần tử:** [duration, startTime, endTime, highIntensityIntervals, totalHighIntensityTime, dayRequired].  
Không có `walking_speed_data`, `hiit_data`.

**Endpoint:** `POST /api/v1/challenges/estimate-gas-create-challenge-hiit-token`

**Body (JSON):** Giống các API trên nhưng:  
- Có `erc20_list_address`.  
- `primary_required`: 6 số (duration, startTime, endTime, highIntensityIntervals, totalHighIntensityTime, dayRequired).  
- Không gửi `walking_speed_data`, `hiit_data`.

**Curl mẫu:**

```bash
curl --location 'https://<domain>/api/v1/challenges/estimate-gas-create-challenge-hiit-token' \
--header 'Authorization: xxx' \
--header 'Content-Type: application/json' \
--data '{
  "network_id": 5,
  "stake_holders": ["0xa826774CA92237635421FeBe045CA2f3D1D4dbf0", "0xa826774CA92237635421FeBe045CA2f3D1D4dbf0", "0xa826774CA92237635421FeBe045CA2f3D1D4dbf0"],
  "erc20_list_address": "0x4b367dE58312a51e5c2Cb6BB2b817bF45e4712DF",
  "erc721_address": ["0x55285EcCef5487E87C5980C880131aCadDE7767C"],
  "primary_required": [3, 1771368487, 1967062887, 2, 60, 3],
  "award_receivers": ["0xa826774CA92237635421FeBe045CA2f3D1D4dbf0", "0xa826774CA92237635421FeBe045CA2f3D1D4dbf0"],
  "index": 1,
  "allow_give_up": [true, true, true],
  "gas_data": ["200000000000000000", "200000000000000000", "0"],
  "all_award_to_sponsor": true,
  "award_receivers_percent": [100, 100],
  "total_amount": "1000000000000"
}'
```

---

### 2.4 Estimate gas — Challenge HIIT (Coin)

Deploy challenge **chỉ HIIT**, thanh toán bằng **native coin**. Không gửi `erc20_list_address`; `primary_required` vẫn 6 phần tử.

**Endpoint:** `POST /api/v1/challenges/estimate-gas-create-challenge-hiit-coin`

**Curl mẫu:**

```bash
curl --location 'https://<domain>/api/v1/challenges/estimate-gas-create-challenge-hiit-coin' \
--header 'Authorization: xxx' \
--header 'Content-Type: application/json' \
--data '{
  "network_id": 5,
  "stake_holders": ["0xa826774CA92237635421FeBe045CA2f3D1D4dbf0", "0xa826774CA92237635421FeBe045CA2f3D1D4dbf0", "0xa826774CA92237635421FeBe045CA2f3D1D4dbf0"],
  "erc721_address": ["0x55285EcCef5487E87C5980C880131aCadDE7767C"],
  "primary_required": [3, 1771368487, 1967062887, 2, 60, 3],
  "award_receivers": ["0xa826774CA92237635421FeBe045CA2f3D1D4dbf0", "0xa826774CA92237635421FeBe045CA2f3D1D4dbf0"],
  "index": 1,
  "allow_give_up": [true, true, true],
  "gas_data": ["200000000000000000", "200000000000000000", "0"],
  "all_award_to_sponsor": true,
  "award_receivers_percent": [100, 100],
  "total_amount": "1000000000000"
}'
```

---

## 3. API mới — Estimate gas send step (BaseStep & HIIT)

Ba API dùng cho **gửi kết quả ngày** (send daily result) trên contract **ChallengeBaseStep** hoặc **ChallengeHIIT**.  
Cần **Authorization** và **Content-Type: application/json**.

**Response thành công:** `{ "status": 200, "data": { ... }, "message": "success", "error": 0 }`

- **Android** (gửi `platform: "android"` trong body hoặc header `platform: android`): `data` có `list_gas` và `encode_abi_data`.
- **iOS / khác:** `data` có `list_gas`, `list_infor_transfer`, `signature`, `data` (payload gửi step).

`list_gas` là mảng 4 mức: `low`, `standard`, `fast`, `fastest` — mỗi phần tử: `{ type, estimate_gas_price, estimate_gas_limit }`.

---

### 3.1 Estimate gas send step — Challenge BaseStep (no gacha)

Dùng cho challenge **BaseStep** khi gửi kết quả ngày **không có gacha**.

**Endpoint:** `POST /api/v1/challenges/estimate-gas-send-step-base-step`

**Body (JSON):**

| Field | Kiểu | Bắt buộc | Ghi chú |
|-------|------|----------|---------|
| wallet_address | string | Có | Địa chỉ ví người gửi |
| network_id | number | Có | VD: 5 (testnet); Polygon mainnet = 137 |
| challenge_address | string | Có | Địa chỉ contract challenge |
| day | string[] hoặc array | Có | VD: `["1771541287"]` |
| step_index | string[] hoặc array | Có | VD: `["10000"]` |
| time_range | string[] | Có | VD: `["1771886887", "1781886888"]` |
| minutes_at_target_speed | string[] hoặc array | Không | Walking: VD `["30"]`; có thể `[]` |
| mets_walking_speed | string[] hoặc array | Không | Walking: VD `["1"]`; có thể `[]` |
| hiit_intervals | string[] hoặc array | Không | HIIT intervals; có thể `[]` |
| hiit_total_seconds | string[] hoặc array | Không | HIIT total seconds; có thể `[]` |
| platform | string | Không | `"android"` hoặc `"ios"` — nếu gửi `android` thì response có `encode_abi_data` |

**Curl mẫu:**

```bash
curl --location 'https://<domain>/api/v1/challenges/estimate-gas-send-step-base-step' \
--header 'Authorization: xxx' \
--header 'Content-Type: application/json' \
--data '{
  "wallet_address": "0xa826774CA92237635421FeBe045CA2f3D1D4dbf0",
  "network_id": 5,
  "challenge_address": "0xddd93ad47907546eE5c774F225DB66f7D00519B5",
  "day": ["1771541287"],
  "step_index": ["10000"],
  "time_range": ["1771886887", "1781886888"],
  "minutes_at_target_speed": ["30"],
  "mets_walking_speed": ["1"],
  "hiit_intervals": ["2"],
  "hiit_total_seconds": ["60"],
  "platform": "android"
}'
```

---

### 3.2 Estimate gas send step — Challenge BaseStep (with gacha)

Dùng cho challenge **BaseStep** khi gửi kết quả ngày **có chọn gacha** (danh sách địa chỉ gacha).

**Endpoint:** `POST /api/v1/challenges/estimate-gas-send-step-base-step-with-gacha`

**Body (JSON):** Giống **3.1** và thêm:

| Field | Kiểu | Bắt buộc | Ghi chú |
|-------|------|----------|---------|
| list_gacha_address | string[] | Có | Danh sách địa chỉ gacha, VD: `["0x0c2c056310cC444A5EfC70ca4FEC44A9CF1518f7"]` hoặc `[]` |

**Curl mẫu:**

```bash
curl --location 'https://<domain>/api/v1/challenges/estimate-gas-send-step-base-step-with-gacha' \
--header 'Authorization: xxx' \
--header 'Content-Type: application/json' \
--data '{
  "wallet_address": "0xa826774CA92237635421FeBe045CA2f3D1D4dbf0",
  "network_id": 5,
  "challenge_address": "0xddd93ad47907546eE5c774F225DB66f7D00519B5",
  "day": ["1771541287"],
  "step_index": ["10000"],
  "list_gacha_address": ["0x0c2c056310cC444A5EfC70ca4FEC44A9CF1518f7"],
  "time_range": ["1771886887", "1781886888"],
  "minutes_at_target_speed": ["30"],
  "mets_walking_speed": ["1"],
  "hiit_intervals": ["2"],
  "hiit_total_seconds": ["60"],
  "platform": "android"
}'
```

---

### 3.3 Estimate gas send step — Challenge HIIT (only HIIT)

Dùng cho challenge **chỉ HIIT** (contract ChallengeHIIT) khi gửi kết quả ngày. Không có step_index, walking, step data — chỉ intervals và totalSeconds.

**Endpoint:** `POST /api/v1/challenges/estimate-gas-send-step-hiit`

**Body (JSON):**

| Field | Kiểu | Bắt buộc | Ghi chú |
|-------|------|----------|---------|
| wallet_address | string | Có | Địa chỉ ví người gửi |
| network_id | number | Có | VD: 5 (testnet); Polygon mainnet = 137 |
| challenge_address | string | Có | Địa chỉ contract challenge HIIT |
| day | string[] hoặc array | Có | VD: `["1771541287"]` |
| intervals | string[] hoặc array | Có | Số intervals HIIT đạt được |
| total_seconds | string[] hoặc array | Có | Tổng giây HIIT |
| time_range | string[] | Có | VD: `["1771886887", "1781886888"]` |
| platform | string | Không | `"android"` hoặc `"ios"` — `android` thì response có `encode_abi_data` |

**Curl mẫu:**

```bash
curl --location 'https://<domain>/api/v1/challenges/estimate-gas-send-step-hiit' \
--header 'Authorization: xxx' \
--header 'Content-Type: application/json' \
--data '{
  "wallet_address": "0xa826774CA92237635421FeBe045CA2f3D1D4dbf0",
  "network_id": 5,
  "challenge_address": "0xddd93ad47907546eE5c774F225DB66f7D00519B5",
  "day": ["1771541287"],
  "intervals": ["2"],
  "total_seconds": ["60"],
  "time_range": ["1771886887", "1781886888"],
  "platform": "android"
}'
```

---

## 4. Tóm tắt cho App

| Loại | API | Method | Ghi chú |
|------|-----|--------|--------|
| Cập nhật | `/api/v1/users/settings/get-deploy` | GET | Thêm `challenge_base_step`, `challenge_base_step_length`, `challenge_hiit`, `challenge_hiit_length` |
| Cập nhật | `/api/v1/users/get-profile-by-wallet/:address` | GET | Thêm field `hiitAge` trong `data` |
| Mới | `/api/v1/challenges/estimate-gas-create-challenge-base-step-token` | POST | Body có `erc20_list_address`, `walking_speed_data`, `hiit_data`; primary_required 5 số |
| Mới | `/api/v1/challenges/estimate-gas-create-challenge-base-step-coin` | POST | Không có `erc20_list_address`; có `walking_speed_data`, `hiit_data` |
| Mới | `/api/v1/challenges/estimate-gas-create-challenge-hiit-token` | POST | Có `erc20_list_address`; `primary_required` 6 số; không walking/hiit_data |
| Mới | `/api/v1/challenges/estimate-gas-create-challenge-hiit-coin` | POST | Không có `erc20_list_address`; `primary_required` 6 số |
| Mới | `/api/v1/challenges/estimate-gas-send-step-base-step` | POST | Estimate gas gửi step BaseStep (no gacha). Body: wallet_address, challenge_address, day, step_index, time_range, walking/HIIT fields, platform (optional) |
| Mới | `/api/v1/challenges/estimate-gas-send-step-base-step-with-gacha` | POST | Estimate gas gửi step BaseStep có gacha. Thêm body `list_gacha_address`. Gửi `platform: "android"` để nhận `encode_abi_data` |
| Mới | `/api/v1/challenges/estimate-gas-send-step-hiit` | POST | Estimate gas gửi step challenge chỉ HIIT. Body: wallet_address, challenge_address, day, intervals, total_seconds, time_range, platform (optional) |

Tất cả API challenge estimate-gas đều yêu cầu **đăng nhập**. Gửi header `Authorization: xxx` — thay `xxx` bằng JWT token thật của user khi gọi từ app.  
Với 3 API estimate-gas **send step** (BaseStep / BaseStep with gacha / HIIT), gửi thêm **`platform: "android"`** (body hoặc header) nếu cần nhận **`encode_abi_data`** trong response.
