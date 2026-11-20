# Phase 2 Notes — Ticket-02 ("Ba hòn đảo" · Contract v1.1)

## 1. Thay đổi so với Phase 1 & Lý do cập nhật Test cũ
Ticket-02 chuẩn hóa toàn bộ thông số lõi (`Contract v1.1`) thay thế các giá trị giả định ở Phase 1. Các test Phase 1 bị ảnh hưởng đã được cập nhật công khai kèm lý do:

| Quy tắc Phase 1 (cũ) | Quy tắc Phase 2 (chuẩn v1.1) | Cập nhật test & lý do |
|---|---|---|
| `player_speed = 8.0`, `lantern_cost = 3`, `carry_capacity = 5` | `player_speed = 6.0`, `lantern_cost = 10`, `carry_capacity = 10` | Cập nhật unit test #1, #3, #4 và kịch bản S1 theo số liệu chuẩn bắt buộc trong Phần 1 Ticket-02 |
| Điểm `+10` cộng lúc nhặt đom đóm (`mote_picked`) | Điểm `+10` cộng lúc **nạp đom đóm vào đèn** (`deposit`), `+5` mỗi Bóng Mực trúng Pulse | Cập nhật assertion điểm trong unit test #5, #6 và S1 |
| `fall_enabled = false` | `fall_enabled = true` (rơi `Y < -10` trừ 1 Ngọn Lửa, mất hết đom đóm, chờ 60 tick hồi sinh + 90 tick bất tử) | Bổ sung unit test #8 và scenario S5 kiểm chứng rơi khỏi đảo & hồi sinh |
| Bóng Mực chỉ có `chase`/`stunned`, không có `recoil` | 5 trạng thái bắt buộc: `spawning`, `wander`, `chase`, `recoil`, `stunned` | Cập nhật unit test #7 xác nhận Bóng Mực chuyển `recoil` và rơi `dropped` motes có TTL 480 tick |

## 2. Tiêu chí nghiệm thu (Acceptance Criteria — Phần 3 Ticket-02)
- **AC-1 (Contract v1.1 Sync):** `game.contract.json` (`1.1`) khớp 100% với `DEFAULT_TUNING`, bao gồm các khóa mới (`dash_*`, `night2_duration_s`, `night3_duration_s`).
- **AC-2 (12-Step Tick & Pause):** Thực hiện đúng 12 bước trong 1 tick; khi `pause` (`Esc`/`P`), `tick` tăng nhưng `sim_tick`, thời gian, hồi chiêu, spawn, TTL đóng băng và snapshot ghi `state: "paused"`.
- **AC-3 (Lướt — Dash):** Tốc `14 m/s` trong 12 tick (`0.2s`), hồi chiêu `1.5s` từ lúc bắt đầu, lướt trên không giữ nguyên độ cao, phát `dash {}`.
- **AC-4 (3 Bản đồ chuẩn):**
  - Đêm 1 Đảo Bến (`r=40m`, 5 đèn `L1..L5`, 24 điểm đom đóm, 12 điểm Bóng Mực).
  - Đêm 2 Đảo Cau (2 đảo `r=28m` tại `0` và `70`, cầu tre `x∈[26,44], z∈[-2,2]`, 2 bục nhảy phóng `vy=14, vh=24`, 6 đèn `L1..L6`).
  - Đêm 3 Đảo Chuông (`r=45m`, 3 tầng `Y=0/3/6`, 2 dốc `30°`/`150°`, bục nhảy `(0,3,13)`, tháp chuông trụ `r=2m` ở tâm, 7 đèn `L1..L7`, Gió mạnh mỗi 30s kéo dài 5s báo trước 2s).
- **AC-5 (Gió Lạc — Drifters):** Đêm 2 & 3, `idle → chase` khi Mây mang `≥ 5` đom đóm & cách `≤ 15m`, chạm cướp `min(3, carried)` (`drifter_steal`) rồi `flee`; trúng Pulse khi `flee` có đồ → thả lại toàn bộ (`drifter_drop`).
- **AC-6 (Bùa Gió — Charms):** Hiệu lực 600 tick (`player_speed = 7.2 m/s`, Lướt không hồi chiêu), phát `charm_picked`, xuất hiện lại sau 2700 tick.
- **AC-7 (UI, Chuỗi 3 Đêm, Bảng màu chuẩn, Âm thanh):** Menu chính → Giới thiệu Đêm (lời Ông Đăng) → Chơi → Kết quả → Đêm tiếp → Màn hình Bình Minh; Cài đặt âm lượng & độ nhạy lưu `localStorage`; HUD đủ thành phần (thanh 10 ô, đồng hồ nhấp nháy đỏ `≤ 30s`, hồi chiêu, mũi tên chỉ đèn ngoài màn hình); bảng màu Hex chuẩn và ánh sáng môi trường `0.15 + 0.55 × (lit/total)`.
- **AC-8 (Hiệu năng & Tính tất định):** Chạy headless 1 Đêm đầy đủ (`21.600 tick`) xong trong `≤ 30s`; 2 lần chạy cùng seed cho output giống hệt từng byte.

## 3. Đánh giá Phase 2 & Nhật ký dùng AI
- **Cập nhật Harness AI:** Đã nâng cấp `AGENTS.md` và `.agents/skills/verify-phase/SKILL.md` phản ánh đầy đủ Contract v1.1 (12 bước tick, trạng thái Bóng Mực chuẩn, ngưỡng 30s cho 21.600 tick).
- **Lỗi AI gặp & cách tự phát hiện:**
  - *Lỗi 1 (Thiết kế Đêm 3):* Ban đầu đặt điểm xuất phát Đêm 3 là `(0, 0, 0)`, nhưng tâm Đảo Chuông có tầng 2 (`Y=6`) và tháp chuông trụ `r=2m`; đã phát hiện trước khi chạy test và đổi điểm xuất phát mặc định Đêm 3 sang `(0, 0, -12)` trên tầng 0 (vẫn tôn trọng `scenario.player.pos` nếu test truyền vào).
  - *Lỗi 2 (TypeScript narrowing):* Trong `src/sim/headless.ts`, TypeScript thu hẹp kiểu `engine.state` bên trong vòng `for` và báo lỗi `TS2367`; đã sửa gọn bằng ép kiểu kiểm tra rõ ràng trước khi build lại.
- **Ước tính token & tối ưu Phase 2:**
  - Ước tính: ~24k input tokens, ~14k output tokens. Tối ưu bằng cách tách riêng `src/sim/maps.ts` (dễ bảo trì, ít đọc lại), lập kế hoạch rõ và xác nhận trước khi code, gộp ghi file song song theo nhóm.
