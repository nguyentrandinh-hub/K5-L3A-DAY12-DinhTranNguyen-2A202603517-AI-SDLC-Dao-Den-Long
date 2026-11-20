# Đảo Đèn Lồng — Bình Minh (`v1.0.0` · Contract v1.3)

> **Video demo (< 5 phút):** [Tải / xem trên Release `v1.0.0`](https://github.com/nguyentrandinh-hub/K5-L3A-DAY12-DinhTranNguyen-2A202603517-AI-SDLC-Dao-Den-Long/releases/tag/v1.0.0) *(đính kèm `demo.mp4` trong Release `v1.0.0`)*  
> **Repo:** `K5-L3A-DAY12-DinhTranNguyen-2A202603517-AI-SDLC-Dao-Den-Long` · **Học viên:** Đinh Trần Nguyên (`2A202603517`)

Game 3D góc nhìn thứ ba qua **3 Đêm** (*Đảo Bến*, *Đảo Cau*, *Đảo Chuông*) xây dựng bằng **TypeScript + Three.js + Vite** với lõi mô phỏng **60 Hz tất định (deterministic)** tuân thủ đầy đủ **Test Contract v1.3**.

---

## Yêu cầu hệ thống
- **Node.js >= 20** (chạy tốt trên **macOS, Linux và Windows**).
- Trình duyệt hỗ trợ WebGL2 (Chrome / Edge / Safari / Firefox) để chơi bản 3D và chạy `bench_cmd`.

---

## Cài đặt & Chạy (tối đa 3 lệnh)

```bash
npm install
npm run build
node scripts/run-game.mjs
```

Mở trình duyệt tại `http://localhost:4173` để chơi (dữ liệu Bảng xếp hạng được lưu trực tiếp trên đĩa tại `data/leaderboard.json`).

---

## Điều khiển & Dễ tiếp cận (Accessibility)

| Phím mặc định | Hành động (có thể đổi toàn bộ trong **Cài đặt & Tiếp cận**) |
|---|---|
| `W / A / S / D` | Di chuyển theo hướng camera (`6.0 m/s`, `7.2 m/s` khi có Bùa Gió) |
| `Chuột (click/kéo)` hoặc `← / →` | Xoay camera quanh Mây (chỉnh độ nhạy chuột trong Cài đặt) |
| `Space` | Nhảy (`7.0 m/s`, trọng lực `-20 m/s²`) |
| `Shift` | **Lướt (Dash)** (`14 m/s` trong `0.2s`, hồi `1.5s`, không hồi chiêu khi có Bùa Gió) |
| `E` (hoặc `F`) | Tương tác đèn: nạp ánh sáng (`10` lần đầu, `5` thắp lại) hoặc châm dầu (`+10 fuel/đom đóm`) |
| `Q` | **Tỏa Sáng (Pulse)** (tốn `3` đom đóm, bán kính 3D `5m`, choáng Bóng Mực & ngắt `drain`) |
| `M` | Tắt/bật âm thanh nhanh |
| `Esc` hoặc `P` | Tạm dừng (đóng băng hoàn toàn logic và thời gian) |

**Tính năng Tiếp cận (Accessibility) trong Cài đặt (lưu tự động):**
- **Đổi phím toàn bộ hành động** kèm phát hiện trùng phím và nút *Khôi phục mặc định*.
- **Bảng màu dễ phân biệt (mù màu):** viền Bóng Mực `#00B3FF`, cảnh báo `#FFFFFF` kèm `⚠`, đèn tắt xẹp 20% + vết rách giấy, thanh dầu 3D nhấp nháy 1 Hz khi `< 30`.
- **Phụ đề & chỉ báo hình ảnh:** Bóng Mực xuất hiện (kèm mũi tên ở mép màn hình), gió sắp thổi, đếm ngược 10s cuối, đèn `< 30` dầu.
- **Giảm chuyển động:** tắt rung camera và hiệu ứng chớp màn hình.
- **Cỡ chữ UI:** tối thiểu `18px` ở 1280×720 + tùy chọn **Chữ lớn (`×1.25`)**.

---

## Cách tính điểm & Luật chơi (`game.contract.json` v1.3)

- **Giữ đảo sáng tới Bình Minh (`dawn_survived`):** Đêm 1/2/3 kéo dài `240 / 270 / 300s`. Thắng khi còn sống tới bình minh với `>= ceil(0.6 × tổng đèn)` đèn sáng (**3/5**, **4/6**, **5/7**).
- **Nhiên liệu đèn:** Hao `1.0/s`; dưới `30` mất vùng an toàn 6m và bị Bóng Mực `drain` (`5.0/s`).
- **Sức chứa tăng dần:** `10 + 2 × số lần thắp thành công` (tối đa `20`).
- **Điểm số:** `+5` mỗi đom đóm nạp/châm dầu · `+100` thắp lần đầu · `+40` thắp lại · `+5` Tỏa Sáng trúng Bóng Mực (`+15` nếu đang `drain`) · Bình minh (khi thắng): `+50 + floor(fuel)` mỗi đèn sáng + `+50` mỗi Ngọn Lửa còn lại.

---

## Chạy Test, Headless, Benchmark, Soak & Xuất Bảng Xếp Hạng

```bash
# 1. Toàn bộ unit test + hồi quy + soak test + kiểm tra xuất bảng xếp hạng
npm test

# 2. Chế độ Headless (Contract v1.3)
node dist-sim/headless.js --seed 42 --night 1 --ticks 600 --out tmp/out.jsonl

# 3. Chế độ Benchmark 1280x720 (tắt vsync bằng cờ --disable-gpu-vsync --disable-frame-rate-limit của Chromium)
node scripts/bench.mjs --seed 42 --duration 30 --out bench.json

# 4. Soak test 10 Đêm liên tiếp
node dist-sim/soak.js --seed 7 --nights 10 --out soak.json

# 5. Xuất Bảng xếp hạng cục bộ ra JSON
node scripts/run-game.mjs --export-leaderboard out.json
```

> **Ghi chú VSync & bộ nhớ trên web:** `scripts/bench.mjs` tự mở Chromium/Chrome/Edge ở kích thước `1280×720` kèm `--disable-gpu-vsync --disable-frame-rate-limit` (`vsync_off: true`). Trên trình duyệt không hỗ trợ `performance.memory`, `peak_mem_mb` trả về `null` theo quy định Contract v1.3.

---

## Sáng tạo của tôi

Toàn bộ yếu tố sáng tạo được cô lập **100% trong `src/game/`** (tự động tắt trong chế độ headless, benchmark và soak test nên **không làm thay đổi đầu ra Contract**):

1. **Hệ sinh thái Đảo sống động & Vườn hoa nở theo ánh đèn (`src/game/flora.ts`):** Cỏ mềm `InstancedMesh`, bụi cây và cây xanh quanh đảo; quanh mỗi Đèn Lồng Lớn có vườn **Hoa Hồng, Hoa Ly và Hoa Tulip** cụp cánh khi đèn tắt và **nở xòe rực rỡ dần theo mức nhiên liệu/độ sáng của đèn** (tắt hoàn toàn trong benchmark & headless).
2. **Cảnh quan bản sắc Việt & Bình minh cổ tích:** Bầu trời sao, trăng khuyết vàng, 18 đèn hoa đăng trôi trên biển mây, chuyển sắc trời bình minh 30s cuối khi đủ ngưỡng thắng; thuyền gỗ + **Ông Đăng** ở *Đảo Bến*; hàng **cây cau** & đèn cầu tre ở *Đảo Cau*; **chuông đồng phát sáng** & **lá bay theo hướng gió** ở *Đảo Chuông*.
3. **HUD & UX nâng cao (Tier S/A/B):** Dải trạng thái dầu mini `L1..L7` trên HUD, thanh tiến trình Bình Minh, thanh hồi chiêu dạng fill, Live Event Toast, Minimap có góc nhìn FOV Cone + nhãn đèn + cảnh báo `drain`, bộ đếm FPS trực tiếp, zoom camera bằng con lăn chuột (`8–18m`), đom đóm dẫn đường mượt (hysteresis 3m), tia hút dầu, số điểm bay nổi, và nhạc nền Ngũ Cung Việt Nam tổng hợp (Web Audio API).

---

## Tài liệu SDLC, Harness & Bằng chứng
- **Harness AI:** [AGENTS.md](AGENTS.md), [.agents/skills/verify-phase/SKILL.md](.agents/skills/verify-phase/SKILL.md), [.github/workflows/ci.yml](.github/workflows/ci.yml)
- **Tài liệu & Retro:** [phase-1.md](docs/notes/phase-1.md), [phase-2.md](docs/notes/phase-2.md), [phase-3.md](docs/notes/phase-3.md), [ADR-001](docs/notes/adr-001-fuel-and-dawn-survival.md), [retro.md](docs/notes/retro.md), [CHANGELOG.md](CHANGELOG.md)
- **Bằng chứng & Số đo:** [phase-1-report.md](docs/proof/phase-1-report.md), [phase-2-report.md](docs/proof/phase-2-report.md), [phase-3-report.md](docs/proof/phase-3-report.md), [phase-4-report.md](docs/proof/phase-4-report.md), [bench.json](bench.json), [soak.json](soak.json)
- **Bản quyền:** [CREDITS.md](CREDITS.md), [LICENSE](LICENSE)
