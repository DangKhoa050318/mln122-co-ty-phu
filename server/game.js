'use strict';
const D = require('./data');
const { TILES, CARDS, QUESTIONS, PHASES, MULT } = D;

const rnd = (n) => Math.floor(Math.random() * n);
const shuffle = (a) => { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = rnd(i + 1); [r[i], r[j]] = [r[j], r[i]]; } return r; };
const r5 = (x) => Math.round(x / 5) * 5;
const money = (n) => `${n}`;

const SPEED = Number(process.env.GAME_SPEED || 1); // chỉ dùng khi chạy thử nghiệm
const DUR_BASE = { phase: 9000, roll: 20000, moving: 1800, quiz: 20000, quiz_result: 6500, decision: 20000, cartel_vote: 15000, result: 4800 };
const DUR = Object.fromEntries(Object.entries(DUR_BASE).map(([k, v]) => [k, Math.max(30, Math.round(v / SPEED))]));
const PROP_GROUPS = ['A', 'B', 'C', 'D', 'E', 'F'];
// Màn "đọc" có thể đứng yên chờ quản trò bấm Tiếp tục thay vì tự chuyển theo giờ.
// hold: 'none' = tự chuyển hết; 'phase' = chờ ở giới thiệu giai đoạn; 'all' = chờ cả giải thích đáp án và kết quả lượt.
const HOLD_MODES = { none: [], phase: ['phase'], all: ['phase', 'quiz_result', 'result'] };

class Game {
  constructor(opts, notify) {
    this.notify = notify;
    this.cfg = {
      teams: Math.min(4, Math.max(2, opts.teams | 0 || 3)),
      rounds: Math.min(15, Math.max(4, opts.rounds | 0 || 10)),
      hold: HOLD_MODES[opts.hold] ? opts.hold : 'phase',
    };
    this.players = new Map();
    this.nextPid = 1;
    this.teams = [];
    for (let i = 0; i < this.cfg.teams; i++) this.teams.push(this.makeTeam(i, D.TEAM_DEFS[i]));
    this.stage = { name: 'lobby', deadline: null, data: {} };
    this.timer = null;
    this.paused = false;
    this.remaining = 0;
    this.log = [];
    this.owners = TILES.map(() => null);
    this.upgraded = TILES.map(() => false);
    this.fund = 0;
    this.cartel = null;
    this.phase = 0;
    this.round = 0;
    this.turnCount = 0;
    this.totalTurns = 0;
    this.activeTeam = 0;
    this.turn = null;
    this.quiz = null;
    this.quizDeck = [];
    this.summary = null;
    this.started = false;
  }

  makeTeam(i, def) {
    return { id: i, name: def.name, color: def.color, cash: D.START_CASH, pos: 0, fdi: 0, shield: false, rot: 0, correct: 0, bankrupt: 0, acquired: 0 };
  }

  // ---------- người chơi ----------
  members(teamId) { return [...this.players.values()].filter((p) => p.team === teamId); }
  smallestTeam() {
    let best = 0, bn = 1e9;
    this.teams.forEach((t, i) => { const n = this.members(i).length; if (n < bn) { bn = n; best = i; } });
    return best;
  }
  addPlayer(name, device = 'desktop') {
    name = String(name || '').trim().slice(0, 20) || 'Người chơi';
    const names = new Set([...this.players.values()].map((p) => p.name));
    let nm = name, k = 2;
    while (names.has(nm)) nm = `${name} ${k++}`;
    const id = 'p' + this.nextPid++ + Math.random().toString(36).slice(2, 7);
    const p = { id, name: nm, team: this.smallestTeam(), online: true, correct: 0, answered: 0, device };
    this.players.set(id, p);
    this.notify();
    return p;
  }
  setOnline(id, on) { const p = this.players.get(id); if (p) { p.online = on; this.notify(); } }
  kick(id) { this.players.delete(id); this.notify(); }
  movePlayer(id, team) { const p = this.players.get(id); if (p && this.teams[team] && !this.started) { p.team = team; this.notify(); } }
  // Người chơi tự chọn đội khi còn ở phòng chờ
  pickTeam(id, team) { const p = this.players.get(id); if (p && this.teams[team] && !this.started && p.team !== team) { p.team = team; this.notify(); } }
  shuffleTeams() {
    if (this.started) return;
    const ids = shuffle([...this.players.keys()]);
    ids.forEach((id, i) => { this.players.get(id).team = i % this.teams.length; });
    this.notify();
  }

