/* Mànmàn — peças de interface do Design System RAIZ (DESIGN_SYSTEM.md, ref. Group OS),
   reescritas em JS puro porque aqui não tem React nem build:

     abreGaveta / fechaGaveta   a <Gaveta> (11.1): o detalhe abre à direita, a lista fica atrás
     filtroMulti / filtroUnico  os filtros da <FilterBar> (9): botão h-9, borda verde 2px
                                quando tem valor, popover com a lista
     botaoQuadrado              os botões "Agrupar por" / "Colunas" (8.5): h-9 w-9 com ícone,
                                borda laranja quando há algo ativo
     popItens / popChecks       o miolo dos popovers (uma escolha / várias)

   Tudo devolve elemento DOM, não string: quem monta a barra só faz append. */

const ICO = {
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  camadas: '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
  colunas: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="M15 3v18"/>',
  ordenar: '<path d="m21 16-4 4-4-4"/><path d="M17 20V4"/><path d="m3 8 4-4 4 4"/><path d="M7 4v16"/>',
  olho: '<path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/>',
  seta: '<path d="m6 9 6 6 6-6"/>',
  cima: '<path d="m18 15-6-6-6 6"/>',
  baixo: '<path d="m6 9 6 6 6-6"/>',
  tabela: '<path d="M12 3v18"/><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/>',
  grade: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>'
};
function icone(nome, cls) {
  return '<svg class="ico' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true">' + ICO[nome] + '</svg>';
}

// ── Gaveta ──────────────────────────────────────────────────────────────────────
// Uma só no app, criada na primeira vez. abreGaveta devolve o corpo pra quem chamou
// preencher e ligar os eventos; chamar de novo com a gaveta aberta só troca o conteúdo
// (é assim que o "próxima ›" da teoria anda sem fechar e abrir).
let gavetaAoFechar = null;
function gavetaEl() {
  let w = $('gaveta');
  if (w) return w;
  w = document.createElement('div');
  w.className = 'gaveta-wrap'; w.id = 'gaveta';
  w.innerHTML = '<div class="gaveta-bg"></div><aside class="gaveta" role="dialog" aria-modal="true">' +
    '<header class="gaveta-cab"><div class="gaveta-esq"><button class="gaveta-x" title="Fechar" aria-label="Fechar">' + icone('x') + '</button>' +
    '<h2 class="gaveta-titulo"></h2></div><div class="gaveta-acoes"></div></header>' +
    '<div class="gaveta-corpo"></div></aside>';
  document.body.appendChild(w);
  w.querySelector('.gaveta-bg').onclick = fechaGaveta;
  w.querySelector('.gaveta-x').onclick = fechaGaveta;
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && w.classList.contains('show') && !document.querySelector('.ft-pop')) fechaGaveta();
  });
  return w;
}
function abreGaveta({ titulo, acoes, aoFechar }) {
  const w = gavetaEl();
  w.querySelector('.gaveta-titulo').textContent = titulo || '';
  const a = w.querySelector('.gaveta-acoes');
  a.innerHTML = '';
  if (typeof acoes === 'string') a.innerHTML = acoes; else if (acoes) a.append(...[].concat(acoes));
  gavetaAoFechar = aoFechar || null;
  const corpo = w.querySelector('.gaveta-corpo');
  corpo.innerHTML = '';
  corpo.scrollTop = 0;
  w.classList.add('show');
  document.body.classList.add('com-gaveta');
  return corpo;
}
function gavetaAberta() { const w = $('gaveta'); return !!(w && w.classList.contains('show')); }
function fechaGaveta() {
  const w = $('gaveta');
  if (!w || !w.classList.contains('show')) return;
  w.classList.remove('show');
  document.body.classList.remove('com-gaveta');
  const f = gavetaAoFechar; gavetaAoFechar = null;
  if (f) f();
}
// <SecaoGaveta>: título em caixa-alta + número à direita
function secaoGaveta(titulo, extra, corpo) {
  return '<section class="gsec"><div class="gsec-cab"><h3>' + esc(titulo) + '</h3>' +
    (extra != null && extra !== '' ? '<span>' + esc(String(extra)) + '</span>' : '') + '</div>' + corpo + '</section>';
}
// <CamposGaveta>: rótulo apagado à esquerda, valor à direita. O valor já vem em HTML.
function camposGaveta(campos) {
  return '<dl class="gcampos">' + campos.filter(([, v]) => v != null && v !== '')
    .map(([r, v]) => '<dt>' + esc(r) + '</dt><dd>' + v + '</dd>').join('') + '</dl>';
}

