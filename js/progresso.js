/* Mànmàn — Tooltip dos gráficos, Competição e Progresso. */
'use strict';

// ── tooltip dos gráficos ────────────────────────────────────
// O title= do navegador demora ~1s pra aparecer e não existe em toque, que é
// justamente onde o app é usado. Este responde a hover no desktop e a toque no celular.
let tipAtual = null;
function hideTip() {
  if (tipAtual) tipAtual.classList.remove('tipped');
  tipAtual = null;
  $('tip').classList.remove('show');
}
function showTip(el) {
  const tip = $('tip');
  if (tipAtual) tipAtual.classList.remove('tipped');
  tipAtual = el;
  el.classList.add('tipped');
  tip.textContent = el.dataset.tip;
  tip.classList.add('show');
  const r = el.getBoundingClientRect();
  const t = tip.getBoundingClientRect();
  const margem = 8;
  let x = r.left + r.width / 2 - t.width / 2;
  x = Math.max(margem, Math.min(x, window.innerWidth - t.width - margem));
  let y = r.top - t.height - 8;
  if (y < margem) y = r.bottom + 8; // barra muito no topo? joga o balão pra baixo
  tip.style.left = Math.round(x) + 'px';
  tip.style.top = Math.round(y) + 'px';
}
function bindTips() {
  const alvo = e => e.target.closest('[data-tip]');
  document.addEventListener('mouseover', e => { const el = alvo(e); if (el) showTip(el); });
  document.addEventListener('mouseout', e => { if (alvo(e)) hideTip(); });
  // no toque: abre no elemento tocado, fecha ao tocar em qualquer outro lugar
  document.addEventListener('click', e => {
    const el = alvo(e);
    if (el) { el === tipAtual ? hideTip() : showTip(el); } else hideTip();
  });
  window.addEventListener('scroll', hideTip, { passive: true });
  window.addEventListener('resize', hideTip);
}

