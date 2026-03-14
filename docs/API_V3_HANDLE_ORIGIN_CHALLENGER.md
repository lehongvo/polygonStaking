# API v3 - Handle Origin Challenger

## Mục đích

Từ v3, backend cần xử lý thêm **origin contract** (`ChallengeDetail.sol`) — các challenge cũ được deploy trước khi có `ChallengeBaseStep` và `ChallengeHIIT`.

Hàm `getOnchainChallengeData(address)` trong `scripts/challenge/getChallengeData.js` tự động detect loại contract và trả về dữ liệu chuẩn hoá.

---

## Contract detection logic

```
address
  ├── có getChallengeTypeAndHistory()  → kind: 'BaseStep'
  ├── có getHIITConfig()               → kind: 'HIIT'
  └── có getChallengeHistory()         → kind: 'Origin'  ← contract cũ
```

---

## Output của `getOnchainChallengeData(address)`

| Field | Type | Mô tả |
|-------|------|--------|
| `isBaseStep` | `boolean` | `true` nếu là `BaseStep` hoặc `Origin` contract |
| `isOnlyHiit` | `boolean` | `true` nếu chỉ có HIIT (`ChallengeHIIT` contract) |
| `challengeTypeName` | `string` | Tên loại challenge (xem bảng bên dưới) |
| `challengeTypeNumber` | `number` | Số loại challenge từ 1–5 |
| `challengeType` | `string` | Alias của `challengeTypeName` |
| `historyDataDate` | `string[]` | Danh sách ngày có lịch sử (unix timestamp dạng string), đã sort tăng dần |
| `hiitConfigData` | `object \| null` | Config HIIT (nếu có) |
| `workingConfigData` | `object \| null` | Config walking speed (nếu có) |
| `historyStepData` | `object[] \| null` | Lịch sử bước chân (nếu có) |
| `historyHiitData` | `object[] \| null` | Lịch sử HIIT (nếu có) |
| `historyWorkingSpeedData` | `object[] \| null` | Lịch sử walking speed (nếu có) |

---

## challengeTypeNumber mapping

| Number | challengeTypeName | Mô tả |
|--------|-------------------|--------|
| 1 | `ONLY BASE STEP` | Step bình thường, không walking, không HIIT |
| 2 | `BASE STEP AND WALKING` | Step + walking speed |
| 3 | `BASE STEP AND HIIT` | Step + HIIT |
| 4 | `BASE STEP AND WALKING AND HIIT` | Step + walking speed + HIIT |
| 5 | `ONLY HIIT` | Chỉ HIIT (contract `ChallengeHIIT`) |

---

## Origin contract (`kind: 'Origin'`)

Contract cũ (`ChallengeDetail.sol`) chỉ có `getChallengeHistory()` trả về `(date[], data[])`.

Output khi gặp origin contract:

```json
{
  "isBaseStep": true,
  "isOnlyHiit": false,
  "challengeTypeName": "ONLY BASE STEP",
  "challengeTypeNumber": 1,
  "challengeType": "ONLY BASE STEP",
  "historyDataDate": ["1700000000", "1700086400"],
  "hiitConfigData": null,
  "workingConfigData": null,
  "historyStepData": [
    { "day": "1700000000", "steps": "8000" },
    { "day": "1700086400", "steps": "10000" }
  ],
  "historyHiitData": null,
  "historyWorkingSpeedData": null
}
```

---

## Notes

- `isBaseStep: true` cho cả `BaseStep` và `Origin` — app có thể dùng field này để biết có `historyStepData`.
- `hiitConfigData`, `workingConfigData`, `historyHiitData`, `historyWorkingSpeedData` đều là `null` với origin contract.
- v2 API không thay đổi.

---

## API `GET /api/v3/challenges/:id`

### 1. Mô tả chung

- API v3 trả về chi tiết challenge, bao gồm cả dữ liệu on-chain đã **chuẩn hoá** từ `getOnchainChallengeData`.
- Dữ liệu on-chain được cache vào bảng `temp_challenges` để giảm số lượng call lên blockchain.

### 2. Query params

| Tên | Kiểu | Mặc định | Mô tả |
|-----|------|----------|-------|
| `cache` | `string` (`'true' \| 'false' \| '1' \| '0'`) | `true` | Điều khiển cách API dùng cache on-chain snapshot. |

Quy tắc parse:

- Nếu **không truyền** `cache` → `useCache = true`.
- Nếu `cache = 'true'` hoặc `cache = '1'` → `useCache = true`.
- Các giá trị khác (`false`, `0`, v.v.) → `useCache = false`.

### 3. Hành vi khi `cache = false`

- Bỏ qua snapshot trong DB (không dùng để trả về trực tiếp).
- Luôn **fetch dữ liệu mới nhất từ on-chain**, gồm:
  - `backupChallengeStatus(...)`
  - `getChallengeInfo(...)`
  - `getOnchainChallengeData(...)`
- Sau khi fetch thành công:
  - Ghi lại snapshot mới vào `temp_challenges` với TTL mặc định **10 phút**.
  - Trả về dữ liệu **mới nhất** vừa fetch.
- Nếu fetch on-chain bị lỗi:
  - Hệ thống sẽ cố gắng **fallback** sang snapshot cache còn hạn (nếu có) trong DB và trả về dữ liệu đó.

### 4. Hành vi khi **không truyền `cache`** hoặc `cache = true`

- Hệ thống sẽ **ưu tiên dùng cache** nếu có snapshot hợp lệ trong `temp_challenges`:
  - Snapshot hợp lệ là bản ghi có `time_expire > now`.
  - Nếu parse `data` thất bại → bỏ snapshot, chuyển sang fetch on-chain.
- Nếu:
  - Không có snapshot còn hạn, **hoặc**
  - Snapshot parse lỗi  
  → API sẽ **fetch dữ liệu mới nhất từ on-chain**, lưu snapshot mới (TTL 10 phút) rồi trả về dữ liệu mới.

Tóm lại:

- `cache = false` → luôn cố gắng **lấy data mới nhất từ on-chain**, chỉ fallback về cache khi on-chain lỗi.
- Không truyền `cache` hoặc `cache = true` → **lấy từ cache nếu còn hạn**, nếu hết hạn / không có / lỗi parse thì sẽ fetch on-chain, **update cache rồi trả về**.
