# 📚 Chill Reader - Ứng Dụng Đọc & Nghe Truyện Đa Nền Tảng

Ứng dụng đọc truyện chữ và nghe Audio (Text-to-Speech) cá nhân siêu nhẹ, mượt mà, **không quảng cáo, không nạp thẻ**, chạy đồng bộ thời gian thực trên cả **Máy tính (Laptop/PC), Điện thoại (Android/iOS) và Tablet**.

---

## 🌟 Tính Năng Cốt Lõi

### 1. ☁️ Đồng Bộ Trực Tuyến Đa Thiết Bị (Supabase Cloud Sync)
* **Đồng bộ thời gian thực 2 chiều**: Đang đọc hoặc nghe audio dở chương 12 trên máy tính, mở điện thoại ra là tự động nhảy đúng chương 12 ngay lập tức.
* **Miễn phí 100% qua Supabase**: Không tốn chi phí máy chủ, sử dụng gói Free vĩnh viễn của Supabase (500MB database, 50.000 users).
* **Sao lưu Offline dự phòng**: Hỗ trợ xuất và nhập file `chill_reader_backup.json` một chạm mà không cần đăng ký tài khoản.

### 2. 📥 Nạp File Thông Minh & Tự Động Phân Chương
* **File `.TXT` nguyên khối**: Thuật toán Regex nhận diện tiêu đề chương thông minh (Chương 1, Hồi 2, Quyển 3...) tự động tách thành từng chương riêng biệt. Cơ chế phân đoạn tự động dự phòng nếu truyện không đánh số.
* **File `.EPUB`**: Bóc tách mục lục chuẩn, giữ nguyên chương hồi và ảnh bìa gốc.
* **File `.PDF`**: Trích xuất lớp văn bản (Text Layer) tự động; cảnh báo nếu gặp file scan ảnh chụp không có chữ số hoá.

### 3. 🎙️ Trình Nghe Audio TTS Đỉnh Cao
* **Hỗ trợ giọng đọc tiếng Việt**: Tự động nhận diện giọng đọc tiếng Việt chất lượng cao của Google / Microsoft / thiết bị.
* **Đồng bộ câu đọc trực quan**: Đọc đến câu nào, câu đó sáng đèn (`tts-highlight`) và trang sách tự động cuộn theo.
* **Chạm để nghe**: Bấm vào bất kỳ câu nào trên trang sách để nghe ngay từ câu đó.
* **Chạy ngầm khi tắt màn hình**: Sử dụng cơ chế Silent Audio Loop và MediaSession API để nghe liên tục khi màn hình tắt hoặc khoá máy.
* **Điều khiển tại màn hình khoá & tai nghe Bluetooth**: Hỗ trợ Play, Pause, Tua lùi, Tua tới, Đổi chương.
* **Hẹn giờ tắt (Sleep Timer)**: Tự tắt sau 15p, 30p, 45p... giúp bạn ngủ ngon không sợ hết pin.

### 4. 🌐 Cào Truyện Online (Web Crawler)
* Tìm kiếm và cào truyện trực tiếp từ nguồn truyện chữ phổ biến (TruyenFull) về máy.
* Tự động lọc sạch quảng cáo, watermark của web nguồn trước khi lưu.
* Lưu trữ offline trong bộ nhớ máy (IndexedDB) không giới hạn dung lượng.

### 5. 📖 Trải Nghiệm Đọc Thư Giãn (Chill Reader)
* **Giao diện đa dạng**: Vàng giấy cổ điển (Sepia bảo vệ mắt), Ban đêm (Dark dịu mắt), OLED Amoled (Đen kịt tiết kiệm pin), Trắng sáng.
* **Typography đẹp**: Phông chữ Lora, Merriweather, Be Vietnam Pro, tuỳ biến cỡ chữ, dãn dòng.
* **Tủ sách cá nhân**: Quản lý truyện đang đọc, yêu thích, lưu chính xác tiến độ %.

---

## 🚀 Hướng Dẫn Deploy Lên Web Miễn Phí (Vercel)

Dự án đã có sẵn file cấu hình `vercel.json`. Bạn có thể đưa app lên web để truy cập từ bất cứ đâu qua các bước sau:

### Cách 1: Deploy qua GitHub (Khuyên dùng)
1. Khởi tạo Git và đẩy mã nguồn lên GitHub của bạn:
   ```bash
   git init
   git add .
   git commit -m "Deploy Chill Reader"
   git branch -M main
   git remote add origin https://github.com/TÊN_GITHUB_CỦA_BẠN/chill-reader.git
   git push -u origin main
   ```
2. Truy cập [vercel.com](https://vercel.com) $\rightarrow$ Đăng nhập bằng tài khoản GitHub.
3. Chọn **Add New Project** $\rightarrow$ Import repository `chill-reader` $\rightarrow$ Bấm **Deploy**.
4. Sau 30 giây, bạn sẽ nhận được địa chỉ web riêng, ví dụ:  
   👉 `https://chill-reader.vercel.app`

### Cách 2: Deploy trực tiếp bằng lệnh
```bash
npx.cmd vercel
```
Làm theo các bước hướng dẫn trên terminal là ứng dụng sẽ online ngay!

---

## ⚡ Thiết Lập Đồng Bộ Cloud Miễn Phí (Supabase)

1. Đăng ký tài khoản miễn phí tại [supabase.com](https://supabase.com) và tạo một **New Project**.
2. Ở thanh menu bên trái, vào mục **SQL Editor** $\rightarrow$ bấm **New Query**.
3. Dán đoạn mã sau rồi bấm **Run**:
   ```sql
   create table if not exists user_stories (
     id text primary key,
     user_id text not null,
     title text not null,
     author text,
     cover_url text,
     description text,
     total_chapters int default 1,
     current_chapter_number int default 1,
     current_progress_percent float default 0,
     current_sentence_index int default 0,
     source text,
     is_favorite boolean default false,
     last_read_at bigint,
     created_at bigint
   );

   alter table user_stories enable row level security;
   create policy "Allow all personal operations" on user_stories for all using (true);
   ```
4. Vào **Project Settings > API**, copy 2 thông tin:
   * **Project URL** (dạng `https://xyz.supabase.co`)
   * **anon public key** (chuỗi ký tự dài bắt đầu bằng `eyJhbG...`)
5. Mở tab **Cài đặt** trong Chill Reader $\rightarrow$ dán 2 thông tin trên vào mục **Đồng bộ Online (Supabase Cloud)** $\rightarrow$ bấm **Kiểm tra kết nối** và **Lưu cấu hình**.

---

## 📱 Cài Đặt Lên Điện Thoại Android

* **Cách 1 (PWA - Nhanh nhất)**: Truy cập đường link Vercel của bạn trên Chrome của điện thoại $\rightarrow$ bấm menu 3 chấm $\rightarrow$ chọn **"Thêm vào Màn hình chính" (Cài đặt ứng dụng)**.
* **Cách 2 (Đóng gói file .APK native qua Capacitor)**:
  ```bash
  npm.cmd install @capacitor/core @capacitor/cli @capacitor/android
  npm.cmd run build
  npx.cmd cap add android
  npx.cmd cap open android
  ```
  *(File `capacitor.config.json` đã được tạo sẵn trong thư mục dự án).*
