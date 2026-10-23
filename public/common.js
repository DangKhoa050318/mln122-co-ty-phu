(function () {
  const cfg = window.GAME_CONFIG || {};
  const wsUrl = () => cfg.WS_URL || (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
  // Địa chỉ HTTP của máy chủ game (cùng tên miền, hoặc suy ra từ WS_URL khi giao diện nằm trên Vercel)
  const apiBase = () => (cfg.WS_URL ? cfg.WS_URL.replace(/^ws/, 'http').replace(/\/ws\/?$/, '') : '');
  let offset = 0;

  function connect(opts) {
    let ws, closed = false, tries = 0, ping;
    const api = {
      send(o) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); },
      close() { closed = true; if (ws) ws.close(); },
    };
    function open() {
      ws = new WebSocket(wsUrl());
      ws.onopen = () => {
        tries = 0;
        if (opts.onStatus) opts.onStatus('open');
        api.send(opts.hello());
        clearInterval(ping);
        ping = setInterval(() => api.send({ t: 'ping' }), 20000);
      };
      ws.onmessage = (e) => {
        let m; try { m = JSON.parse(e.data); } catch { return; }
        if (m.t === 'state' && m.s.now) offset = m.s.now - Date.now();
        opts.onMessage(m);
      };
      ws.onclose = () => {
        clearInterval(ping);
        if (opts.onStatus && !closed) opts.onStatus('closed');
        if (!closed) setTimeout(open, Math.min(5000, 700 * ++tries));
      };
    }
    open();
    return api;
  }

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const left = (stage) => (stage && stage.deadline ? Math.max(0, stage.deadline - (Date.now() + offset)) : null);

  // cập nhật mọi thanh đếm ngược có data-dl / data-total
  function tickTimers(stage) {
    document.querySelectorAll('[data-timer]').forEach((el) => {
      const total = Number(el.dataset.total) || 1;
      const l = left(stage);
      const bar = el.firstElementChild;
      el.classList.toggle('paused', !!(stage && stage.paused));
      if (l == null) { bar.style.transform = stage && stage.paused ? bar.style.transform : 'scaleX(1)'; return; }
      bar.style.transform = `scaleX(${Math.min(1, l / total)})`;
    });
    document.querySelectorAll('[data-secs]').forEach((el) => {
      const l = left(stage);
      el.textContent = l == null ? '' : Math.ceil(l / 1000);
    });
  }

  const DUR = { phase: 9000, roll: 20000, moving: 1800, quiz: 20000, quiz_result: 6500, decision: 20000, cartel_vote: 15000, result: 4800 };
  const dieFaces = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  function die(n) {
    let h = '<div class="die">';
    for (let i = 0; i < 9; i++) h += dieFaces[n].includes(i) ? '<b></b>' : '<span></span>';
    return h + '</div>';
  }
  const LETTER = ['A', 'B', 'C', 'D'];

  // ---------- thiết bị ----------
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && window.innerWidth < 900);

  // ---------- phòng & địa chỉ mời ----------
  const cleanCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);

  async function checkRoom(code) {
    try {
      const r = await fetch(apiBase() + '/api/room/' + encodeURIComponent(code), { cache: 'no-store' });
      if (r.status === 404) return { ok: false };
      if (!r.ok) return { ok: null };
      return await r.json();
    } catch (_) { return { ok: null }; } // không kiểm tra được thì vẫn cho vào, WebSocket sẽ báo lỗi
  }

  // Khi host mở trang bằng localhost, điện thoại không vào được địa chỉ đó: thay bằng IP mạng LAN của máy.
  const isLocalHost = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  const net = { lan: [], ip: null };
  try { net.ip = localStorage.getItem('mln_lan') || null; } catch (_) {}
  const netReady = (async () => {
    if (!isLocalHost || cfg.WS_URL) return;
    try {
      const j = await (await fetch(apiBase() + '/api/info', { cache: 'no-store' })).json();
      net.lan = j.lan || [];
      net.port = location.port || j.port;
      if (!net.lan.some((a) => a.ip === net.ip)) net.ip = net.lan.length ? net.lan[0].ip : null;
    } catch (_) {}
  })();
  function siteBase() {
    const here = new URL('.', location.href);
    if (isLocalHost && net.ip) here.host = net.ip + (net.port ? ':' + net.port : '');
    return here.href;
  }
  const joinUrl = (code) => siteBase() + 'j/' + encodeURIComponent(code);
  const prettyUrl = (u) => u.replace(/^https?:\/\//, '').replace(/\/$/, '');
  function setLanIp(ip) { net.ip = ip; try { localStorage.setItem('mln_lan', ip); } catch (_) {} }

  function qrSvg(text) {
    const q = qrcode(0, 'M'); q.addData(text); q.make();
    return q.createSvgTag({ cellSize: 6, margin: 0, scalable: true });
  }

  // ---------- hộp thoại ----------
  function modal(html, opts = {}) {
    closeModal();
    const box = document.createElement('div');
    box.className = 'modal';
    box.id = 'gmodal';
    box.innerHTML = `<div class="note ${opts.cls || ''}" role="dialog" aria-modal="true">${html}</div>`;
    box.addEventListener('click', (e) => {
      if (e.target === box || e.target.closest('[data-close]')) closeModal();
    });
    document.body.appendChild(box);
    const f = box.querySelector('[data-autofocus]') || box.querySelector('button');
    if (f) f.focus();
    if (opts.onOpen) opts.onOpen(box);
    return box;
  }
  function closeModal() { const m = document.getElementById('gmodal'); if (m) m.remove(); }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  function toast(msg, ms = 3000) {
    const d = document.createElement('div');
    d.className = 'toast'; d.setAttribute('role', 'status'); d.textContent = msg; document.body.appendChild(d);
    setTimeout(() => d.remove(), ms);
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (_) { /* http qua IP LAN không có clipboard API */ }
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (_) {}
    ta.remove();
    return ok;
  }

  // Hộp "Mời vào phòng": QR cho điện thoại, mã phòng + địa chỉ cho máy tính.
  async function showInvite(code) {
    await netReady;
    const draw = () => {
      const url = joinUrl(code);
      const site = prettyUrl(siteBase());
      const lanSel = net.lan.length > 1
        ? `<label class="field lanpick"><span>Mạng dùng cho QR</span><select data-lan>${net.lan.map((a) => `<option value="${esc(a.ip)}" ${a.ip === net.ip ? 'selected' : ''}>${esc(a.ip)} · ${esc(a.name)}</option>`).join('')}</select></label>` : '';
      const warn = isLocalHost && !net.ip
        ? '<p class="warnbox">Trang đang mở bằng localhost nên điện thoại không vào được. Hãy mở trang bằng địa chỉ IP của máy trong mạng Wi-Fi.</p>'
        : isLocalHost ? '<p class="sub">Điện thoại và máy tính cần dùng chung mạng Wi-Fi với máy host.</p>' : '';
      return `<div class="invite-head"><h2>Mời vào phòng</h2><button class="btn small ghost" data-close>Đóng</button></div>
        <div class="invite">
          <div class="qr invite-qr">${qrSvg(url)}</div>
          <div class="invite-info">
            <div class="how"><span class="howic" aria-hidden="true">📱</span><div><b>Điện thoại</b><span>Mở camera, quét mã QR</span></div></div>
            <div class="how"><span class="howic" aria-hidden="true">💻</span><div><b>Máy tính</b><span>Vào <b class="num">${esc(site)}</b> rồi nhập mã</span></div></div>
            <div class="roomcode-box"><span class="sub">Mã phòng</span><div class="roomcode">${esc(code)}</div></div>
            <div class="linkrow"><code>${esc(prettyUrl(url))}</code></div>
            <div class="row-btns">
              <button class="btn small" data-copy="${esc(url)}">Sao chép liên kết</button>
              <button class="btn small ghost" data-copy="${esc(code)}">Sao chép mã</button>
              ${navigator.share ? '<button class="btn small ghost" data-share>Chia sẻ…</button>' : ''}
            </div>
            ${lanSel}${warn}
          </div>
        </div>`;
    };
    modal(draw(), {
      cls: 'invite-modal',
      onOpen(box) {
        box.addEventListener('click', async (e) => {
          const c = e.target.closest('[data-copy]');
          if (c) toast((await copyText(c.dataset.copy)) ? 'Đã sao chép' : 'Không sao chép được, hãy chép thủ công');
          if (e.target.closest('[data-share]')) {
            try { await navigator.share({ title: 'Cờ Tỷ Phú MLN122', text: `Vào phòng ${code}`, url: joinUrl(code) }); } catch (_) {}
          }
        });
        box.addEventListener('change', (e) => {
          if (!e.target.matches('[data-lan]')) return;
          setLanIp(e.target.value);
          box.firstElementChild.innerHTML = draw();
          if (window.onLanChange) window.onLanChange();
        });
      },
    });
  }

  window.G = {
    connect, esc, left, tickTimers, DUR, die, LETTER, isMobile, cleanCode, checkRoom,
    netReady, siteBase, joinUrl, prettyUrl, isLocalHost, net, qrSvg, modal, closeModal, toast, copyText, showInvite,
  };
})();