// ── Popover ─────────────────────────────────────────────────────────────────────
// Um aberto por vez, preso embaixo do botão que o abriu. Fecha no clique fora e no Esc.
let popAtual = null;
function fechaPop() {
  if (!popAtual) return;
  popAtual.el.remove();
  popAtual.dono.classList.remove('aberto');
  popAtual = null;
}
function abrePop(dono, largura, monta) {
  const era = popAtual && popAtual.dono === dono;
  fechaPop();
  if (era) return; // segundo toque no mesmo botão fecha
  const el = document.createElement('div');
  el.className = 'ft-pop';
  el.style.width = largura + 'px';
  document.body.appendChild(el);
  popAtual = { el, dono };
  dono.classList.add('aberto');
  monta(el);
  posicionaPop();
}
function posicionaPop() {
  if (!popAtual) return;
  const { el, dono } = popAtual;
  if (!dono.isConnected) return; // a barra foi redesenhada: o popover fica onde está
  const r = dono.getBoundingClientRect();
  const w = el.offsetWidth, vw = document.documentElement.clientWidth;
  let left = r.left;
  if (left + w > vw - 8) left = Math.max(8, r.right - w);
  el.style.left = left + window.scrollX + 'px';
  el.style.top = r.bottom + window.scrollY + 4 + 'px';
}
document.addEventListener('pointerdown', e => {
  if (popAtual && !popAtual.el.contains(e.target) && !popAtual.dono.contains(e.target)) fechaPop();
}, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape') fechaPop(); });
window.addEventListener('resize', fechaPop);

// Lista de uma escolha (Agrupar por, Ordenar, filtro de valor único)
function popItens(el, titulo, opcoes, atual, escolhe, rodape) {
  el.innerHTML = (titulo ? '<div class="ft-pop-tit">' + esc(titulo) + '</div>' : '') +
    opcoes.map(([k, t]) => '<button class="ft-item' + (k === atual ? ' on' : '') + '" data-k="' + esc(k) + '">' +
      '<i class="ft-q"></i><span>' + t + '</span></button>').join('') +
    (rodape ? '<div class="ft-pop-rod"><button class="ft-link" data-rod="1">' + esc(rodape) + '</button></div>' : '');
  el.querySelectorAll('.ft-item').forEach(b => b.onclick = () => { fechaPop(); escolhe(b.dataset.k); });
  const r = el.querySelector('[data-rod]');
  if (r) r.onclick = () => { fechaPop(); escolhe(null); };
}
// Lista de várias (filtro multi): busca no topo quando é comprida, Marcar todos / Limpar no pé
function popChecks(el, opcoes, sel, muda) {
  const set = new Set(sel);
  const longa = opcoes.length > 8;
  el.innerHTML = (longa ? '<label class="ft-pop-busca">' + '<input placeholder="Buscar" autocomplete="off"></label>' : '') +
    '<div class="ft-lista"></div><div class="ft-pop-rod"><button class="ft-link" data-todos="1">Marcar todos</button>' +
    '<button class="ft-link" data-limpa="1">Limpar</button></div>';
  const lista = el.querySelector('.ft-lista');
  const desenha = (q) => {
    q = (q || '').trim().toLowerCase();
    lista.innerHTML = opcoes.filter(([, t]) => !q || semAcento(t).includes(semAcento(q)))
      .map(([k, t]) => '<button class="ft-item' + (set.has(k) ? ' on' : '') + '" data-k="' + esc(k) + '"><i class="ft-q"></i><span>' + t + '</span></button>').join('') ||
      '<p class="ft-vazio">Nada encontrado.</p>';
    lista.querySelectorAll('.ft-item').forEach(b => b.onclick = () => {
      const k = b.dataset.k;
      if (set.has(k)) set.delete(k); else set.add(k);
      b.classList.toggle('on', set.has(k));
      muda([...set]);
    });
  };
  desenha('');
  const busca = el.querySelector('.ft-pop-busca input');
  if (busca) { busca.oninput = () => desenha(busca.value); setTimeout(() => busca.focus(), 0); }
  el.querySelector('[data-todos]').onclick = () => { opcoes.forEach(([k]) => set.add(k)); desenha(busca && busca.value); muda([...set]); };
  el.querySelector('[data-limpa]').onclick = () => { set.clear(); desenha(busca && busca.value); muda([]); };
}
function semAcento(s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
function textoDe(html) { const d = document.createElement('div'); d.innerHTML = html; return d.textContent; }

// ── Filtros da barra ────────────────────────────────────────────────────────────
// Vazio: mostra o rótulo, apagado. Com valor: borda verde de 2px, o chip verde com a
// quantidade e os nomes (truncados). Valor vazio = sem filtro, sempre.
function filtroMulti(rotulo, opcoes, sel, muda) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'ft-btn';
  const pinta = (s) => {
    const nomes = opcoes.filter(([k]) => s.includes(k)).map(([, t]) => textoDe(t));
    b.classList.toggle('cheio', s.length > 0);
    b.innerHTML = (s.length ? '<em>' + s.length + '</em><span>' + esc(nomes.join(', ')) + '</span>' : '<span>' + esc(rotulo) + '</span>') + icone('seta', 'ft-seta');
    b.title = s.length ? rotulo + ': ' + nomes.join(', ') : rotulo;
  };
  pinta(sel);
  b.onclick = () => abrePop(b, 256, el => popChecks(el, opcoes, sel, s => { sel = s; pinta(s); muda(s); }));
  return b;
}
function filtroUnico(rotulo, opcoes, valor, muda) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'ft-btn' + (valor ? ' cheio' : '');
  const op = opcoes.find(([k]) => k === valor);
  b.innerHTML = '<span>' + (op ? op[1] : esc(rotulo)) + '</span>' + icone('seta', 'ft-seta');
  b.title = rotulo;
  b.onclick = () => abrePop(b, 224, el => popItens(el, null,
    [['', esc(rotulo) + ': todos']].concat(opcoes), valor || '', k => muda(k || null)));
  return b;
}
// h-9 w-9 com ícone; ativo = borda laranja
function botaoQuadrado(nomeIcone, titulo, ativo, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'ft-quad' + (ativo ? ' ativo' : '');
  b.title = titulo; b.setAttribute('aria-label', titulo);
  b.innerHTML = icone(nomeIcone);
  b.onclick = () => onClick(b);
  return b;
}
// Popover "Colunas (5/8)": um check por coluna, Mostrar/Ocultar todas no topo
function popColunas(el, colunas, ocultas, muda) {
  const set = new Set(ocultas);
  const desenha = () => {
    const vis = colunas.filter(([k]) => !set.has(k)).length;
    el.innerHTML = '<div class="ft-pop-tit ft-pop-tit2"><span>Colunas (' + vis + '/' + colunas.length + ')</span>' +
      '<button class="ft-link" data-tudo="1">' + (set.size ? 'Mostrar todas' : 'Ocultar todas') + '</button></div>' +
      colunas.map(([k, t]) => '<button class="ft-item' + (set.has(k) ? '' : ' on') + '" data-k="' + k + '"><i class="ft-q"></i><span>' + t + '</span></button>').join('');
    el.querySelectorAll('.ft-item').forEach(b => b.onclick = () => {
      if (set.has(b.dataset.k)) set.delete(b.dataset.k); else set.add(b.dataset.k);
      desenha(); muda([...set]);
    });
    el.querySelector('[data-tudo]').onclick = () => {
      if (set.size) set.clear(); else colunas.forEach(([k]) => set.add(k));
      desenha(); muda([...set]);
    };
  };
  desenha();
}

// <SeletorVisao> (8.10): jeitos de ver os mesmos dados, no canto direito da barra.
// opcoes = [[chave, nome, ícone]]; o nome some em tela estreita.
function seletorVisao(opcoes, valor, muda) {
  const g = document.createElement('div');
  g.className = 'ft-visao';
  g.setAttribute('role', 'group');
  g.innerHTML = opcoes.map(([k, t, ic]) => '<button type="button" data-k="' + k + '" title="' + esc(t) + '"' +
    (k === valor ? ' class="on" aria-pressed="true"' : ' aria-pressed="false"') + '>' + icone(ic) + '<span>' + esc(t) + '</span></button>').join('');
  g.querySelectorAll('button').forEach(b => b.onclick = () => { if (b.dataset.k !== valor) muda(b.dataset.k); });
  return g;
}
