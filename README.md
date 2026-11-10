# Ảnh Gần Nhất — GitHub Pages

Website tĩnh gửi một ảnh do người dùng **chọn thủ công** từ điện thoại tới máy tính bằng WebRTC. Bản này dùng PeerJS Cloud để ghép đôi hai trình duyệt. **Không cần server Node.js**; ảnh không được lưu trên GitHub.

## Triển khai GitHub Pages

1. Đăng nhập GitHub và tạo repository mới, ví dụ `anh-gan-nhat` (Public nếu dùng GitHub Free).
2. Tải tất cả tệp trong thư mục này lên **thư mục gốc** repository: `index.html`, `send.html`, `view.html`, `app.js`, `style.css`, `.nojekyll`, `README.md`.
3. Vào repository → **Settings** → **Pages** → **Build and deployment** → **Deploy from a branch** → `main` / `(root)` → **Save**.
4. Khi site được publish, URL thường có dạng `https://TEN-USER.github.io/anh-gan-nhat/`.

## Sử dụng

1. Trên máy tính: mở `https://TEN-USER.github.io/anh-gan-nhat/view.html` và **để tab mở**.
2. Trang máy tính sẽ tự sinh mã phòng ngẫu nhiên 10 ký tự và hiển thị URL gửi có dạng `https://TEN-USER.github.io/anh-gan-nhat/send.html#MA-PHONG`.
3. Trên điện thoại iQOO Neo 9 đen màn hình: kết nối bàn phím OTG, mở Chrome rồi nhập **chính xác URL gửi ở bước 2**, nhấn Enter.
4. Khi trang đã tải xong, chạm 1 lần vào vùng xanh: có tiếng "ting" và mở trình chọn ảnh Android. **Vẫn phải chọn một ảnh và xác nhận thủ công**; TalkBack giúp dùng được khi màn hình đen.
5. Nếu gửi thành công và máy tính xác nhận: điện thoại phát **hai tiếng "ting"**; máy tính hiển thị ảnh và có nút tải về.

## Lưu ý

- Chrome Android **không cho website tự đọc ảnh mới nhất** mà không có chọn ảnh. Web cũng không tự chụp màn hình điện thoại.
- Trình duyệt có thể chặn tiếng khi vừa tải URL. Âm thanh chỉ được kích hoạt chắc chắn hơn sau lần chạm đầu tiên và tùy trạng thái âm lượng thiết bị.
- Ghép đôi qua dịch vụ công cộng PeerJS Cloud (`0.peerjs.com`) và thư viện JS từ jsDelivr; cần Internet trên cả hai máy.
- WebRTC truyền ảnh trực tiếp giữa các trình duyệt (có mã hóa kênh). Nếu thiết bị ở mạng hạn chế/NAT nghiêm ngặt, WebRTC có thể không ghép nối được do bản demo không cấu hình TURN.
- Mã phòng nằm trong URL dưới dạng fragment `#...`, không gửi lên GitHub Pages khi tải trang. Không công khai URL gửi có mã phòng. Không tải lên repository ảnh hoặc thông tin riêng tư.
- **Chưa kiểm thử thực tế trên iQOO Neo 9**. Trước tiên nên thử trên điện thoại có màn hình hoạt động để xác nhận luồng gửi/nhận.
- Đây là công cụ gửi **ảnh đã chọn** chứ không phải màn hình thời gian thực. Để xem màn hình đen liên tục, cần giải pháp khác, thường là scrcpy đã được ủy quyền USB Debugging hoặc phần mềm hỗ trợ phản chiếu màn hình.

## Kiểm tra nhanh

Bạn có thể mở `index.html` để xem giao diện nhưng dịch vụ ghép đôi yêu cầu tải được PeerJS và WebRTC; hãy dùng GitHub Pages/HTTPS để thử thực tế. Không cần chạy `npm install` hoặc `node server.js`.
