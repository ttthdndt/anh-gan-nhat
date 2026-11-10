'use strict';
const apiBase = (window.APP_CONFIG?.apiBase || '').replace(/\/$/, '');
const accessKey = decodeURIComponent(location.hash.slice(1));
const statusEl = document.getElementById('status');
const tapZone = document.getElementById('tapZone');
const fileInput = document.getElementById('fileInput');
let uploading = false;
let audioCtx = null;

function status(message, kind = '') {
  statusEl.textContent = message;
  statusEl.className = 'send-status ' + kind;
}
function configured() {
  return Boolean(apiBase.startsWith('https://') && !apiBase.includes('THAY-BANG') && accessKey.length >= 12);
}
function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    audioCtx = new AudioContextClass();
  }
  return audioCtx;
}
function note(ctx, start, freq, duration = .14) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine'; osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(.0001, start);
  gain.gain.exponentialRampToValueAtTime(.26, start + .012);
  gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
  osc.connect(gain); gain.connect(ctx.destination);
  osc.start(start); osc.stop(start + duration + .01);
}
function ding(count = 1, autoplay = false) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (autoplay && ctx.state !== 'running') {
      // Trinh duyet co quyen chan am thanh khi chua co lan cham dau tien.
      // Thu resume nhung khong xep hang am thanh cho lan cham sau.
      const started = Date.now();
      ctx.resume().then(() => {
        // Chi phat neu trinh duyet cho phep ngay sau khi tai trang.
        if (Date.now() - started < 1200) note(ctx, ctx.currentTime + .015, 880);
      }).catch(() => {});
      return;
    }
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    const start = ctx.currentTime + .015;
    for (let i = 0; i < count; i++) note(ctx, start + i * .2, i % 2 ? 1047 : 880);
  } catch (_) { /* Thiet bi khong co ho tro am thanh */ }
}

async function compressToJpeg(file) {
  // Xu ly anh tren may truoc khi tai len GitHub, khong gui file goc.
  let source, objectUrl;
  try {
    if (typeof createImageBitmap === 'function') source = await createImageBitmap(file);
    else {
      objectUrl = URL.createObjectURL(file);
      source = await new Promise((resolve, reject) => {
        const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = objectUrl;
      });
    }
    const rawW = source.width || source.naturalWidth;
    const rawH = source.height || source.naturalHeight;
    if (!rawW || !rawH) throw new Error('Không đọc được ảnh.');
    let side = 1450;
    for (let attempt = 0; attempt < 7; attempt++) {
      const scale = Math.min(1, side / Math.max(rawW, rawH));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(rawW * scale));
      canvas.height = Math.max(1, Math.round(rawH * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Không thể xử lý hình ảnh trên máy.');
      context.drawImage(source, 0, 0, canvas.width, canvas.height);
      const quality = Math.max(.42, .82 - attempt * .07);
      const jpeg = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (!jpeg) throw new Error('Không thể chuyển ảnh sang JPEG.');
      if (jpeg.size < 800_000) return jpeg;
      side = Math.max(600, Math.floor(side * .78));
    }
    throw new Error('Ảnh quá lớn, hãy chọn ảnh khác.');
  } finally {
    if (source && typeof source.close === 'function') source.close();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

tapZone.addEventListener('click', () => {
  ding();
  if (uploading) return;
  if (!configured()) { status('Chưa cấu hình địa chỉ Worker hoặc thiếu khóa trong URL.', 'fail'); return; }
  // Phai click file input dong bo trong su kien cham de trinh duyet mo bo chon anh.
  fileInput.click();
});
fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  if (!file || uploading) return;
  uploading = true;
  status('Đã chọn ảnh. Đang nén và tải lên GitHub...');
  try {
    if (!file.type.startsWith('image/')) throw new Error('Hãy chọn một tệp hình ảnh.');
    const jpg = await compressToJpeg(file);
    const response = await fetch(apiBase + '/api/upload', {
      method: 'POST',
      headers: {'Content-Type': 'image/jpeg', 'X-Access-Key': accessKey},
      body: jpg,
      cache: 'no-store'
    });
    let info = {};
    try { info = await response.json(); } catch (_) {}
    if (!response.ok) throw new Error(info.error || 'Lỗi tải ảnh (HTTP ' + response.status + ').');
    status('ĐÃ GỬI THÀNH CÔNG! Máy tính sẽ tự hiển thị ảnh.', 'success');
    ding(2);
  } catch (error) {
    status('Gửi ảnh thất bại: ' + (error?.message || 'Lỗi không xác định'), 'fail');
    ding(3);
  } finally {
    uploading = false;
    fileInput.value = '';
  }
});

if (!configured()) status('Trang đã mở. Cần cấu hình Worker + khóa truy cập trong URL.', 'fail');
// Khi TalkBack duoc bat, dong thong bao co the duoc doc thanh tieng.
if (configured()) setTimeout(() => status('Trang đã tải xong. Chạm bất kỳ đâu để mở bộ chọn ảnh.'), 400);
// Thu phat ting ngay luc website tai xong. Chrome Android co the chan truoc lan cham dau.
ding(1, true);
