# ADR-001: Mô hình Nhiên liệu Đèn (1/60 nguyên), Bóng Mực Hút Dầu và Luật Thắng Sống Sót Bình Minh

- **Trạng thái:** Đã áp dụng (Phase 3 · Contract v1.2)
- **Bối cảnh:** Ticket-03 thay thế luật cũ ("đèn sáng mãi mãi" & "thắng ngay khi thắp hết đèn") bằng cơ chế nhiên liệu cạn dần (`1.0/s`), Bóng Mực hút dầu (`5.0/s` khi `fuel < 30`), thắp lại đèn với nửa chi phí (`5` đom đóm), và mục tiêu mới "giữ tối thiểu `ceil(0.6 × N)` đèn sáng tới bình minh".

## Quyết định thiết kế

### 1. Biểu diễn nhiên liệu bằng số nguyên `fuelUnits` (đơn vị `1/60`)
- Thay vì lưu `fuel` dạng dấu phẩy động (`fuel -= 1/60` gây sai số tích lũy sau hàng nghìn tick và có thể lệch ngưỡng `30.0` hoặc `0.0`), mỗi đèn lưu số nguyên `fuelUnits ∈ [0, 6000]` (`6000 = 100.0`, `1800 = 30.0`).
- Mỗi tick đang sáng trừ đúng `1` đơn vị; mỗi Bóng Mực đang `drain` trừ thêm `5` đơn vị; mỗi đom đóm châm dầu cộng `600` đơn vị (`min(6000, ...)`).
- Chỉ chuyển sang số thực làm tròn 1 chữ số thập phân (`round1(fuelUnits / 60)`) khi xuất `snapshot` hoặc sự kiện `refuel` / `fuel_drain`.
- **Lợi ích:** Tính tất định tuyệt đối qua mọi nền tảng và kiểm tra ngưỡng `fuel >= 30` (`fuelUnits >= 1800`) chính xác từng tick.

### 2. Máy trạng thái Đèn & Vùng an toàn động
- Đèn chuyển qua vòng đời: `Unlit (everLit=false, cost=10)` → `Lit Healthy (fuel >= 30, safe_radius=6m)` → `Lit Low Fuel (fuel < 30, mất safe_radius, nhấp nháy 1Hz)` → `Out (fuel <= 0, phát lantern_out, everLit=true, deposited=0)` → `Relit (cost=5, relitCount++)`.
- Khi đèn được châm dầu từ `< 30` lên `>= 30`, vùng an toàn 6m được khôi phục và đẩy mọi Bóng Mực đang đứng bên trong ra mép trong tối đa 30 tick (tương tự khi thắp đèn mới).

### 3. Trạng thái Bóng Mực `drain` & Thứ tự trong tick
- Bổ sung trạng thái `drain` vào tập trạng thái chuẩn (`spawning`, `wander`, `chase`, `recoil`, `stunned`, `drain`).
- Giảm nhiên liệu (hao tự nhiên + hút dầu) và tắt đèn (`fuel <= 0`) được đặt ngay ở **Bước 2** để các bước sau trong cùng tick (tương tác, vùng an toàn, xét thắng/thua) luôn nhìn thấy trạng thái đèn nhất quán.

### 4. Luật thắng Bình Minh (`dawn_survived`)
- Bỏ hoàn toàn nhánh thắng sớm (`all_lit`) khi thắp đủ đèn.
- Ở **Bước 11** của mọi tick: kiểm tra `flames <= 0` (`no_flames`) trước; nếu còn sống và `timeLeftS <= 0`, kiểm tra `litCount >= ceil(0.6 * total)` → thắng (`dawn_survived`, cộng `+50 + floor(fuel)` mỗi đèn sáng + `+50` mỗi Ngọn Lửa) hoặc thua (`dawn`).
