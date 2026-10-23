// Chạy thử: node test/sim.js  (cần server đang chạy, GAME_SPEED=50 để nhanh)
const WebSocket = require('ws');
const URL = process.env.URL || 'ws://localhost:3000/ws';
const N = Number(process.env.PLAYERS || 15);
const TEAMS = Number(process.env.TEAMS || 3);
const ROUNDS = Number(process.env.ROUNDS || 10);

function client(onMsg) {
  const ws = new WebSocket(URL);
  const c = { ws, send: (o) => ws.send(JSON.stringify(o)), state: null };
  ws.on('message', (d) => onMsg(c, JSON.parse(d)));
  return new Promise((res) => ws.on('open', () => res(c)));
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stats = { stages: {}, decisions: {}, errors: [], lines: 0 };

(async () => {
  let room, hostC, ended = false, endState = null;
  hostC = await client((c, m) => {
    if (m.t === 'welcome') room = m.room;
    if (m.t === 'state') { c.state = m.s; if (m.s.stage.name === 'end') { ended = true; endState = m.s; } }
    if (m.t === 'error') stats.errors.push(m.msg);
  });
  hostC.send({ t: 'host_create', teams: TEAMS, rounds: ROUNDS });
  await sleep(300);
  const players = [];
  for (let i = 0; i < N; i++) {
    const c = await client((cc, m) => {
      if (m.t === 'welcome') cc.id = m.playerId;
      if (m.t === 'error') stats.errors.push(m.msg);
      if (m.t !== 'state') return;
      const s = m.s; cc.state = s;
      const st = s.stage; stats.stages[st.name] = (stats.stages[st.name] || 0) + 1;
      const me = s.me; if (!me) return;
      if (st.name === 'roll' && st.data.playerId === me.id) cc.send({ t: 'roll' });
      if (st.name === 'quiz' && st.data.myAnswer == null) setTimeout(() => cc.send({ t: 'answer', choice: Math.floor(Math.random() * 4) }), Math.random() * 100);
      if (st.name === 'decision' && st.data.teamId === me.team && Math.random() < 0.8) {
        const opts = st.data.options.filter((o) => !o.disabled);
        const o = opts[Math.floor(Math.random() * opts.length)];
        stats.decisions[st.data.kind + ':' + o.id.split(':')[0]] = (stats.decisions[st.data.kind + ':' + o.id.split(':')[0]] || 0) + 1;
        cc.send({ t: 'decide', action: o.id });
      }
      if (st.name === 'cartel_vote' && st.data.to === me.team) cc.send({ t: 'vote', accept: Math.random() < 0.6 });
    });
    c.send({ t: 'join', room, name: 'HS' + (i + 1) });
    players.push(c);
  }
  await sleep(500);
  const lob = hostC.state.lobbyPlayers;
  console.log('Lobby:', lob.length, 'người, đội:', [0, 1, 2].map((t) => lob.filter((p) => p.team === t).length).join('/'));
  hostC.send({ t: 'host_start' });
  const t0 = Date.now();
  while (!ended && Date.now() - t0 < 180000) {
    await sleep(500);
    const s = hostC.state;
    if (s && s.turn % 5 === 0 && s.stage.name === 'roll') process.stdout.write(`\rvòng ${s.round}/${s.rounds} giai đoạn ${s.phase}   `);
  }
  console.log('\nKết thúc:', ended, 'sau', ((Date.now() - t0) / 1000).toFixed(1), 's');
  if (endState) {
    const sum = endState.stage.data;
    console.log('Bảng xếp hạng:', JSON.stringify(sum.ranking.map((r) => ({ t: endState.teams[r.id].name, net: r.net, score: r.score, mono: r.monopolies, bk: r.bankrupt, acq: r.acquired }))));
    console.log('Top HS:', sum.topPlayers.map((p) => p.name + ':' + p.correct).join(', '));
    const bad = endState.teams.filter((t) => !Number.isFinite(t.cash) || t.cash < 0);
    console.log('Đội có tiền âm/NaN:', bad.length);
    console.log('Log cuối:', endState.log.slice(-4).map((l) => l.text));
  }
  console.log('Thống kê stage:', stats.stages);
  console.log('Quyết định:', stats.decisions);
  console.log('Lỗi:', stats.errors.slice(0, 5));
  process.exit(ended ? 0 : 1);
})();