function renderStreak() {
  const hoje = revsDoDia(todayStr());
  const bateu = hoje >= META_DIARIA;
  $('streakpill').classList.toggle('hit', bateu);
  $('streak-n').textContent = calcStreak();
  // passou da meta? mostra o excedente em vez de travar em 20/20 — a meta é piso, não teto
  $('streak-meta').textContent = bateu ? '+' + (hoje - META_DIARIA) : hoje + '/' + META_DIARIA;
  $('streakpill').title = bateu
    ? 'Meta do dia batida: ' + hoje + ' revisões. Pode seguir o quanto quiser.'
    : 'Faltam ' + (META_DIARIA - hoje) + ' revisões pra fechar o dia';
}
let statOrder = 'erros'; // 'erros' | 'acertos' | 'total' | 'deck'
function renderWordStats() {
  const pool = cards.filter(c => !isOff(c.id));
  const linhas = pool.map(c => {
    const s = statOf(c.id);
    return { c, ...s, total: s.g + s.h + s.a };
  });
  const semDado = linhas.every(l => !l.total);

  $('statsort').innerHTML = [['erros', 'mais erro'], ['acertos', 'mais acerto'],
    ['total', 'mais vistas'], ['deck', 'por tema']]
    .map(([k, t]) => '<button class="chip' + (statOrder === k ? ' active' : '') +
      '" data-s="' + k + '">' + t + '</button>').join('');
  $('statsort').querySelectorAll('.chip').forEach(ch => ch.onclick = () => {
    statOrder = ch.dataset.s;
    renderWordStats();
    $('wordstats').scrollTop = 0; // reordenou: volta pro topo, senão a nova ordem começa no meio
  });

  if (semDado) {
    $('wordstats').innerHTML = '<p class="wempty">Ainda sem contagem. Ela começou a ser gravada em ' +
      '20/08 — as revisões anteriores a essa data não foram registradas por carta.</p>';
    return;
  }
  const ordem = {
    erros: (a, b) => (b.a + b.h) - (a.a + a.h) || b.total - a.total,
    acertos: (a, b) => b.g - a.g || b.total - a.total,
    total: (a, b) => b.total - a.total,
    deck: (a, b) => a.c.deck.localeCompare(b.c.deck) || b.total - a.total
  }[statOrder];
  linhas.sort(ordem);

  const vistas = linhas.filter(l => l.total).length;
  // legenda uma vez no topo: os três números são coloridos mas não rotulados, e
  // explicar via tooltip obrigaria a tocar em cada linha pra entender a tela
  $('wordstats').innerHTML = '<p class="wcount">' + linhas.length + ' palavras · ' +
    vistas + ' já com contagem &nbsp;·&nbsp; <span class="tally">' +
    '<span class="g">acertos</span><span class="h">difícil</span><span class="a">erros</span>' +
    '</span></p>' + linhas.map(l => {
    const pill = (n, cls) => '<span class="' + (n ? cls : 'zero') + '">' + n + '</span>';
    return '<div class="wrow"><span class="hz zh" lang="zh-Hans">' + esc(l.c.hanzi) + '</span>' +
      '<span class="info"><b>' + esc(l.c.pt) + '</b><small>' + pinyinColored(l.c.pinyin) +
      ' · ' + esc(deckLabel(l.c.deck)) + '</small></span>' +
      '<span class="tally" data-tip="' + esc(l.c.hanzi + ': ' + l.g + ' acertos, ' + l.h +
        ' difícil, ' + l.a + ' erros') + '">' +
      pill(l.g, 'g') + pill(l.h, 'h') + pill(l.a, 'a') + '</span></div>';
  }).join('');
}
// Taxa, não contagem. O aleatório sorteia os modos de forma desigual, e tom e desenho só
// valem pra palavra de um caractere: "14 erros de tom" sozinho não diz nada, "38% de erro
// em 21 tentativas" diz. Por isso a tentativa aparece do lado de toda porcentagem.
function renderHabStats() {
  const tot = { palavra: {}, frase: {} };
  HABS.forEach(h => { tot.palavra[h.k] = { n: 0, e: 0 }; tot.frase[h.k] = { n: 0, e: 0 }; });
  const conf = {};
  let nConf = 0;
  cards.forEach(c => {
    const s = stats[c.id];
    if (!s) return;
    // o grupo sai da carta, não da habilidade: o mesmo 'rec' que a frase mediu não pode
    // entrar na conta das palavras, senão a taxa de cada lado deixa de ser daquele lado
    const t = tot[ehFrase(c) ? 'frase' : 'palavra'];
    if (s.hab) HABS.forEach(h => {
      const v = s.hab[h.k];
      if (v) { t[h.k].n += v.n || 0; t[h.k].e += v.e || 0; }
    });
    if (s.tomX) for (const par of Object.keys(s.tomX)) {
      conf[par] = (conf[par] || 0) + s.tomX[par];
      nConf += s.tomX[par];
    }
  });
  if (!HABS.some(h => tot.palavra[h.k].n || tot.frase[h.k].n)) {
    $('habstats').innerHTML = '<p class="wempty">Ainda sem medição, e ela só enxerga daqui ' +
      'pra frente: as revisões antigas não sabem de que modo vieram. O 🔀 Aleatório é o que ' +
      'enche isto mais rápido, porque te expõe aos quatro modos na mesma sessão.</p>';
    return;
  }
  const habrow = (h, v, g) => {
    const r = (h.porGrupo && h.porGrupo[g]) || h;
    if (!v.n) return '<div class="habrow vazio"><span class="hnome">' + esc(r.nome) +
      '<small>' + esc(r.dica) + '</small></span><span class="hnum">sem dados</span></div>';
    const pct = Math.round(v.e / v.n * 100);
    return '<div class="habrow abre" data-hab="' + h.k + '" data-g="' + g + '" role="button" tabindex="0"><span class="hnome">' + esc(r.nome) +
      '<small>' + esc(r.dica) + '</small></span>' +
      '<span class="hnum"><b>' + pct + '%</b><small>de erro · ' + v.e + ' de ' + v.n + '</small></span>' +
      '<span class="hbar"><i style="width:' + Math.max(2, pct) + '%"></i></span></div>';
  };
  // Deck sem frase nenhuma não ganha um grupo inteiro de "sem dados" — mas se houver
  // medição ali (frase apagada do deck, carta que trocou de tipo), ela continua visível.
  const linhas = HAB_GRUPOS.map(gr => {
    const t = tot[gr.g];
    const hs = HABS.filter(h => t[h.k].n || ((h.alvo === gr.g || h.alvo === 'ambos') &&
      (gr.g !== 'frase' || temFrases())));
    if (!hs.length) return '';
    return '<div class="habgrp"><b>' + esc(gr.titulo) + '</b><small>' + esc(gr.dica) +
      '</small></div>' + hs.map(h => habrow(h, t[h.k], gr.g)).join('');
  }).join('');
  // A lista de pares é a resposta à pergunta que a contagem de erros não responde.
  // Duas ou três confusões concentram quase tudo — por isso só as cinco maiores.
  const pares = Object.keys(conf).map(p => [p, conf[p]]).sort((a, b) => b[1] - a[1]);
  let cx = '';
  if (pares.length) {
    const [certo, marcado] = pares[0][0].split('>');
    cx = '<div class="tomx"><b>Quais tons você confunde</b>' +
      '<p>O mais comum: era <b>' + TOM_CURTO[certo] + '</b> e você marcou <b>' + TOM_CURTO[marcado] +
      '</b>, em ' + pares[0][1] + ' dos ' + nConf + ' erro' + (nConf > 1 ? 's' : '') + ' de tom.</p>' +
      pares.slice(0, 5).map(function (par) {
        const t = par[0].split('>');
        return '<div class="tomxrow"><span>' + TOM_CURTO[t[0]] + ' → ' + TOM_CURTO[t[1]] +
          '</span><b>' + par[1] + '×</b></div>';
      }).join('') + '</div>';
  }
  $('habstats').innerHTML = linhas + cx;
  ligaLinhas($('habstats'), '.habrow.abre', el => abreHabGaveta(el.dataset.hab, el.dataset.g));
}
function renderTurma() {
  if (!logTurma || !logTurma.length) {
    $('turma').innerHTML = '<p style="color:var(--mut);font-size:13px;margin:0;text-align:center">' +
      'Sem dados da turma agora (precisa de internet).</p>';
    return;
  }
  // 7 dias e não 14: com 14 colunas o número não cabe, e sem número só sobra
  // a barra — que num celular é fina demais pra ler ou tocar
  const days = [];
  for (let i = 6; i >= 0; i--) days.push(todayStr(-i));
  const porUser = {};
  logTurma.forEach(r => {
    if (!porUser[r.user_name]) porUser[r.user_name] = {};
    porUser[r.user_name][r.day] = r.rev || 0;
  });
  const nomes = Object.keys(porUser).sort((a, b) =>
    days.reduce((s, d) => s + (porUser[b][d] || 0), 0) -
    days.reduce((s, d) => s + (porUser[a][d] || 0), 0));

  const cabecalho = '<div class="turmalabels">' +
    days.map(d => '<span>' + diaLabel(d) + '</span>').join('') + '</div>';

  $('turma').innerHTML = cabecalho + nomes.map(u => {
    const tot = days.reduce((s, d) => s + (porUser[u][d] || 0), 0);
    const celulas = days.map(d => {
      const v = porUser[u][d] || 0;
      const cls = v >= META_DIARIA ? 'bateu' : v > 0 ? 'fez' : '';
      return '<b class="' + cls + '">' + (v || '–') + '</b>';
    }).join('');
    return '<div class="userrow"><span class="nome' + (u === settings.user ? ' eu' : '') + '">' +
      esc(nomeDe(u)) + '</span><span class="dias">' + celulas + '</span>' +
      '<span class="tot">' + tot + '</span></div>';
  }).join('') +
    '<p class="turmaleg">últimos 7 dias · <i></i> meta de ' + META_DIARIA + ' batida</p>';
}

