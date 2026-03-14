# API Update — Cho team App

**Base URL:** `{LINK}` (đổi theo môi trường)  
**Header:** `Authorization: xxx` (JWT), `Content-Type: application/json`

---

## Tóm tắt nhanh

| Loại | Method | Path | Ghi chú |
|------|--------|------|--------|
| Cập nhật | GET | `/api/v1/users/settings/get-deploy` | Thêm `challenge_base_step`, `challenge_base_step_length`, `challenge_hiit`, `challenge_hiit_length` |
| Cập nhật | GET | `/api/v1/users/get-profile-by-wallet/:address` | Thêm `hiitAge` trong `data` |
| Mới | POST | `/api/v1/challenges/estimate-gas-create-challenge-base-step-token` | Deploy BaseStep bằng token; body có `erc20_list_address`, `walking_speed_data`, `hiit_data` |
| Mới | POST | `/api/v1/challenges/estimate-gas-create-challenge-base-step-coin` | Deploy BaseStep bằng coin; không có `erc20_list_address` |
| Mới | POST | `/api/v1/challenges/estimate-gas-create-challenge-hiit-token` | Deploy HIIT bằng token; `primary_required` 6 số |
| Mới | POST | `/api/v1/challenges/estimate-gas-create-challenge-hiit-coin` | Deploy HIIT bằng coin |
| Mới | POST | `/api/v1/challenges/estimate-gas-send-step-base-step` | Estimate gas **gửi step** cho ChallengeBaseStep |
| Mới | POST | `/api/v1/challenges/estimate-gas-send-step-hiit` | Estimate gas **gửi step** cho ChallengeHIIT |

Tất cả API challenge đều cần đăng nhập (header `Authorization`).

---

## 1. API cập nhật

### GET get-deploy
- **Path:** `GET /api/v1/users/settings/get-deploy`
- **Thay đổi:** Response thêm `challenge_base_step`, `challenge_base_step_length`, `challenge_hiit`, `challenge_hiit_length` (bytecode deploy BaseStep/HIIT).

```bash
curl --location '{LINK}/api/v1/users/settings/get-deploy' \
--header 'Authorization: xxx' --header 'Content-Type: application/json'
```

### GET get-profile-by-wallet
- **Path:** `GET /api/v1/users/get-profile-by-wallet/:address`
- **Thay đổi:** Trong `data` thêm field `hiitAge` (birthday từ chatbot setting; null nếu không có).

```bash
curl --location '{LINK}/api/v1/users/get-profile-by-wallet/0xe340371845820cb16Cb8908E0ed07e2E1Ff40024' \
--header 'Authorization: xxx' --header 'Content-Type: application/json'
```

---

## 2. API mới — Estimate gas **tạo** challenge (deploy)

POST, có auth. Response: `data` = mảng gas (low, standard, fast, fastest).

| API | Khác biệt |
|-----|------------|
| **base-step-token** | Body có `erc20_list_address`, `walking_speed_data`, `hiit_data`. `primary_required` 5 số. |
| **base-step-coin** | Giống trên, không gửi `erc20_list_address`. |
| **hiit-token** | Có `erc20_list_address`. `primary_required` **6** số. Không có walking_speed_data, hiit_data. |
| **hiit-coin** | Giống hiit-token, không gửi `erc20_list_address`. |

**Curl mẫu (base-step-token):**
```bash
curl --location '{LINK}/api/v1/challenges/estimate-gas-create-challenge-base-step-token' \
--header 'Authorization: xxx' --header 'Content-Type: application/json' \
--data '{"network_id":5,"stake_holders":["0xa82...","0xa82...","0xa82..."],"erc20_list_address":"0x4b36...","erc721_address":["0x5528..."],"primary_required":[3,1771368487,1967062887,100,3],"award_receivers":["0xa82...","0xa82..."],"index":1,"allow_give_up":[true,true,true],"gas_data":["200000000000000000","200000000000000000","0"],"all_award_to_sponsor":true,"award_receivers_percent":[100,100],"total_amount":"1000000000000","walking_speed_data":[50,30,2],"hiit_data":[3,120]}'
```

**Curl mẫu (hiit-token):** Cùng ý, bỏ `walking_speed_data` và `hiit_data`, đổi `primary_required` thành 6 phần tử (thêm highIntensityIntervals, totalHighIntensityTime).  
**Coin:** Bỏ `erc20_list_address` trong body.

---

## 3. API mới — Estimate gas **gửi step** (send step no gacha)

Dùng khi challenge **đã deploy** (contract có trong DB). Response: `data` có `list_gas`; Android thêm `encode_abi_data`, iOS thêm `list_infor_transfer`, `signature`, `data`.

### 3.1 ChallengeBaseStep
- **Path:** `POST /api/v1/challenges/estimate-gas-send-step-base-step`
- **Body bắt buộc:** `wallet_address`, `network_id`, `challenge_address`, `day` (array 1 phần tử), `step_index` (array), `time_range` ([start, end] unix).
- **Body tùy chọn:** `minutes_at_target_speed`, `mets_walking_speed` (walking); `hiit_intervals`, `hiit_total_seconds` (khi challenge bật HIIT).

```bash
curl --location '{LINK}/api/v1/challenges/estimate-gas-send-step-base-step' \
--header 'Authorization: xxx' --header 'Content-Type: application/json' \
--data '{"wallet_address":"0xa82...","network_id":5,"challenge_address":"0x1b09...","day":[1741885300],"step_index":[1000],"time_range":[1741885200,1741971599],"minutes_at_target_speed":[30],"mets_walking_speed":[1000],"hiit_intervals":[3],"hiit_total_seconds":[120]}'
```

### 3.2 ChallengeHIIT
- **Path:** `POST /api/v1/challenges/estimate-gas-send-step-hiit`
- **Body:** `wallet_address`, `network_id`, `challenge_address`, `day`, `intervals`, `total_seconds`, `time_range` (đều theo format trên).

```bash
curl --location '{LINK}/api/v1/challenges/estimate-gas-send-step-hiit' \
--header 'Authorization: xxx' --header 'Content-Type: application/json' \
--data '{"wallet_address":"0xa82...","network_id":5,"challenge_address":"0x79FC...","day":[1741885300],"intervals":[3],"total_seconds":[120],"time_range":[1741885200,1741971599]}'
```

---

**Lưu ý:** Thay `xxx` bằng JWT thật khi gọi từ app.
