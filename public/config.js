// Cấu hình địa chỉ máy chủ game (WebSocket).
// - Chỉ dùng Render, hoặc chạy `npm start` trên laptop: để nguyên, trang tự nối về chính máy chủ đang mở nó.
// - Giao diện trên Vercel + máy chủ trên Render: điền RENDER_URL. Chỉ trang mở từ tên miền Vercel mới
//   nối sang Render; trang mở từ Render hoặc từ laptop vẫn dùng máy chủ của chính nó.
(function () {
  const RENDER_URL = 'https://mln122-co-ty-phu.onrender.com'; // để '' nếu không dùng Vercel
  const VERCEL_HOST = /\.vercel\.app$/; // dùng tên miền riêng trên Vercel thì thêm vào đây, ví dụ /\.vercel\.app$|^game\.example\.com$/
  const onVercel = VERCEL_HOST.test(location.hostname);
  if (onVercel && !RENDER_URL) console.error('Chưa điền RENDER_URL trong public/config.js nên trang trên Vercel không nối được máy chủ game.');
  window.GAME_CONFIG = {
    WS_URL: onVercel && RENDER_URL ? RENDER_URL.replace(/^http/, 'ws').replace(/\/+$/, '') + '/ws' : '',
  };
})();