// ── UI: competição (comparar os 4) ──────────────────────────
// A aba Progresso é sobre VOCÊ; esta é sobre os quatro juntos. Puxa o progress e o
// review_log de todo mundo (as policies de leitura são abertas, e não há dado sensível —
// é acerto/erro de flashcard) e compara. Sem coluna nova: n_good/n_hard/n_again, hab,
// tom_x, suspended e new_cnt já guardam tudo.
let compData = null, compLog = null;
const COMP_CORES = ['#3b6fd4', '#2e9e5b', '#dd8500', '#8b5cf6', '#c8102e'];
async function loadCompeticao() {
  if (!sbConfigured()) { compData = null; return; }
  try {
    // paginado (ver sbTodas): numa chamada só o PostgREST cortava em 1.000 linhas, e a
    // turma já tem quase o dobro — quem caía depois do corte saía com menos do que tem
    const [prows, lrows] = await Promise.all([
      sbTodas('progress?select=user_name,card_id,ivl,reps,n_good,n_hard,n_again,hab,tom_x,suspended' +
        '&order=user_name.asc,card_id.asc'),
      sbTodas('review_log?select=user_name,day,rev,new_cnt&day=gte.' + META_DESDE + '&order=day.asc,user_name.asc')
        .catch(() => [])
    ]);
    const deckDe = {}; cards.forEach(c => { deckDe[c.id] = c.deck; });
    const ehFr = {}; cards.forEach(c => { ehFr[c.id] = ehFrase(c); });
    const by = {};
    provasTurma = {};
    await carregaNomesDaTurma();
    for (const row of prows) {
      const u = row.user_name;
      if (/^prova:/.test(row.card_id || '')) { guardaProvaDaTurma(row); continue; }
      if (!u || u === 'convidado' || linhaEspecial(row.card_id)) continue;
      const d = by[u] || (by[u] = { seen: 0, learned: 0, susp: 0, g: 0, h: 0, a: 0,
        hab: {}, err: {}, tomx: {}, deck: {}, tipo: { palavra: { g: 0, h: 0, a: 0, learned: 0 }, frase: { g: 0, h: 0, a: 0, learned: 0 } } });
      if ((row.reps || 0) > 0) d.seen++;
      const apr = (row.ivl || 0) >= LEARNED_IVL;
      if (apr) d.learned++;
      if (row.suspended) d.susp++;
      const g = row.n_good || 0, h = row.n_hard || 0, a = row.n_again || 0;
      d.g += g; d.h += h; d.a += a;
      const err = h + a;
      if (err) d.err[row.card_id] = err;
      if (row.hab) for (const k of Object.keys(row.hab)) {
        const v = row.hab[k]; const t = d.hab[k] || (d.hab[k] = { n: 0, e: 0 });
        t.n += v.n || 0; t.e += v.e || 0;
      }
      if (row.tom_x) for (const par of Object.keys(row.tom_x)) d.tomx[par] = (d.tomx[par] || 0) + row.tom_x[par];
      const dk = deckDe[row.card_id];
      if (dk) { const t = d.deck[dk] || (d.deck[dk] = { g: 0, h: 0, a: 0 }); t.g += g; t.h += h; t.a += a; }
      if (row.card_id in ehFr) { const tp = d.tipo[ehFr[row.card_id] ? 'frase' : 'palavra']; tp.g += g; tp.h += h; tp.a += a; if (apr) tp.learned++; }
    }
    compData = by;
    compLog = lrows;
    logTurma = compLog; // a seção da turma agora vive aqui, e lê o mesmo review_log
  } catch (e) { compData = null; }
}
function compUsuarios() {
  return Object.keys(compData || {})
    .filter(u => compData[u].seen || compData[u].g + compData[u].h + compData[u].a)
    .sort((a, b) => compData[b].learned - compData[a].learned);
}
// uma célula da matriz: o vermelho cresce com o valor (erro é o que se quer achar), e a
// coluna do próprio usuário fica marcada. `frac` (0–1) = intensidade; null = sem dado.
function compCel(txt, frac, eu) {
  const bg = frac == null ? '' : 'background:rgba(190,91,55,' + (0.08 + 0.5 * frac).toFixed(2) + ')';
  return '<span class="cmcel' + (eu ? ' eu' : '') + '" style="' + bg + '">' +
    (txt == null ? '<i>–</i>' : txt) + '</span>';
}
// uma matriz genérica: linhas (rótulo + valor por usuário) × colunas (usuários)
function compMatriz(us, cab, linhas) {
  return '<div class="cmatriz" style="--cn:' + us.length + '"><div class="cmrow cmhead">' + cab +
    '</div>' + linhas + '</div>';
}
// erro% de um bloco {g,h,a} — null se não houve tentativa
function erroPct(v) { const n = v.g + v.h + v.a; return n ? Math.round((v.h + v.a) / n * 100) : null; }
// o gráfico de linhas: cartas novas acumuladas por dia, uma linha por pessoa. É o mais
// perto de "melhoria ao longo do tempo" que o dado permite — o banco não guarda o acerto
// histórico, só o de agora; guarda quantas cartas novas cada um viu por dia (new_cnt).
function compGrafico(us) {
  if (!compLog || !compLog.length) return '';
  const dias = [];
  const fim = todayStr();
  for (let dt = new Date(META_DESDE + 'T00:00:00'); ; dt.setDate(dt.getDate() + 1)) {
    const dia = dt.toISOString().slice(0, 10);
    dias.push(dia);
    if (dia >= fim || dias.length > 400) break;
  }
  const serie = {}; us.forEach(u => serie[u] = {});
  compLog.forEach(r => { if (serie[r.user_name]) serie[r.user_name][r.day] = (serie[r.user_name][r.day] || 0) + (r.new_cnt || 0); });
  const acum = {}; let max = 1;
  us.forEach(u => {
    acum[u] = []; let s = 0;
    dias.forEach(dia => { s += serie[u][dia] || 0; acum[u].push(s); });
    max = Math.max(max, s);
  });
  const W = 700, H = 240, pl = 34, pr = 12, pt = 12, pb = 22;
  const pw = W - pl - pr, ph = H - pt - pb;
  const x = i => pl + (dias.length < 2 ? 0 : i / (dias.length - 1) * pw);
  const y = v => pt + ph - (v / max) * ph;
  const linhas = us.map((u, k) => {
    const pts = acum[u].map((v, i) => x(i).toFixed(1) + ',' + y(v).toFixed(1)).join(' ');
    return '<polyline points="' + pts + '" fill="none" stroke="' + COMP_CORES[k % COMP_CORES.length] +
      '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>';
  }).join('');
  // 3 linhas-guia horizontais com o valor
  const guias = [0, 0.5, 1].map(f => {
    const gy = y(max * f);
    return '<line x1="' + pl + '" y1="' + gy.toFixed(1) + '" x2="' + (W - pr) + '" y2="' + gy.toFixed(1) +
      '" stroke="var(--line)" stroke-width="1"/><text x="' + (pl - 5) + '" y="' + (gy + 3).toFixed(1) +
      '" text-anchor="end" font-size="9" fill="var(--soft)">' + Math.round(max * f) + '</text>';
  }).join('');
  const xlabs = [0, dias.length - 1].map(i => '<text x="' + x(i).toFixed(1) + '" y="' + (H - 6) +
    '" text-anchor="' + (i ? 'end' : 'start') + '" font-size="9" fill="var(--soft)">' + diaLabel(dias[i]) + '</text>').join('');
  const leg = us.map((u, k) => '<span class="cglegi"><i style="background:' + COMP_CORES[k % COMP_CORES.length] +
    '"></i>' + esc(nomeDe(u)) + '</span>').join('');
  return '<div class="card"><svg class="cgsvg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet">' +
    guias + linhas + xlabs + '</svg><div class="cgleg">' + leg + '</div></div>';
}
function renderCompeticao() {
  renderProvasTurma();
  if (!sbConfigured()) {
    $('comp-placar').innerHTML = '<p class="wempty">Sem conexão com o banco.</p>';
    ['comp-graf', 'comp-hab', 'comp-tema', 'comp-tipo', 'comp-tom', 'comp-erram'].forEach(id => $(id).innerHTML = '');
    return;
  }
  const us = compData ? compUsuarios() : [];
  if (!us.length) {
    $('comp-placar').innerHTML = '<p class="wempty">Sem dados da turma agora (precisa de internet, e de pelo menos uma pessoa com progresso).</p>';
    ['comp-graf', 'comp-hab', 'comp-tema', 'comp-tipo', 'comp-tom', 'comp-erram'].forEach(id => $(id).innerHTML = '');
    return;
  }
  const nome = nomeDe;
  const MEDALHA = ['🥇', '🥈', '🥉'];
  const ligadasTotal = cards.length;

  // placar: um cartão por pessoa, do mais aprendido pro menos
  $('comp-placar').innerHTML = '<div class="complacar">' + us.map((u, i) => {
    const d = compData[u];
    const tent = d.g + d.h + d.a;
    const acerto = tent ? Math.round(d.g / tent * 100) : null;
    const streak = calcStreak(compLogRegistro(u));
    return '<div class="compcard' + (u === settings.user ? ' eu' : '') + '">' +
      '<div class="cptop"><span class="cppos">' + (MEDALHA[i] || (i + 1) + 'º') + '</span>' +
      '<b class="cpnome">' + esc(nome(u)) + '</b>' +
      '<span class="cpfogo">🔥 ' + streak + '</span></div>' +
      '<div class="cpnums">' +
      '<span><b>' + d.learned + '</b><small>aprendidas</small></span>' +
      '<span><b>' + (ligadasTotal - d.susp) + '</b><small>ligadas</small></span>' +
      '<span><b>' + (acerto == null ? '–' : acerto + '%') + '</b><small>de acerto</small></span>' +
      '</div></div>';
  }).join('') + '</div>';

  // gráfico de vocabulário no tempo
  $('comp-graf').innerHTML = compGrafico(us);

  // cabeçalho comum das matrizes: as iniciais das pessoas
  const cab = '<span class="cmlab"></span>' + us.map(u =>
    '<span class="cmcel cmh' + (u === settings.user ? ' eu' : '') + '" title="' + esc(nome(u)) + '">' +
    esc(nome(u).slice(0, 3)) + '</span>').join('');

  // erro por habilidade
  const habLinhas = HABS.filter(h => us.some(u => compData[u].hab[h.k] && compData[u].hab[h.k].n));
  $('comp-hab').innerHTML = habLinhas.length ? compMatriz(us, cab, habLinhas.map(h =>
    '<div class="cmrow"><span class="cmlab">' + esc(h.nome) + '</span>' + us.map(u => {
      const v = compData[u].hab[h.k];
      if (!v || !v.n) return compCel(null, null, u === settings.user);
      const pct = Math.round(v.e / v.n * 100);
      return compCel(pct + '%', pct / 100, u === settings.user);
    }).join('') + '</div>').join(''))
    : '<p class="wempty">Ainda sem medição por habilidade — ela enche conforme a turma estuda no 🔀 Aleatório.</p>';

  // erro por tema
  const decks = [...new Set(cards.map(c => c.deck))]
    .filter(dk => us.some(u => compData[u].deck[dk] && (compData[u].deck[dk].g + compData[u].deck[dk].h + compData[u].deck[dk].a)))
    .sort((a, b) => deckLabel(a).localeCompare(deckLabel(b), 'pt'));
  $('comp-tema').innerHTML = decks.length ? compMatriz(us, cab, decks.map(dk =>
    '<div class="cmrow"><span class="cmlab">' + esc(deckLabel(dk)) + '</span>' + us.map(u => {
      const pct = erroPct(compData[u].deck[dk] || { g: 0, h: 0, a: 0 });
      return compCel(pct == null ? null : pct + '%', pct == null ? null : pct / 100, u === settings.user);
    }).join('') + '</div>').join(''))
    : '<p class="wempty">Sem dados por tema ainda.</p>';

  // frases vs palavras — erro% por tipo
  $('comp-tipo').innerHTML = compMatriz(us, cab, ['palavra', 'frase'].map(tp =>
    '<div class="cmrow"><span class="cmlab">' + (tp === 'frase' ? 'Frases' : 'Palavras') + '</span>' + us.map(u => {
      const pct = erroPct(compData[u].tipo[tp]);
      return compCel(pct == null ? null : pct + '%', pct == null ? null : pct / 100, u === settings.user);
    }).join('') + '</div>').join(''));

  // tons que cada um confunde — o par mais trocado
  const temTom = us.some(u => Object.keys(compData[u].tomx).length);
  $('comp-tom').innerHTML = temTom ? '<div class="ctons">' + us.map(u => {
    const pares = Object.keys(compData[u].tomx).map(p => [p, compData[u].tomx[p]]).sort((x, y) => y[1] - x[1]);
    if (!pares.length) return '<div class="ctonrow' + (u === settings.user ? ' eu' : '') + '"><b>' + esc(nome(u)) +
      '</b><span class="ctonv">sem erro de tom</span></div>';
    const [certo, marc] = pares[0][0].split('>');
    return '<div class="ctonrow' + (u === settings.user ? ' eu' : '') + '"><b>' + esc(nome(u)) + '</b>' +
      '<span class="ctonv">marca <b>' + TOM_CURTO[marc] + '</b> quando é <b>' + TOM_CURTO[certo] + '</b>' +
      ' <small>· ' + pares[0][1] + '×</small></span></div>';
  }).join('') + '</div>' : '<p class="wempty">Ninguém errou tom ainda (ou o quiz de tom não foi usado).</p>';

  // o que a turma mais erra
  const soma = {};
  us.forEach(u => Object.keys(compData[u].err).forEach(id => { soma[id] = (soma[id] || 0) + compData[u].err[id]; }));
  const rank = Object.keys(soma)
    .map(id => ({ id, c: cards.find(k => k.id === id), soma: soma[id] }))
    .filter(x => x.c).sort((a, b) => b.soma - a.soma).slice(0, 15);
  const maxErr = rank.reduce((m, x) => us.reduce((mm, u) => Math.max(mm, compData[u].err[x.id] || 0), m), 1);
  $('comp-erram').innerHTML = rank.length ? compMatriz(us, cab, rank.map(x =>
    '<div class="cmrow"><span class="cmlab carta"><span class="zh" lang="zh-Hans">' + esc(x.c.hanzi) +
    '</span><span class="cmpt">' + esc(x.c.pt) + '</span></span>' + us.map(u => {
      const e = compData[u].err[x.id] || 0;
      return compCel(e || null, e ? e / maxErr : null, u === settings.user);
    }).join('') + '</div>').join(''))
    : '<p class="wempty">Ninguém errou nada ainda — ou o banco não trouxe os dados.</p>';
}
// registro {dia:{rev}} de um usuário, pro calcStreak
function compLogRegistro(u) {
  const reg = {};
  (compLog || []).forEach(r => { if (r.user_name === u) reg[r.day] = { rev: r.rev || 0 }; });
  return reg;
}

