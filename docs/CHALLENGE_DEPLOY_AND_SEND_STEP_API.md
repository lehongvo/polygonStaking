# Hướng dẫn Deploy & Gửi Step – Challenge (Cho App)

Tài liệu này mô tả **cách truyền đúng tham số** khi:
1. **Deploy** challenge (tạo contract mới)
2. **Gửi kết quả hàng ngày** (gọi `sendDailyResult`)

Có **2 loại contract**, mỗi loại có bộ tham số khác nhau — app cần gọi đúng và truyền đúng thứ tự.

---

## Chọn contract nào?

| Nhu cầu | Dùng contract |
|--------|----------------|
| Chỉ đếm **bước chân (step)** | **ChallengeBaseStep** |
| Step + **tốc độ đi bộ (walking speed)** | **ChallengeBaseStep** |
| Step + **HIIT** (cường độ cao) | **ChallengeBaseStep** |
| Step + walking speed + HIIT | **ChallengeBaseStep** |
| **Chỉ HIIT** (không step, không walking) | **ChallengeHIIT** |

---

# Phần 1: ChallengeBaseStep

**File contract:** `ChallengeBaseStep.sol`  
**Dùng khi:** Challenge có step (và có thể thêm walking speed và/hoặc HIIT).

---

## 1.1 Deploy ChallengeBaseStep — Cần truyền gì?

Khi tạo challenge mới, bạn truyền **13 tham số** theo đúng thứ tự dưới đây.

### Nhóm 1 — Người tham gia & token

| Tham số | Ý nghĩa | Ví dụ |
|--------|---------|--------|
| `_stakeHolders` | 3 địa chỉ: [sponsor, challenger, địa chỉ nhận fee] | `["0x...", "0x...", "0x..."]` |
| `_createByToken` | Token dùng để tạo challenge. Dùng native (MATIC) thì truyền `0x0000000000000000000000000000000000000000` | `"0x00...00"` |
| `_erc721Address` | Danh sách địa chỉ NFT (thường 1 phần tử) | `["0x..."]` |

### Nhóm 2 — Thời gian & mục tiêu challenge