  // ---------- điều khiển stage ----------
  held(name) { return HOLD_MODES[this.cfg.hold].includes(name); }
  setStage(name, ms, data = {}) {
    clearTimeout(this.timer);
    if (ms && this.held(name)) { ms = 0; data.hold = true; } // chờ quản trò bấm Tiếp tục
    this.stage = { name, deadline: ms ? Date.now() + ms : null, data };
    this.paused = false;
    if (ms) this.timer = setTimeout(() => this.onTimeout(), ms);
    this.notify();
  }
  accelerate(ms) {
    if (this.paused) return;
    clearTimeout(this.timer);
    this.stage.deadline = Date.now() + ms;
    this.timer = setTimeout(() => this.onTimeout(), ms);
    this.notify();
  }
  pause() {
    if (this.paused || !this.stage.deadline) return;
    this.remaining = Math.max(500, this.stage.deadline - Date.now());
    clearTimeout(this.timer);
    this.stage.deadline = null;
    this.paused = true;
    this.notify();
  }
  resume() {
    if (!this.paused) return;
    this.paused = false;
    this.stage.deadline = Date.now() + this.remaining;
    this.timer = setTimeout(() => this.onTimeout(), this.remaining);
    this.notify();
  }
  // Đổi chế độ chuyển bước giữa chừng: áp dụng ngay cho màn đang hiện
  setHold(mode) {
    if (!HOLD_MODES[mode] || mode === this.cfg.hold) return;
    this.cfg.hold = mode;
    const st = this.stage;
    if (this.started && st.name !== 'end' && DUR[st.name]) {
      if (this.held(st.name) && !st.data.hold) {
        clearTimeout(this.timer); this.timer = null;
        st.deadline = null; st.data.hold = true; this.paused = false;
      } else if (!this.held(st.name) && st.data.hold) {
        st.data.hold = false;
        st.deadline = Date.now() + DUR[st.name];
        this.timer = setTimeout(() => this.onTimeout(), DUR[st.name]);
      }
    }
    this.notify();
  }
  skip() {
    if (!this.started || this.stage.name === 'end') return;
    clearTimeout(this.timer);
    this.paused = false;
    this.onTimeout();
  }
  onTimeout() {
    clearTimeout(this.timer);
    this.timer = null;
    switch (this.stage.name) {
      case 'phase': return this.beginRoll();
      case 'roll': return this.doRoll();
      case 'moving': return this.beginQuiz();
      case 'quiz': return this.endQuiz();
      case 'quiz_result': return this.resolveTile();
      case 'decision': return this.applyDecision(this.stage.data.def || 'skip');
      case 'cartel_vote': return this.cartelAnswer(false);
      case 'result': return this.nextTurn();
      default: return undefined;
    }
  }

  // ---------- bắt đầu / kết thúc ----------
  start() {
    if (this.started) return 'Game đã bắt đầu';
    const keep = this.teams.filter((t) => this.members(t.id).length > 0);
    if (keep.length < 2) return 'Cần ít nhất 2 đội có người chơi';
    const remap = new Map();
    keep.forEach((t, i) => remap.set(t.id, i));
    this.players.forEach((p) => { p.team = remap.get(p.team); });
    this.teams = keep.map((t, i) => ({ ...t, id: i }));
    this.started = true;
    this.totalTurns = this.cfg.rounds * this.teams.length;
    this.quizDeck = [];
    this.addLog('Game bắt đầu. Mỗi đội khởi đầu với ' + D.START_CASH + ' vốn.', 'sys');
    this.startTurn();
    return null;
  }

  phaseFor(round) {
    const R = this.cfg.rounds;
    const p2 = Math.floor(R * 0.3) + 1, p3 = Math.floor(R * 0.7) + 1;
    return round >= p3 ? 3 : round >= p2 ? 2 : 1;
  }

  startTurn() {
    if (this.turnCount >= this.totalTurns) return this.endGame();
    const n = this.teams.length;
    this.round = Math.floor(this.turnCount / n) + 1;
    this.activeTeam = this.turnCount % n;
    if (this.activeTeam === 0) this.roundStart();
    const ph = this.phaseFor(this.round);
    if (ph !== this.phase) {
      this.phase = ph;
      this.addLog(`Giai đoạn ${ph}: ${PHASES[ph].name}`, 'phase');
      return this.setStage('phase', DUR.phase, { phase: ph, info: PHASES[ph] });
    }
    return this.beginRoll();
  }

  roundStart() {
    if (!this.cartel) return;
    this.cartel.left -= 1;
    const [a, b] = [this.teams[this.cartel.a], this.teams[this.cartel.b]];
    if (this.cartel.left <= 0) {
      this.addLog(`Cartel ${a.name} + ${b.name} hết hạn.`, 'cartel');
      this.cartel = null;
    } else if (Math.random() < 0.25) {
      this.addLog(`Cartel ${a.name} + ${b.name} tan vỡ trước kỳ hạn (cartel vốn không vững chắc).`, 'cartel');
      this.cartel = null;
    }
  }

  pickActivePlayer(team) {
    const list = this.members(team.id);
    if (!list.length) return null;
    const online = list.filter((p) => p.online);
    const pool = online.length ? online : list;
    const p = pool[team.rot % pool.length];
    team.rot += 1;
    return p;
  }

  beginRoll() {
    const t = this.teams[this.activeTeam];
    const pl = this.pickActivePlayer(t);
    this.turn = { team: t, player: pl, lines: [], discount: false, tile: null, card: null };
    this.setStage('roll', DUR.roll, { playerId: pl ? pl.id : null, playerName: pl ? pl.name : t.name, teamId: t.id });
  }

