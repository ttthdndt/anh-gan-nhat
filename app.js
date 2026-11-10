(() => {
  "use strict";
  const mode = document.body.dataset.mode;
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const prefix = "anhgan-v1-";
  const $ = id => document.getElementById(id);
  const status = (message, level = "") => {
    const root = $("status");
    $("statusText").textContent = message;
    root.className = "status " + level;
  };
  const makeCode = () => {
    const values = new Uint8Array(10);
    crypto.getRandomValues(values);
    return Array.from(values, v => alphabet[v % alphabet.length]).join("");
  };
  const normalCode = value => (value || "").trim().replace(/^#/, "").toUpperCase();
  const validCode = value => /^[A-HJ-NP-Z2-9]{10}$/.test(value);
  const base = new URL("./", location.href);
  let peer;

  if (typeof Peer !== "function") {
    status("Không tải được thư viện PeerJS. Kiểm tra Internet hoặc trình chặn nội dung.", "error");
    return;
  }

  if (mode === "view") {
    let connection = null;
    let transfer = null;
    let currentImageUrl = null;
    let code = normalCode(location.hash.slice(1));
    if (!validCode(code)) {
      code = makeCode();
      history.replaceState(null, "", "#" + code);
    }
    const sendUrl = new URL("send.html", base);
    sendUrl.hash = code;
    $("roomCode").textContent = code;
    $("senderUrl").textContent = sendUrl.href;
    $("copyUrl").addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(sendUrl.href); $("copyUrl").textContent = "Đã sao chép"; }
      catch { status("Không sao chép tự động được. Hãy chọn URL ở trên.", "error"); }
    });
    $("newRoom").addEventListener("click", () => {
      location.hash = makeCode();
      location.reload();
    });

    peer = new Peer(prefix + code.toLowerCase());
    peer.on("open", () => status("Sẵn sàng nhận ảnh. Hãy mở URL trên điện thoại.", "ready"));
    peer.on("disconnected", () => status("Mất kết nối dịch vụ ghép đôi. Đang thử khôi phục…"));
    peer.on("error", error => status("Lỗi: " + (error?.message || error?.type || "Không xác định") + ". Thử mã phòng mới.", "error"));
    peer.on("connection", conn => {
      if (connection?.open) { conn.on("open", () => conn.close()); return; }
      connection = conn;
      transfer = null;
      status("Điện thoại đang kết nối…");
      conn.on("open", () => status("Đã kết nối điện thoại. Đang chờ chọn ảnh.", "ready"));
      conn.on("data", async data => {
        if (!data || typeof data !== "object") return;
        if (data.kind === "meta") {
          if (typeof data.id !== "string" || data.mime !== "image/jpeg" || !Number.isInteger(data.total) || data.total < 1 || data.total > 500 || !Number.isInteger(data.size) || data.size < 1 || data.size > 6_000_000) return;
          transfer = {id:data.id,total:data.total,size:data.size,parts:new Array(data.total),count:0};
          status("Đang nhận ảnh…");
        } else if (data.kind === "chunk") {
          if (!transfer || data.id !== transfer.id || !Number.isInteger(data.index) || data.index < 0 || data.index >= transfer.total) return;
          if (!(data.bytes instanceof ArrayBuffer) && !ArrayBuffer.isView(data.bytes)) return;
          if (!transfer.parts[data.index]) { transfer.parts[data.index] = data.bytes; transfer.count++; }
        } else if (data.kind === "end") {
          if (!transfer || data.id !== transfer.id || transfer.count !== transfer.total) { status("Ảnh truyền chưa đủ. Hãy chọn lại.", "error"); return; }
          const done = transfer;
          transfer = null;
          const blob = new Blob(done.parts, {type:"image/jpeg"});
          if (blob.size !== done.size) { status("Ảnh chưa nhận đủ dữ liệu. Vui lòng thử lại.", "error"); return; }
          if (currentImageUrl) URL.revokeObjectURL(currentImageUrl);
          currentImageUrl = URL.createObjectURL(blob);
          $("receivedImage").src = currentImageUrl;
          $("receivedImage").hidden = false;
          $("downloadLink").href = currentImageUrl;
          $("downloadLink").classList.remove("hidden");
          $("receivedInfo").textContent = "Đã nhận ảnh • " + (blob.size / 1024).toFixed(0) + " KB • " + new Date().toLocaleTimeString("vi-VN");
          status("Đã nhận ảnh thành công.", "ready");
          if (conn.open) conn.send({kind:"ack", id:done.id});
        }
      });
      conn.on("close", () => { if (connection === conn) { connection = null; status("Điện thoại đã ngắt. Sẵn sàng nhận kết nối khác.", "ready"); } });
      conn.on("error", () => status("Kết nối nhận ảnh bị lỗi.", "error"));
    });
  }

  if (mode === "send") {
    const input = $("photoInput");
    const photoStatus = text => { $("photoStatus").textContent = text; };
    let room = normalCode(location.hash.slice(1));
    let conn = null;
    let pending = null;
    let sending = false;
    let audioContext;

    function ting(count = 1) {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        audioContext ||= new AudioCtx();
        audioContext.resume().catch(() => {});
        for (let i = 0; i < count; i++) {
          const osc = audioContext.createOscillator();
          const gain = audioContext.createGain();
          const start = audioContext.currentTime + i * .18;
          osc.type = "sine"; osc.frequency.value = i === 0 ? 1047 : 1319;
          gain.gain.setValueAtTime(0.0001, start);
          gain.gain.exponentialRampToValueAtTime(0.14, start + .012);
          gain.gain.exponentialRampToValueAtTime(0.0001, start + .12);
          osc.connect(gain).connect(audioContext.destination);
          osc.start(start); osc.stop(start + .13);
        }
      } catch { /* Audio có thể bị trình duyệt chặn */ }
    }

    async function compressImage(file) {
      const bitmap = await createImageBitmap(file);
      try {
        const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const ctx = canvas.getContext("2d");
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        let blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", .77));
        if (blob && blob.size > 3_000_000) blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", .52));
        if (!blob || blob.size > 6_000_000) throw new Error("Ảnh quá lớn hoặc trình duyệt không hỗ trợ ảnh này.");
        return blob;
      } finally { bitmap.close?.(); }
    }

    peer = new Peer();
    peer.on("open", () => {
      if (validCode(room)) connect(room);
      else status("Chưa có mã phòng. Nhập mã từ máy tính.", "error");
    });
    peer.on("error", error => status("Lỗi kết nối: " + (error?.message || error?.type || "Không xác định"), "error"));
    peer.on("disconnected", () => status("Mất kết nối dịch vụ ghép đôi."));
    const roomInput = $("roomInput");
    roomInput.value = validCode(room) ? room : "";
    if (validCode(room)) $("roomFormSection").classList.add("hidden");
    $("connectRoom").addEventListener("click", () => {
      const next = normalCode(roomInput.value);
      if (!validCode(next)) { status("Mã phòng phải có 10 ký tự theo mã của máy tính.", "error"); return; }
      location.hash = next;
      room = next;
      $("roomFormSection").classList.add("hidden");
      if (peer.open) connect(room);
    });

    function connect(code) {
      if (conn) { try { conn.close(); } catch {} }
      status("Đang kết nối tới máy tính…");
      conn = peer.connect(prefix + code.toLowerCase(), {reliable:true});
      const thisConn = conn;
      conn.on("open", () => {
        status("Đã kết nối máy tính. Chạm vùng xanh rồi chọn ảnh.", "ready");
        if (pending) sendPending();
      });
      conn.on("data", data => {
        if (data?.kind === "ack") {
          photoStatus("Máy tính đã nhận ảnh thành công. Bạn có thể chọn ảnh khác.");
          status("Gửi thành công!", "ready");
          ting(2);
        }
      });
      conn.on("close", () => { if (conn === thisConn) { status("Mất kết nối máy tính. Tải lại trang nếu cần.", "error"); } });
      conn.on("error", () => status("Không kết nối được máy tính. Kiểm tra mã phòng và trang nhận.", "error"));
    }

    $("tapZone").addEventListener("click", () => {
      ting(1);
      input.value = "";
      input.click();
    });
    input.addEventListener("change", async () => {
      if (!input.files?.length) { photoStatus("Chưa chọn ảnh."); return; }
      const file = input.files[0];
      if (!file.type.startsWith("image/")) { photoStatus("Vui lòng chọn tệp ảnh."); return; }
      photoStatus("Đang chuẩn bị ảnh: " + file.name);
      try {
        pending = await compressImage(file);
        photoStatus("Đã chọn ảnh. Đang gửi hoặc đợi máy tính kết nối…");
        await sendPending();
      } catch(error) { photoStatus("Không xử lý được ảnh: " + (error?.message || "Lỗi")); }
    });

    async function sendPending() {
      if (sending || !conn?.open || !pending) return;
      sending = true;
      const blob = pending;
      pending = null;
      const currentConn = conn;
      const id = crypto.randomUUID?.() || String(Date.now()) + Math.random();
      try {
        const buffer = await blob.arrayBuffer();
        const chunkSize = 12_000;
        const total = Math.ceil(buffer.byteLength / chunkSize);
        if (total > 500) throw new Error("Ảnh vượt giới hạn truyền.");
        currentConn.send({kind:"meta",id,mime:"image/jpeg",size:blob.size,total});
        for (let i = 0; i < total; i++) {
          if (!currentConn.open) throw new Error("Mất kết nối máy tính.");
          const channel = currentConn.dataChannel;
          let waitCount = 0;
          while (channel?.bufferedAmount > 90_000 || currentConn.bufferSize > 18) {
            if (waitCount++ > 400 || !currentConn.open) throw new Error("Gửi ảnh quá lâu hoặc mất kết nối.");
            await new Promise(resolve => setTimeout(resolve, 40));
          }
          currentConn.send({kind:"chunk",id,index:i,bytes:buffer.slice(i*chunkSize,(i+1)*chunkSize)});
          if (i % 20 === 0) photoStatus("Đang gửi ảnh: " + Math.round(i * 100 / total) + "%");
        }
        currentConn.send({kind:"end",id});
        photoStatus("Đã truyền dữ liệu. Đang chờ máy tính xác nhận…");
      } catch (error) {
        photoStatus("Gửi thất bại: " + (error?.message || "Lỗi không xác định") + ". Hãy chọn ảnh lại.");
        status("Gửi ảnh thất bại.", "error");
      } finally {
        sending = false;
        if (pending) sendPending();
      }
    }
  }
})();
