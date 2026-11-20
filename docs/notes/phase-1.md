# Phase 1 Notes — PRD-0 (Đêm 1: Đảo Bến)

## 1. Phân tích yêu cầu & Giả định cho các điểm mơ hồ

| Hạng mục | Điểm mơ hồ trong PRD-0 | Giả định đã chọn (khớp `game.contract.json`) |
|---|---|---|
| Kích thước đảo & rơi khỏi đảo | Không quy định bán kính đảo hay phạt rơi | Đảo tròn bán kính 45m (`ISLAND_RADIUS = 45.0`), `fall_enabled = false` (giữ nhân vật trong ranh giới an toàn; tự mở rộng vùng chơi khi scenario đặt thực thể xa hơn) |
| Tốc độ & sức chứa | Không có số cụ thể | `player_speed = 8.0` m/s, `carry_capacity = 5`, `lantern_cost = 3`, `pickup_radius = 2.0` m, `interact_radius = 3.5` m |
| Tỏa sáng (Pulse) | Tốn ánh sáng, xua Bóng Mực | `pulse_cost = 2`, `pulse_radius = 8.0` m, `pulse_stun_s = 3.0` s, `pulse_push_m = 6.0` m, `pulse_cooldown_s = 1.5` s |
| Bóng Mực & đèn | Sợ đèn, chạm thì mất máu | `shade_speed = 4.5` m/s, `shade_hit_radius = 1.5` m, `safe_radius = 6.0` m quanh các đèn **đã thắp sáng** (`lit: true`) |
| Máu & rơi đom đóm | Mất máu khi bị chạm | `flames = 3`, `invuln_s = 2.0` s, `hit_drop_ratio = 0.5` (rơi `Math.floor(carried * 0.5)` đom đóm) |
| Thời lượng Đêm 1 | Không nêu thời lượng cố định | `night1_duration_s = 300` s (5 phút); hết giờ → thua với `reason: "dawn"` |
| Điểm số | Có điểm số | `per_mote = 10`, `per_lantern = 100`, `per_stun = 25`, thưởng thắng: `per_second_left = 2`, `per_flame_left = 50` |

## 2. Tiêu chí nghiệm thu (Acceptance Criteria)
1. **AC-1 (Contract Sync):** `DEFAULT_TUNING` khớp 100% với `game.contract.json`.
2. **AC-2 (Setup sạch):** Dựng scenario (kể cả đèn đặt sẵn `lit: true`) không phát sự kiện, không cộng điểm, snapshot tick 0 ở trạng thái trước input.
3. **AC-3 (Di chuyển & Camera):** Di chuyển theo đúng công thức xoay `cam_yaw_deg`, chuẩn hóa vector dài > 1, kích hoạt hành động theo sườn lên `false -> true`.
4. **AC-4 (Vòng lặp thắng):** Nhặt đom đóm (`mote_picked`), nạp đèn (`deposit`), thắp đèn (`lantern_lit`), đủ 5 đèn thì thắng (`game_over` với `reason: "all_lit"`) và cộng thưởng.
5. **AC-5 (Tỏa sáng & An toàn):** Pulse trừ `pulse_cost`, stun + đẩy Bóng Mực trong `pulse_radius`; Bóng Mực không đi vào `safe_radius` quanh đèn đã thắp.
6. **AC-6 (Chạm Bóng Mực & Thua):** Mất 1 máu, rơi đom đóm theo `hit_drop_ratio`, bất tử trong `invuln_s`, về 0 máu → `game_over` (`no_flames`); hết giờ → `game_over` (`dawn`).
7. **AC-7 (Tính tất định & Lỗi):** Cùng seed/scenario/inputs cho output JSONL giống nhau từng byte; file inputs/scenario lỗi thoát mã `2` + thông báo `stderr`.
8. **AC-8 (3D & Chơi lại):** Bản web 3D Three.js chạy được trên macOS/Linux/Windows, hiển thị Mây đội nón lá treo đèn lồng, HUD đầy đủ, đảo sáng dần khi thắp đèn, chơi lại được sau thắng/thua.

## 3. Kế hoạch kiểm chứng (trước khi code)
- **Unit tests (`src/sim/tests/engine.test.ts`):** 8 test kiểm tra sync contract, setup sạch, di chuyển, nhặt/nạp/thắng, pulse, safe_radius, hit/thua, hết giờ.
- **Scenario headless (`scripts/verify-phase1.mjs`):** 5 kịch bản end-to-end qua CLI `node dist-sim/headless.js`, gồm cả kiểm tra tính tất định 600 tick × 2 lần chạy và kiểm tra mã thoát `2`.
- **CI (`.github/workflows/ci.yml`):** Tự động build + chạy toàn bộ `npm test` trên Ubuntu mỗi lần push/tag.

## 4. Đánh giá Phase 1 & Nhật ký dùng AI
- **Tech stack chọn:** TypeScript + Three.js + Vite (chạy 3D trên trình duyệt đa nền tảng) + Node.js thuần cho `src/sim/` (chạy headless cực nhanh, 0 phụ thuộc GPU).
- **Harness đã xây dựng:** `AGENTS.md` (ràng buộc bất biến của Test Contract), `.agents/skills/verify-phase/SKILL.md`, `.github/workflows/ci.yml`.
- **Lỗi AI gặp & cách xử lý:**
  - Lần đầu viết `index.html`, phím `E` bị ghi trùng cho cả xoay camera và nạp đèn; đã review lại và tách rõ `← / →` xoay camera, `E / F` nạp đèn.
  - Khi thiết kế ranh giới đảo (`fall_enabled: false`), nhận ra nếu scenario ẩn đặt đèn ở tọa độ lớn hơn 45m thì nhân vật sẽ bị kẹt; đã bổ sung `playableRadius = Math.max(ISLAND_RADIUS, maxEntityDist + 15)` ngay trong constructor.
- **Ước tính token & tối ưu Phase 1:**
  - Ước tính: ~18k input tokens, ~9k output tokens (chi phí rất thấp nhờ gộp batch đọc/ghi file, không chạy agent lặp vô ích, giữ `AGENTS.md` ngắn dưới 35 dòng).
