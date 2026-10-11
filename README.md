# 🎬 Chill Player - Trình Phát Media visionOS & Két Bảo Mật Ẩn (Hệ Sinh Thái NKI)

Trình phát Video, Media và Audio cá nhân siêu nhẹ, mượt mà, **100% không quảng cáo, không thu phí, không theo dõi**, kế thừa trọn vẹn tinh hoa cử chỉ của **MX Player** kết hợp ngôn ngữ thiết kế **Spatial Glassmorphism (Apple visionOS)** đỉnh cao và tính năng **Két Bí Mật (Private Vault 🔒)** mã hóa AES-256.

---

## 🌟 Tính Năng Đột Phá

### 1. 🥽 Ngôn Ngữ Thiết Kế Apple visionOS (Spatial Glassmorphism)
* **Kính mờ không gian (Frosted Acrylic Blur):** Nền tối sâu thẳm kết hợp hiệu ứng làm mờ phản quang `backdrop-blur-2xl`, viền phản xạ ánh sáng siêu mảnh (`Specular border glow`).
* **Thanh điều hướng nổi (Floating Capsule Dock):** Dock điều hướng hình viên nang lơ lửng ở cạnh dưới màn hình chuẩn hệ điều hành visionOS.
* **Thanh điều khiển lơ lửng (Floating Island Controls):** Toàn bộ các nút Play/Pause, tua 10s, khóa cảm ứng, tỉ lệ khung hình, phụ đề, âm lượng đều nổi bồng bềnh dạng viên nang thủy tinh.

### 2. 🔒 Két Riêng Tư (Private Media Vault) - Mã Hóa AES-256-GCM
* **Ẩn video & nhạc nhạy cảm:** Chuyển tệp từ thư viện công cộng vào Két chỉ với 1-chạm. Tệp sẽ biến mất hoàn toàn khỏi thư viện máy và các ứng dụng quét ảnh/video khác.
* **Mã hóa cấp quân sự AES-256-GCM:** Sử dụng Web Crypto API với hàm dẫn xuất khóa PBKDF2 (100.000 vòng lặp) và vector khởi tạo IV ngẫu nhiên.
* **Bàn phím số PIN kiểu visionOS:** Bàn phím số tròn kính mờ nổi, hiệu ứng rung phản hồi xúc giác (Haptic Touch feedback) và bảo mật mã PIN 6 số.
* **Phát trực tiếp trong bộ nhớ RAM (In-Memory Decryption):** Khi xem phim hoặc nghe nhạc trong Vault, ứng dụng giải mã luồng trực tiếp nạp vào RAM, **không bao giờ ghi tệp giải mã ra bộ nhớ đĩa**, đảm bảo an toàn tuyệt đối.
* **Khôi phục dễ dàng:** Cho phép đưa tệp trở lại thư viện thường hoặc xóa vĩnh viễn khỏi két bất cứ lúc nào.

### 3. 👆 Cử Chỉ Vuốt Thông Minh (Gesture Controls Chuẩn MX Player)
* **Vuốt cạnh phải màn hình:** Điều chỉnh âm lượng mượt mà kèm HUD kính mờ, hỗ trợ **Audio Boost lên tới 200%** (khuếch đại âm thanh vượt ngưỡng loa ngoài).
* **Vuốt cạnh trái màn hình:** Điều chỉnh độ sáng màn hình độc lập với thanh đo thị giác.
* **Vuốt ngang màn hình:** Tua nhanh/lùi video với hiển thị mốc thời gian thời gian thực chính xác từng giây.
* **Chạm đúp (Double Tap):**
  * Chạm đúp bên trái: Lùi 10 giây (kèm hiệu ứng ripple sóng nước).
  * Chạm đúp bên phải: Tới 10 giây (kèm hiệu ứng ripple sóng nước).
  * Chạm đúp giữa màn hình: Tạm dừng / Phát tiếp.
* **Nút Khóa Màn Hình (Screen Lock):** Khóa toàn bộ cảm ứng chống chạm nhầm khi đang xem phim, nằm xem hoặc bỏ túi nghe nhạc.

### 4. 🔊 Khuếch Đại Âm Lượng 200% (Audio Boost) & Bộ Cân Bằng (Equalizer)
* **Audio Boost 200%:** Sử dụng Web Audio API GainNode chuyên dụng để kích âm thanh các video quay nhỏ tiếng hoặc nguồn phim thu âm kém.
* **Bộ Cân Bằng Âm Thanh (Equalizer Presets):**
  * **Tăng Bass (Bass Boost):** Thích hợp nghe nhạc EDM, phim hành động, cháy nổ sống động.
  * **Giọng Nói (Vocal):** Làm rõ lời thoại nhân vật trong phim tài liệu, bài giảng.
  * **Điện Ảnh (Movie):** Cân bằng âm thanh vòm sống động.
  * **Chuẩn (Flat):** Giữ nguyên âm bản gốc.

### 5. 💬 Quản Lý Phụ Đề Đa Định Dạng (.SRT, .VTT)
* Hỗ trợ tải file phụ đề rời nhanh chóng từ bộ nhớ máy.
* **Căn chỉnh độ trễ thời gian thực (+/- 250ms, Reset):** Khớp lời thoại phim ngay lập tức nếu phụ đề bị lệch so với tiếng.
* Tùy biến kích thước phông chữ và màu sắc phụ đề hiển thị nổi bật trên nền phim tối.

### 6. 🔲 Thu Nhỏ Màn Hình (Picture-in-Picture) & Đa Tỉ Lệ Khung Hình
* **Picture-in-Picture (PiP):** Thu nhỏ video thành một cửa sổ nổi tiện lợi để vừa xem phim vừa lướt web, làm việc khác.
* **Tỉ Lệ Khung Hình Linh Hoạt:**
  * **Fit:** Vừa vặn màn hình giữ nguyên tỉ lệ gốc.
  * **Fill / Crop:** Tràn viền toàn màn hình điện thoại (loại bỏ dải đen 2 bên).
  * **Stretch:** Kéo giãn 100%.
  * **16:9 & 4:3:** Chuẩn màn hình rạp chiếu hoặc tivi cổ điển.

### 7. 🌐 Phát Luồng Trực Tuyến (Network Stream) & Định Dạng Rộng Rãi
* Hỗ trợ phát trực tiếp các đường link HLS (`.m3u8`), MP4, MKV, WebM, AVI, FLV, MP3, FLAC...
* Tích hợp bộ giải mã Hls.js độ trễ thấp chuyên nghiệp.

### 8. 🌙 Hẹn Giờ Tắt (Sleep Timer) & Lưu Tiến Độ Thông Minh
* Hẹn giờ tắt nhạc/phim sau 15p, 30p, 45p, 60p giúp bạn an tâm đi ngủ không sợ máy chạy suốt đêm hao pin.
* Tự động lưu tiến độ xem dở chính xác đến từng giây vào IndexedDB, dễ dàng xem tiếp bất cứ lúc nào.

### 9. 🔄 Cập Nhật 1-Chạm Trong App (GitHub Actions CI/CD)
* Ứng dụng tự động tăng `versionCode` và `versionName` (`v1.0.${RUN_NUMBER}`) mỗi lần đẩy code lên GitHub qua GitHub Actions.
* Tự động kiểm tra và tải file cài đặt APK mới nhất trực tiếp trong mục **Cài đặt**.

---

## 📱 Cài Đặt Lên Điện Thoại Android

```bash
npm install
npm run build
npx cap sync android
```
Mở Android Studio bằng `npx cap open android` hoặc đẩy lên nhánh `main` để GitHub Actions tự động build và phát hành file APK cài đặt.
