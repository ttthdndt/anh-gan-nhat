'use strict';
const apiBase = (window.APP_CONFIG?.apiBase || '').replace(/\/$/, '');
const accessKey = decodeURIComponent(location.hash.slice(1));
const photo = document.getElementById('photo');
const empty = document.getElementById('empty');
const statusEl = document.getElementById('status');
const connection = document.getElementById('connection');
const updated = document.getElementById('updated');
const download = document.getElementById('download');
let lastEtag = '';
let lastBlobUrl = '';
let working = false;
function configured() { return apiBase.startsWith('https://') && !apiBase.includes('THAY-BANG') && accessKey.length >= 12; }
async function refresh() {
  if (working || !configured()) return;
  working = true;
  try {
    const headers = {'X-Access-Key': accessKey};
    if (lastEtag) headers['If-None-Match'] = lastEtag;
    const response = await fetch(apiBase + '/api/latest?t=' + Date.now(), {headers, cache: 'no-store'});
    if (response.status === 304) { connection.textContent = '● Đã kết nối · Đang theo dõi'; return; }
    if (response.status === 404) {
      if (!lastBlobUrl) statusEl.textContent = 'Chưa có ảnh. Hãy chọn ảnh từ điện thoại.';
      connection.textContent = '● Đã kết nối · Chưa có ảnh';
      return;
    }
    if (!response.ok) {
      let info = {};
      try { info = await response.json(); } catch (_) {}
      throw new Error(info.error || 'HTTP ' + response.status);
    }
    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) throw new Error('Máy chủ không trả về ảnh.');
    const newUrl = URL.createObjectURL(blob);
    const oldUrl = lastBlobUrl;
    lastBlobUrl = newUrl;
    photo.src = newUrl;
    photo.hidden = false;
    empty.hidden = true;
    download.href = newUrl;
    download.hidden = false;
    lastEtag = response.headers.get('etag') || '';
    connection.textContent = '● Đã nhận ảnh mới';
    updated.textContent = 'Nhận được bản ảnh mới lúc ' + new Date().toLocaleTimeString('vi-VN') + '. Trang vẫn tự kiểm tra 8 giây/lần.';
    if (oldUrl) URL.revokeObjectURL(oldUrl);
  } catch (error) {
    connection.textContent = '● Lỗi kết nối';
    if (!lastBlobUrl) statusEl.textContent = 'Không tải được ảnh: ' + (error?.message || 'Lỗi không xác định');
    updated.textContent = 'Lỗi: ' + (error?.message || 'Không rõ nguyên nhân') + '. Sẽ thử lại tự động.';
  } finally { working = false; }
}
document.getElementById('refresh').addEventListener('click', refresh);
if (!configured()) {
  connection.textContent = '● Chưa cấu hình';
  statusEl.textContent = 'Cần cấu hình Worker và mở URL riêng có khóa truy cập.';
} else { refresh(); setInterval(refresh, 8000); }