// Quanto de cada capítulo já está de pé. A pergunta aqui é COMPARATIVA — "vou melhor no
// 2 ou no 3?" — e é por isso que este bloco não é um filtro em cima dos outros gráficos:
// filtro mostra um capítulo por vez e obriga a decorar o anterior pra comparar.
//
// O denominador ignora carta desligada: ela saiu da rotação de propósito, então contá-la
// como "falta aprender" seria cobrar por uma dívida que a pessoa já perdoou.
function renderCapStats() {
  const origens = [...new Set(cards.map(origemDe))]
    .sort((a, b) => ordemOrigem(a) - ordemOrigem(b) || a.localeCompare(b));
  const linhas = origens.map(o => {
    const todas = cards.filter(c => origemDe(c) === o);
    const nOff = todas.filter(c => isOff(c.id)).length;
    const pool = todas.filter(c => !isOff(c.id));
    if (!pool.length) return '';               // capítulo inteiro desligado não vira linha
    const apr = pool.filter(c => srs[c.id] && srs[c.id].ivl >= LEARNED_IVL).length;
    const vis = pool.filter(c => srs[c.id] && srs[c.id].ivl < LEARNED_IVL).length;
    const pct = Math.round(apr / pool.length * 100);
    // "12 de 34" em vez de "12/34": o segundo lê como fração e este número não é uma
    const detalhe = apr + ' de ' + pool.length + (vis ? ' · ' + vis + ' começada' + (vis > 1 ? 's' : '') : '')
      + (nOff ? ' · ' + nOff + ' 🚫' : '');
    return '<div class="caprow abre' + (apr + vis ? '' : ' vazio') + '" data-origem="' + esc(o) + '" role="button" tabindex="0">' +
      '<span class="cnome">' + esc(origemLabel(o)) + '<small>' + esc(detalhe) + '</small></span>' +
      '<span class="cnum"><b>' + pct + '%</b><small>aprendido</small></span>' +
      '<span class="cbar">' +
        '<i style="width:' + (apr / pool.length * 100) + '%"></i>' +
        '<i class="vis" style="width:' + (vis / pool.length * 100) + '%"></i>' +
      '</span></div>';
  }).join('');
  $('capstats').innerHTML = linhas ? linhas +
    '<div class="capleg"><span><i></i>aprendida (≥' + LEARNED_IVL + 'd)</span>' +
    '<span><i class="vis"></i>começada</span><span><i class="nao"></i>nunca vista</span></div>'
    : '<p class="wempty">O deck ainda não tem carta com capítulo marcado.</p>';
  ligaLinhas($('capstats'), '.caprow.abre', el => abreRecorteGaveta(origemLabel(el.dataset.origem), 'Capítulo',
    cards.filter(c => origemDe(c) === el.dataset.origem), ['cap', el.dataset.origem]));
}