  roll(playerId) {
    if (this.stage.name !== 'roll') return;
    if (!this.turn.player || this.turn.player.id !== playerId) return;
    clearTimeout(this.timer);
    this.doRoll();
  }

  doRoll() {
    const t = this.turn.team;
    const d1 = 1 + rnd(6), d2 = 1 + rnd(6);
    const from = t.pos;
    const raw = from + d1 + d2;
    const to = raw % TILES.length;
    let passed = false;
    if (raw >= TILES.length) {
      passed = true;
      const sal = D.SALARY + D.FDI_YIELD * t.fdi;
      t.cash += sal;
      this.line(`${t.name} qua Xuất phát, nhận ${sal} lợi nhuận` + (t.fdi ? ` (gồm ${D.FDI_YIELD * t.fdi} từ ${t.fdi} nhà máy ở nước ngoài)` : '') + '.', 'gain');
    }
    t.pos = to;
    this.turn.tile = to;
    this.turn.roll = { d1, d2, from, to, passed };
    this.addLog(`${t.name} tung ${d1}+${d2}=${d1 + d2}, đến ô "${TILES[to].name}".`, 'move', t.id);
    this.setStage('moving', DUR.moving, { d1, d2, from, to, passed, teamId: t.id });
  }

  // ---------- câu hỏi ----------
  beginQuiz() {
    if (!this.quizDeck.length) this.quizDeck = shuffle(QUESTIONS.map((_, i) => i));
    const src = QUESTIONS[this.quizDeck.pop()];
    const order = shuffle(src.opts.map((_, i) => i));
    this.quiz = {
      sec: src.sec, q: src.q, why: src.why,
      opts: order.map((i) => src.opts[i]),
      correct: order.indexOf(src.ans),
      answers: new Map(),
    };
    this.setStage('quiz', DUR.quiz, { sec: src.sec, q: src.q, opts: this.quiz.opts, teamId: this.turn.team.id });
  }

  answer(playerId, choice) {
    if (this.stage.name !== 'quiz') return;
    const p = this.players.get(playerId);
    if (!p || this.quiz.answers.has(playerId)) return;
    if (!Number.isInteger(choice) || choice < 0 || choice >= this.quiz.opts.length) return;
    this.quiz.answers.set(playerId, choice);
    const online = [...this.players.values()].filter((x) => x.online).length;
    this.notify();
    if (this.quiz.answers.size >= online) this.accelerate(900);
  }

  endQuiz() {
    const q = this.quiz;
    const perTeam = this.teams.map((t) => ({ id: t.id, correct: 0, answered: 0, members: this.members(t.id).length }));
    this.players.forEach((p) => {
      if (!q.answers.has(p.id)) return;
      p.answered += 1;
      perTeam[p.team].answered += 1;
      if (q.answers.get(p.id) === q.correct) { p.correct += 1; perTeam[p.team].correct += 1; this.teams[p.team].correct += 1; }
    });
    const at = perTeam[this.turn.team.id];
    const bonus = at.members > 0 && at.correct / at.members >= 0.5;
    this.turn.discount = bonus;
    this.addLog(bonus
      ? `${this.turn.team.name} trả lời đúng ${at.correct}/${at.members}: Lợi thế tri thức, chi phí lượt này giảm 30%.`
      : `${this.turn.team.name} trả lời đúng ${at.correct}/${at.members}: chưa đạt lợi thế tri thức.`, 'quiz', this.turn.team.id);
    this.setStage('quiz_result', DUR.quiz_result, {
      sec: q.sec, q: q.q, opts: q.opts, correct: q.correct, why: q.why, perTeam, bonus, teamId: this.turn.team.id,
    });
  }

  // ---------- nhật ký & tiền ----------
  addLog(text, kind = 'info', team = null) {
    this.log.push({ r: this.round, text, kind, team });
    if (this.log.length > 80) this.log.shift();
  }
  line(text, kind = 'info') {
    if (this.turn) this.turn.lines.push({ text, kind });
    this.addLog(text, kind, this.turn ? this.turn.team.id : null);
  }
  propsOf(t) { const r = []; this.owners.forEach((o, i) => { if (o === t.id) r.push(i); }); return r; }
  groupCount(owner, group) { let n = 0; TILES.forEach((tl, i) => { if (tl.group === group && this.owners[i] === owner) n++; }); return n; }
  // Độc quyền (chi phối) một nhóm ngành: nắm từ 2/3 ngành trở lên (hơn 50%, như quy tắc 51% cổ phần khống chế)
  monopolies(t) { return PROP_GROUPS.filter((g) => this.groupCount(t.id, g) >= 2); }
  fullMonopolies(t) { return PROP_GROUPS.filter((g) => this.groupCount(t.id, g) === 3); }
  net(t) {
    let n = t.cash + t.fdi * D.FDI_COST;
    this.propsOf(t).forEach((i) => { n += Math.round(TILES[i].price * (this.upgraded[i] ? 1.3 : 1)); });
    return n;
  }
  richest(exclude = -1) { let b = null; this.teams.forEach((t) => { if (t.id !== exclude && (!b || t.cash > b.cash)) b = t; }); return b; }
  poorest(exclude = -1) { let b = null; this.teams.forEach((t) => { if (t.id !== exclude && (!b || t.cash < b.cash)) b = t; }); return b; }
  financier() { return this.teams.find((t) => this.groupCount(t.id, 'BANK') === 3) || null; }