| Tham số | Ý nghĩa | Ví dụ |
|--------|---------|--------|
| `_primaryRequired` | Mảng **ít nhất 5 số**:<br>**[0]** duration (số ngày challenge)<br>**[1]** startTime (unix timestamp bắt đầu)<br>**[2]** endTime (unix timestamp kết thúc)<br>**[3]** goal (số bước chân cần đạt mỗi ngày)<br>**[4]** dayRequired (số ngày cần đạt mục tiêu trong khoảng thời gian challenge | `[3, 1771368487, 1967062887, 100, 3]`<br>→ 3 ngày, goal 100 bước, cần đạt 3 ngày |

### Nhóm 3 — Thưởng & give up

| Tham số | Ý nghĩa | Ví dụ |
|--------|---------|--------|
| `_awardReceivers` | Danh sách ví nhận thưởng (khi success và khi fail) | `["0x...", "0x..."]` |
| `_index` | Số lượng receiver được nhận thưởng khi **success** (các vị trí còn lại là thưởng khi **fail**) | `1` |
| `_allowGiveUp` | Mảng **đúng 3 bool**: [sponsor được give up?, challenger được give up?, ...] | `[true, true, true]` |
| `_allAwardToSponsorWhenGiveUp` | Khi give up thì có chuyển hết thưởng cho sponsor không | `true` / `false` |
| `_awardReceiversPercent` | Phần trăm thưởng cho từng receiver (tổng = 100), số phần tử = số `_awardReceivers` | `[100, 100]` |

### Nhóm 4 — Tiền & gas

| Tham số | Ý nghĩa | Ví dụ |
|--------|---------|--------|
| `_gasData` | Mảng ít nhất 3 phần tử (wei). **Phần tử thứ 3 `_gasData[2]`** = gas fee trả cho challenger | `["200000000000000000", "200000000000000000", "0"]` |
| `_totalAmount` | Tổng tiền khóa trong challenge (wei). Nếu cho phép challenger give up và trả bằng native token thì lúc gửi transaction phải gửi kèm `msg.value = _totalAmount` | `"1000000000000"` |

### Nhóm 5 — Walking speed & HIIT (tùy chọn)

| Tham số | Ý nghĩa | Khi nào dùng | Ví dụ |
|--------|---------|--------------|--------|
| `_walkingSpeedData` | Cấu hình walking speed. **Không dùng** thì truyền mảng rỗng `[]`. **Có dùng** thì truyền **đúng 3 số**: [tốc độ đích (km/h), số phút cần đạt mỗi ngày, số ngày tối thiểu đạt điều kiện walking] | Step + walking speed | `[]` hoặc `[50, 30, 2]` |
| `_hiitData` | Cấu hình HIIT. **Không dùng** thì `[]`. **Có dùng** thì **đúng 2 số**: [số intervals cường độ cao mỗi ngày, tổng số giây cường độ cao mỗi ngày] | Step + HIIT | `[]` hoặc `[3, 120]` |

**Lưu ý nhanh:**
- Chỉ step: `_walkingSpeedData = []`, `_hiitData = []`
- Step + walking: `_walkingSpeedData` có 3 phần tử, `_hiitData = []`
- Step + HIIT: `_walkingSpeedData = []`, `_hiitData` có 2 phần tử
- Cả hai: cả hai mảng đều có phần tử như trên

**Ví dụ JSON đầy đủ (Step + Walking + HIIT):**

```json
{
  "stakeHolders": ["0xSponsor", "0xChallenger", "0xFee"],
  "createByToken": "0x0000000000000000000000000000000000000000",
  "erc721Addresses": ["0xERC721..."],
  "primaryRequired": [3, 1771368487, 1967062887, 100, 3],
  "awardReceivers": ["0xRecv1", "0xRecv2"],
  "index": 1,
  "allowGiveUp": [true, true, true],
  "gasData": ["200000000000000000", "200000000000000000", "0"],
  "allAwardToSponsorWhenGiveUp": true,
  "awardReceiversPercent": [100, 100],
  "totalAmount": "1000000000000",
  "walkingSpeedData": [50, 30, 2],
  "hiitData": [3, 120]
}
```

---

## 1.2 Gửi kết quả hàng ngày (sendDailyResult) — ChallengeBaseStep

Chỉ **challenger** được gọi hàm này, và phải gọi trong khung thời gian cho phép. Backend/NFT tạo **signature** và **data** để contract verify.

### Tham số cần truyền (theo đúng thứ tự)

| # | Tham số | Ý nghĩa | Ghi chú |
|---|--------|---------|--------|
| 1 | `_day` | Mảng ngày (unix timestamp), mỗi phần tử = 1 ngày | Số phần tử > 0 |
| 2 | `_stepIndex` | Số bước chân tương ứng từng ngày | Số phần tử = số phần tử của `_day` |
| 3 | `_data` | 2 số uint64 dùng để verify signature | Backend/NFT quy định format |
| 4 | `_signature` | Chữ ký (bytes) | Backend tạo, contract verify với `_day`, `_stepIndex`, `_data` |
| 5 | `_listGachaAddress` | Danh sách địa chỉ Gacha | Có thể rỗng `[]` |
| 6 | `_listNFTAddress` | Danh sách địa chỉ NFT | Có thể rỗng `[]` |
| 7 | `_listIndexNFT` | Chỉ số NFT (mảng 2 chiều) | Theo logic app |
| 8 | `_listSenderAddress` | Địa chỉ gửi tương ứng (mảng 2 chiều) | Theo logic app |
| 9 | `_statusTypeNft` | Trạng thái NFT (mảng bool) | Theo logic app |
| 10 | `_timeRange` | Khoảng thời gian hợp lệ cho lần gửi: [fromTime, toTime] (unix) | uint64[2] |
| 11 | `_intervals` | Số intervals HIIT mỗi ngày | **Chỉ khi challenge bật HIIT:** số phần tử = `_day.length`. Không bật HIIT: `[]` |
| 12 | `_totalSeconds` | Tổng giây cường độ cao mỗi ngày | **Chỉ khi bật HIIT:** số phần tử = `_day.length`. Không bật: `[]` |
| 13 | `_minutesAtTargetSpeed` | Số phút đạt tốc độ đích mỗi ngày | **Chỉ khi bật Walking speed:** số phần tử = `_day.length`. Không bật: `[]` |
| 14 | `_metsWalkingSpeed` | METs walking mỗi ngày | **Chỉ khi bật Walking speed:** số phần tử = `_day.length`. Không bật: `[]` |

**Cách hiểu nhanh:**
- Luôn có: `_day`, `_stepIndex`, `_data`, `_signature`, các list, `_timeRange`.
- Challenge có **HIIT** → thêm `_intervals` và `_totalSeconds` (cùng length với `_day`).
- Challenge có **Walking speed** → thêm `_minutesAtTargetSpeed` và `_metsWalkingSpeed` (cùng length với `_day`).

Một ngày được coi **đạt HIIT** khi: `_intervals[i] >= highIntensityIntervals` và `_totalSeconds[i] >= totalHighIntensityTime` (lấy từ config lúc deploy).

---

# Phần 2: ChallengeHIIT

**File contract:** `ChallengeHIIT.sol`  
**Dùng khi:** Challenge **chỉ HIIT** (không đếm step, không walking speed).

---

## 2.1 Deploy ChallengeHIIT — Cần truyền gì?

Có **11 tham số** (ít hơn BaseStep vì không có `_walkingSpeedData` và `_hiitData`).

### Giống ChallengeBaseStep

- `_stakeHolders`, `_createByToken`, `_erc721Address`
- `_awardReceivers`, `_index`, `_allowGiveUp`, `_allAwardToSponsorWhenGiveUp`, `_awardReceiversPercent`
- `_gasData`, `_totalAmount`

### Khác ChallengeBaseStep — `_primaryRequired`

Ở **ChallengeHIIT**, `_primaryRequired` có **ít nhất 6 phần tử** (không có goal step):

| Vị trí | Ý nghĩa |
|--------|---------|
| [0] | duration (số ngày challenge) |
| [1] | startTime (unix) |
| [2] | endTime (unix) |
| [3] | **highIntensityIntervals** — số intervals cường độ cao cần đạt mỗi ngày |
| [4] | **totalHighIntensityTime** — tổng giây cường độ cao cần đạt mỗi ngày |
| [5] | **dayRequired** — số ngày cần đạt điều kiện HIIT |

**Ví dụ:** `[3, 1771368487, 1967062887, 3, 120, 3]` → challenge 3 ngày, mỗi ngày cần ≥3 intervals và ≥120 giây cường độ cao, cần đạt 3 ngày.

**Ví dụ JSON deploy ChallengeHIIT:**

```json
{
  "stakeHolders": ["0xSponsor", "0xChallenger", "0xFee"],
  "createByToken": "0x0000000000000000000000000000000000000000",
  "erc721Addresses": ["0xERC721..."],
  "primaryRequired": [3, 1771368487, 1967062887, 3, 120, 3],
  "awardReceivers": ["0xRecv1", "0xRecv2"],
  "index": 1,
  "allowGiveUp": [true, true, true],
  "gasData": ["200000000000000000", "200000000000000000", "0"],
  "allAwardToSponsorWhenGiveUp": true,
  "awardReceiversPercent": [100, 100],
  "totalAmount": "1000000000000"
}
```

---

## 2.2 Gửi kết quả hàng ngày (sendDailyResult) — ChallengeHIIT

Chỉ có **HIIT**, không có step hay walking → **không có** `_stepIndex`, `_minutesAtTargetSpeed`, `_metsWalkingSpeed`.

### Tham số (theo đúng thứ tự)

| # | Tham số | Ý nghĩa |
|---|--------|---------|
| 1 | `_day` | Mảng ngày (unix timestamp) |
| 2 | `_intervals` | Số intervals cường độ cao mỗi ngày (số phần tử = `_day.length`) |
| 3 | `_totalSeconds` | Tổng giây cường độ cao mỗi ngày (số phần tử = `_day.length`) |
| 4 | `_data` | uint64[2] cho verify signature |
| 5 | `_signature` | Chữ ký từ backend (contract verify với `_day`, mảng rỗng, `_data`) |
| 6 | `_listGachaAddress` | Danh sách Gacha |
| 7 | `_listNFTAddress` | Danh sách NFT |
| 8 | `_listIndexNFT` | Chỉ số NFT (mảng 2 chiều) |
| 9 | `_listSenderAddress` | Địa chỉ gửi (mảng 2 chiều) |
| 10 | `_statusTypeNft` | Trạng thái NFT |
| 11 | `_timeRange` | [fromTime, toTime] (unix) |

Một ngày **đạt** khi: `_intervals[i] >= highIntensityIntervals` và `_totalSeconds[i] >= totalHighIntensityTime` (lấy từ contract).

---

# So sánh nhanh 2 contract

| | ChallengeBaseStep | ChallengeHIIT |
|---|------------------|----------------|
| **Deploy** | 13 tham số, có `_walkingSpeedData`, `_hiitData` | 11 tham số, không có 2 mảng trên |
| **primaryRequired** | 5 số: duration, start, end, **goal (step)**, dayRequired | 6 số: duration, start, end, **highIntensityIntervals**, **totalHighIntensityTime**, dayRequired |
| **sendDailyResult** | Có `_stepIndex`; nếu bật HIIT/walking thì thêm các mảng tương ứng | Chỉ `_day`, `_intervals`, `_totalSeconds` (+ signature, lists, timeRange). Không có step, walking |

---

# Checklist cho App

- [ ] Chọn đúng contract: có step/walking → **ChallengeBaseStep**; chỉ HIIT → **ChallengeHIIT**.
- [ ] Deploy: truyền đúng thứ tự tham số; với BaseStep thì `_walkingSpeedData`/`_hiitData` = `[]` nếu không dùng.
- [ ] Send step: chỉ **challenger** gọi được; đúng khung thời gian; có **signature** từ backend (format thống nhất với NFT contract).
- [ ] BaseStep: gửi thêm `_intervals`/`_totalSeconds` khi có HIIT; thêm `_minutesAtTargetSpeed`/`_metsWalkingSpeed` khi có walking speed.
- [ ] HIIT: không gửi `_stepIndex`, không gửi walking; chỉ gửi `_day`, `_intervals`, `_totalSeconds` và các tham số còn lại theo bảng.

Nếu cần thêm ví dụ encode (ethers/viem) hoặc sample request, có thể bổ sung sau theo stack app đang dùng.
