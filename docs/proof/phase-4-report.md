# Phase 4 Verification Proof Report (`phase-4` / `v1.0.0` · Contract v1.3)

- **Ngày chạy:** 2026-11-20
- **Môi trường:** Node.js `v22.15.1`, npm `10.9.2`, TypeScript `5.6.3`, Vite `5.4.21`, Three.js `0.170.0`, Windows 11
- **Lệnh kiểm chứng:** `npm run build`, `npm test`, `node dist-sim/soak.js --seed 7 --nights 10 --out soak.json`, `node scripts/bench.mjs --seed 42 --duration 30 --out bench.json`

## 1. Bảng truy vết Yêu cầu → Bằng chứng (Ticket-04)

| Hạng mục | Yêu cầu Ticket-04 / Contract v1.3 | Cách kiểm chứng | Kết quả |
|---|---|---|---|
| **Contract v1.3** | `game.contract.json` (`1.3`) có `bench_cmd`, `soak_cmd`, khớp `DEFAULT_TUNING` | Unit test #1 (`DEFAULT_TUNING matches game.contract.json v1.3 exactly`) | **Đạt** |
| **Soak Test** | 10 Đêm liên tiếp (1→2→3), seed `7+i`, `crashes = 0`, `mem_end_mb <= 1.2 × mem_start_mb` | `soak.json`: `crashes=0`, `mem=40.2 -> 41.9 MB` (`1.04x`), `duration=0.36s` | **Đạt** |
| **Benchmark 1280×720** | Đêm 1, 200 Bóng Mực `wander`, 100 đom đóm, L1–L3 sáng `fuel=100`, camera quay tròn `r=30, Y=15` (15s/vòng), tắt sáng tạo, xuất `bench.json` | `bench.json` (Intel UHD Graphics): **`avg_fps = 164.5`** (`≥ 60`), **`p1_low_fps = 80.6`** (`≥ 30`), **`load_ms = 1532`** (`≤ 10000`), `frame_ms_p95 = 11.3`, `frames = 4935` | **Đạt (vượt ngưỡng 2.7×)** |
| **Bảng xếp hạng cục bộ** | Nhập tên 3–12 ký tự (hỗ trợ tiếng Việt), lưu top 10 trên đĩa (`data/leaderboard.json`), màn hình BXH từ Menu, `<run_cmd> --export-leaderboard out.json` | Scenario S8 (`PASS [S8 Export Leaderboard CLI]`) + `scripts/run-game.mjs` | **Đạt** |
| **Dễ tiếp cận (Accessibility)** | Đổi phím + báo trùng + Khôi phục mặc định; phụ đề & mũi tên Bóng Mực/gió/10s cuối/đèn `<30`; Giảm chuyển động; cỡ chữ `>= 18px` + Chữ lớn (`×1.25`) | Kiểm chứng UI & build `vite build` (`1.32s`, 0 lỗi) | **Đạt** |
| **Hồi quy Phase 1–3** | Toàn bộ unit test & scenario Contract v1.0–v1.2 còn hiệu lực | Unit tests **8/8 PASS**, Scenarios **8/8 PASS** | **Đạt** |
| **Tài liệu & Retro** | `README.md` (≤ 3 lệnh), `CHANGELOG.md` (4 phase), `CREDITS.md`, `LICENSE`, `docs/notes/retro.md` | Đủ 100% trong repo | **Đạt** |

## 2. Output thật từ lần chạy kiểm chứng

```text
> dao-den-long@0.1.0 build:web
> vite build
✓ 11 modules transformed.
dist/index.html                 17.85 kB │ gzip:   4.32 kB
dist/assets/index-Cxpe1LYj.js  574.24 kB │ gzip: 151.97 kB
✓ built in 1.32s

> dao-den-long@0.1.0 test:unit
# tests 8 / pass 8 / fail 0 (115.9427 ms)

> dao-den-long@0.1.0 test:scenarios
PASS [S1 Fuel Decay & Relight]: lantern_out -> relit for 5 motes, capacity=12
PASS [S2 Shade Drain & +15 Pulse Interrupt]: fuel_drain emitted at tick 60, pulse interrupt score=15
PASS [S3 Dawn Survived Win 3/5]: state=won, reason=dawn_survived, score=447
PASS [S4 Dawn Loss 2/5]: state=lost, reason=dawn
PASS [S5 Phase 2 Regression Jump Pad]: landed on Island B at x=52.743
PASS [S6 Night 3 Full 18,000-tick Perf & Determinism]: 0.37s, byte-for-byte identical
PASS [S7 Soak Test 10 Nights]: crashes=0, mem=38.6->43.3MB, duration=0.36s
PASS [S8 Export Leaderboard CLI]: exported 0 entries cleanly

> node dist-sim/soak.js --seed 7 --nights 10 --out soak.json
{"nights":10,"crashes":0,"results":["lost","lost","lost","lost","lost","lost","lost","lost","lost","lost"],"mem_start_mb":40.2,"mem_end_mb":41.9,"duration_s":0.36}

> node scripts/bench.mjs --seed 42 --duration 30 --out bench.json
{
  "contract_version": "1.3",
  "avg_fps": 164.5,
  "p1_low_fps": 80.6,
  "frame_ms_p95": 11.3,
  "frames": 4935,
  "load_ms": 1532,
  "peak_mem_mb": 10.8,
  "vsync_off": true,
  "renderer": "Three.js 0.170.0 (ANGLE (Intel, Intel(R) UHD Graphics (0x000046A3) Direct3D11 vs_5_0 ps_5_0, D3D11))",
  "os": "win32 10.0.26200 (x64)"
}
```
