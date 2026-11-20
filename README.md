# Đảo Đèn Lồng — Ba Hòn Đảo (Contract v1.1)

> **Video demo:** *(Sẽ cập nhật link Release `v1.0.0` ở Phase 4)*
> **Repo:** `K5-L3A-DAY12-DinhTranNguyen-2A202603517-AI-SDLC-Dao-Den-Long` · **Học viên:** Đinh Trần Nguyên (`2A202603517`)

Game 3D góc nhìn thứ ba qua **3 Đêm** (*Đảo Bến*, *Đảo Cau*, *Đảo Chuông*) xây dựng bằng **TypeScript + Three.js + Vite** với lõi mô phỏng **60 Hz tất định (deterministic)** tuân thủ **Test Contract v1.1**.

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
| `← / →` | Xoay camera quanh Mây (độ nhạy chỉnh trong Cài đặt) |
| `Space` | Nhảy (`7.0 m/s`, trọng lực `-20 m/s²`) |
| `Shift` | **Lướt (Dash)** (`14 m/s` trong `0.2s`, hồi chiêu `1.5s`, không hồi chiêu khi có Bùa Gió) |
| `E` hoặc `F` | Nạp đom đóm vào Đèn Lồng Lớn gần nhất (`10` đom đóm/đèn) |
| `Q` | **Tỏa Sáng (Pulse)** (tốn `3` đom đóm, bán kính 3D `5m`, làm choáng Bóng Mực & đẩy lùi Gió Lạc) |
| `Esc` hoặc `P` | Tạm dừng (dừng hoàn toàn logic và thời gian) |

---

## Cách tính điểm & Thông số chuẩn (`game.contract.json` v1.1)

- **Nạp đom đóm vào đèn:** `+10` điểm / đom đóm (`per_mote: 10`), sức chứa tối đa `10`.
- **Thắp sáng Đèn Lồng Lớn (đủ 10 đom đóm):** `+100` điểm (`per_lantern: 100`).
- **Tỏa Sáng trúng Bóng Mực:** `+5` điểm / Bóng Mực (`per_stun: 5`).
- **Thưởng khi thắng Đêm:** `+ floor(giây còn lại) × 2` + `+50 × Ngọn Lửa còn lại`.
- **Tổng điểm chiến dịch:** Tổng điểm các Đêm đã thắng (hiển thị trên màn hình Bình Minh sau Đêm 3).

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

Các yếu tố sáng tạo được giữ ở lớp đồ họa & âm thanh (**hoàn toàn không làm thay đổi đầu ra headless**):

1. **Mây đội nón lá treo đèn lồng đung đưa:** Đèn lồng dưới vành nón sáng mạnh dần theo số đom đóm đang mang và đung đưa theo bước chạy, kết hợp bảng màu chuẩn của lab (áo `#E8E2D0`, khăn `#C8102E`).
2. **Vòng sáng an toàn & sóng Tỏa Sáng trực quan:** Đèn đã thắp hiển thị vòng vàng `safe_radius` 6m giúp người chơi nhận biết vùng an toàn, kèm ánh sáng môi trường tăng mượt `0.15 + 0.55 × (đèn sáng / tổng đèn)`.
3. **Âm thanh tổng hợp Web Audio API (100% nguyên bản):** Nhạc nền đêm nhẹ và đầy đủ hiệu ứng âm thanh (nhặt, nạp, thắp đèn, tỏa sáng, lướt, nhảy, bị đánh, Bóng Mực xuất hiện, cảnh báo gió, đếm ngược 10s cuối) kèm lưu cài đặt âm lượng vào `localStorage`.

---

## Tài liệu SDLC & Bằng chứng
- Harness AI: [AGENTS.md](AGENTS.md), [.agents/skills/verify-phase/SKILL.md](.agents/skills/verify-phase/SKILL.md), [.github/workflows/ci.yml](.github/workflows/ci.yml)
- Ghi chép SDLC: [docs/notes/phase-1.md](docs/notes/phase-1.md), [docs/notes/phase-2.md](docs/notes/phase-2.md)
- Bằng chứng kiểm chứng: [docs/proof/phase-1-report.md](docs/proof/phase-1-report.md), [docs/proof/phase-2-report.md](docs/proof/phase-2-report.md)
- Bản quyền & nguồn: [CREDITS.md](CREDITS.md), [LICENSE](LICENSE)
