'use strict';
const path = require('path');
const http = require('http');
const os = require('os');
const express = require('express');
const { WebSocketServer } = require('ws');
const D = require('./data');
const { Game } = require('./game');

const PORT = process.env.PORT || 3000;
const app = express();
const rooms = new Map();
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const cleanCode = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);

// Địa chỉ IPv4 trong mạng LAN, ưu tiên Wi-Fi/Ethernet thật, đẩy card ảo (VMware, VPN...) xuống cuối.
function lanAddresses() {
  const VIRTUAL = /vmware|virtualbox|vbox|hyper-v|vethernet|wsl|docker|loopback|radmin|zerotier|tailscale|hamachi|utun|veth|br-/i;
  const REAL = /wi-?fi|wlan|wireless|^en\d|^eth|ethernet/i;
  const out = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const a of list || []) {
      if ((a.family !== 'IPv4' && a.family !== 4) || a.internal || a.address.startsWith('169.254.')) continue;
      const priv = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a.address);
      const score = (priv ? 2 : 0) + (REAL.test(name) ? 2 : 0) - (VIRTUAL.test(name) ? 4 : 0);
      out.push({ ip: a.address, name, score });
    }
  }
  return out.sort((a, b) => b.score - a.score).map(({ ip, name }) => ({ ip, name }));
}
const isLoopback = (req) => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);

app.get('/healthz', (_req, res) => res.type('text').send('ok'));
app.use('/api', (_req, res, next) => { res.set({ 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' }); next(); });
// Chỉ trả danh sách IP cho chính máy chủ (host mở bằng localhost) để QR trỏ đúng địa chỉ mạng LAN.
app.get('/api/info', (req, res) => res.json({ port: Number(PORT), lan: isLoopback(req) ? lanAddresses() : [] }));
app.get('/api/room/:code', (req, res) => {
  const room = rooms.get(cleanCode(req.params.code));
  if (!room) return res.status(404).json({ ok: false });
  const g = room.game;
  res.json({ ok: true, code: room.code, started: g.started, ended: g.stage.name === 'end', players: g.players.size, teams: g.teams.length });
});
// Link ngắn trong QR / để gõ trên máy tính: /j/ABCD
app.get('/j/:code', (req, res) => res.redirect('/play.html?room=' + encodeURIComponent(cleanCode(req.params.code))));
app.use(express.static(path.join(__dirname, '..', 'public'), { extensions: ['html'] }));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

function newCode() {
  for (;;) {
    let c = '';
    for (let i = 0; i < 4; i++) c += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    if (!rooms.has(c)) return c;
  }
}

const STATIC = {
  tiles: D.TILES, groups: D.GROUPS, teamDefs: D.TEAM_DEFS, phases: D.PHASES,
  consts: { startCash: D.START_CASH, salary: D.SALARY, fdiCost: D.FDI_COST, fdiYield: D.FDI_YIELD, mult: D.MULT },
};

function send(ws, obj) { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); }

function makeRoom(opts) {
  const code = newCode();
  const room = { code, conns: new Set(), hostToken: Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2), last: Date.now(), pending: false };
  room.game = new Game(opts, () => schedule(room));
  rooms.set(code, room);
  return room;
}

function schedule(room) {
  if (room.pending) return;
  room.pending = true;
  setImmediate(() => { room.pending = false; broadcast(room); });
}

function broadcast(room) {
  room.last = Date.now();
  for (const ws of room.conns) {
    const m = ws.meta;
    if (!m) continue;
    if (m.role === 'host') send(ws, { t: 'state', s: room.game.view('host') });
    else send(ws, { t: 'state', s: room.game.view('player', m.playerId) });
  }
}

function err(ws, msg) { send(ws, { t: 'error', msg }); }

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.meta = null;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('message', (raw) => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m.t !== 'string') return;
    if (m.t === 'ping') return send(ws, { t: 'pong' });
    try { handle(ws, m); } catch (e) { console.error('handler error', e); err(ws, 'Lỗi máy chủ.'); }
  });
  ws.on('close', () => {
    const meta = ws.meta;
    if (!meta) return;
    const room = rooms.get(meta.room);
    if (!room) return;
    room.conns.delete(ws);
    if (meta.role === 'player') {
      const still = [...room.conns].some((c) => c.meta && c.meta.role === 'player' && c.meta.playerId === meta.playerId);
      if (!still) room.game.setOnline(meta.playerId, false);
    }
  });
});

