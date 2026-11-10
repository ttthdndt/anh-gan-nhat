// Cloudflare Worker trung chuyen anh va luu duy nhat uploads/latest.jpg trong GitHub.
// REPO_OWNER, REPO_NAME, SITE_ORIGIN la Variables; GITHUB_TOKEN va ACCESS_KEY la Secrets.
const PHOTO_PATH = 'uploads/latest.jpg';
const MAX_BYTES = 900_000;
const encoder = new TextEncoder();
function equalSecret(a, b) {
  const x = encoder.encode(a || '');
  const y = encoder.encode(b || '');
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] || 0) ^ (y[i] || 0);
  return diff === 0 && x.length > 0;
}
function corsHeaders(origin, env) {
  const h = new Headers({
    'Cache-Control':'no-store',
    'Vary':'Origin',
    'Access-Control-Allow-Headers':'X-Access-Key, Content-Type, If-None-Match',
    'Access-Control-Allow-Methods':'GET,POST,OPTIONS',
    'Access-Control-Expose-Headers':'ETag'
  });
  if (origin && origin === env.SITE_ORIGIN) h.set('Access-Control-Allow-Origin', origin);
  return h;
}
function json(body, status, headers) { const h = new Headers(headers); h.set('Content-Type','application/json; charset=utf-8'); return new Response(JSON.stringify(body), {status, headers:h}); }
function githubHeaders(env) { return {
  'Authorization':'Bearer ' + env.GITHUB_TOKEN,
  'Accept':'application/vnd.github+json',
  'X-GitHub-Api-Version':'2022-11-28',
  'User-Agent':'AnhGanNhat-Private-Upload'
}; }
function githubUrl(env) { return 'https://api.github.com/repos/' + encodeURIComponent(env.REPO_OWNER) + '/' + encodeURIComponent(env.REPO_NAME) + '/contents/' + PHOTO_PATH; }
async function getGithubFile(env) {
  const res = await fetch(githubUrl(env), {headers: githubHeaders(env), cache:'no-store'});
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('GitHub API status ' + res.status);
  return res.json();
}
function base64ToBytes(base64) {
  const s = atob(base64.replace(/\s/g, ''));
  const output = new Uint8Array(s.length);
  for (let i=0;i<s.length;i++) output[i] = s.charCodeAt(i);
  return output;
}
function bytesToBase64(bytes) {
  let binary = '';
  for (let i=0;i<bytes.length;i+=0x4000) {
    binary += String.fromCharCode(...bytes.subarray(i,i+0x4000));
  }
  return btoa(binary);
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const headers = corsHeaders(origin, env);
    if (request.method === 'OPTIONS') {
      if (origin !== env.SITE_ORIGIN) return json({error:'Origin không được phép.'},403,headers);
      return new Response(null,{status:204,headers});
    }
    if (!env.GITHUB_TOKEN || !env.ACCESS_KEY || !env.REPO_OWNER || !env.REPO_NAME || !env.SITE_ORIGIN) return json({error:'Worker chưa cấu hình đầy đủ.'},503,headers);
    if (!equalSecret(request.headers.get('X-Access-Key'), env.ACCESS_KEY)) return json({error:'Khóa truy cập không đúng.'},401,headers);
    // Ngăn trang web thu ba tu dung browser gui anh; secret luon duoc kiem tra rieng.
    if (origin && origin !== env.SITE_ORIGIN) return json({error:'Trang nguồn không được phép.'},403,headers);
    try {
      if (url.pathname === '/api/latest' && request.method === 'GET') {
        const file = await getGithubFile(env);
        if (!file) return json({error:'Chưa có ảnh.'},404,headers);
        const etag = '"' + file.sha + '"';
        headers.set('ETag', etag);
        if (request.headers.get('If-None-Match') === etag) return new Response(null,{status:304,headers});
        if (file.encoding !== 'base64' || !file.content) return json({error:'Không thể đọc ảnh lưu trữ.'},502,headers);
        headers.set('Content-Type','image/jpeg');
        return new Response(base64ToBytes(file.content),{status:200,headers});
      }
      if (url.pathname === '/api/upload' && request.method === 'POST') {
        if (request.headers.get('Content-Type')?.split(';')[0].trim() !== 'image/jpeg') return json({error:'Chỉ cho phép ảnh JPEG.'},415,headers);
        const length = Number(request.headers.get('Content-Length') || 0);
        if (length > MAX_BYTES) return json({error:'Ảnh quá lớn.'},413,headers);
        const bytes = new Uint8Array(await request.arrayBuffer());
        if (bytes.length < 4 || bytes.length > MAX_BYTES) return json({error:'Kích thước ảnh không hợp lệ.'},413,headers);
        if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[bytes.length-2] !== 0xff || bytes[bytes.length-1] !== 0xd9) return json({error:'Tệp không phải JPEG hợp lệ.'},415,headers);
        const existing = await getGithubFile(env);
        const payload = {message:'Cập nhật ảnh mới nhất', content:bytesToBase64(bytes)};
        if (existing?.sha) payload.sha = existing.sha;
        const result = await fetch(githubUrl(env), {
          method:'PUT',
          headers:{...githubHeaders(env),'Content-Type':'application/json'},
          body:JSON.stringify(payload)
        });
        if (!result.ok) {
          const hint = result.status === 409 ? 'Có xung đột cập nhật, vui lòng thử lại.' : ('GitHub từ chối ghi ảnh (HTTP ' + result.status + ').');
          return json({error:hint},502,headers);
        }
        return json({ok:true},200,headers);
      }
      return json({error:'Đường dẫn không tồn tại.'},404,headers);
    } catch (err) {
      return json({error:'Lỗi dịch vụ ảnh: ' + (err?.message || 'không rõ')},502,headers);
    }
  }
};
