(function () {
  const { esc, tickTimers, DUR, die, LETTER, toast } = G;
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const fmt = (n) => Math.round(n).toLocaleString('vi-VN');
  const DESK = window.matchMedia('(min-width: 980px)');
  let ST = null, S = null, api = null;
  let room = G.cleanCode(params.get('room') || '');
  let rec = null; // { room, playerId, name }
  try { rec = JSON.parse(localStorage.getItem('mln_player') || 'null'); } catch (_) {}
  if (rec && room && rec.room !== room) rec = null;
  if (!room && rec) room = rec.room;
  let pendingName = '';
  try { pendingName = localStorage.getItem('mln_name') || ''; } catch (_) {}
  if (!pendingName && rec) pendingName = rec.name;

  // ---------- vào phòng ----------
  function showJoin(msg) {
    $('app').classList.add('hide'); $('joinView').classList.remove('hide');
    $('room').value = room; $('name').value = pendingName || '';
    $('joinErr').textContent = msg || '';
    checkRoomInfo();
    (room.length === 4 ? $('name') : $('room')).focus({ preventScroll: true });
  }

  let infoSeq = 0;
  async function checkRoomInfo() {
    const code = G.cleanCode($('room').value), box = $('roomInfo'), seq = ++infoSeq;
    if (code.length !== 4) { box.classList.add('hide'); return null; }
    const r = await G.checkRoom(code);
    if (seq !== infoSeq) return r;
    box.classList.remove('hide', 'bad');
    if (r.ok === false) { box.classList.add('bad'); box.textContent = `Không tìm thấy phòng ${code}. Kiểm tra lại mã trên màn hình host.`; }
    else if (r.ok == null) box.classList.add('hide');
    else if (r.ended) { box.classList.add('bad'); box.textContent = `Ván ở phòng ${code} đã kết thúc.`; }
    else box.innerHTML = `<b>Phòng ${esc(code)}</b> · ${r.players} người · ${r.started ? 'đang chơi, bạn sẽ vào đội ít người nhất' : 'đang chờ bắt đầu'}`;
    return r;
  }
  let infoTimer = null;
  $('room').addEventListener('input', (e) => {
    const v = G.cleanCode(e.target.value);
    if (v !== e.target.value) e.target.value = v;
    clearTimeout(infoTimer); infoTimer = setTimeout(checkRoomInfo, 250);
  });

  $('joinForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    room = G.cleanCode($('room').value);
    pendingName = $('name').value.trim();
    if (room.length !== 4) { $('joinErr').textContent = 'Mã phòng gồm 4 ký tự.'; return $('room').focus(); }
    if (!pendingName) { $('joinErr').textContent = 'Hãy nhập tên của bạn.'; return $('name').focus(); }
    $('joinBtn').disabled = true;
    const r = await checkRoomInfo();
    $('joinBtn').disabled = false;
    if (r && (r.ok === false || r.ended)) { $('joinErr').textContent = ''; return; }
    rec = rec && rec.room === room ? rec : null;
    history.replaceState(null, '', 'play.html?room=' + encodeURIComponent(room));
    start();
  });

  function hello() { return { t: 'join', room, name: pendingName, playerId: rec ? rec.playerId : undefined, device: G.isMobile ? 'mobile' : 'desktop' }; }
  function leave(msg) {
    try { localStorage.removeItem('mln_player'); } catch (_) {}
    rec = null; S = null;
    if (api) { api.close(); api = null; }
    $('conn').classList.add('hide');
    showJoin(msg);
  }
  function start() {
    if (api) { api.close(); api = null; }
    api = G.connect({
      hello,
      onStatus: (s) => $('conn').classList.toggle('hide', s === 'open'),
      onMessage: (m) => {
        if (m.t === 'welcome') {
          ST = m.static; room = m.room;
          rec = { room: m.room, playerId: m.playerId, name: pendingName };
          try { localStorage.setItem('mln_player', JSON.stringify(rec)); localStorage.setItem('mln_name', pendingName); } catch (_) {}
          $('joinView').classList.add('hide'); $('app').classList.remove('hide');
          $('roomCode').textContent = room;
          fit();
        } else if (m.t === 'state') { S = m.s; render(); }
        else if (m.t === 'error') { if ($('joinView').classList.contains('hide')) toast(m.msg); else $('joinErr').textContent = m.msg; }
        else if (m.t === 'gone') leave('Mã phòng không đúng hoặc phòng đã đóng. Kiểm tra lại mã.');
        else if (m.t === 'kicked') leave('Host đã mời bạn ra khỏi phòng. Bạn có thể vào lại bằng tên khác.');
      },
    });
  }
  let auto = null;
  try { auto = sessionStorage.getItem('mln_autojoin'); sessionStorage.removeItem('mln_autojoin'); } catch (_) {}
  if (auto && auto === room && pendingName) { // đã nhập mã + tên ở trang chủ
    if (rec && rec.name !== pendingName) rec = null; // tên khác: vào như người chơi mới
    start();
  } else if (rec) { pendingName = rec.name; start(); }
  else showJoin('');
  const send = (o) => api && api.send(o);

  // ---------- bố cục: máy tính hiện cả 3 vùng, điện thoại chuyển tab ----------
  let tab = 'play';
  function setTab(t) {
    tab = t;
    $('app').dataset.tab = t;
    document.querySelectorAll('[data-tabto]').forEach((b) => b.setAttribute('aria-current', b.dataset.tabto === t ? 'page' : 'false'));
    $('badge').classList.toggle('hide', t === 'play' || !(S && S.me && needsMe()));
    if (!DESK.matches) window.scrollTo(0, 0);
    fit();
  }
  function fit() {
    const b = $('board');
    const W = document.documentElement.clientWidth, H = document.documentElement.clientHeight; // như host.js: không dùng innerWidth
    if (DESK.matches) {
      const hh = document.querySelector('.pbar').offsetHeight || 56;
      const avail = Math.min(H - hh - 24, W - 340 - 46);
      G.board.size(b, Math.floor(Math.max(440, Math.min(avail, 1100))));
    } else G.board.size(b, Math.min(W - 16, 680));
  }
  window.addEventListener('resize', fit);
  DESK.addEventListener('change', () => { fit(); render(); });
  setTab('play');

  // ---------- tiện ích ----------
  const timerBar = (ms) => `<div class="timer" data-timer data-total="${ms}"><i></i></div>`;
  const teamTag = (i) => `<span class="dot" style="background:${S.teams[i].color}"></span> <b>${esc(S.teams[i].name)}</b>`;
  const grpColor = (g) => ST.groups[g].color;
  const kb = (k) => `<kbd class="kb">${k}</kbd>`;
  const devIcon = (m) => (m.device === 'mobile' ? '📱' : '💻');

  // người chơi này có việc phải làm ở bước hiện tại không
  function needsMe() {
    const me = S.me, st = S.stage, d = st.data;
    if (st.name === 'roll') return d.playerId === me.id;
    if (st.name === 'quiz') return d.myAnswer == null;
    if (st.name === 'decision') return d.teamId === me.team;
    if (st.name === 'cartel_vote') return d.to === me.team;
    return false;
  }

  // ---------- vùng "Lượt chơi" ----------
  function mainHTML() {
    const me = S.me, st = S.stage, d = st.data, mine = d.teamId === me.team;
    const myTeam = S.teams[me.team];
    switch (st.name) {
      case 'lobby': {
        const picks = S.teams.map((t, i) => {
          const on = t.id === me.team;
          const names = t.members.map((m) => esc(m.name)).join(', ');
          const label = `${on ? 'Đội của bạn' : 'Vào đội'} ${t.name}, ${t.members.length} người${names ? ': ' + t.members.map((m) => m.name).join(', ') : ''}`;
          return `<button class="tp ${on ? 'on' : ''}" style="--tc:${t.color}" aria-label="${esc(label)}" ${on ? 'disabled aria-current="true"' : ''} data-key="${i + 1}" data-send='{"t":"pick_team","team":${t.id}}'>
            <span class="tp-head"><span class="dot" style="background:${t.color}"></span><b>${esc(t.name)}</b><span class="tp-n">${t.members.length} người</span></span>
            <span class="tp-mem">${names || 'Chưa có ai'}</span>
            <span class="tp-act">${on ? '✓ Đội của bạn' : `${kb(i + 1)} Vào đội này`}</span></button>`;
        }).join('');
        return `<div class="panel"><h2>Chọn đội</h2><p class="lead">Bạn đang ở đội <span style="color:${myTeam.color}">${esc(myTeam.name)}</span>. Bạn có thể đổi đội cho tới khi game bắt đầu.</p>
          <div class="teampick">${picks}</div>
          <p class="sub">Chỉ host mới bắt đầu được game: chờ host bấm “Bắt đầu game” trên màn hình host.</p>
          <button class="btn ghost" data-ui="invite">Mời bạn bè vào phòng (QR + mã)</button>
          <p class="sub">${G.isMobile ? 'Giữ màn hình sáng. Nếu mất kết nối, trang sẽ tự nối lại.' : 'Phím tắt khi chơi: Space để tung xúc xắc, A–D hoặc 1–4 để trả lời, số 1–3 để chọn quyết định.'}</p></div>`;
      }
      case 'phase':
        return `<div class="panel"><span class="pill" style="justify-self:start">Giai đoạn ${d.phase}/3</span><h2>${esc(d.info.name)}</h2><p class="lead">${esc(d.info.lead)}</p><p>${esc(d.info.body)}</p>${timerBar(DUR.phase)}</div>`;
      case 'roll': {
        const isMe = d.playerId === me.id;
        if (isMe) return `<div class="panel act"><p class="lead">Đến lượt đội bạn. Bạn là người tung xúc xắc.</p><button class="btn gold bigbtn" data-key="space enter r" data-send='{"t":"roll"}'>Tung xúc xắc ${kb('Space')}</button>${timerBar(DUR.roll)}</div>`;
        return `<div class="panel"><p class="lead">${mine ? `${esc(d.playerName)} sẽ tung xúc xắc cho đội bạn` : `${teamTag(d.teamId)} đang tung xúc xắc`}</p><p class="sub">Chuẩn bị trả lời câu hỏi sắp tới.</p>${timerBar(DUR.roll)}</div>`;
      }
      case 'moving':
        return `<div class="panel"><div class="dice">${die(d.d1)}${die(d.d2)}</div><p class="lead" style="text-align:center">${teamTag(d.teamId)} đến “${esc(ST.tiles[d.to].name)}”</p></div>`;
      case 'quiz': {
        const my = d.myAnswer;
        const ch = d.opts.map((o, i) => `<button class="choice ${my === i ? 'sel' : ''} ${my != null && my !== i ? 'dim' : ''}" ${my != null ? 'disabled' : ''} data-key="${LETTER[i].toLowerCase()} ${i + 1}" data-send='{"t":"answer","choice":${i}}'><b>${LETTER[i]}</b><span>${esc(o)}</span></button>`).join('');
        return `<div class="panel ${my == null ? 'act' : ''}"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span class="pill">${esc(d.sec)}</span><span class="num" style="font-weight:700;font-size:1.3rem" data-secs></span></div>
          <h2 style="font-size:1.2rem">${esc(d.q)}</h2><div class="choices">${ch}</div>
          <p class="sub">${my != null ? 'Đã ghi nhận. Chờ cả lớp.' : `Cả lớp cùng trả lời. Đội đang chơi trả lời đúng ≥ 50% sẽ được giảm 30% chi phí. ${kb('A–D')}`} (${d.answered}/${d.online})</p>${timerBar(DUR.quiz)}</div>`;
      }
      case 'quiz_result': {
        const my = d.myAnswer, ok = my === d.correct;
        const ch = d.opts.map((o, i) => `<div class="choice ${i === d.correct ? 'right' : my === i ? 'wrong' : 'dim'}"><b>${LETTER[i]}</b><span>${esc(o)}</span></div>`).join('');
        const t = d.perTeam[me.team];
        return `<div class="panel"><div class="verdict ${ok ? 'ok' : 'no'}">${my == null ? 'Bạn chưa trả lời' : ok ? 'Chính xác' : 'Chưa đúng'}</div>
          <div class="choices">${ch}</div><p><b>Giải thích:</b> ${esc(d.why)}</p>
          <p class="sub">Đội bạn đúng ${t.correct}/${t.members}. ${d.bonus ? `${esc(S.teams[d.teamId].name)} đạt lợi thế tri thức.` : `${esc(S.teams[d.teamId].name)} chưa đạt lợi thế tri thức.`}</p></div>`;
      }
      case 'decision': {
        if (!mine) return `<div class="panel"><p class="lead">${teamTag(d.teamId)} đang quyết định</p><h2 style="font-size:1.2rem">${esc(d.title)}</h2><p class="sub">${esc(d.text)}</p>${timerBar(DUR.decision)}</div>`;
        const btns = d.options.map((o, i) => `<button class="btn ${o.id === 'skip' || o.id === 'rent' ? 'ghost' : 'gold'} bigbtn" ${o.disabled ? 'disabled' : ''} data-key="${i + 1}" data-send='${JSON.stringify({ t: 'decide', action: o.id })}'>${kb(i + 1)} ${esc(o.label)}${o.disabled ? ' (không đủ vốn)' : ''}</button>`).join('');
        return `<div class="panel act"><h2>${esc(d.title)}</h2><p class="lead">${esc(d.text)}</p><p class="sub">Cả đội cùng bàn, ai bấm trước thì quyết định.</p><div class="choices">${btns}</div>${timerBar(DUR.decision)}</div>`;
      }
      case 'cartel_vote': {
        if (d.to !== me.team) return `<div class="panel"><p class="lead">${teamTag(d.from)} mời ${teamTag(d.to)} lập Cartel.</p>${timerBar(DUR.cartel_vote)}</div>`;
        return `<div class="panel act"><h2>Lời mời lập Cartel</h2><p class="lead">${teamTag(d.from)} đề nghị thỏa thuận giá: 3 vòng tới miễn tiền thuê cho nhau và nâng giá ×1,3 với đội còn lại. Cartel có thể tan vỡ.</p>
          <div class="choices"><button class="btn gold bigbtn" data-key="y 1" data-send='{"t":"vote","accept":true}'>${kb('Y')} Đồng ý</button><button class="btn ghost bigbtn" data-key="n 2" data-send='{"t":"vote","accept":false}'>${kb('N')} Từ chối</button></div>${timerBar(DUR.cartel_vote)}</div>`;
      }
      case 'result': {
        const lines = d.lines.map((l) => `<div class="logline ${l.kind}">${esc(l.text)}</div>`).join('');
        const card = d.card ? `<div class="cardbox ${d.card.crisis ? 'crisis' : ''}"><b>${d.card.crisis ? 'Khủng hoảng' : 'Thời cuộc'}: ${esc(d.card.title)}</b><div>${esc(d.card.text)}</div><div class="th">${esc(d.card.theory)}</div></div>` : '';
        return `<div class="panel"><h2 style="font-size:1.2rem">${teamTag(d.teamId)} tại “${esc(ST.tiles[d.tile].name)}”</h2>${card}<div>${lines}</div></div>`;
      }
      case 'end': {
        const rows = d.ranking.map((r, i) => `<div class="r ${i === 0 ? 'first' : ''}" style="border-left-color:${S.teams[r.id].color}"><span class="big">${i + 1}</span><div><b>${esc(S.teams[r.id].name)}</b><div class="sub">Tài sản ${fmt(r.net)} · ${r.correct} câu đúng</div></div><span class="big">${fmt(r.score)}</span></div>`).join('');
        const mineRank = d.ranking.findIndex((r) => r.id === me.team) + 1;
        return `<div class="panel"><h2>Kết thúc game</h2><p class="lead">Đội bạn xếp hạng ${mineRank}. Bạn trả lời đúng ${me.correct} câu.</p><div class="podium">${rows}</div>
          <a class="btn ghost" href="index.html" data-ui="leave">Về trang chủ</a></div>`;
      }
      default: return '';
    }
  }

  function assetsHTML() {
    if (!S.started) return '';
    const t = S.teams[S.me.team];
    const mine = [];
    S.owners.forEach((o, i) => { if (o === t.id) mine.push(i); });
    const chips = mine.map((i) => `<button class="asset" data-tile="${i}" style="background:${grpColor(ST.tiles[i].group)}">${esc(ST.tiles[i].name)}${S.upgraded[i] ? ' ★' : ''}</button>`).join('');
    return `<div class="panel flat"><b>Tài sản đội: ${fmt(t.net)}</b><div class="assets">${chips || '<span class="sub">Chưa sở hữu ngành nào</span>'}</div>
      <p class="sub">${t.fdi ? `${t.fdi} nhà máy ở nước ngoài. ` : ''}${t.shield ? 'Có lá chắn miễn tiền thuê. ' : ''}${t.monopolies.length ? `Chi phối ${t.monopolies.length} nhóm ngành.` : ''}</p></div>`;
  }

  // ---------- giữa bàn cờ (bản tóm tắt cho người chơi) ----------
  function centerHTML() {
    const st = S.stage, d = st.data;
    switch (st.name) {
      case 'lobby': {
        const n = (S.lobbyPlayers || []).length;
        return `<div class="pc-lobby"><button class="qr pc-qr" data-ui="invite" title="Phóng to mã QR">${G.qrSvg(G.joinUrl(room))}</button>
          <div class="pc-lobby-info"><h3>Mời bạn cùng chơi</h3><div class="roomcode sm">${esc(room)}</div>
          <p class="sub">📱 Quét QR · 💻 vào <b class="num">${esc(G.prettyUrl(G.siteBase()))}</b> nhập mã</p><p class="lead">${n} người trong phòng</p></div></div>`;
      }
      case 'phase':
        return `<span class="pill" style="align-self:flex-start">Giai đoạn ${d.phase}/3</span><h2>${esc(d.info.name)}</h2><p class="lead">${esc(d.info.lead)}</p><div style="margin-top:auto">${timerBar(DUR.phase)}</div>`;
      case 'roll':
        return `<p class="sub">Vòng ${S.round}/${S.rounds}</p><h2>${teamTag(d.teamId)}</h2><p class="lead">${esc(d.playerName)} tung xúc xắc…</p><div style="margin-top:auto">${timerBar(DUR.roll)}</div>`;
      case 'moving':
        return `<h3>${teamTag(d.teamId)} di chuyển</h3><div class="dice" style="margin:auto">${die(d.d1)}${die(d.d2)}</div><p class="lead" style="text-align:center">Đến ô “${esc(ST.tiles[d.to].name)}”</p>`;
      case 'quiz': {
        const per = S.teams.map((t, i) => `<span class="chip" style="border-color:${t.color}">${esc(t.name)} ${d.byTeam[i]}/${t.members.length}</span>`).join(' ');
        return `<span class="pill" style="align-self:flex-start">Câu hỏi cả lớp</span><div class="bigsecs num" data-secs></div>
          <p class="lead" style="text-align:center">${d.answered}/${d.online} đã trả lời</p><div class="chips-row">${per}</div><div style="margin-top:auto">${timerBar(DUR.quiz)}</div>`;
      }
      case 'quiz_result': {
        const bars = d.perTeam.map((p, i) => `<div class="bar"><span>${esc(S.teams[i].name)}</span><div class="tr"><i style="width:${p.members ? (100 * p.correct) / p.members : 0}%;background:${S.teams[i].color}"></i></div><span>${p.correct}/${p.members}</span></div>`).join('');
        return `<h3>Kết quả câu hỏi</h3><div class="bars">${bars}</div><p class="lead">${teamTag(d.teamId)} ${d.bonus ? 'được giảm 30% chi phí.' : 'chưa đạt lợi thế tri thức.'}</p>`;
      }
      case 'decision':
        return `<span class="pill" style="align-self:flex-start">Ô “${esc(ST.tiles[d.tile].name)}”</span><h3>${esc(d.title)}</h3><p class="sub">${teamTag(d.teamId)} đang quyết định</p><div style="margin-top:auto">${timerBar(DUR.decision)}</div>`;
      case 'cartel_vote':
        return `<h3>Lời mời lập Cartel</h3><p class="lead">${teamTag(d.from)} mời ${teamTag(d.to)}</p><div style="margin-top:auto">${timerBar(DUR.cartel_vote)}</div>`;
      case 'result': {
        const card = d.card ? `<div class="cardbox ${d.card.crisis ? 'crisis' : ''}"><b>${esc(d.card.title)}</b></div>` : '';
        return `<h3>${teamTag(d.teamId)} tại “${esc(ST.tiles[d.tile].name)}”</h3>${card}<div>${d.lines.slice(-4).map((l) => `<div class="logline ${l.kind}">${esc(l.text)}</div>`).join('')}</div>`;
      }
      case 'end': {
        const rows = d.ranking.map((r, i) => `<div class="r ${i === 0 ? 'first' : ''}" style="border-left-color:${S.teams[r.id].color}"><span class="big">${i + 1}</span><b>${esc(S.teams[r.id].name)}</b><span class="big">${fmt(r.score)}</span></div>`).join('');
        return `<h2>Kết quả</h2><div class="podium">${rows}</div>`;
      }
      default: return '';
    }
  }

  function boardInfoHTML() {
    const rows = S.teams.map((t) => `<div class="posrow"><span class="dot" style="background:${t.color}"></span><b>${esc(t.name)}</b><span class="sub">ô “${esc(ST.tiles[t.pos].name)}”</span><span class="num">${fmt(t.cash)}</span></div>`).join('');
    return `${rows}<p class="sub">Chạm vào một ô để xem chi tiết. Có thể phóng to bằng hai ngón tay.</p>`;
  }

  // ---------- vùng "Các đội" ----------
  function teamsHTML() {
    const list = S.started ? [...S.teams].sort((a, b) => b.net - a.net) : S.teams;
    return list.map((t, rank) => {
      const act = S.started && S.activeTeam === t.id && S.stage.name !== 'end';
      const mine = t.id === S.me.team;
      const metas = S.started ? [
        `<span class="chip">Tài sản ${fmt(t.net)}</span>`,
        `<span class="chip">${t.props} ngành</span>`,
        t.monopolies.length ? `<span class="chip gold">${t.monopolies.length} nhóm chi phối</span>` : '',
        t.banks ? `<span class="chip ${t.banks === 3 ? 'gold' : ''}">${t.banks}/3 ngân hàng</span>` : '',
        t.fdi ? `<span class="chip">${t.fdi} nhà máy ngoài nước</span>` : '',
        t.shield ? '<span class="chip gold">lá chắn</span>' : '',
        S.cartel && (S.cartel.a === t.id || S.cartel.b === t.id) ? '<span class="chip gold">Cartel</span>' : '',
      ].join('') : `<span class="chip">${t.members.length} người</span>`;
      const mem = t.members.map((m) => `<span class="chip ${m.online ? '' : 'off'} ${m.id === S.me.id ? 'gold' : ''}">${devIcon(m)} ${esc(m.name)}${S.started ? ` · ${m.correct}✓` : ''}</span>`).join('');
      return `<div class="team ${act ? 'act' : ''} ${mine ? 'mine' : ''}" style="--tc:${t.color}"><div class="row"><span class="name">${S.started ? `${rank + 1}. ` : ''}${esc(t.name)}${mine ? ' <span class="chip">đội bạn</span>' : ''}</span><span class="cash">${fmt(t.cash)}</span></div>
        <div class="meta">${metas}</div><div class="members">${mem || '<span class="sub">Chưa có ai</span>'}</div></div>`;
    }).join('') + (S.started ? `<div class="chip" style="justify-self:start">Quỹ Nhà nước: ${fmt(S.fund)}</div>` : '');
  }
  const logHTML = () => S.log.slice(-12).map((l) => `<div class="${l.kind}">${esc(l.text)}</div>`).join('') || '<div class="sub">Nhật ký ván chơi sẽ hiện ở đây.</div>';

  function headHTML() {
    const t = S.teams[S.me.team];
    return `<span class="dot" style="background:${t.color}"></span><div class="who"><b>${esc(S.me.name)}</b><span>Đội ${esc(t.name)}</span></div>${S.started ? `<div class="cashbox"><b class="num">${fmt(t.cash)}</b><span>vốn</span></div>` : ''}`;
  }

  // ---------- vẽ ----------
  let lastKey = '';
  function render() {
    if (!ST || !S || !S.me) return;
    if ($('app').classList.contains('hide')) return;
    const need = needsMe();
    const key = S.turn + ':' + S.stage.name;
    if (key !== lastKey) {
      if (need && !DESK.matches && tab !== 'play') setTab('play');
      if (need && navigator.vibrate) navigator.vibrate([30, 60, 30]);
      lastKey = key;
    }
    $('badge').classList.toggle('hide', !need || tab === 'play');
    document.title = need ? '🔔 Đến lượt bạn · Cờ Tỷ Phú' : 'Cờ Tỷ Phú: người chơi';
    $('phaseTxt').textContent = S.stage.name === 'end' ? 'Ván đã kết thúc' : S.started && S.phase ? `Giai đoạn ${S.phase}: ${ST.phases[S.phase].name} · Vòng ${Math.max(1, S.round)}/${S.rounds}${S.paused ? ' · Tạm dừng' : ''}` : 'Phòng chờ';
    $('me').innerHTML = headHTML();
    $('main').innerHTML = mainHTML();
    $('assets').innerHTML = assetsHTML();
    $('board').innerHTML = G.board.html(ST, S, centerHTML());
    $('boardInfo').innerHTML = boardInfoHTML();
    $('teams').innerHTML = teamsHTML();
    $('log').innerHTML = logHTML();
    tickTimers(S.stage);
  }
  G.netReady.then(render);

  // ---------- thao tác ----------
  document.addEventListener('click', (e) => {
    const tb = e.target.closest('[data-tabto]');
    if (tb) return setTab(tb.dataset.tabto);
    const ui = e.target.closest('[data-ui]');
    if (ui && ui.dataset.ui === 'invite') return G.showInvite(room);
    if (ui && ui.dataset.ui === 'leave') { try { localStorage.removeItem('mln_player'); } catch (_) {} return; }
    const tile = e.target.closest('[data-tile]');
    if (tile && ST && S) return G.board.showTile(ST, S, Number(tile.dataset.tile));
    const b = e.target.closest('[data-send]');
    if (!b || b.disabled) return;
    try { send(JSON.parse(b.dataset.send)); } catch (_) {}
    if (navigator.vibrate) navigator.vibrate(15);
  });

  // Phím tắt trên máy tính: Space tung xúc xắc, A–D / 1–4 trả lời, số chọn quyết định, Y/N cho Cartel
  document.addEventListener('keydown', (e) => {
    if (!S || e.ctrlKey || e.metaKey || e.altKey || e.repeat || document.getElementById('gmodal')) return;
    const tgt = e.target instanceof Element ? e.target : null;
    if (tgt && tgt.closest('input, select, textarea')) return;
    const k = e.key === ' ' ? 'space' : e.key === 'Enter' ? 'enter' : e.key.toLowerCase();
    if ((k === 'space' || k === 'enter') && tgt && tgt.closest('button, a')) return; // để trình duyệt tự bấm nút đang focus
    const b = [...document.querySelectorAll('#main [data-key]')].find((x) => !x.disabled && x.dataset.key.split(' ').includes(k));
    if (!b) return;
    e.preventDefault();
    b.click();
  });
  setInterval(() => { if (S) tickTimers(S.stage); }, 150);
})();
