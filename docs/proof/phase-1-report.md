# Phase 1 Verification Proof Report (`phase-1`)

- **Ngày chạy:** 2026-11-20
- **Môi trường:** Node.js `v22.15.1`, npm `10.9.2`, TypeScript `5.6.3`, Vite `5.4.21`, Three.js `0.170.0`
- **Lệnh kiểm chứng:** `npm run build` và `npm test` (chạy đồng thời trên CI `.github/workflows/ci.yml`)

## 1. Bảng truy vết Yêu cầu → Bằng chứng

| Mã AC | Yêu cầu PRD-0 / Test Contract v1.0 | Cách kiểm chứng | Kết quả |
|---|---|---|---|
| AC-1 | `game.contract.json` khớp tuning thực tế của game | Unit test #1 (`DEFAULT_TUNING matches game.contract.json exactly`) | **Đạt** |
| AC-2 | Dựng scenario không phát sự kiện, không cộng điểm; snapshot tick 0 trước input | Unit test #2 + Scenario S1 (`lines[0].tick === 0 && score === 0`) | **Đạt** |
| AC-3 | Di chuyển theo công thức xoay `cam_yaw_deg`, chuẩn hóa vector > 1, rising-edge input | Unit test #3 + Scenario S1 | **Đạt** |
| AC-4 | Nhặt đom đóm, nạp đèn, thắp đủ 5 đèn → thắng + cộng thưởng | Unit test #4 + Scenario S1 (`ticks=116, score=676, state=won`) | **Đạt** |
| AC-5 | Tỏa sáng (Pulse) tốn `pulse_cost`, stun + đẩy Bóng Mực; `safe_radius` quanh đèn đã thắp | Unit test #5, #6 + Scenario S2 (`shade pushed to x=12, state=stunned`) | **Đạt** |
| AC-6 | Chạm Bóng Mực mất máu, rơi đom đóm, `invuln_s`, thua `no_flames` & hết giờ `dawn` | Unit test #7, #8 + Scenario S3 (`hit at tick=20, dropped=2, end=lost`) | **Đạt** |
| AC-7 | Tính tất định byte-for-byte + mã thoát `2` khi file inputs/scenario lỗi | Scenario S4 (600 ticks × 2 lần = `72050 bytes` giống hệt) + Scenario S5 (`exit=2`) | **Đạt** |
| AC-8 | Build bản 3D Three.js Đêm 1 (Mây đội nón lá, HUD, chơi lại, sáng tạo không đổi headless) | `npm run build` (`vite build` thành công 0 lỗi) + `npm test` xanh toàn bộ | **Đạt** |

## 2. Output thật từ lần chạy kiểm chứng

```text
> dao-den-long@0.1.0 build:web
> vite build

vite v5.4.21 building for production...
✓ 9 modules transformed.
dist/index.html                  6.21 kB │ gzip:   2.07 kB
dist/assets/index-YNSiQmJK.js  490.13 kB │ gzip: 125.85 kB
✓ built in 1.21s

> dao-den-long@0.1.0 test:unit
TAP version 13
ok 1 - DEFAULT_TUNING matches game.contract.json exactly
ok 2 - Scenario setup emits no events and awards no score even with pre-lit lanterns
ok 3 - Camera-relative movement and diagonal normalization follow contract formula
ok 4 - Pickup motes up to carry_capacity, deposit into lantern, and win on all lit
ok 5 - Pulse stuns and pushes shade within pulse_radius and spends pulse_cost
ok 6 - Shade cannot enter safe_radius of a lit lantern
ok 7 - Shade hit reduces flames, drops motes, triggers invuln, and loses at 0 flames
ok 8 - Dawn timeout triggers loss with reason dawn
# tests 8 / pass 8 / fail 0 (152.222 ms)

> dao-den-long@0.1.0 test:scenarios
PASS [S1 Win Flow]: ticks=116, score=676
PASS [S2 Pulse Stun/Push]: shade pushed to x=12, state=stunned
PASS [S3 Shade Hit & Loss]: hit at tick=20, dropped=2, end=lost
PASS [S4 Determinism]: 600 ticks x 2 runs byte-for-byte identical (72050 bytes)
PASS [S5 Invalid Input Exit 2]: exit=2, stderr="Error: Non-increasing tick at frame 1: 10 <= 10"
```
