# Đảo Đèn Lồng (Lantern Island)

> **Video demo:** *(Sẽ cập nhật link Release `v1.0.0` ở Phase 4)*
> **Repo:** `K5-L3A-DAY12-DinhTranNguyen-2A202603517-AI-SDLC-Dao-Den-Long` · **Học viên:** Đinh Trần Nguyên (`2A202603517`)

Game 3D góc nhìn thứ ba xây dựng bằng **TypeScript + Three.js + Vite** với lõi mô phỏng **60 Hz tất định (deterministic)** tách hoàn toàn khỏi đồ họa để chạy chế độ headless theo **Test Contract v1.0**.

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
| `W / A / S / D` | Di chuyển theo hướng camera |
| `← / →` (hoặc `Q`) | Xoay camera quanh Mây |
| `Space` | Nhảy |
| `E` hoặc `F` | Nạp đom đóm vào Đèn Lồng Lớn gần nhất |
| `Shift` | Tỏa sáng (tốn 2 đom đóm, làm choáng và đẩy lùi Bóng Mực) |
| `R` | Chơi lại ngay lập tức |

---

## Cách tính điểm & Thông số (`game.contract.json`)

- **Nhặt đom đóm:** `+10` điểm (`per_mote: 10`), mang tối đa `5` đom đóm (`carry_capacity: 5`).
- **Thắp sáng 1 Đèn Lồng Lớn (nạp đủ 3 đom đóm):** `+100` điểm (`per_lantern: 100`).
- **Làm choáng Bóng Mực bằng Tỏa Sáng:** `+25` điểm / Bóng Mực (`per_stun: 25`).
- **Thưởng khi thắng (thắp đủ 5/5 đèn):** `+2` điểm / giây còn lại (`per_second_left: 2`) + `+50` điểm / ngọn lửa còn lại (`per_flame_left: 50`).
- **Lưu ý `fall_enabled: false`:** Nhân vật được giữ trong ranh giới an toàn của đảo, không rơi khỏi đảo.

---

## Chạy Test & Chế độ Headless

```bash
# Chạy toàn bộ unit test + kịch bản headless + kiểm tra tính tất định
npm test

# Chạy trực tiếp chế độ headless (Test Contract v1.0)
node dist-sim/headless.js --seed 42 --night 1 --ticks 600 --out tmp/out.jsonl
```

---

## Sáng tạo của tôi

Các yếu tố sáng tạo được thêm ở lớp hiển thị & âm thanh (**hoàn toàn không ảnh hưởng đến đầu ra headless**):

1. **Mây đội nón lá treo đèn lồng đung đưa:** Đèn lồng nhỏ dưới vành nón lá sáng mạnh dần theo số đom đóm Mây đang mang và đung đưa nhẹ theo bước chạy.
2. **Đảo Bến sáng ấm dần lên & Tàn lửa bay trời:** Khi thắp sáng từng Đèn Lồng Lớn, bầu trời chuyển từ xanh đêm sang hoàng hôn ấm, sương mù tan dần, vòng sáng vàng chỉ rõ `safe_radius` nơi Bóng Mực không thể vào, và các đốm lửa nhỏ bay lên trời ăn mừng.
3. **Âm thanh tổng hợp Web Audio API (100% nguyên bản):** Tự tổng hợp tiếng chuông nhặt đom đóm, tiếng cộng hưởng thắp đèn, sóng âm Tỏa Sáng và hiệu ứng va chạm mà không cần file âm thanh ngoài.

Bằng chứng các phần sáng tạo không ảnh hưởng lõi headless được kiểm chứng tự động qua `npm test` (xem [docs/proof/phase-1-report.md](docs/proof/phase-1-report.md)).

---

## Tài liệu SDLC & Bằng chứng
- Harness AI: [AGENTS.md](AGENTS.md), [.agents/skills/verify-phase/SKILL.md](.agents/skills/verify-phase/SKILL.md), [.github/workflows/ci.yml](.github/workflows/ci.yml)
- Ghi chép & giả định Phase 1: [docs/notes/phase-1.md](docs/notes/phase-1.md)
- Bằng chứng kiểm chứng Phase 1: [docs/proof/phase-1-report.md](docs/proof/phase-1-report.md)
- Bản quyền & nguồn: [CREDITS.md](CREDITS.md), [LICENSE](LICENSE)
