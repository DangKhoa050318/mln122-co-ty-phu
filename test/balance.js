// Mô phỏng cân bằng game (không mạng): node test/balance.js
process.env.GAME_SPEED = '1000';
const { Game } = require('../server/game');
const D = require('../server/data');
const R = Number(process.env.ROUNDS || 10), RUNS = Number(process.env.RUNS || 40), T = Number(process.env.TEAMS || 3);
const agg = { mono: 0, monoGames: 0, acq: 0, bk: 0, spread: 0, maxMonoMult: 0, cartels: 0, finNet: [] };
for (let run = 0; run < RUNS; run++) {
  const g = new Game({ teams: T, rounds: R }, () => {});
  for (let i = 0; i < T * 5; i++) g.addPlayer('p' + i);
  g.start();
  let guard = 0;
  while (g.stage.name !== 'end' && guard++ < 5000) {
    const st = g.stage;
    if (st.name === 'decision') {
      const t = g.turn.team, pick = st.data.options.filter((o) => !o.disabled);
      const want = pick.find((o) => ['buy', 'acquire', 'invest'].includes(o.id) && (o.cost || 0) <= t.cash - 150) || pick.find((o) => o.id.startsWith('partner')) || pick.find((o) => o.id === 'rent' || o.id === 'skip');
      const m = g.members(t.id)[0];
      g.decide(m.id, want ? want.id : pick[0].id);
    } else if (st.name === 'cartel_vote') {
      g.cartelAnswer(true, g.members(st.data.to)[0].id); agg.cartels++;
    } else g.skip();
  }
  clearTimeout(g.timer);
  const rk = g.summary.ranking;
  agg.mono += rk.reduce((a, r) => a + r.monopolies, 0);
  agg.monoGames += rk.some((r) => r.monopolies > 0) ? 1 : 0;
  agg.acq += rk.reduce((a, r) => a + r.acquired, 0);
  agg.bk += rk.reduce((a, r) => a + r.bankrupt, 0);
  agg.spread += rk[0].net - rk[rk.length - 1].net;
  rk.forEach((r) => agg.finNet.push(r.net));
}
console.log(`Vòng ${R}, ${T} đội, ${RUNS} ván`);
console.log('Ván có độc quyền nhóm ngành:', agg.monoGames + '/' + RUNS, '| nhóm độc quyền/ván:', (agg.mono / RUNS).toFixed(2));
console.log('Thôn tính/ván:', (agg.acq / RUNS).toFixed(1), '| phá sản/ván:', (agg.bk / RUNS).toFixed(1), '| cartel/ván:', (agg.cartels / RUNS).toFixed(1));
console.log('Chênh lệch tài sản nhất–bét:', Math.round(agg.spread / RUNS), '| tài sản TB:', Math.round(agg.finNet.reduce((a, b) => a + b, 0) / agg.finNet.length), 'min', Math.min(...agg.finNet), 'max', Math.max(...agg.finNet));
process.exit(0);
