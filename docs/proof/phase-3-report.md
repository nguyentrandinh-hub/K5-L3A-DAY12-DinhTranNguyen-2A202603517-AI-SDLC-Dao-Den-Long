# Phase 3 Verification Proof Report (`phase-3` · Contract v1.2)

- **Ngày chạy:** 2026-11-20
- **Môi trường:** Node.js `v22.15.1`, npm `10.9.2`, TypeScript `5.6.3`, Vite `5.4.21`, Three.js `0.170.0`
- **Lệnh kiểm chứng:** `npm run build` và `npm test`

## 1. Bảng truy vết Yêu cầu → Bằng chứng (Ticket-03)

| Mã AC | Yêu cầu Ticket-03 / Test Contract v1.2 | Cách kiểm chứng | Kết quả |
|---|---|---|---|
| AC-1 | `game.contract.json` v1.2 khớp 100% `DEFAULT_TUNING` (thêm các khóa fuel/relight/drain/win_ratio/capacity_max) | Unit test #1 | **Đạt** |
| AC-2 | Nhiên liệu đèn dùng số nguyên `1/60`, hao `1/s`, hết dầu tắt (`lantern_out`), thắp lại tốn `5` đom đóm (`+40`) | Unit test #3 + Scenario S1 (`lantern_out -> relit for 5 motes, capacity=12`) | **Đạt** |
| AC-3 | Châm dầu `used = min(carried, ceil((100-fuel)/10))`, bỏ qua đèn đầy, đẩy Bóng Mực khi châm lên `>= 30` | Unit test #4 | **Đạt** |
| AC-4 | Bóng Mực `drain` hút `5 fuel/s`, phát `fuel_drain` mỗi 60 tick; Pulse ngắt `drain` nhận tổng `+15` điểm | Unit test #5 + Scenario S2 (`fuel_drain emitted at tick 60, pulse interrupt score=15`) | **Đạt** |
| AC-5 | Không thắng sớm (`all_lit` bỏ); thắng bình minh `dawn_survived` khi `>= ceil(0.6*N)` đèn sáng, ngược lại thua `dawn` | Unit test #6, #7 + Scenarios S3 (`3/5 -> dawn_survived`), S4 (`2/5 -> dawn`) | **Đạt** |
| AC-6 | Sức chứa tăng dần `10 + 2 × successful_lights` (tối đa 20) & hiển thị HUD | Unit test #3, #6 + Scenario S1 (`capacity=12`) | **Đạt** |
| AC-7 | Hồi quy Phase 2 (Dash, Charm, Drifter, Jump Pad, Pause, Hiệu năng 18.000 tick & Tính tất định) | Unit test #8 + Scenarios S5, S6 (`0.37s`, byte-for-byte identical) | **Đạt** |
| AC-8 | Chế độ mù màu (`#00B3FF`, `#FFFFFF` + `⚠`, đèn tắt xẹp 20% + vết rách, thanh dầu 3D nhấp nháy 1 Hz) | `npm run build` (`vite build` 0 lỗi trong `1.29s`) | **Đạt** |
| AC-9 | ADR-001, Changelog breaking changes, lý do cập nhật test cũ | `docs/notes/adr-001-fuel-and-dawn-survival.md`, `CHANGELOG.md`, `docs/notes/phase-3.md` | **Đạt** |

## 2. Output thật từ lần chạy kiểm chứng

```text
> dao-den-long@0.1.0 build:web
> vite build
✓ 10 modules transformed.
dist/index.html                 12.81 kB │ gzip:   3.41 kB
dist/assets/index-BkVc1ECH.js  556.96 kB │ gzip: 146.49 kB
✓ built in 1.29s

> dao-den-long@0.1.0 test:unit
TAP version 13
ok 1 - DEFAULT_TUNING matches game.contract.json v1.2 exactly
ok 2 - Scenario setup emits no events, awards no score, sets default fuel=100 for lit lanterns
ok 3 - Lantern fuel decays at exact 1/60 per tick, extinguishes at 0, and relights for 5 motes (+40)
ok 4 - Refuel lit lantern uses ceil((100-fuel)/10) motes, skips full lanterns, pushes shades when >= 30
ok 5 - Shade drains weak lantern (<30 fuel) at 5/s and pulsing draining shade awards +15 total
ok 6 - No early win on all lit; dawn win requires >= ceil(0.6*N) lit lanterns (dawn_survived)
ok 7 - Dawn loss occurs when lit lanterns < ceil(0.6*N)
ok 8 - Phase 2 regression: Dash, Charm, Drifter, Fall, Pause still work under v1.2
# tests 8 / pass 8 / fail 0 (205.1336 ms)

> dao-den-long@0.1.0 test:scenarios
PASS [S1 Fuel Decay & Relight]: lantern_out -> relit for 5 motes, capacity=12
PASS [S2 Shade Drain & +15 Pulse Interrupt]: fuel_drain emitted at tick 60, pulse interrupt score=15
PASS [S3 Dawn Survived Win 3/5]: state=won, reason=dawn_survived, score=447
PASS [S4 Dawn Loss 2/5]: state=lost, reason=dawn
PASS [S5 Phase 2 Regression Jump Pad]: landed on Island B at x=52.743
PASS [S6 Night 3 Full 18,000-tick Perf & Determinism]: 0.37s, byte-for-byte identical
```
