# Phase 3 Notes — Ticket-03 (Change Request "Đèn cạn dầu" · Contract v1.2)

## 1. Test cũ bị thay thế & Lý do cập nhật (không skip âm thầm)
| Test Phase 1–2 cũ | Lý do bị thay bởi Ticket-03 | Cách xử lý |
|---|---|---|
| Test thắng sớm `reason: "all_lit"` khi thắp đủ 5 đèn | Ticket-03 bỏ thắng sớm, chuyển sang sống sót tới bình minh (`dawn_survived`, `>= ceil(0.6*N)`) | Thay bằng unit test #6 (`No early win on all lit; dawn win requires >= ceil(0.6*N)`) và #7 (`Dawn loss < ceil(0.6*N)`) + S3, S4 |
| Test điểm `+10/mote` + thưởng `floor(timeLeft)*2` | Ticket-03 thay toàn bộ bảng điểm (`+5/mote`, `+40` relight, `+15` ngắt drain, bỏ thưởng thời gian) | Cập nhật assertion điểm trong unit test #3, #4, #5 và S1, S2 |
| Test `safe_radius` luôn chặn Bóng Mực trên mọi đèn sáng | Ticket-03 quy định đèn `fuel < 30` mất vùng an toàn và bị Bóng Mực `drain` | Bổ sung unit test #4, #5 kiểm tra `drain`, `refuel` khôi phục safe zone đẩy Bóng Mực ra |
| Test Phase 2 không bị thay thế (Dash, Charm, Drifter, Jump Pad, Pause, Determinism) | Vẫn còn nguyên hiệu lực | Giữ nguyên hồi quy ở unit test #8 và scenarios S5, S6 |

## 2. Tài liệu kiến trúc & thay đổi
- **ADR:** [docs/notes/adr-001-fuel-and-dawn-survival.md](adr-001-fuel-and-dawn-survival.md)
- **Changelog:** [CHANGELOG.md](../../CHANGELOG.md)
- **Harness AI:** Cập nhật `AGENTS.md` cho Contract v1.2 (số nguyên `1/60` fuel units, 6 trạng thái Bóng Mực gồm `drain`, luật thắng bình minh).

## 3. Nhật ký AI & Ước tính Token Phase 3
- **Cách triển khai:** Thực hiện gọn trong 2 batch song song (Sim/Contract/Tests trước, UI/3D/Colorblind/Docs sau), kiểm chứng 1 lượt duy nhất sau khi xong.
- **Ước tính token Phase 3:** ~19k input tokens, ~11k output tokens.