  gain(t, amt, why) { amt = Math.round(amt); t.cash += amt; this.line(`${t.name} nhận ${amt}${why ? ' (' + why + ')' : ''}.`, 'gain'); }

  // trả tiền: to = id đội | 'state' | 'bank'
  pay(from, amt, to, why, opts = {}) {
    amt = Math.round(amt);
    if (amt <= 0) return 0;
    if (opts.discountable !== false && this.turn && this.turn.discount && from.id === this.turn.team.id) {
      const save = r5(amt * 0.3);
      if (save > 0) { amt -= save; this.line(`Lợi thế tri thức: ${from.name} được giảm ${save}.`, 'bonus'); }
    }
    from.cash -= amt;
    let creditor = null;
    if (to === 'state') { this.fund += amt; }
    else if (typeof to === 'number') {
      creditor = to;
      let recv = amt;
      const fin = opts.rent ? this.financier() : null;
      if (fin && this.phase >= 2 && fin.id !== to) {
        const cut = Math.round(amt * 0.1);
        if (cut > 0) { recv -= cut; fin.cash += cut; this.line(`Tài phiệt ${fin.name} (nắm đủ 3 ngân hàng) thu 10% = ${cut} theo “chế độ tham dự”.`, 'fin'); }
      }
      this.teams[to].cash += recv;
    }
    this.line(`${from.name} trả ${amt}${why ? ' (' + why + ')' : ''}${typeof to === 'number' ? ' cho ' + this.teams[to].name : to === 'state' ? ' vào Quỹ Nhà nước' : ''}.`, 'pay');
    this.settle(from, creditor);
    return amt;
  }

  settle(t, creditor) {
    let liquidated = false;
    while (t.cash < 0) {
      const owned = this.propsOf(t).sort((a, b) => TILES[a].price - TILES[b].price);
      if (!owned.length) break;
      const idx = owned[0];
      const val = Math.round(TILES[idx].price * 0.5);
      let B = creditor != null && creditor !== t.id ? this.teams[creditor] : this.richest(t.id);
      liquidated = true;
      if (B && B.cash >= val) {
        this.owners[idx] = B.id; B.cash -= val; t.cash += val; B.acquired += 1;
        this.line(`${t.name} thiếu tiền, ngành "${TILES[idx].name}" bị ${B.name} thôn tính với giá ${val}.`, 'bankrupt');
      } else {
        this.owners[idx] = null; this.upgraded[idx] = false; t.cash += val;
        this.line(`${t.name} phải bán rẻ ngành "${TILES[idx].name}" lấy ${val}.`, 'bankrupt');
      }
    }
    if (t.cash < 0) {
      const short = -t.cash;
      if (creditor != null && creditor !== t.id) this.teams[creditor].cash -= short;
      t.cash = 100;
      t.bankrupt += 1;
      this.line(`${t.name} phá sản, Nhà nước cứu trợ 100 để tiếp tục (không còn ngành nào).`, 'bankrupt');
    } else if (liquidated) t.bankrupt += 1;
  }

  // ---------- tiền thuê ----------
  rentFor(idx, payer) {
    const tile = TILES[idx], owner = this.owners[idx];
    let rent;
    if (tile.type === 'bank') rent = D.BANK_RENT * this.groupCount(owner, 'BANK');
    else {
      const base = tile.rent * (this.upgraded[idx] ? 1.5 : 1);
      rent = base * MULT[this.phase || 1][this.groupCount(owner, tile.group)];
    }
    if (this.cartel && (this.cartel.a === owner || this.cartel.b === owner)) {
      const partner = this.cartel.a === owner ? this.cartel.b : this.cartel.a;
      rent = payer.id === partner ? 0 : rent * 1.3;
    }
    return r5(rent);
  }

  payRent(t, idx) {
    const owner = this.owners[idx];
    const O = this.teams[owner];
    if (t.shield) {
      t.shield = false;
      this.line(`${t.name} dùng lá chắn vận động hành lang: được miễn tiền thuê "${TILES[idx].name}".`, 'bonus');
      return;
    }
    const rent = this.rentFor(idx, t);
    if (rent === 0) { this.line(`${t.name} và ${O.name} cùng trong Cartel: miễn tiền thuê.`, 'cartel'); return; }
    const cnt = TILES[idx].type === 'bank' ? this.groupCount(owner, 'BANK') : this.groupCount(owner, TILES[idx].group);
    const tag = cnt === 3 ? ' (độc quyền nhóm ngành)' : cnt === 2 ? ' (liên kết ngang)' : '';
    this.pay(t, rent, owner, `tiền thuê "${TILES[idx].name}"${tag}`, { rent: true });
  }