// ── UI: progresso ───────────────────────────────────────────
function renderProgress() {
  gravaFoto();
  renderCapStats();
  renderHabStats();
  renderWordStats();
  const t = todayStr();
  const { due, news } = dueCount();
  const nOff = offCount();
  // o Progresso é do deck inteiro, não do tipo escolhido em Estudar: aqui a pergunta é
  // "como eu vou", e ir bem em frases também é ir bem
  const nFr = cards.filter(ehFrase).length;
  $('s-total').textContent = cards.length;
  $('s-total-lbl').textContent = (nFr ? (cards.length - nFr) + ' palavras + ' + nFr + ' frase' + (nFr > 1 ? 's' : '')
    : 'palavras no deck') + (nOff ? ' · ' + nOff + ' desligada' + (nOff > 1 ? 's' : '') : '');
  $('s-hoje').textContent = due;
  $('s-novas').textContent = news;
  $('s-aprendidas').textContent = cards.filter(c => srs[c.id] && srs[c.id].ivl >= LEARNED_IVL).length;
  $('s-streak').textContent = calcStreak();
  const days = [];
  for (let i = 13; i >= 0; i--) days.push(todayStr(-i));
  const vals = days.map(k => (log[k] && log[k].rev) || 0);
  const max = Math.max(1, ...vals);
  $('bars').innerHTML = vals.map((v, i) =>
    '<div class="bar' + (v === 0 ? ' zero' : '') + '" style="height:' + Math.max(3, Math.round(v / max * 100)) + '%"' +
    ' data-tip="' + esc(diaLabel(days[i]) + ' · ' + rotuloRev(v)) + '"></div>').join('');
  $('barlabels').innerHTML = days.map(k => '<span>' + k.slice(8) + '</span>').join('');
  const decks = [...new Set(cards.map(c => c.deck))];
  $('deckstats').innerHTML = decks.map(dk => {
    const pool = cards.filter(c => c.deck === dk);
    const learned = pool.filter(c => srs[c.id] && srs[c.id].ivl >= LEARNED_IVL).length;
    const seen = pool.filter(c => srs[c.id]).length;
    const nOff = pool.filter(c => isOff(c.id)).length;
    return '<div class="deckrow abre" data-deck="' + esc(dk) + '" role="button" tabindex="0"><b>' + esc(deckLabel(dk)) + '</b><span>' + seen + '/' + pool.length +
      ' vistas · ' + learned + ' aprendidas' + (nOff ? ' · ' + nOff + ' 🚫' : '') + '</span></div>';
  }).join('');
  ligaLinhas($('deckstats'), '.deckrow.abre', el => abreRecorteGaveta(deckLabel(el.dataset.deck), 'Tema',
    cards.filter(c => c.deck === el.dataset.deck), ['deck', el.dataset.deck]));
}

