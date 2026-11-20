# Retrospective — Đảo Đèn Lồng (AI SDLC Lab Day 12)

> **Dự án:** Đảo Đèn Lồng (`v1.0.0` · Contract `v1.0 → v1.3`)  
> **Học viên:** Đinh Trần Nguyên (`2A202603517`) · **Thời lượng:** 4 giờ (4 Phase)

---

## 1. Tổng hợp Evaluation qua 4 Phase

| Phase | Phạm vi chính | Kết quả kiểm chứng | Thời gian | Ước tính Token (In / Out) |
|---|---|---|---|---|
| **Phase 1 (`phase-1`)** | PRD-0, Đêm 1 Đảo Bến, lõi 60 Hz tất định, CLI headless v1.0, 3D Three.js, Web Audio | 8/8 unit tests, 5/5 scenarios (600 tick determinism = `72050B`) | ~45 phút | ~18k / ~9k |
| **Phase 2 (`phase-2`)** | Ticket-02 (v1.1): chuẩn hóa số liệu, 3 bản đồ (Đảo Bến/Cau/Chuông), Dash, Gió Lạc, Bùa Gió, Gió mạnh, Pause, bảng màu chuẩn, sáng tạo cảnh quan & Minimap | 12/12 unit tests, 9/9 scenarios (21.600 tick = `0.34s`), sửa font tiếng Việt, WASD & chuột | ~55 phút | ~28k / ~16k |
| **Phase 3 (`phase-3`)** | Ticket-03 (v1.2 Change Request): nhiên liệu đèn (`1/60` nguyên), Bóng Mực `drain`, thắp lại `5` đom đóm, thắng `dawn_survived`, sức chứa tăng dần, chế độ mù màu, ADR-001, Changelog | 8/8 unit tests, 6/6 scenarios (18.000 tick = `0.32s`), sửa bug Pause/Resume, gói Tier S | ~28 phút | ~22k / ~13k |
| **Phase 4 (`phase-4` / `v1.0.0`)** | Ticket-04 (v1.3 Release): Benchmark 1280×720 (`bench.json`), Soak 10 Đêm (`soak.json`), Bảng xếp hạng lưu đĩa + `--export-leaderboard`, Accessibility (đổi phím, phụ đề, giảm chuyển động, chữ ≥ 18px & ×1.25), Retro & Release | 8/8 unit tests, 8/8 scenarios (soak 0 crash, `mem_end <= 1.2x mem_start`), build sạch 0 lỗi | ~40 phút | ~20k / ~12k |
| **Tổng cộng** | **4 Phase + Sáng tạo Tier S + Release `v1.0.0`** | **100% PASS mọi cổng kiểm chứng** | **~2h50** | **~88k in / ~50k out (~$0.5–$1.2)** |

---

## 2. Điều gì hiệu quả & chưa hiệu quả khi làm việc với AI

### Hiệu quả nhất
- **Tách kiến trúc ngay từ Phase 1 (`src/sim/` vs `src/game/`):** Vì `src/sim/` hoàn toàn thuần TypeScript/Node.js không dính DOM hay Three.js, mọi thay đổi lớn ở Phase 2 (3 bản đồ), Phase 3 (nhiên liệu đèn & luật thắng mới) và Phase 4 (Soak test 10 Đêm) đều chạy kiểm chứng trong **< 0.5 giây**, đồng thời mọi yếu tố sáng tạo đồ họa/âm thanh ở `src/game/` có **0% rủi ro làm lệch đầu ra headless**.
- **Nghĩ cách kiểm chứng trước khi code & Unit test khóa `game.contract.json`:** Test #1 so sánh sâu `DEFAULT_TUNING` với `game.contract.json` giúp không bao giờ xảy ra lệch thông số giữa file khai báo và code thực thi.
- **Lập kế hoạch và xác nhận trước khi sửa lớn (Phase 2):** Giúp thống nhất 12 bước tick và 3 bản đồ chuẩn trước khi viết code, tránh sửa đi sửa lại.