  // ---------- giải quyết ô ----------
  resolveTile() {
    const t = this.turn.team;
    const idx = this.turn.tile;
    const tile = TILES[idx];
    const ph = this.phase;
    const locked = tile.minPhase && ph < tile.minPhase;
    if (locked) {
      this.line(`Ô "${tile.name}" chưa kích hoạt: chỉ mở từ giai đoạn ${tile.minPhase}.`, 'info');
      return this.finishResult();
    }
    switch (tile.type) {
      case 'start': this.line('Dừng đúng điểm Xuất phát.', 'info'); return this.finishResult();
      case 'prop':
      case 'bank': return this.resolveProperty(t, idx, tile);
      case 'state':
        this.line(`Ngành then chốt do Nhà nước độc quyền: ${tile.name}.`, 'state');
        this.pay(t, tile.fee, 'state', `phí dịch vụ ${tile.name}`);
        return this.finishResult();
      case 'card': this.drawCard(false); return this.finishResult();
      case 'crisis': this.drawCard(true); return this.finishResult();
      case 'regulate': this.regulate(); return this.finishResult();
      case 'fdi':
        if (t.fdi >= 2) { this.line('Đã đạt tối đa 2 nhà máy ở nước ngoài.', 'info'); return this.finishResult(); }
        return this.decision('invest', 'Xuất khẩu tư bản: đầu tư trực tiếp (FDI)',
          `Xây nhà máy ở nước ngoài để thu giá trị thặng dư. Mỗi lần qua Xuất phát đội nhận thêm ${D.FDI_YIELD}.`,
          [{ id: 'invest', label: `Xây nhà máy (${D.FDI_COST})`, cost: D.FDI_COST, disabled: t.cash < D.FDI_COST }, { id: 'skip', label: 'Bỏ qua' }]);
      case 'fii':
        return this.decision('invest', 'Xuất khẩu tư bản: đầu tư gián tiếp (FII)',
          `Mua cổ phiếu, trái phiếu nước ngoài. Lợi nhuận ngẫu nhiên từ 0 đến 260 (vốn ${D.FII_COST}).`,
          [{ id: 'invest', label: `Đầu tư danh mục (${D.FII_COST})`, cost: D.FII_COST, disabled: t.cash < D.FII_COST }, { id: 'skip', label: 'Bỏ qua' }]);
      case 'rd': {
        const cand = this.propsOf(t).filter((i) => TILES[i].type === 'prop' && !this.upgraded[i]);
        if (!cand.length) { this.line('Chưa có ngành nào để đầu tư nghiên cứu.', 'info'); return this.finishResult(); }
        return this.decision('invest', 'Viện nghiên cứu khoa học kỹ thuật',
          'Nâng năng suất ngành đắt nhất chưa nâng cấp của đội: tiền thuê ngành đó +50% vĩnh viễn.',
          [{ id: 'invest', label: `Đầu tư R&D (${D.RD_COST})`, cost: D.RD_COST, disabled: t.cash < D.RD_COST }, { id: 'skip', label: 'Bỏ qua' }]);
      }
      case 'lobby':
        if (t.shield) { this.line('Đội đã có lá chắn rồi.', 'info'); return this.finishResult(); }
        return this.decision('invest', 'Vận động hành lang',
          'Kết hợp nhân sự giữa tập đoàn và nhà nước: lần tới phải trả tiền thuê, đội được miễn.',
          [{ id: 'invest', label: `Vận động (${D.LOBBY_COST})`, cost: D.LOBBY_COST, disabled: t.cash < D.LOBBY_COST }, { id: 'skip', label: 'Bỏ qua' }]);
      case 'cartel': {
        const others = this.teams.filter((x) => x.id !== t.id);
        if (this.teams.length < 3) { this.line('Cần ít nhất 3 đội để lập Cartel.', 'info'); return this.finishResult(); }
        if (this.cartel) { this.line('Đang có một Cartel hoạt động trên thị trường.', 'info'); return this.finishResult(); }
        return this.decision('cartel', 'Hội nghị Cartel',
          'Chọn một đội để thỏa thuận: 3 vòng tới hai đội miễn tiền thuê cho nhau và nâng giá ×1,3 với đội ngoài. Cartel có thể tan vỡ bất cứ lúc nào.',
          [...others.map((o) => ({ id: 'partner:' + o.id, label: `Mời ${o.name}`, teamId: o.id })), { id: 'skip', label: 'Bỏ qua' }]);
      }
      default: return this.finishResult();
    }
  }