function handle(ws, m) {
  const meta = ws.meta;
  if (m.t === 'host_create') {
    const room = makeRoom({ teams: m.teams, rounds: m.rounds });
    ws.meta = { room: room.code, role: 'host' };
    room.conns.add(ws);
    send(ws, { t: 'welcome', role: 'host', room: room.code, hostToken: room.hostToken, static: STATIC });
    return schedule(room);
  }
  if (m.t === 'host_resume') {
    const room = rooms.get(cleanCode(m.room));
    if (!room || room.hostToken !== m.hostToken) return err(ws, 'Không tìm thấy phòng. Hãy tạo phòng mới.'), send(ws, { t: 'gone' });
    ws.meta = { room: room.code, role: 'host' };
    room.conns.add(ws);
    send(ws, { t: 'welcome', role: 'host', room: room.code, hostToken: room.hostToken, static: STATIC });
    return schedule(room);
  }
  if (m.t === 'join') {
    const room = rooms.get(cleanCode(m.room));
    if (!room) { err(ws, 'Mã phòng không đúng hoặc phòng đã đóng.'); return send(ws, { t: 'gone' }); }
    const device = m.device === 'mobile' ? 'mobile' : 'desktop';
    let p = m.playerId && room.game.players.get(m.playerId);
    if (!p) {
      if (!String(m.name || '').trim()) return err(ws, 'Hãy nhập tên của bạn.');
      p = room.game.addPlayer(m.name, device);
    } else { p.device = device; room.game.setOnline(p.id, true); }
    ws.meta = { room: room.code, role: 'player', playerId: p.id };
    room.conns.add(ws);
    send(ws, { t: 'welcome', role: 'player', room: room.code, playerId: p.id, static: STATIC });
    return schedule(room);
  }
  if (!meta) return;
  const room = rooms.get(meta.room);
  if (!room) return;
  const g = room.game;
  if (meta.role === 'host') {
    switch (m.t) {
      case 'host_start': { const e = g.start(); if (e) err(ws, e); return; }
      case 'host_shuffle': return g.shuffleTeams();
      case 'host_move': return g.movePlayer(m.playerId, m.team | 0);
      case 'host_kick':
        for (const c of room.conns) {
          if (c.meta && c.meta.role === 'player' && c.meta.playerId === m.playerId) { send(c, { t: 'kicked' }); c.meta = null; room.conns.delete(c); }
        }
        return g.kick(m.playerId);
      case 'host_skip': return g.skip();
      case 'host_pause': return g.pause();
      case 'host_resume_game': return g.resume();
      case 'host_end': return g.forceEnd();
      default: return;
    }
  }
  if (meta.role === 'player') {
    switch (m.t) {
      case 'roll': return g.roll(meta.playerId);
      case 'answer': return g.answer(meta.playerId, m.choice);
      case 'decide': return g.decide(meta.playerId, String(m.action || ''));
      case 'vote': return g.cartelAnswer(!!m.accept, meta.playerId);
      case 'pick_team': return g.pickTeam(meta.playerId, m.team | 0);
      default: return;
    }
  }
}

setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
  const now = Date.now();
  for (const [code, room] of rooms) if (now - room.last > 3 * 3600 * 1000 && room.conns.size === 0) rooms.delete(code);
}, 30000);

server.listen(PORT, () => console.log(`MLN122 Monopoly server chạy tại cổng ${PORT}`));