// ── Progresso → gaveta ─────────────────────────────────────
// Clicar numa linha da aba Geral (capítulo, habilidade, tema) abre o recorte na gaveta
// (DESIGN_SYSTEM.md 11.1): o que você mais erra ali primeiro, depois o que ainda não
// aprendeu e o que já aprendeu. Cada carta da lista abre a carta na mesma gaveta.
function ligaLinhas(box, sel, abre) {
  box.querySelectorAll(sel).forEach(el => {
    el.onclick = () => abre(el);
    el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abre(el); } };
  });
}
// uma carta numa linha: 汉字, pinyin e significado, e à direita o número que importa ali
function linhaCartaGaveta(c, dir, dirSub) {
  return '<button class="glinha" data-id="' + esc(c.id) + '"><span class="zh" lang="zh-Hans">' + esc(c.hanzi) + '</span>' +
    '<span class="gl-meio"><b>' + esc(c.pt) + '</b><small>' + pinyinColored(c.pinyin) + '</small></span>' +
    (dir != null ? '<span class="gl-dir"><b>' + dir + '</b>' + (dirSub ? '<small>' + esc(dirSub) + '</small>' : '') + '</span>' : '') + '</button>';
}
function listaGaveta(lista) { return '<div class="glista">' + lista.join('') + '</div>'; }
function ligaCartasGaveta(corpo) {
  corpo.querySelectorAll('.glinha[data-id]').forEach(b => b.onclick = () => abreCartaGaveta(b.dataset.id));
}
// Um capítulo ou um tema: as cartas dele que estão na rotação, divididas em três
function abreRecorteGaveta(titulo, tipo, todas, evo) {
  const pool = todas.filter(c => !isOff(c.id));
  const nOff = todas.length - pool.length;
  const apr = pool.filter(c => aprendida(c.id));
  const nao = pool.filter(c => !aprendida(c.id));
  const comErro = nao.filter(c => erroCount(c.id) > 0).sort((a, b) => erroCount(b.id) - erroCount(a.id));
  const resto = nao.filter(c => !erroCount(c.id)).sort((a, b) => dominio(b.id) - dominio(a.id));
  const corpo = abreGaveta({ titulo });
  const pct = pool.length ? Math.round(apr.length / pool.length * 100) : 0;
  gravaFoto(); // o gráfico mostra hoje com o que acabou de acontecer
  let h = '<div class="gcodigo"><span>' + esc(tipo) + '</span>' + (nOff ? '<span class="gtag">' + nOff + ' desligada' + (nOff > 1 ? 's' : '') + '</span>' : '') + '</div>' +
    '<div class="gkpis">' +
    '<div class="gkpi"><small>Cartas</small><b>' + pool.length + '</b></div>' +
    '<div class="gkpi"><small>Aprendidas</small><b>' + apr.length + ' <i>' + pct + '%</i></b></div>' +
    '<div class="gkpi"><small>Com tropeço</small><b>' + comErro.length + '</b></div>' +
    '<div class="gkpi"><small>Nunca vistas</small><b>' + pool.filter(c => !srs[c.id]).length + '</b></div></div>';
  if (evo) h += secaoGaveta('Evolução', '', graficoEvolucao(evo[0], evo[1]));
  h += secaoGaveta('O que você mais erra', comErro.length, comErro.length
    ? listaGaveta(comErro.map(c => { const n = erroCount(c.id); return linhaCartaGaveta(c, n, n > 1 ? 'tropeços' : 'tropeço'); }))
    : '<p class="gvazio">Nenhum tropeço nas que faltam aprender. 🎉</p>');
  if (resto.length) h += secaoGaveta('Ainda não aprendidas', resto.length,
    listaGaveta(resto.map(c => linhaCartaGaveta(c, srs[c.id] ? Math.round(dominio(c.id) * 100) + '%' : '—', srs[c.id] ? 'domínio' : 'nunca vista'))));
  if (apr.length) h += secaoGaveta('Aprendidas', apr.length, listaGaveta(apr.map(c => linhaCartaGaveta(c))));
  corpo.innerHTML = h;
  ligaCartasGaveta(corpo);
}
// Uma habilidade: as cartas em que ela foi medida, da que você mais erra pra que nunca erra
function abreHabGaveta(k, g) {
  const hab = HABS.find(x => x.k === k);
  const r = (hab.porGrupo && hab.porGrupo[g]) || hab;
  const medidas = cards.filter(c => (ehFrase(c) ? 'frase' : 'palavra') === g)
    .map(c => ({ c, v: (stats[c.id] && stats[c.id].hab && stats[c.id].hab[k]) || null }))
    .filter(x => x.v && x.v.n);
  const erra = medidas.filter(x => x.v.e).sort((a, b) => b.v.e - a.v.e || (b.v.e / b.v.n) - (a.v.e / a.v.n));
  const limpas = medidas.filter(x => !x.v.e).sort((a, b) => b.v.n - a.v.n);
  const n = medidas.reduce((t, x) => t + x.v.n, 0), e = medidas.reduce((t, x) => t + x.v.e, 0);
  gravaFoto();
  const corpo = abreGaveta({ titulo: r.nome });
  let h = '<div class="gcodigo"><span>Habilidade · ' + (g === 'frase' ? 'Frases' : 'Palavras') + '</span></div>' +
    '<p class="gtexto">' + esc(r.dica) + '</p>' +
    '<div class="gkpis">' +
    '<div class="gkpi"><small>Erro</small><b>' + (n ? Math.round(e / n * 100) + '%' : '—') + '</b></div>' +
    '<div class="gkpi"><small>Tentativas</small><b>' + n + '</b></div>' +
    '<div class="gkpi"><small>Cartas medidas</small><b>' + medidas.length + '</b></div>' +
    '<div class="gkpi"><small>Com erro</small><b>' + erra.length + '</b></div></div>';
  h += secaoGaveta('Evolução', '', graficoEvolucao('hab', g + '.' + k));
  h += secaoGaveta('O que você mais erra', erra.length, erra.length
    ? listaGaveta(erra.map(x => linhaCartaGaveta(x.c, x.v.e + ' de ' + x.v.n, Math.round(x.v.e / x.v.n * 100) + '% de erro')))
    : '<p class="gvazio">Nenhum erro nesta habilidade ainda.</p>');
  if (limpas.length) h += secaoGaveta('Sem erro', limpas.length,
    listaGaveta(limpas.map(x => linhaCartaGaveta(x.c, x.v.n + '×', 'sem errar'))));
  corpo.innerHTML = h;
  ligaCartasGaveta(corpo);
}