  resolveProperty(t, idx, tile) {
    const owner = this.owners[idx];
    if (owner == null) {
      const cost = Math.round(tile.price * (this.turn.discount ? 0.7 : 1));
      return this.decision('buy', `Mua ngành "${tile.name}"`,
        `Nhóm: ${D.GROUPS[tile.group].name}. Tiền thuê gốc ${tile.type === 'bank' ? D.BANK_RENT : tile.rent}. Gom đủ nhóm để định giá độc quyền.`,
        [{ id: 'buy', label: `Mua (${cost})`, cost, disabled: t.cash < cost }, { id: 'skip', label: 'Bỏ qua' }]);
    }
    if (owner === t.id) { this.line(`"${tile.name}" là ngành của ${t.name}.`, 'info'); return this.finishResult(); }
    if (this.phase >= 2) {
      const rent = this.rentFor(idx, t);
      const cost = Math.round(tile.price * 2 * (this.turn.discount ? 0.7 : 1));
      return this.decision('acquire', `"${tile.name}" thuộc ${this.teams[owner].name}`,
        `Trả tiền thuê ${rent} hoặc thôn tính luôn ngành này với ${cost} (tích tụ và tập trung).`,
        [{ id: 'rent', label: `Trả thuê (${rent})` }, { id: 'acquire', label: `Thôn tính (${cost})`, cost, disabled: t.cash < cost }], 'rent');
    }
    this.payRent(t, idx);
    return this.finishResult();
  }

  decision(kind, title, text, options, def = 'skip') {
    this.turn.pending = { kind, def };
    this.setStage('decision', DUR.decision, { kind, title, text, options, def, teamId: this.turn.team.id, tile: this.turn.tile });
  }

  decide(playerId, action) {
    if (this.stage.name === 'cartel_vote') return;
    if (this.stage.name !== 'decision') return;
    const p = this.players.get(playerId);
    if (!p || p.team !== this.turn.team.id) return;
    const opt = this.stage.data.options.find((o) => o.id === action);
    if (!opt || opt.disabled) return;
    clearTimeout(this.timer);
    this.applyDecision(action);
  }

  applyDecision(action) {
    const t = this.turn.team, idx = this.turn.tile, tile = TILES[idx];
    const kind = this.turn.pending ? this.turn.pending.kind : null;
    const opt = (this.stage.data.options || []).find((o) => o.id === action);
    const afford = !opt || !opt.cost || t.cash >= opt.cost;
    if (kind === 'buy') {
      if (action === 'buy' && afford) {
        this.pay(t, opt.cost, 'bank', `mua ngành "${tile.name}"`, { discountable: false });
        this.owners[idx] = t.id;
        const n = this.groupCount(t.id, tile.group);
        this.line(`${t.name} sở hữu "${tile.name}" (${n}/3 nhóm ${D.GROUPS[tile.group].name}).`, 'buy');
      } else this.line(`${t.name} bỏ qua, không mua "${tile.name}".`, 'info');
    } else if (kind === 'acquire') {
      if (action === 'acquire' && afford) {
        const o = this.teams[this.owners[idx]];
        this.pay(t, opt.cost, o.id, `thôn tính "${tile.name}"`, { discountable: false });
        this.owners[idx] = t.id; t.acquired += 1;
        this.line(`${t.name} thôn tính "${tile.name}" từ ${o.name}.`, 'buy');
      } else this.payRent(t, idx);
    } else if (kind === 'invest' && action === 'invest' && afford) {
      this.doInvest(t, tile);
    } else if (kind === 'cartel' && action.startsWith('partner:')) {
      const target = parseInt(action.split(':')[1], 10);
      return this.setStage('cartel_vote', DUR.cartel_vote, { from: t.id, to: target });
    } else {
      this.line(`${t.name} bỏ qua.`, 'info');
    }
    return this.finishResult();
  }

  doInvest(t, tile) {
    if (tile.type === 'fdi') {
      this.pay(t, D.FDI_COST, 'bank', 'xây nhà máy ở nước ngoài', { discountable: false });
      t.fdi += 1;
      this.line(`${t.name} xuất khẩu tư bản (FDI): có ${t.fdi} nhà máy ở nước ngoài, mỗi vòng thu thêm ${D.FDI_YIELD * t.fdi}.`, 'buy');
    } else if (tile.type === 'fii') {
      this.pay(t, D.FII_COST, 'bank', 'đầu tư gián tiếp (FII)', { discountable: false });
      const d = 1 + rnd(6);
      const ret = D.FII_RETURNS[d - 1];
      this.line(`Danh mục FII (xúc xắc ${d}): thu về ${ret}.`, ret > D.FII_COST ? 'gain' : 'pay');
      t.cash += ret;
    } else if (tile.type === 'rd') {
      const cand = this.propsOf(t).filter((i) => TILES[i].type === 'prop' && !this.upgraded[i]).sort((a, b) => TILES[b].price - TILES[a].price);
      if (cand.length) {
        this.pay(t, D.RD_COST, 'bank', 'đầu tư R&D');
        this.upgraded[cand[0]] = true;
        this.line(`"${TILES[cand[0]].name}" được nâng cấp công nghệ: tiền thuê +50%.`, 'buy');
      }
    } else if (tile.type === 'lobby') {
      this.pay(t, D.LOBBY_COST, 'bank', 'vận động hành lang', { discountable: false });
      t.shield = true;
      this.line(`${t.name} có lá chắn: miễn một lần tiền thuê.`, 'buy');
    }
  }

