# Changelog

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