// ── a evolução: uma foto por dia ───────────────────────────
// O banco só guarda o estado ATUAL de cada carta, então "estou melhorando no Cap. 3?" não
// tem resposta olhando pra trás. A partir de agora o app tira uma foto por dia, com o
// ACUMULADO de cada recorte, e o gráfico da gaveta compara uma foto com a anterior:
//   cap / deck:  [aprendidas, na rotação, acertos, tropeços]   (tropeço = difícil + erro)
//   hab:         [tentativas, erros]                            chave 'palavra.rec' etc.
// A foto de hoje é refeita a cada resposta (a última do dia vale). Mora na chave
// `evolucao` da tabela `estado`, então segue a conta de um aparelho pro outro.
const K_EVOLUCAO = 'manman.evolucao.v1';
const EVOLUCAO_DIAS = 200; // ~1 KB por dia; o jsonb da tabela aceita até 256 KB
function fotoAgora() {
  const f = { cap: {}, deck: {}, hab: {} };
  const soma = (m, k, c) => {
    const x = m[k] || (m[k] = [0, 0, 0, 0]);
    if (isOff(c.id)) return;
    const st = statOf(c.id);
    x[1]++; if (aprendida(c.id)) x[0]++;
    x[2] += st.g || 0; x[3] += (st.h || 0) + (st.a || 0);
  };
  cards.forEach(c => {
    soma(f.cap, origemDe(c), c);
    soma(f.deck, c.deck, c);
    const h = stats[c.id] && stats[c.id].hab;
    if (h) for (const k of Object.keys(h)) {
      const key = (ehFrase(c) ? 'frase' : 'palavra') + '.' + k;
      const x = f.hab[key] || (f.hab[key] = [0, 0]);
      x[0] += h[k].n || 0; x[1] += h[k].e || 0;
    }
  });
  return f;
}
function gravaFoto() {
  if (!cards.length || !settings.user) return;
  const ev = load(uk(K_EVOLUCAO), {});
  const t = todayStr(), f = fotoAgora();
  const sem = o => o ? JSON.stringify({ cap: o.cap, deck: o.deck, hab: o.hab }) : '';
  if (sem(ev[t]) === sem(f)) return; // nada mudou desde a última foto de hoje
  f.u = Date.now();
  ev[t] = f;
  const dias = Object.keys(ev).sort();
  dias.slice(0, Math.max(0, dias.length - EVOLUCAO_DIAS)).forEach(d => delete ev[d]);
  save(uk(K_EVOLUCAO), ev);
  if (typeof marcaEstado === 'function') marcaEstado('evolucao');
}
let fotoTimer = null;
// cada resposta refaz a foto de hoje, mas sem pressa: uma rodada são dezenas de respostas
function agendaFoto() { clearTimeout(fotoTimer); fotoTimer = setTimeout(gravaFoto, 4000); }

