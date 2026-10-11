# 🎬 Chill Player - Trình Phát Video & Media Đỉnh Cao (Hệ Sinh Thái NKI)

Ứng dụng phát Video, Media và Audio cá nhân siêu nhẹ, mượt mà, **100% không quảng cáo, không thu phí**, kế thừa trọn vẹn tinh hoa của **MX Player** và mang **100% ADN thiết kế của hệ sinh thái NKI** (viền kim loại bạc squircle kép, nền trắng/đen tinh tế, nút Play và dải sóng âm Equalizer xanh ngọc lục bảo).

---

## 🌟 Tính Năng Cốt Lõi

### 1. 👆 Cử Chỉ Vuốt Thông Minh (Gesture Controls Chuẩn MX Player)
* **Vuốt cạnh phải màn hình:** Điều chỉnh âm lượng mượt mà, hỗ trợ **Audio Boost lên tới 200%** (khuếch đại âm thanh vượt ngưỡng loa ngoài).
* **Vuốt cạnh trái màn hình:** Điều chỉnh độ sáng màn hình độc lập không phụ thuộc cài đặt hệ thống.
* **Vuốt ngang màn hình:** Tua nhanh/lùi video với hiển thị mốc thời gian thời gian thực chính xác từng giây.
* **Chạm đúp (Double Tap):**
  * Chạm đúp bên trái: Lùi 10 giây (kèm hiệu ứng ripple).
  * Chạm đúp bên phải: Tới 10 giây (kèm hiệu ứng ripple).
  * Chạm đúp giữa màn hình: Tạm dừng / Phát tiếp.
* **Nút Khóa Màn Hình (Screen Lock):** Khóa toàn bộ cảm ứng chống chạm nhầm khi đang xem phim, nằm xem hoặc bỏ túi nghe nhạc.

### 2. 🔊 Khuếch Đại Âm Lượng 200% (Audio Boost) & Bộ Cân Bằng (Equalizer)
* **Audio Boost 200%:** Sử dụng Web Audio API GainNode chuyên dụng để kích âm thanh các video quay nhỏ tiếng hoặc nguồn phim thu âm kém.
* **Bộ Cân Bằng Âm Thanh (Equalizer Presets):**
  * **Tăng Bass (Bass Boost):** Thích hợp nghe nhạc EDM, phim hành động, cháy nổ sống động.
  * **Giọng Nói (Vocal):** Làm rõ lời thoại nhân vật trong phim tài liệu, bài giảng.
  * **Điện Ảnh (Movie):** Cân bằng âm thanh vòm sống động.
  * **Chuẩn (Flat):** Giữ nguyên âm bản gốc.

### 3. 💬 Quản Lý Phụ Đề Đa Định Dạng (.SRT, .VTT, .ASS)
* Hỗ trợ tải file phụ đề rời nhanh chóng từ bộ nhớ máy.
* **Căn chỉnh độ trễ thời gian thực (+/- 250ms, Reset):** Khớp lời thoại phim ngay lập tức nếu phụ đề bị lệch so với tiếng.
* Tùy biến kích thước phông chữ và màu sắc phụ đề hiển thị nổi bật trên nền phim tối.

### 4. 🔲 Thu Nhỏ Màn Hình (Picture-in-Picture) & Đa Tỉ Lệ Khung Hình
* **Picture-in-Picture (PiP):** Thu nhỏ video thành một cửa sổ nổi tiện lợi để vừa xem phim vừa lướt web, làm việc khác.
* **Tỉ Lệ Khung Hình Linh Hoạt:**
  * **Fit:** Vừa vặn màn hình giữ nguyên tỉ lệ gốc.
  * **Fill / Crop:** Tràn viền toàn màn hình điện thoại (loại bỏ dải đen 2 bên).
  * **Stretch:** Kéo giãn 100%.
  * **16:9 & 4:3:** Chuẩn màn hình rạp chiếu hoặc tivi cổ điển.

### 5. 🌐 Phát Luồng Trực Tuyến (Network Stream) & Định Dạng Rộng Rãi
* Hỗ trợ phát trực tiếp các đường link HLS (`.m3u8`), MP4, MKV, WebM, AVI, FLV, MP3, FLAC...
* Tích hợp bộ giải mã Hls.js độ trễ thấp chuyên nghiệp.

### 6. 🌙 Hẹn Giờ Tắt (Sleep Timer) & Lưu Tiến Độ Thông Minh
* Hẹn giờ tắt nhạc/phim sau 15p, 30p, 45p, 60p giúp bạn an tâm đi ngủ không sợ máy chạy suốt đêm hao pin.
* Tự động lưu tiến độ xem dở chính xác đến từng giây vào IndexedDB, dễ dàng xem tiếp bất cứ lúc nào.

### 7. 🔄 Cập Nhật 1-Chạm Trong App (GitHub Actions CI/CD)
* Ứng dụng tự động tăng `versionCode` và `versionName` (`v1.0.${RUN_NUMBER}`) mỗi lần đẩy code lên GitHub.
* Tự động kiểm tra và tải file cài đặt APK mới nhất trực tiếp trong mục **Cài đặt**.

---

## 📱 Cài Đặt Lên Điện Thoại Android

```bash
npm install
npm run build
npx cap add android
npx cap sync android
```
Mở Android Studio bằng `npx cap open android` hoặc build trực tiếp file APK thông qua GitHub Actions.
