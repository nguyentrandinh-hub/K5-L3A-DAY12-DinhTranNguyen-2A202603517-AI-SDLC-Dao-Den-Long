# Changelog

## [v1.0.0 — Phase 4 — Contract v1.3] — 2026-11-20

### Added
- **Contract v1.3:** Thêm `bench_cmd` (`node scripts/bench.mjs`) và `soak_cmd` (`node dist-sim/soak.js`) vào `game.contract.json`.
- **Chế độ Benchmark 1280×720 (`scripts/bench.mjs` + `src/game/bench-runner.ts`):** Cảnh chuẩn Đêm 1 với 200 Bóng Mực `wander` (InstancedMesh), 100 đom đóm, L1–L3 sáng `fuel = 100`, camera quay tròn `r=30m, Y=15m` (15s/vòng), tắt hiệu ứng sáng tạo, xuất `bench.json`.
- **Soak Test 10 Đêm (`src/sim/soak.ts`):** Chạy 10 Đêm liên tiếp xoay vòng 1→2→3 trong cùng 1 tiến trình với input ngẫu nhiên theo seed, đo `mem_start_mb`, `mem_end_mb`, `crashes`, xuất `soak.json`.
- **Bảng xếp hạng cục bộ (`scripts/run-game.mjs` + UI):** Lưu top 10 trên đĩa (`data/leaderboard.json`), nhập tên 3–12 ký tự (hỗ trợ tiếng Việt có dấu), hỗ trợ xuất chuẩn `<run_cmd> --export-leaderboard out.json`.
- **Accessibility (Dễ tiếp cận):** Đổi toàn bộ phím kèm phát hiện trùng phím + khôi phục mặc định; phụ đề & mũi tên mép màn hình cho Bóng Mực xuất hiện, gió, 10s cuối, đèn `< 30` dầu; chế độ Giảm chuyển động; cỡ chữ UI tối thiểu `18px` và tùy chọn Chữ lớn (`×1.25`).
- **Tài liệu phát hành:** Retro tổng kết 4 phase (`docs/notes/retro.md`), báo cáo kiểm chứng Phase 4 (`docs/proof/phase-4-report.md`), cập nhật `README.md` hoàn chỉnh cho Release `v1.0.0`.

---

## [Phase 3 — Contract v1.2] — 2026-11-20 (BREAKING CHANGES)

### Breaking Changes (Thay thế luật Phase 1–2 theo Ticket-03)
- **Contract version:** Nâng cấp `game.contract.json` từ `1.1` lên `1.2`, bổ sung các khóa `fuel_max: 100`, `fuel_decay_per_s: 1.0`, `fuel_per_mote: 10`, `relight_cost: 5`, `win_ratio: 0.6`, `drain_per_s: 5`, `low_fuel_threshold: 30`, `capacity_max: 20`.
- **Thời lượng Đêm rút ngắn:** Đêm 1/2/3 đổi từ `300 / 330 / 360 s` sang `240 / 270 / 300 s`.
- **Luật thắng mới (`dawn_survived`):** Bỏ thắng sớm (`all_lit`). Người chơi chỉ thắng khi sống sót tới bình minh với `>= ceil(0.6 × tổng đèn)` đèn đang sáng (3/5, 4/6, 5/7).
- **Nhiên liệu đèn & Châm dầu:** Đèn đang sáng hao `1.0 fuel/s`, hết dầu chuyển tắt (`lantern_out`, `ever_lit: true`), thắp lại tốn `5` đom đóm; tương tác đèn đang sáng chưa đầy dầu sẽ châm dầu (`refuel`).
- **Vùng an toàn & Bóng Mực `drain`:** Đèn có `fuel < 30` mất vùng an toàn 6m; Bóng Mực ở trạng thái `wander` tiến tới hút `5 fuel/s` (`drain`, phát `fuel_drain` mỗi 60 tick).
- **Công thức điểm mới:** Đổi từ `+10/mote` sang `+5/mote`, thắp lại `+40`, Tỏa Sáng ngắt `drain` nhận tổng `+15`, bỏ thưởng thời gian (`per_second_left: 0`), thêm thưởng bình minh `+50 + floor(fuel)` mỗi đèn sáng.
- **Sức chứa tăng dần:** `capacity = min(20, 10 + 2 × successful_lights)` mỗi Đêm.
- **Snapshot & Events v1.2:** Snapshot thêm `player.capacity` và `lantern.{fuel, ever_lit, relit_count}`; sự kiện mới `refuel`, `lantern_out`, `fuel_drain`, `lantern_lit.relight`.

### Added
- **Chế độ mù màu ("Bảng màu dễ phân biệt"):** Viền Bóng Mực `#00B3FF`, cảnh báo `#FFFFFF` kèm `⚠`, đèn tắt xẹp 20% + vết rách giấy, thanh dầu 3D trên đèn sáng nhấp nháy 1 Hz khi `fuel < 30`.
- **ADR-001:** Ghi nhận quyết định kiến trúc tại `docs/notes/adr-001-fuel-and-dawn-survival.md`.

---

## [Phase 2 — Contract v1.1] — 2026-11-20
- Chuẩn hóa số liệu, 3 bản đồ chuẩn (Đảo Bến, Đảo Cau, Đảo Chuông), Lướt, Gió Lạc, Bùa Gió, Gió mạnh, Rơi khỏi đảo, Pause, HUD & bảng màu chuẩn, sáng tạo cảnh quan/Minimap/Ngũ cung.

## [Phase 1 — Contract v1.0] — 2026-11-20
- Bản chơi được Đêm 1 (Đảo Bến), lõi 60 Hz tất định, CLI headless v1.0, CI và kiểm chứng ban đầu.