  cartelAnswer(accept, playerId) {
    if (this.stage.name !== 'cartel_vote') return;
    const { from, to } = this.stage.data;
    if (playerId) {
      const p = this.players.get(playerId);
      if (!p || p.team !== to) return;
    }
    clearTimeout(this.timer);
    const A = this.teams[from], B = this.teams[to];
    if (accept) {
      this.cartel = { a: from, b: to, left: 4 };
      this.line(`${A.name} và ${B.name} lập Cartel 3 vòng: miễn thuê cho nhau, nâng giá ×1,3 với đội ngoài.`, 'cartel');
    } else this.line(`${B.name} từ chối Cartel của ${A.name}.`, 'info');
    this.finishResult();
  }

  // ---------- thẻ ----------
  drawCard(crisis) {
    const pool = CARDS.filter((c) => c.minPhase <= this.phase && (crisis ? c.crisis : true));
    let c = pool[rnd(pool.length)];
    if (this.lastCard === c.id && pool.length > 1) c = pool[(pool.indexOf(c) + 1) % pool.length];
    this.lastCard = c.id;
    this.turn.card = { id: c.id, title: c.title, text: c.text, theory: c.theory, crisis: c.crisis };
    this.addLog(`Thẻ ${c.crisis ? 'khủng hoảng' : 'thời cuộc'}: ${c.title}`, 'card', this.turn.team.id);
    c.apply(this, this.turn.team);
  }
  cardGain(t, amt, why) { if (amt > 0) this.gain(t, amt, why); else this.line('Chưa có ngành nào để hưởng lợi.', 'info'); }
  cardPay(t, amt, why) { this.pay(t, amt, 'bank', why); }
  cardForcedSale() {
    const poor = this.poorest(), rich = this.richest();
    if (poor.id === rich.id) return this.line('Không đội nào bị ảnh hưởng.', 'info');
    const owned = this.propsOf(poor).sort((a, b) => TILES[a].price - TILES[b].price);
    if (!owned.length) return this.line(`${poor.name} chưa có ngành nào để phải bán.`, 'info');
    const idx = owned[0], val = Math.round(TILES[idx].price * 0.5);
    if (rich.cash < val) return this.line(`${rich.name} không đủ tiền thâu tóm.`, 'info');
    this.owners[idx] = rich.id; rich.cash -= val; poor.cash += val; rich.acquired += 1;
    this.line(`${poor.name} phá sản một phần: "${TILES[idx].name}" bị ${rich.name} thâu tóm giá ${val}.`, 'bankrupt');
  }
  cardFinCrisis() {
    this.teams.forEach((x) => {
      const loss = r5(Math.max(0, x.cash) * 0.1);
      if (loss > 0) { x.cash -= loss; this.line(`${x.name} mất ${loss} vì khủng hoảng tài chính.`, 'pay'); }
      const nb = this.groupCount(x.id, 'BANK');
      if (nb) { x.cash += 40 * nb; this.line(`${x.name} (giữ ${nb} ngân hàng) thu lại ${40 * nb}.`, 'gain'); }
    });
  }
  cardBankRun() {
    let any = false;
    this.teams.forEach((x) => { if (this.groupCount(x.id, 'BANK') > 0) { any = true; x.cash += 100; this.line(`${x.name} thâu tóm ngân hàng nhỏ, nhận 100.`, 'gain'); } });
    if (!any) this.line('Chưa đội nào giữ ngân hàng nên không ai hưởng lợi.', 'info');
  }
  cardBoycott(t) {
    const mono = this.teams.filter((x) => this.monopolies(x).length);
    if (!mono.length) return this.gain(t, 40, 'cạnh tranh gay gắt, chưa ai độc quyền');
    mono.forEach((x) => { this.pay(x, 100, 'state', 'bị tẩy chay vì giá độc quyền', { discountable: false }); });
  }
  cardTech(t) {
    this.gain(t, 100, 'phát minh');
    const cand = this.propsOf(t).filter((i) => TILES[i].type === 'prop' && !this.upgraded[i]).sort((a, b) => TILES[a].price - TILES[b].price);
    if (cand.length) { this.upgraded[cand[0]] = true; this.line(`"${TILES[cand[0]].name}" được nâng cấp: tiền thuê +50%.`, 'buy'); }
  }
  cardMA(t) {
    const n = PROP_GROUPS.filter((g) => this.groupCount(t.id, g) >= 2).length;
    this.cardGain(t, 40 * n, `${n} nhóm ngành liên kết ngang`);
  }
  cardWelfare() {
    const rich = this.richest(), poor = this.poorest();
    if (rich.id === poor.id) return this.line('Không có chênh lệch để điều tiết.', 'info');
    const amt = Math.min(80, Math.max(0, rich.cash));
    rich.cash -= amt; poor.cash += amt;
    this.line(`${rich.name} nộp ${amt} trợ cấp cho ${poor.name}.`, 'state');
  }
  cardLobby(t) { this.gain(t, 100, 'chủ độc quyền vào chính phủ'); t.shield = true; this.line(`${t.name} nhận lá chắn miễn một lần tiền thuê.`, 'bonus'); }
  propsOfCount(t) { return this.propsOf(t).length; }

