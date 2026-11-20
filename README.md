# Đảo Đèn Lồng — Ba Hòn Đảo (Contract v1.2)

> **Video demo:** *(Sẽ cập nhật link Release `v1.0.0` ở Phase 4)*
> **Repo:** `K5-L3A-DAY12-DinhTranNguyen-2A202603517-AI-SDLC-Dao-Den-Long` · **Học viên:** Đinh Trần Nguyên (`2A202603517`)

Game 3D góc nhìn thứ ba qua **3 Đêm** (*Đảo Bến*, *Đảo Cau*, *Đảo Chuông*) xây dựng bằng **TypeScript + Three.js + Vite** với lõi mô phỏng **60 Hz tất định (deterministic)** tuân thủ **Test Contract v1.2** (*Đèn cạn dầu & Sống sót tới Bình Minh*).

---

## Cài đặt & Chạy (tối đa 3 lệnh)

Yêu cầu: **Node.js >= 20** (chạy tốt trên macOS, Linux và Windows).

```bash
npm install
npm run build
npm run preview
```

Mở trình duyệt tại địa chỉ hiển thị (mặc định `http://localhost:4173`).

---

## Điều khiển

| Phím | Hành động |
|---|---|
| `W / A / S / D` | Di chuyển theo hướng camera (`6.0 m/s`, `7.2 m/s` khi có Bùa Gió) |
| `Chuột (click/kéo)` hoặc `← / →` | Xoay camera quanh Mây (độ nhạy chuột chỉnh trong Cài đặt) |
| `Space` | Nhảy (`7.0 m/s`, trọng lực `-20 m/s²`) |
| `Shift` | **Lướt (Dash)** (`14 m/s` trong `0.2s`, hồi chiêu `1.5s`, không hồi chiêu khi có Bùa Gió) |
| `E` hoặc `F` | Nạp đom đóm vào Đèn Lồng Lớn gần nhất (`10` đom đóm/đèn) |
| `Q` | **Tỏa Sáng (Pulse)** (tốn `3` đom đóm, bán kính 3D `5m`, làm choáng Bóng Mực & đẩy lùi Gió Lạc) |
| `Esc` hoặc `P` | Tạm dừng (dừng hoàn toàn logic và thời gian) |

---

## Cách tính điểm & Luật chơi (`game.contract.json` v1.2)

- **Giữ đảo sáng tới Bình Minh (`dawn_survived`):** Đêm 1/2/3 kéo dài `240 / 270 / 300s`. Thắng khi còn sống tới bình minh với `>= ceil(0.6 × tổng đèn)` đèn đang sáng (**3/5**, **4/6**, **5/7**).
- **Nhiên liệu đèn:** Đèn sáng hao `1.0/s`; dưới `30` mất vùng an toàn 6m và bị Bóng Mực `drain` (`5.0/s`). Châm dầu bằng `E` (`+10 fuel/đom đóm`); đèn tắt thắp lại chỉ tốn `5` đom đóm.
- **Sức chứa tăng dần:** `10 + 2 × số lần thắp thành công` (tối đa `20`).
- **Điểm số v1.2:** `+5` mỗi đom đóm nạp/châm dầu · `+100` thắp lần đầu · `+40` thắp lại · `+5` Tỏa Sáng trúng Bóng Mực (`+15` nếu đang `drain`) · Bình minh (khi thắng): `+50 + floor(fuel)` mỗi đèn sáng + `+50` mỗi Ngọn Lửa còn lại.
- **Chế độ mù màu:** Bật trong **Cài đặt** (*Bảng màu dễ phân biệt*).

---

## Chạy Test & Chế độ Headless (Contract v1.1)

```bash
# Chạy toàn bộ unit test + 9 kịch bản headless (Đêm 1/2/3, hiệu năng 21.600 tick, tính tất định)
npm test

# Chạy trực tiếp chế độ headless cho Đêm 1, 2 hoặc 3
node dist-sim/headless.js --seed 42 --night 3 --ticks 600 --out tmp/out.jsonl
```

---

## Sáng tạo của tôi

Các yếu tố sáng tạo được xây dựng **100% ở lớp đồ họa & âm thanh (`src/game/`)** nên **không hề làm thay đổi đầu ra headless** (đã chứng minh qua `npm test` với 12 unit test + 9 kịch bản headless & tính tất định):

1. **Cảnh quan bản sắc Việt & Bình minh cổ tích:** Bầu trời sao, trăng khuyết vàng, đèn hoa đăng trôi trên biển mây và chuyển sắc trời bình minh trong 30s cuối khi đủ ngưỡng thắng; thuyền gỗ + **Ông Đăng** ở *Đảo Bến*; hàng **cây cau** & đèn cầu tre ở *Đảo Cau*; **chuông đồng phát sáng** & **lá bay theo đúng hướng gió** ở *Đảo Chuông*.
2. **Đom đóm dẫn đường mượt & Hiệu ứng chiến đấu (Tier S):** Đom đóm dẫn đường dùng độ trễ chuyển mục tiêu (hysteresis 3m) + nội suy mượt nên không bị giật giữa hai đèn; tia năng lượng nối Bóng Mực đang `drain` tới đèn; số điểm bay nổi (`+100`, `+40`, `+15 Ngắt hút dầu!`); vệt sáng khi Lướt; tàn lửa khi thắp đèn; đèn nón Mây rực sáng khi đầy sức chứa / có Bùa Gió; rung camera & viền đỏ khi bị đánh.
3. **Minimap Radar & Kỷ lục cá nhân:** Bản đồ radar tròn ở góc dưới trái hiển thị vị trí Mây, đèn sáng/tắt và Bùa Gió; tự động lưu điểm cao nhất (High Score) mỗi Đêm vào `localStorage`.
4. **Nhạc nền Ngũ Cung Việt Nam tổng hợp (Web Audio API):** Giai điệu ngũ cung cổ tích tự tổng hợp 100% nguyên bản, sáng ấm dần theo tiến độ thắp đèn (hỗ trợ phím `M` tắt/bật tiếng nhanh).

---

## Tài liệu SDLC & Bằng chứng
- Harness AI: [AGENTS.md](AGENTS.md), [.agents/skills/verify-phase/SKILL.md](.agents/skills/verify-phase/SKILL.md), [.github/workflows/ci.yml](.github/workflows/ci.yml)
- Ghi chép SDLC & ADR: [docs/notes/phase-1.md](docs/notes/phase-1.md), [docs/notes/phase-2.md](docs/notes/phase-2.md), [docs/notes/phase-3.md](docs/notes/phase-3.md), [ADR-001](docs/notes/adr-001-fuel-and-dawn-survival.md), [CHANGELOG.md](CHANGELOG.md)
- Bằng chứng kiểm chứng: [docs/proof/phase-1-report.md](docs/proof/phase-1-report.md), [docs/proof/phase-2-report.md](docs/proof/phase-2-report.md), [docs/proof/phase-3-report.md](docs/proof/phase-3-report.md)
- Bản quyền & nguồn: [CREDITS.md](CREDITS.md), [LICENSE](LICENSE)
