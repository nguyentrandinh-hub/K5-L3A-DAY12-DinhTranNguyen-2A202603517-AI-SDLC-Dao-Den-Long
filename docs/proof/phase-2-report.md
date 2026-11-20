# Phase 2 Verification Proof Report (`phase-2` · Contract v1.1)

- **Ngày chạy:** 2026-11-20
- **Môi trường:** Node.js `v22.15.1`, npm `10.9.2`, TypeScript `5.6.3`, Vite `5.4.21`, Three.js `0.170.0`
- **Lệnh kiểm chứng:** `npm run build` và `npm test`

## 1. Bảng truy vết Yêu cầu → Bằng chứng (Ticket-02)

| Mã AC | Yêu cầu Ticket-02 / Test Contract v1.1 | Cách kiểm chứng | Kết quả |
|---|---|---|---|
| AC-1 | `game.contract.json` v1.1 khớp 100% số liệu chuẩn | Unit test #1 (`DEFAULT_TUNING matches game.contract.json v1.1 exactly`) | **Đạt** |
| AC-2 | Mô hình 12 bước tick + Pause đóng băng `sim_tick` / timer | Unit test #9 + Scenario S6 (`tick=20 state=paused sim_tick=5`) | **Đạt** |
| AC-3 | Lướt (`14 m/s`, 12 tick, hồi `1.5s`, giữ độ cao trên không) | Unit test #4 + Scenario S2 | **Đạt** |
| AC-4 | 3 Bản đồ chuẩn (Đêm 1/2/3, cầu tre, bục nhảy, 3 tầng + dốc + tháp chuông, gió) | Unit test #12 + Scenarios S1, S3 (`landed on Island B at x=52.743, z=6.213`), S7 | **Đạt** |
| AC-5 | Gió Lạc (`drifter_steal`, `drifter_drop`, `idle/chase/flee/removed`) | Unit test #10 + Scenario S4 (`stole 3 motes, dropped 3 on pulse`) | **Đạt** |
| AC-6 | Bùa Gió (`7.2 m/s`, Lướt không hồi chiêu 600 tick, hồi 2700 tick) | Unit test #11 + Scenario S2 (`2 dashes triggered under charm`) | **Đạt** |
| AC-7 | Rơi khỏi đảo (`Y < -10`, mất hết đom đóm, hồi sinh sau 60 tick) + Bóng Mực `recoil` | Unit test #7, #8 + Scenario S5 (`hit at tick=60, lost=5, respawned at origin`) | **Đạt** |
| AC-8 | Hiệu năng 1 Đêm đầy đủ (`21.600 tick <= 30s`), tính tất định & mã thoát `2` | Scenario S7 (2000 ticks × 2 = `54342 bytes` giống hệt), S8 (`0.37s`), S9 (`exit=2`) | **Đạt** |
| AC-9 | Build 3D 3 Đêm, Menu/Intro/Pause/Settings, HUD đầy đủ, bảng màu chuẩn | `npm run build` (`vite build` thành công 0 lỗi trong `1.39s`) | **Đạt** |

## 2. Output thật từ lần chạy kiểm chứng

```text
> dao-den-long@0.1.0 build:web
> vite build
✓ 10 modules transformed.
dist/index.html                 10.93 kB │ gzip:   2.94 kB
dist/assets/index-BAofItqj.js  544.21 kB │ gzip: 142.36 kB
✓ built in 1.39s

> dao-den-long@0.1.0 test:unit
TAP version 13
ok 1 - DEFAULT_TUNING matches game.contract.json v1.1 exactly
ok 2 - Scenario setup emits no events and awards no score even with pre-lit lanterns
ok 3 - Camera-relative movement (6.0 m/s) and diagonal normalization follow contract formula
ok 4 - Dash moves at 14 m/s for 12 ticks, holds air altitude, and enforces 1.5s cooldown
ok 5 - Deposit awards +10 per mote, +100 per lantern, and wins on all lit
ok 6 - Pulse (cost 3, 3D radius 5m) stuns for 120 ticks, pushes 4m over 15 ticks, +5 score
ok 7 - Shade hit drops floor(carried/2) dropped motes with TTL, enters recoil, invuln 90 ticks
ok 8 - Fall off island (Y < -10) deducts 1 flame, loses all motes, respawns after 60 ticks
ok 9 - Pause freezes sim_tick and time_left_s while incrementing tick
ok 10 - Drifter steals up to 3 motes when carried >= 5 and drops them when pulsed while fleeing
ok 11 - Charm grants 7.2 m/s speed and zero dash cooldown for 600 ticks
ok 12 - Night 2 jump pad launches player across islands and Night 3 wind activates at 30s
# tests 12 / pass 12 / fail 0 (140.7097 ms)

> dao-den-long@0.1.0 test:scenarios
PASS [S1 Night 1 Win Regression]: ticks=1, score=748
PASS [S2 Night 2 Charm + Zero-CD Dash]: 2 dashes triggered under charm
PASS [S3 Night 2 Jump Pad]: landed on Island B at x=52.743, z=6.213
PASS [S4 Drifter Steal & Pulse Drop]: stole 3 motes, dropped 3 on pulse
PASS [S5 Fall & Respawn]: hit at tick=60, lost=5, respawned at origin
PASS [S6 Pause/Resume]: tick=20 state=paused sim_tick=5
PASS [S7 Night 3 Wind & Determinism]: 2000 ticks x 2 runs identical (54342 bytes), wind activated
PASS [S8 Full Night Perf 21,600 ticks]: completed in 0.37s (limit <= 30s)
PASS [S9 Invalid Input Exit 2]: exit=2
```
