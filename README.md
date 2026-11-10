# Ảnh gần nhất — chỉ 2 giao diện, lưu ảnh vào GitHub

## Hoạt động

- `send.html`: trang điện thoại. Thử phát âm thanh ting khi mở, chạm vào bất kỳ đâu sẽ có ting và mở trình chọn ảnh của Android. Chọn ảnh xong sẽ tự nén JPEG và tải lên GitHub.
- `view.html`: trang máy tính. Tự động hiển thị **duy nhất ảnh mới nhất** và kiểm tra thay đổi mỗi 8 giây. Không mã phòng, không kết nối peer-to-peer, máy tính không cần bật trước.
- Ảnh luôn được ghi đè tại `uploads/latest.jpg` trong **repository GitHub riêng tư** của bạn.
- Không có cách hợp lệ để tự lấy ảnh gần nhất khỏi điện thoại mà không chọn tệp. Và Chrome Android có thể **chặn âm thanh autoplay khi vừa mở web**; tiếng ting đầu tiên chỉ đáng tin cậy hơn sau khi bạn chạm.

## Cần có 2 dịch vụ: GitHub Pages + Cloudflare Worker

GitHub Pages chỉ chạy web tĩnh; nó **không nhận được file upload trực tiếp**. Worker nhận ảnh và ghi chúng vào GitHub bằng API; GitHub token được giữ trong **Worker Secrets**, không đưa vào JavaScript của trang công khai.

### A. Trên GitHub — 2 repository

1. Tạo repository **Private** tên `anh-gan-nhat-photos` (để lưu ảnh; ảnh có thể riêng tư). Không bật Pages cho repo này.
2. Vào GitHub **Settings → Developer settings → Personal access tokens → Fine-grained tokens**. Tạo token chỉ có quyền đối với repo `anh-gan-nhat-photos`, quyền **Contents: Read and write**. Lưu token ở nơi an toàn, không đưa vào repository, không gửi cho người khác.
3. Tạo repository **Public** tên `anh-gan-nhat` (để lưu web). Upload các tệp trong thư mục gốc: `index.html`, `send.html`, `view.html`, `style.css`, `send.js`, `view.js`, `config.js`, `.nojekyll`. Có thể upload cả README và `worker/worker.mjs` (KHÔNG upload token).
4. Trong repo `anh-gan-nhat` → **Settings → Pages → Deploy from a branch → main / (root) → Save**.

### B. Trên Cloudflare — tạo Worker

1. Vào https://dash.cloudflare.com/ → **Workers & Pages** → tạo Worker mới, đặt tên tùy chọn như `anh-gan-nhat-api`.
2. Dán toàn bộ nội dung `worker/worker.mjs` vào Worker Editor (JavaScript ES module), **Deploy**.
3. Trong Settings → Variables and Secrets, thêm:

| Biến | Loại | Giá trị |
|---|---|---|
| `REPO_OWNER` | Text | Tên tài khoản GitHub của bạn |
| `REPO_NAME` | Text | `anh-gan-nhat-photos` |
| `SITE_ORIGIN` | Text | `https://TEN-USER.github.io` (không thêm `/anh-gan-nhat`) |
| `GITHUB_TOKEN` | **Secret** | Token fine-grained ở bước A2 |
| `ACCESS_KEY` | **Secret** | Một chuỗi bí mật dài ít nhất 16 ký tự do bạn tự tạo, ví dụ chọn bằng trình tạo mật khẩu; dùng cùng chuỗi này cho cả hai URL |

4. Đảm bảo Worker đã được deploy sau khi lưu biến. URL Worker có dạng `https://anh-gan-nhat-api.YOUR-SUBDOMAIN.workers.dev`.

### C. Nối GitHub Pages và Worker

1. Mở `config.js` trong repo web `anh-gan-nhat` (nhấn biểu tượng bút chì để sửa).
2. Thay `https://THAY-BANG-WORKER-CUA-BAN.workers.dev` thành URL Worker thật; Commit changes.
3. Sau khi trang Pages cập nhật, dùng hai đường dẫn sau. **Thay** `TEN-USER` bằng username của bạn và `KHOA-CUA-BAN` bằng giá trị `ACCESS_KEY`:

**Điện thoại (chọn ảnh và upload):**

`https://TEN-USER.github.io/anh-gan-nhat/send.html#KHOA-CUA-BAN`

**Máy tính (xem ảnh mới nhất):**

`https://TEN-USER.github.io/anh-gan-nhat/view.html#KHOA-CUA-BAN`

Chuỗi sau dấu `#` là **khóa truy cập cố định nằm trong URL**, không phải mã phòng; không cần nhập mã trong giao diện, không phải ghép đôi, không đổi sau mỗi lần sử dụng. Khóa này không được gửi tới GitHub Pages khi tải trang nhưng được trang dùng để xác thực API. Giữ bí mật cả hai URL.

## Dùng trên iQOO Neo 9 màn hình đen

1. Đầu tiên thử trên điện thoại **còn màn hình** để chắc chắn đường dẫn và upload đã hoạt động.
2. Kết nối bàn phím OTG, mở Chrome, nhập chính xác URL `send.html#...`, nhấn Enter.
3. Trang **thử** phát tiếng `ting` lúc tải, nhưng Chrome có thể chặn trước lần chạm đầu tiên. **Chạm bất kỳ đâu** để nghe ting và mở bộ chọn ảnh.
4. Dùng **TalkBack** nếu cần để biết bộ chọn ảnh đang ở đâu. **Bắt buộc chọn ảnh** và xác nhận. Không thể tự lấy ảnh mới nhất không qua thao tác đó.
5. Khi gửi thành công, máy phát **2 tiếng ting**; lỗi sẽ có 3 tiếng.
6. Máy tính mở URL `view.html#...`, ảnh tự hiển thị sau tối đa khoảng 8 giây, tùy mạng.

## Quyền riêng tư và giới hạn

- Ảnh được chuyển thành JPEG tối đa khoảng 800 KB (có thể giảm chất lượng); chỉ lưu ảnh mới nhất tại `uploads/latest.jpg`. GitHub vẫn có thể giữ bản cũ trong **lịch sử commit**. Nếu ảnh nhạy cảm, không xem cách này là "xóa hoàn toàn" khi có bản mới.
- Sử dụng repo ảnh **Private**, không lưu token trên web public. Người có đường dẫn kèm khóa truy cập có thể đọc và tải lên ảnh: giữ kín URL.
- URL phía GitHub Pages cần HTTPS để tải tới Worker HTTPS. Worker phải có đúng `SITE_ORIGIN`.
- Gói miễn phí GitHub/Cloudflare có giới hạn sử dụng. Việc kiểm tra mỗi 8 giây tạo nhiều lượt đọc GitHub API; không nên mở hàng chục tab liên tục.
- Đây là công cụ chia sẻ ảnh được chọn thủ công, **không phải** screen mirror hay ảnh chụp màn hình tự động.
- Chưa được triển khai lên tài khoản GitHub/Cloudflare hoặc kiểm thử thực tế trên iQOO Neo 9 của bạn.