  regulate() {
    const rich = this.richest(), poor = this.poorest();
    this.line('Nhà nước điều tiết nền kinh tế.', 'state');
    if (rich.id !== poor.id) {
      const tax = r5(Math.max(0, rich.cash) * 0.1);
      if (tax > 0) { rich.cash -= tax; this.fund += tax; this.line(`Thuế lũy tiến: ${rich.name} nộp ${tax} vào Quỹ Nhà nước.`, 'state'); }
    }
    if (this.phase >= 3) {
      this.teams.forEach((x) => {
        if (this.monopolies(x).length) this.pay(x, 100, 'state', 'phạt độc quyền (luật chống độc quyền)', { discountable: false });
      });
    }
    const poor2 = this.poorest();
    if (this.fund > 0 && poor2) {
      this.line(`Quỹ Nhà nước chi ${this.fund} trợ cấp, phúc lợi cho ${poor2.name}.`, 'state');
      poor2.cash += this.fund; this.fund = 0;
    }
  }

  // ---------- kết thúc lượt ----------
  finishResult() {
    this.setStage('result', DUR.result, { lines: this.turn.lines, card: this.turn.card, tile: this.turn.tile, teamId: this.turn.team.id });
  }
  nextTurn() { this.turnCount += 1; this.startTurn(); }

  endGame() {
    const ranking = this.teams.map((t) => ({
      id: t.id, net: this.net(t), correct: t.correct, score: this.net(t) + 10 * t.correct, cash: t.cash,
      props: this.propsOf(t).length, monopolies: this.monopolies(t).length, full: this.fullMonopolies(t).length, banks: this.groupCount(t.id, 'BANK'),
      fdi: t.fdi, bankrupt: t.bankrupt, acquired: t.acquired,
    })).sort((a, b) => b.score - a.score);
    const top = [...this.players.values()].sort((a, b) => b.correct - a.correct).slice(0, 5)
      .map((p) => ({ id: p.id, name: p.name, team: p.team, correct: p.correct, answered: p.answered }));
    const mostMono = ranking.slice().sort((a, b) => b.monopolies - a.monopolies || b.props - a.props)[0];
    this.summary = { ranking, topPlayers: top, mostMonopoly: mostMono && mostMono.props ? mostMono.id : null };
    this.addLog('Game kết thúc.', 'sys');
    this.setStage('end', 0, this.summary);
  }

  forceEnd() { if (this.started && this.stage.name !== 'end') { clearTimeout(this.timer); this.endGame(); } }

  // ---------- góc nhìn ----------
  pub() {
    return {
      phase: this.phase, round: this.round, rounds: this.cfg.rounds, turn: this.turnCount, totalTurns: this.totalTurns,
      started: this.started, activeTeam: this.activeTeam, fund: this.fund,
      owners: this.owners, upgraded: this.upgraded, cartel: this.cartel,
      teams: this.teams.map((t) => ({
        id: t.id, name: t.name, color: t.color, cash: t.cash, pos: t.pos, fdi: t.fdi, shield: t.shield, net: this.net(t),
        correct: t.correct, bankrupt: t.bankrupt, acquired: t.acquired, props: this.propsOf(t).length,
        monopolies: this.monopolies(t), banks: this.groupCount(t.id, 'BANK'),
        members: this.members(t.id).map((p) => ({ id: p.id, name: p.name, online: p.online, correct: p.correct, device: p.device })),
      })),
      lobbyPlayers: this.started ? undefined : [...this.players.values()].map((p) => ({ id: p.id, name: p.name, team: p.team, online: p.online, device: p.device })),
      log: this.log.slice(-40),
      paused: this.paused,
      hold: this.cfg.hold,
    };
  }

  view(role, playerId) {
    const s = this.pub();
    const st = this.stage;
    const out = { name: st.name, deadline: st.deadline, paused: this.paused, data: { ...st.data } };
    if (st.name === 'quiz' && this.quiz) {
      out.data.answered = this.quiz.answers.size;
      out.data.online = [...this.players.values()].filter((p) => p.online).length;
      out.data.byTeam = this.teams.map((t) => this.members(t.id).filter((p) => this.quiz.answers.has(p.id)).length);
      if (role === 'player') out.data.myAnswer = this.quiz.answers.has(playerId) ? this.quiz.answers.get(playerId) : null;
    }
    if (st.name === 'quiz_result' && this.quiz && role === 'player') {
      out.data.myAnswer = this.quiz.answers.has(playerId) ? this.quiz.answers.get(playerId) : null;
    }
    if (st.name === 'decision' && this.turn) {
      // Không lộ gì thêm
    }
    s.stage = out;
    s.now = Date.now();
    if (role === 'player') {
      const p = this.players.get(playerId);
      if (p) s.me = { id: p.id, name: p.name, team: p.team, correct: p.correct };
    }
    return s;
  }
}

module.exports = { Game };