// A série de um recorte, dia a dia: o % aprendido naquele dia e o % de tropeço DAQUELE
// dia (a diferença pra foto anterior). O tropeço acumulado quase não se mexe depois de
// meses; o do dia é que mostra se você está errando menos agora.
function serieEvolucao(tipo, chave) {
  const ev = load(uk(K_EVOLUCAO), {});
  const dias = Object.keys(ev).sort();
  let ant = null;
  return dias.map(d => {
    const x = ev[d] && ev[d][tipo] && ev[d][tipo][chave];
    if (!x) { return null; }
    let apr = null, erro = null, n = 0;
    if (tipo === 'hab') {
      if (ant) { n = x[0] - ant[0]; if (n > 0) erro = Math.max(0, Math.min(1, (x[1] - ant[1]) / n)); }
    } else {
      apr = x[1] ? x[0] / x[1] : 0;
      if (ant) { n = (x[2] - ant[2]) + (x[3] - ant[3]); if (n > 0) erro = Math.max(0, Math.min(1, (x[3] - ant[3]) / n)); }
    }
    ant = x;
    return { d, apr, erro, n };
  }).filter(Boolean);
}
// O gráfico da gaveta: linha do % aprendido (cheia) e do % de tropeço do dia (pontilhada,
// com os pontos), de 0 a 100%. Sem dois dias ainda, diz que começou hoje.
function graficoEvolucao(tipo, chave) {
  const s = serieEvolucao(tipo, chave);
  const temApr = tipo !== 'hab';
  const comErro = s.filter(p => p.erro != null);
  const W = 560, H = 150, L = 34, R = 8, T = 10, B = 22;
  if (s.length < 2 || (!temApr && !comErro.length)) {
    return '<div class="gevo vazio"><b>Começou hoje</b><span>O app passou a guardar uma foto por dia deste recorte. ' +
      'Cada dia em que você estudar vira um ponto aqui, e em uma ou duas semanas dá pra ver se está melhorando.</span></div>';
  }
  const x = i => L + (s.length === 1 ? 0 : i * (W - L - R) / (s.length - 1));
  const y = v => T + (1 - v) * (H - T - B);
  const linha = (key) => s.map((p, i) => p[key] == null ? null : [x(i), y(p[key])]).filter(Boolean)
    .map((pt, i) => (i ? 'L' : 'M') + pt[0].toFixed(1) + ' ' + pt[1].toFixed(1)).join(' ');
  const grade = [0, .5, 1].map(v => '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '" class="gevo-g"/>' +
    '<text x="' + (L - 6) + '" y="' + (y(v) + 3) + '" class="gevo-t" text-anchor="end">' + Math.round(v * 100) + '%</text>').join('');
  const fmt = d => d.slice(8) + '/' + d.slice(5, 7);
  const rotX = '<text x="' + x(0) + '" y="' + (H - 6) + '" class="gevo-t">' + fmt(s[0].d) + '</text>' +
    '<text x="' + x(s.length - 1) + '" y="' + (H - 6) + '" class="gevo-t" text-anchor="end">' + fmt(s[s.length - 1].d) + '</text>';
  const pontos = s.map((p, i) => p.erro == null ? '' : '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(p.erro).toFixed(1) + '" r="3" class="gevo-pe"><title>' +
    fmt(p.d) + ': ' + Math.round(p.erro * 100) + '% de tropeço em ' + p.n + ' resposta' + (p.n > 1 ? 's' : '') + '</title></circle>').join('');
  // a tendência em palavras: o tropeço da primeira metade dos dias contra o da segunda
  let veredito = '';
  if (comErro.length >= 4) {
    const meio = Math.floor(comErro.length / 2);
    const media = l => l.reduce((t, p) => t + p.erro * p.n, 0) / Math.max(1, l.reduce((t, p) => t + p.n, 0));
    const a = media(comErro.slice(0, meio)), b = media(comErro.slice(meio));
    const dif = Math.round((b - a) * 100);
    veredito = dif <= -3 ? '<span class="gevo-ok">Melhorando: o tropeço caiu de ' + Math.round(a * 100) + '% pra ' + Math.round(b * 100) + '%</span>'
      : dif >= 3 ? '<span class="gevo-mal">Piorando: o tropeço subiu de ' + Math.round(a * 100) + '% pra ' + Math.round(b * 100) + '%</span>'
      : '<span>Estável: o tropeço está em torno de ' + Math.round(b * 100) + '%</span>';
  }
  return '<div class="gevo"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Evolução">' + grade + rotX +
    (temApr ? '<path d="' + linha('apr') + '" class="gevo-la"/>' : '') +
    '<path d="' + linha('erro') + '" class="gevo-le"/>' + pontos + '</svg>' +
    '<div class="gevo-leg">' + (temApr ? '<span><i class="a"></i>aprendido</span>' : '') +
    '<span><i class="e"></i>tropeço no dia</span>' + veredito + '</div></div>';
}
