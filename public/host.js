(function () {
  const { esc, tickTimers, DUR, die, LETTER, toast } = G;
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  let ST = null;      // dữ liệu tĩnh
  let S = null;       // trạng thái mới nhất
  let api = null;
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem('mln_host') || 'null'); } catch (_) {}

  const fmt = (n) => Math.round(n).toLocaleString('vi-VN');
  const tc = (i) => 't' + i;

  // ---------- kết nối ----------
  function hello() {
    if (saved && saved.room && !params.get('new')) return { t: 'host_resume', room: saved.room, hostToken: saved.token };
    if (saved && saved.room && params.get('new') && saved.created) return { t: 'host_resume', room: saved.room, hostToken: saved.token };
    return { t: 'host_create', teams: Number(params.get('teams')) || 3, rounds: Number(params.get('rounds')) || 10 };
  }
  api = G.connect({
    hello,
    onStatus: (s) => $('conn').classList.toggle('hide', s === 'open'),
    onMessage: (m) => {
      if (m.t === 'welcome') {
        ST = m.static;
        saved = { room: m.room, token: m.hostToken, created: true };
        try { localStorage.setItem('mln_host', JSON.stringify(saved)); } catch (_) {}
        history.replaceState(null, '', 'host.html');
        params.delete('new');
      } else if (m.t === 'state') { S = m.s; render(); }
      else if (m.t === 'error') toast(m.msg);
      else if (m.t === 'gone') { try { localStorage.removeItem('mln_host'); } catch (_) {} saved = null; location.href = 'index.html'; }
    },
  });
  const send = (o) => api.send(o);

  // ---------- bố cục ----------
  // Bàn cờ chiếm gần hết chiều cao màn hình, cột đội + nhật ký bên phải rộng tối thiểu 300px.
  // Màn hình dọc hoặc hẹp (điện thoại, máy tính bảng dọc): bàn cờ ở trên, cột đội ở dưới.
  function fit() {
    const W = window.innerWidth, H = window.innerHeight;
    const head = document.querySelector('.hbar').offsetHeight || 56;
    const stacked = W < 900 || W < H;
    document.body.classList.toggle('stacked', stacked);
    const bs = stacked ? Math.min(W - 24, 860) : Math.max(440, Math.min(H - head - 24, W - 300 - 38, 1200));
    G.board.size($('board'), Math.floor(bs));
  }
  window.addEventListener('resize', fit);
  fit();

  // ---------- trung tâm ----------
  function timerBar(ms) { return `<div class="timer" data-timer data-total="${ms}"><i></i></div>`; }
  const team = (i) => S.teams[i];
  const teamTag = (i) => `<span class="dot" style="background:${team(i).color}"></span> <b>${esc(team(i).name)}</b>`;

  function centerHTML() {
    const st = S.stage, d = st.data;
    switch (st.name) {
      case 'lobby': {
        const url = G.joinUrl(saved.room);
        const lp = S.lobbyPlayers || [];
        const nMob = lp.filter((p) => p.device === 'mobile').length;
        const noLan = G.isLocalHost && !G.net.ip;
        return `<div class="lobby-center">
          <button class="qr lobby-qr" data-act="invite" title="Phóng to mã QR">${G.qrSvg(url)}</button>
          <div class="lobby-info">
            <h2>Vào phòng chơi</h2>
            <div class="how"><span class="howic" aria-hidden="true">📱</span><div><b>Điện thoại</b><span>Mở camera, quét mã QR bên cạnh</span></div></div>
            <div class="how"><span class="howic" aria-hidden="true">💻</span><div><b>Máy tính</b><span>Vào <b class="num">${esc(G.prettyUrl(G.siteBase()))}</b>, nhập mã phòng</span></div></div>
            <div class="roomcode">${esc(saved.room)}</div>
            ${noLan ? '<p class="warnbox">Đang mở bằng localhost: điện thoại sẽ không vào được. Hãy mở trang host bằng IP của máy.</p>' : `<p class="sub">Link nhanh: <b class="num">${esc(G.prettyUrl(url))}</b></p>`}
            <p class="lead">${lp.length} người đã vào (${nMob} điện thoại, ${lp.length - nMob} máy tính) · ${S.teams.length} đội</p>
            ${startHTML()}
          </div></div>`;
      }
      case 'phase': {
        const p = d.info;
        return `<span class="pill" style="align-self:flex-start">Giai đoạn ${d.phase} / 3</span>
          <h2>${esc(p.name)}</h2><p class="lead">${esc(p.lead)}</p><p>${esc(p.body)}</p>
          <div><b style="font-size:.9em">Mở khóa trong giai đoạn này</b><ul class="unlock">${p.unlock.map((u) => `<li>${esc(u)}</li>`).join('')}</ul></div>
          <p class="sub" style="margin-top:auto">${esc(p.ref)}</p>${timerBar(DUR.phase)}`;
      }
      case 'roll':
        return `<p class="sub">Vòng ${S.round}/${S.rounds}</p><h2>${teamTag(d.teamId)}</h2>
          <p class="lead">${esc(d.playerName)} tung xúc xắc trên điện thoại</p>
          <div style="margin:auto 0;text-align:center" class="sub">Đang chờ…</div>${timerBar(DUR.roll)}`;
      case 'moving':
        return `<h2>${teamTag(d.teamId)} di chuyển</h2><div class="dice" style="margin:auto">${die(d.d1)}${die(d.d2)}</div>
          <p class="lead" style="text-align:center">Đến ô “${esc(ST.tiles[d.to].name)}”${d.passed ? ' (qua Xuất phát, nhận lợi nhuận)' : ''}</p>`;
      case 'quiz': {
        const per = S.teams.map((t, i) => `<span class="chip" style="border-color:${t.color}">${esc(t.name)} ${d.byTeam[i]}/${t.members.length}</span>`).join(' ');
        return `<div style="display:flex;justify-content:space-between;align-items:center"><span class="pill">Câu hỏi cả lớp · ${esc(d.sec)}</span><span class="num" style="font-size:1.6em;font-weight:700" data-secs></span></div>
          <h3>${esc(d.q)}</h3>
          <div class="opts">${d.opts.map((o, i) => `<div class="opt"><b>${LETTER[i]}</b><span>${esc(o)}</span></div>`).join('')}</div>
          <div style="margin-top:auto;display:grid;gap:6px"><div class="sub"><b>${d.answered}/${d.online}</b> đã trả lời · ${per}</div>${timerBar(DUR.quiz)}</div>`;
      }
      case 'quiz_result': {
        const bars = d.perTeam.map((p, i) => `<div class="bar ${tc(i)}"><span>${esc(team(i).name)}</span><div class="tr"><i style="width:${p.members ? (100 * p.correct) / p.members : 0}%;background:${team(i).color}"></i></div><span>${p.correct}/${p.members}</span></div>`).join('');
        return `<h3>${esc(d.q)}</h3>
          <div class="opts">${d.opts.map((o, i) => `<div class="opt ${i === d.correct ? 'right' : 'wrong'}"><b>${LETTER[i]}</b><span>${esc(o)}</span></div>`).join('')}</div>
          <p class="sub"><b>Giải thích:</b> ${esc(d.why)}</p>
          <div class="bars">${bars}</div>
          <p class="lead">${d.bonus ? `${teamTag(d.teamId)} đạt <b>lợi thế tri thức</b>: chi phí lượt này giảm 30%.` : `${teamTag(d.teamId)} chưa đạt lợi thế tri thức.`}</p>`;
      }
      case 'decision': {
        const tl = ST.tiles[d.tile];
        return `<span class="pill" style="align-self:flex-start">Ô “${esc(tl.name)}”</span><h2>${esc(d.title)}</h2><p class="lead">${esc(d.text)}</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap">${d.options.map((o) => `<span class="chip ${o.disabled ? 'off' : ''}">${esc(o.label)}</span>`).join('')}</div>
          <p class="sub" style="margin-top:auto">${teamTag(d.teamId)} đang quyết định trên điện thoại</p>${timerBar(DUR.decision)}`;
      }
      case 'cartel_vote':
        return `<h2>Lời mời lập Cartel</h2><p class="lead">${teamTag(d.from)} mời ${teamTag(d.to)} thỏa thuận giá. Đội ${esc(team(d.to).name)} chọn Đồng ý hoặc Từ chối trên điện thoại.</p>${timerBar(DUR.cartel_vote)}`;
      case 'result': {
        const lines = d.lines.map((l) => `<div class="logline ${l.kind}">${esc(l.text)}</div>`).join('');
        const card = d.card ? `<div class="cardbox ${d.card.crisis ? 'crisis' : ''}"><b>${d.card.crisis ? 'Khủng hoảng' : 'Thời cuộc'}: ${esc(d.card.title)}</b><div>${esc(d.card.text)}</div><div class="th">Lý thuyết: ${esc(d.card.theory)}</div></div>` : '';
        return `<h3>${teamTag(d.teamId)} tại “${esc(ST.tiles[d.tile].name)}”</h3>${card}<div>${lines}</div>`;
      }
      case 'end': return endHTML(d);
      default: return '';
    }
  }

  function endHTML(d) {
    const rows = d.ranking.map((r, i) => {
      const t = team(r.id);
      return `<div class="r ${i === 0 ? 'first' : ''}" style="border-left-color:${t.color}"><span class="big">${i + 1}</span>
        <div><b>${esc(t.name)}</b><div class="sub">Tài sản ròng ${fmt(r.net)} · ${r.correct} câu đúng · ${r.props} ngành · ${r.monopolies} nhóm chi phối · ${r.acquired} lần thôn tính · ${r.bankrupt} lần phá sản</div></div>
        <span class="big">${fmt(r.score)}</span></div>`;
    }).join('');
    const top = d.topPlayers.map((p) => `${esc(p.name)} (${p.correct})`).join(', ');
    const totalAcq = d.ranking.reduce((a, r) => a + r.acquired, 0), totalBk = d.ranking.reduce((a, r) => a + r.bankrupt, 0);
    const mono = d.mostMonopoly != null ? team(d.mostMonopoly).name : null;
    return `<h2>Kết quả cuối game</h2><div class="podium">${rows}</div>
      <p class="sub">Điểm = tài sản ròng + 10 × số câu đúng của cả đội. Xuất sắc về kiến thức: ${top || 'chưa có'}.</p>
      <div class="cardbox"><b>Bài học từ ván cờ</b><div class="sub" style="margin-top:.3em">Cạnh tranh tự do đã dẫn tới ${totalAcq} vụ thôn tính và ${totalBk} lần phá sản. ${mono ? `${esc(mono)} nắm nhiều ngành nhất, cho thấy tích tụ và tập trung dẫn tới độc quyền.` : ''} Quỹ Nhà nước và thuế lũy tiến là công cụ hạn chế mặt tiêu cực của độc quyền tư nhân.</div></div>`;
  }

  // Điều kiện bắt đầu: ít nhất 2 đội có người chơi
  function readiness() {
    const sizes = S.teams.map((t) => t.members.length);
    const filled = sizes.filter((n) => n > 0).length;
    const total = sizes.reduce((a, b) => a + b, 0);
    let why = '';
    if (!total) why = 'Đang chờ người chơi vào phòng.';
    else if (filled < 2) why = 'Cần ít nhất 2 đội có người chơi. Bấm “Xáo đội” hoặc nhờ người chơi đổi đội.';
    const uneven = filled >= 2 && Math.max(...sizes) - Math.min(...sizes.filter((n) => n > 0)) > 1;
    return { ok: !why, why, filled, uneven };
  }
  function startHTML() {
    const r = readiness();
    const note = r.ok
      ? `${r.filled}/${S.teams.length} đội có người chơi.${r.uneven ? ' Các đội đang chênh lệch, có thể bấm “Xáo đội”.' : ''}${r.filled < S.teams.length ? ' Đội không có ai sẽ bị loại khi bắt đầu.' : ' Sẵn sàng!'}`
      : r.why;
    return `<div class="startrow"><button class="btn gold bigbtn" data-act="start" ${r.ok ? '' : 'disabled'}>▶ Bắt đầu game</button><span class="sub">${esc(note)}</span></div>`;
  }

  // ---------- thanh bên ----------
  const devIcon = (m) => `<span aria-label="${m.device === 'mobile' ? 'điện thoại' : 'máy tính'}">${m.device === 'mobile' ? '📱' : '💻'}</span>`;
  function teamsHTML() {
    return S.teams.map((t) => {
      const act = S.started && S.activeTeam === t.id && S.stage.name !== 'end';
      const mem = S.started ? '' : `<div class="members">${t.members.map((m) => `<span class="mem ${m.online ? '' : 'off'}"><button class="chip" data-mv="${m.id}" data-to="${(t.id + 1) % S.teams.length}" title="Bấm để chuyển sang đội kế tiếp">${devIcon(m)} ${esc(m.name)}</button><button class="kick" data-kick="${m.id}" data-name="${esc(m.name)}" aria-label="Mời ${esc(m.name)} ra khỏi phòng" title="Mời ra khỏi phòng">×</button></span>`).join('')}${t.members.length ? '' : '<span class="sub">Chưa có ai</span>'}</div>`;
      const metas = S.started ? [
        `<span class="chip">${t.props} ngành</span>`,
        t.monopolies.length ? `<span class="chip gold">${t.monopolies.length} nhóm chi phối</span>` : '',
        t.banks ? `<span class="chip ${t.banks === 3 ? 'gold' : ''}">${t.banks}/3 ngân hàng</span>` : '',
        t.fdi ? `<span class="chip">${t.fdi} nhà máy ngoài nước</span>` : '',
        t.shield ? '<span class="chip gold">lá chắn</span>' : '',
        S.cartel && (S.cartel.a === t.id || S.cartel.b === t.id) ? '<span class="chip gold">Cartel</span>' : '',
        `<span class="chip">${t.correct} câu đúng</span>`,
      ].join('') : `<span class="chip">${t.members.length} người</span>`;
      return `<div class="team ${tc(t.id)} ${act ? 'act' : ''}" style="--tc:${t.color}"><div class="row"><span class="name">${esc(t.name)}</span><span class="cash">${fmt(t.cash)}</span></div>
        <div class="meta">${S.started ? `<span class="chip">Tài sản ròng ${fmt(t.net)}</span>` : ''}${metas}</div>${mem}</div>`;
    }).join('') + (S.started ? `<div class="chip" style="justify-self:start">Quỹ Nhà nước: ${fmt(S.fund)}</div>`
      : '<p class="sub side-hint">Người chơi tự chọn đội trên máy của họ. Host có thể bấm tên để chuyển đội, × để mời ra khỏi phòng.</p>');
  }

  function logHTML() { return S.log.slice(-9).map((l) => `<div class="${l.kind}">${esc(l.text)}</div>`).join(''); }

  // ---------- điều khiển ----------
  function ctrlHTML() {
    if (!S.started) {
      return `<button class="btn ghost small" data-act="invite">Mời người chơi</button><button class="btn ghost small" data-act="shuffle">Xáo đội</button><button class="btn ghost small" data-act="guide">Sổ tay lý thuyết</button><button class="btn small gold" data-act="start" ${readiness().ok ? '' : `disabled title="${esc(readiness().why)}"`}>Bắt đầu game</button>`;
    }
    if (S.stage.name === 'end') return `<button class="btn ghost small" data-act="guide">Sổ tay lý thuyết</button><button class="btn small" data-act="new">Ván mới</button>`;
    return `<button class="btn ghost small" data-act="invite">Mời thêm</button><button class="btn ghost small" data-act="guide">Sổ tay lý thuyết</button>
      <button class="btn ghost small" data-act="${S.paused ? 'resume' : 'pause'}">${S.paused ? 'Tiếp tục' : 'Tạm dừng'}</button>
      <button class="btn ghost small" data-act="skip">Bỏ qua bước này</button>
      <button class="btn ghost small" data-act="end">Kết thúc</button>`;
  }

  document.addEventListener('click', (e) => {
    const tile = e.target.closest('[data-tile]');
    if (tile && ST && S) return G.board.showTile(ST, S, Number(tile.dataset.tile));
    const b = e.target.closest('[data-act],[data-mv],[data-kick]');
    if (!b) return;
    if (b.dataset.mv) return send({ t: 'host_move', playerId: b.dataset.mv, team: Number(b.dataset.to) });
    if (b.dataset.kick) { if (confirm(`Mời "${b.dataset.name}" ra khỏi phòng?`)) send({ t: 'host_kick', playerId: b.dataset.kick }); return; }
    switch (b.dataset.act) {
      case 'start': return send({ t: 'host_start' });
      case 'shuffle': return send({ t: 'host_shuffle' });
      case 'pause': return send({ t: 'host_pause' });
      case 'resume': return send({ t: 'host_resume_game' });
      case 'skip': return send({ t: 'host_skip' });
      case 'end': if (confirm('Kết thúc game và xem kết quả?')) send({ t: 'host_end' }); return;
      case 'new': try { localStorage.removeItem('mln_host'); } catch (_) {} location.href = 'index.html'; return;
      case 'guide': return showGuide();
      case 'invite': return saved && G.showInvite(saved.room);
      default:
    }
  });

  const GUIDE = [
    ['3 giai đoạn của ván cờ', 'Tự do cạnh tranh → tích tụ và tập trung sản xuất → độc quyền', 'Nguyên nhân hình thành độc quyền'],
    ['Gom 2/3 ngành (chi phối) hoặc 3/3 ngành (độc quyền hoàn toàn) của một nhóm thì tiền thuê tăng (×1,5 / ×2,5 rồi ×2 / ×4)', 'Liên kết ngang; định giá độc quyền để thu lợi nhuận độc quyền cao', 'Giá cả và lợi nhuận độc quyền'],
    ['Thôn tính ngành của đội khác (trả 2× giá)', 'Tích tụ và tập trung tư bản; doanh nghiệp nhỏ bị thôn tính', 'Tập trung sản xuất'],
    ['Hội nghị Cartel (miễn thuê cho nhau, nâng giá với đội ngoài, có thể tan vỡ)', 'Cartel: thỏa thuận giá cả, sản lượng, thị trường; không vững chắc, thường tan vỡ', 'Các tổ chức độc quyền'],
    ['Ô ngân hàng; nắm đủ 3 ngân hàng thì thu 10% tiền thuê của người khác', 'Tư bản tài chính, tài phiệt chi phối bằng “chế độ tham dự”', 'Tư bản tài chính'],
    ['Ô FDI và FII; nhà máy ở nước ngoài mang thêm lợi nhuận mỗi vòng', 'Xuất khẩu tư bản trở thành phổ biến (đầu tư trực tiếp, gián tiếp)', 'Xuất khẩu tư bản'],
    ['Thẻ hiệp định phân chia thị trường, thiếu thị trường tiêu thụ, tranh giành lãnh thổ ảnh hưởng', 'Cạnh tranh phân chia thị trường thế giới; lôi kéo chính phủ phân định lãnh thổ', 'Phân chia thế giới về kinh tế và lãnh thổ'],
    ['Ô Điện lực, Đường sắt – Cảng, Cấp nước thuộc Nhà nước, thu phí vào Quỹ Nhà nước', 'Độc quyền nhà nước ở ngành then chốt; ngành vốn lớn, thu hồi chậm mà tư nhân không làm', 'Nguyên nhân hình thành độc quyền nhà nước'],
    ['Ô Nhà nước điều tiết: thuế lũy tiến, phạt độc quyền, trợ cấp đội nghèo nhất', 'Nhà nước điều tiết thu nhập, phúc lợi; hạn chế mặt tiêu cực, phát huy mặt tích cực của độc quyền', 'Nhà nước điều tiết kinh tế'],
    ['Vận động hành lang; thẻ “chủ độc quyền vào chính phủ”', 'Kết hợp nhân sự giữa tổ chức độc quyền và nhà nước', 'Biểu hiện của độc quyền nhà nước'],
    ['Viện nghiên cứu KHKT; thẻ phát minh', 'Tác động tích cực của độc quyền: nghiên cứu KHKT, tăng năng suất lao động', 'Tác động của độc quyền'],
    ['Thẻ khủng hoảng thừa, ngân hàng nhỏ phá sản, tẩy chay giá độc quyền', 'Khủng hoảng thúc đẩy tập trung; tác động tiêu cực: thiệt hại người tiêu dùng, phân hóa giàu nghèo', 'Nguyên nhân và tác động của độc quyền'],
    ['Phá sản: ngành bị thôn tính hoặc bán rẻ, Nhà nước cứu trợ', 'Doanh nghiệp vừa và nhỏ mất giá trị thặng dư trong cạnh tranh; nhà nước cung cấp tư bản', 'Lợi nhuận độc quyền; sở hữu nhà nước'],
    ['Câu hỏi cho cả lớp mỗi lượt; đội trả lời đúng ≥ 50% được giảm 30% chi phí', 'Củng cố kiến thức Chương 4, ai cũng tham gia', 'Toàn chương'],
  ];
  function showGuide() {
    G.modal(`<div class="invite-head"><h2>Cơ chế game ứng với lý thuyết Chương 4</h2><button class="btn small" data-close>Đóng</button></div>
      <table class="grid"><thead><tr><th>Trong game</th><th>Khái niệm trong chương</th><th>Phần lý thuyết</th></tr></thead><tbody>${GUIDE.map((r) => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join('')}</tbody></table>
      <p class="sub" style="margin-top:10px">Câu hỏi và thẻ bám theo Chương 4 giáo trình Kinh tế chính trị Mác – Lênin: cạnh tranh và độc quyền, 5 đặc điểm của độc quyền, độc quyền nhà nước, biểu hiện mới và vai trò lịch sử của CNTB.</p>`, { cls: 'wide' });
  }

  // ---------- vẽ ----------
  let lastKey = '';
  function render() {
    if (!ST || !S) return;
    $('roomPill').classList.remove('hide'); $('roomPill').innerHTML = `Mã phòng <b class="num">${esc(saved.room)}</b>`;
    const pp = $('phasePill'), rp = $('roundPill');
    pp.classList.toggle('hide', !S.started || !S.phase);
    if (S.started && S.phase) pp.textContent = `Giai đoạn ${S.phase}: ${ST.phases[S.phase].name}`;
    rp.classList.toggle('hide', !S.started || S.stage.name === 'end');
    if (S.started) rp.textContent = `Vòng ${Math.max(1, S.round)}/${S.rounds}`;
    $('ctrl').innerHTML = ctrlHTML();
    fit(); // chiều cao thanh trên thay đổi theo số nút
    $('board').innerHTML = G.board.html(ST, S);
    $('center').innerHTML = centerHTML();
    $('teams').innerHTML = teamsHTML();
    $('log').innerHTML = logHTML();
    tickTimers(S.stage);
  }
  setInterval(() => { if (S) tickTimers(S.stage); }, 150);
  // QR phụ thuộc IP mạng LAN: vẽ lại khi dò xong hoặc khi host đổi mạng
  G.netReady.then(render);
  window.onLanChange = render;
})();
