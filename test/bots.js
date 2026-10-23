// Thêm bot vào phòng có sẵn: ROOM=ABCD N=12 node test/bots.js
const WebSocket = require('ws');
const URL = process.env.URL || 'ws://localhost:3000/ws';
const room = process.env.ROOM, N = Number(process.env.N || 12);
for (let i = 0; i < N; i++) {
  const ws = new WebSocket(URL);
  const send = (o) => ws.send(JSON.stringify(o));
  ws.on('open', () => send({ t: 'join', room, name: 'Bot ' + (i + 1) }));
  ws.on('message', (d) => {
    const m = JSON.parse(d);
    if (m.t !== 'state' || !m.s.me) return;
    const s = m.s, st = s.stage, me = s.me;
    if (st.name === 'roll' && st.data.playerId === me.id) setTimeout(() => send({ t: 'roll' }), 800 + Math.random() * 1500);
    if (st.name === 'quiz' && st.data.myAnswer == null) setTimeout(() => send({ t: 'answer', choice: Math.floor(Math.random() * 4) }), 1000 + Math.random() * 6000);
    if (st.name === 'decision' && st.data.teamId === me.team && Math.random() < 0.7) {
      const o = st.data.options.filter((x) => !x.disabled); setTimeout(() => send({ t: 'decide', action: o[Math.floor(Math.random() * o.length)].id }), 1500);
    }
    if (st.name === 'cartel_vote' && st.data.to === me.team) setTimeout(() => send({ t: 'vote', accept: true }), 1500);
  });
  setInterval(() => ws.readyState === 1 && send({ t: 'ping' }), 20000);
}
console.log('bots ready');
