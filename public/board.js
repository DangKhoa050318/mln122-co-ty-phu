// Vẽ bàn cờ 36 ô, dùng chung cho màn hình host và màn hình người chơi.
(function () {
  const { esc } = G;
  const ICON = { start: '🏁', card: '🎴', crisis: '⚡', fdi: '✈️', fii: '📈', cartel: '🤝', regulate: '⚖️', rd: '🔬', lobby: '🕴️', state: '🏛️', bank: '🏦' };
  const CORNERS = [0, 9, 18, 27];
  const ACTIVE_STAGES = ['moving', 'quiz', 'quiz_result', 'decision', 'cartel_vote', 'result'];

  function pos(i) {
    if (i <= 9) return [10, 10 - i];
    if (i <= 18) return [10 - (i - 9), 1];
    if (i <= 27) return [1, i - 18 + 1];
    return [i - 27 + 1, 10];
  }

  function tileHTML(ST, S, i) {
    const t = ST.tiles[i];
    const [r, c] = pos(i);
    const own = S.owners[i];
    const corner = CORNERS.includes(i);
    const locked = S.started && t.minPhase && S.phase < t.minPhase;
    const act = S.started && S.teams[S.activeTeam] && S.teams[S.activeTeam].pos === i && ACTIVE_STAGES.includes(S.stage.name);
    const cls = ['tile', corner ? 'corner' : '', own != null ? 'owned t' + own : '', locked ? 'locked' : '', act ? 'active' : ''].join(' ');
    let inner = '';
    const g = t.group && ST.groups[t.group];
    if (t.type === 'prop' || t.type === 'bank' || t.type === 'state') {
      const star = S.upgraded[i] ? '★' : '';
      const mark = t.type === 'bank' ? '🏦' : t.type === 'state' ? '🏛️' : star;
      inner = `<div class="band" style="background:${g.color}">${mark}</div><div class="nm">${esc(t.name)}</div><div class="pr">${t.type === 'state' ? 'phí ' + t.fee : t.price}</div>`;
      if (own != null) inner += `<div class="own" style="--tc:${S.teams[own].color}">${esc(S.teams[own].name.split(' ')[0])}</div>`;
    } else {
      inner = `<div class="ic">${ICON[t.type] || ''}</div><div class="nm" style="flex:1;text-align:center;justify-content:center;padding-top:2%">${esc(t.name)}</div>`;
    }
    const pawns = S.teams.filter((x) => x.pos === i).map((x) => `<span class="pawn" style="background:${x.color}" title="${esc(x.name)}"></span>`).join('');
    return `<div class="${cls}" data-tile="${i}" style="grid-row:${r};grid-column:${c}">${inner}${pawns ? `<div class="pawns">${pawns}</div>` : ''}</div>`;
  }

  function html(ST, S, center = '') {
    let h = '';
    for (let i = 0; i < ST.tiles.length; i++) h += tileHTML(ST, S, i);
    return h + `<div class="center" id="center">${center}</div>`;
  }

  function size(el, px) {
    el.style.setProperty('--bs', px + 'px');
    el.style.setProperty('--u', (px / 100) + 'px');
    el.classList.toggle('compact', px < 560); // bàn cờ nhỏ (điện thoại): chữ tối thiểu, ẩn bớt chi tiết
  }

  const TYPE_TEXT = {
    start: 'Mỗi lần đi qua nhận lợi nhuận bình quân.',
    card: 'Rút thẻ Thời cuộc.',
    crisis: 'Rút thẻ Khủng hoảng.',
    fdi: 'Xây nhà máy ở nước ngoài (xuất khẩu tư bản trực tiếp).',
    fii: 'Mua cổ phiếu, trái phiếu nước ngoài (đầu tư gián tiếp).',
    cartel: 'Mời một đội lập Cartel thỏa thuận giá.',
    regulate: 'Thuế lũy tiến, phạt độc quyền, trợ cấp đội nghèo nhất.',
    rd: 'Đầu tư nghiên cứu: tiền thuê một ngành +50%.',
    lobby: 'Mua lá chắn miễn một lần tiền thuê.',
    state: 'Ngành then chốt do Nhà nước độc quyền, thu phí vào Quỹ Nhà nước.',
    bank: 'Tư bản tài chính. Nắm đủ 3 ngân hàng thì thu 10% tiền thuê của người khác.',
  };

  // Chi tiết một ô (bấm vào ô trên bàn cờ, hữu ích khi bàn cờ nhỏ trên điện thoại)
  function showTile(ST, S, i) {
    const t = ST.tiles[i];
    const g = t.group && ST.groups[t.group];
    const own = S.owners[i];
    const here = S.teams.filter((x) => x.pos === i);
    const rows = [];
    if (g) rows.push(['Nhóm', `<span class="dot" style="background:${g.color}"></span> ${esc(g.name)}`]);
    if (t.price) rows.push(['Giá mua', `<b class="num">${t.price}</b>`]);
    if (t.type === 'prop') rows.push(['Tiền thuê gốc', `<b class="num">${t.rent}</b>${S.upgraded[i] ? ' ×1,5 (đã nâng cấp ★)' : ''}`]);
    if (t.type === 'bank') rows.push(['Tiền thuê', `<b class="num">40</b> × số ngân hàng của chủ`]);
    if (t.type === 'state') rows.push(['Phí dịch vụ', `<b class="num">${t.fee}</b>`]);
    if (t.type === 'prop' || t.type === 'bank') rows.push(['Chủ sở hữu', own != null ? `<span class="dot" style="background:${S.teams[own].color}"></span> ${esc(S.teams[own].name)}` : 'Chưa có']);
    if (t.minPhase) rows.push(['Mở khóa', `Từ giai đoạn ${t.minPhase}${S.started && S.phase < t.minPhase ? ' (đang khóa)' : ''}`]);
    if (here.length) rows.push(['Đang đứng', here.map((x) => `<span class="dot" style="background:${x.color}"></span> ${esc(x.name)}`).join(', ')]);
    const desc = t.type === 'prop' ? 'Gom 2/3 hoặc 3/3 ngành cùng nhóm để tăng tiền thuê (định giá độc quyền).' : TYPE_TEXT[t.type] || '';
    G.modal(`<div class="invite-head"><h2>${esc(t.name)}</h2><button class="btn small ghost" data-close>Đóng</button></div>
      ${g ? `<div class="tilecard-band" style="background:${g.color}"></div>` : ''}
      <p>${esc(desc)}</p>
      <table class="kv">${rows.map((r) => `<tr><th>${r[0]}</th><td>${r[1]}</td></tr>`).join('')}</table>`, { cls: 'tile-modal' });
  }

  G.board = { html, size, showTile, pos };
})();