### Chưa hiệu quả / Bài học rút ra
- **Test trực quan trên trình duyệt cần làm sớm hơn:** Lỗi ngược phím `A/D` trong hệ tọa độ tay phải Three.js, lỗi thiếu font tiếng Việt ở nút bấm và lỗi biến `pauseQueued` làm kẹt trạng thái khi bấm `P` 2 lần đều chỉ lộ ra khi người chơi tự mở trình duyệt chơi thử (unit test headless không bắt được lỗi mapping UI).

---

## 3. Những lần AI sai, cách phát hiện & cách chỉnh Harness
1. **Phím `E` bị trùng cho cả xoay camera và tương tác (Phase 1):** Phát hiện khi rà soát `index.html`; sửa tách hẳn phím và ghi chú trong `phase-1.md`.
2. **Điểm xuất phát Đêm 3 bị đặt trùng tâm Tháp Chuông (Phase 2):** Phát hiện khi đối chiếu hình học 3 tầng Đảo Chuông (`r <= 8m` là tầng 2 `Y=6` có tháp trụ `r=2m`); chuyển điểm xuất phát mặc định Đêm 3 sang `(0, 0, -12)` trên tầng 0.
3. **Ngược phím `A/D` khi camera nhìn `+Z` và kẹt `pauseQueued` khi bấm `P` (Phase 2–3):** Người chơi phát hiện trực tiếp khi chơi thử trên trình duyệt; sửa triệt để chỉ ở lớp `src/game/main.ts` mà không chạm vào công thức Test Contract trong `src/sim/engine.ts`.
4. **Unit test #5 Phase 3 bị fail ngay lần chạy đầu:** Do đặt Mây cách Bóng Mực đang `drain` `2.2m <= 6m`, nên ở bước 8 tick 1 Bóng Mực chuyển sang `chase` đúng theo luật; test thực tế đã chứng minh đúng thứ tự 12 bước (bước 7 Pulse chạy trước bước 8 AI) và giúp viết kịch bản kiểm chứng chính xác hơn.

---

## 4. Harness AI nào giúp nhiều nhất?
- **`AGENTS.md` (cập nhật qua cả 4 phase):** Là thành phần hữu ích nhất — ngắn gọn (~30 dòng), khóa chặt các bất biến (không dùng `Math.random()`, nhiên liệu dùng số nguyên `1/60`, đúng thứ tự 12 bước, sáng tạo không đổi headless), giúp AI không bao giờ phá vỡ Contract cũ khi mở rộng phase mới.
- **`.github/workflows/ci.yml` + `npm test`:** Tự động chạy build + unit test + scenario headless + kiểm tra tính tất định sau mọi thay đổi, loại bỏ hoàn toàn tình trạng "tưởng là đã chạy".
- **Skill `.agents/skills/verify-phase/SKILL.md`:** Chuẩn hóa quy trình nghiệm thu và lưu bằng chứng trước mỗi lần gắn tag.

---

## 5. Quản lý Token & Nếu làm lại thì đổi gì?
- **Cách đã tiết kiệm token:** Giữ `AGENTS.md` ngắn dưới 35 dòng; đọc/ghi nhiều file song song theo batch trong cùng một lượt; tách module gọn (`maps.ts`, `bench-runner.ts`, `audio.ts`) để không phải đọc lại toàn bộ codebase; chạy kiểm chứng 1 lệnh gộp `npm run build && npm test`.
- **Nếu làm lại sẽ đổi gì:**
  1. Xây dựng sẵn một script kiểm tra **smoke-test trình duyệt tự động** (kiểm tra WASD, Pause/Resume bằng phím `P`, font chữ, FPS) ngay từ Phase 2 để bắt sớm các lỗi UI trước khi người dùng phải thử tay.
  2. Tách `src/game/main.ts` sớm hơn thành `scene.ts`, `hud.ts`, `input.ts` để chỉnh sửa giao diện và đồ họa nhanh hơn nữa.
