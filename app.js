/* Jìzhù 记住 — flashcards de mandarim
   Sem build, sem dependências. Dados: Supabase (REST) → cache local → seed. */
'use strict';

// ── constantes ──────────────────────────────────────────────
const NEW_PER_DAY = 10;          // novas cartas por dia
const LEARNED_IVL = 21;          // intervalo (dias) p/ considerar "aprendida"
const EASE_START = 2.5, EASE_MIN = 1.3, EASE_MAX = 2.8;
const K = {                      // chaves do localStorage
  cards: 'jizhu.cards.v1',
  srs: 'jizhu.srs.v1',
  log: 'jizhu.log.v1',
  settings: 'jizhu.settings.v1',
  dayOffset: 'jizhu.dayoffset'
};
const DECK_LABELS = { saudacoes: 'Saudações', numeros: 'Números', pronomes: 'Pronomes',
  verbos: 'Verbos', uteis: 'Úteis', radicais: 'Radicais', geral: 'Geral' };

// ── estado ──────────────────────────────────────────────────
let cards = [];                  // deck completo (não deletadas)
let srs = load(K.srs, {});       // id → {reps, ivl, ease, due}
let log = load(K.log, {});       // 'YYYY-MM-DD' → {rev, new}
let settings = load(K.settings, { mode: 'zh2pt', deck: 'todos', quem: 'leo', theme: null });
let queue = [];                  // fila da sessão (ids)
let current = null;              // carta atual
let freeMode = false;            // treino livre (não grava SRS)
let dataSource = '';             // 'supabase' | 'cache' | 'seed'

// ── helpers ─────────────────────────────────────────────────
function load(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v === null || v === undefined ? fallback : v; }
  catch (e) { return fallback; }
}
function save(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
function $(id) { return document.getElementById(id); }
function esc(s) { const d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }
function dayOffset() { return parseInt(localStorage.getItem(K.dayOffset) || '0', 10); }
function todayStr(plusDays) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset() + (plusDays || 0));
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}
function deckLabel(d) { return DECK_LABELS[d] || (d.charAt(0).toUpperCase() + d.slice(1)); }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// ── conversor de tons: ni3 hao3 → nǐ hǎo ────────────────────
const TONE_MARKS = {
  a: ['ā', 'á', 'ǎ', 'à', 'a'], e: ['ē', 'é', 'ě', 'è', 'e'], i: ['ī', 'í', 'ǐ', 'ì', 'i'],
  o: ['ō', 'ó', 'ǒ', 'ò', 'o'], u: ['ū', 'ú', 'ǔ', 'ù', 'u'], 'ü': ['ǖ', 'ǘ', 'ǚ', 'ǜ', 'ü'],
  A: ['Ā', 'Á', 'Ǎ', 'À', 'A'], E: ['Ē', 'É', 'Ě', 'È', 'E'], O: ['Ō', 'Ó', 'Ǒ', 'Ò', 'O']
};
function pinyinTones(input) {
  return String(input || '').replace(/([a-zA-ZüÜ:]+)([1-5])/g, function (m, syl, tone) {
    syl = syl.replace(/v/g, 'ü').replace(/V/g, 'Ü').replace(/u:/g, 'ü').replace(/U:/g, 'Ü');
    const t = parseInt(tone, 10) - 1;
    if (t === 4) return syl; // tom neutro
    let idx = -1;
    const lower = syl.toLowerCase();
    if (lower.includes('a')) idx = lower.indexOf('a');
    else if (lower.includes('e')) idx = lower.indexOf('e');
    else if (lower.includes('ou')) idx = lower.indexOf('o');
    else { // última vogal
      for (let i = syl.length - 1; i >= 0; i--) {
        if ('iouü'.includes(lower[i])) { idx = i; break; }
      }
    }
    if (idx === -1) return syl + tone;
    const ch = syl[idx];
    const marks = TONE_MARKS[ch] || TONE_MARKS[ch.toLowerCase()];
    if (!marks) return syl + tone;
    return syl.slice(0, idx) + marks[t] + syl.slice(idx + 1);
  });
}

// ── SRS (SM-2 simplificado) ─────────────────────────────────
function srsPreview(state, grade) { // retorna rótulo do próximo intervalo
  const s = state || { reps: 0, ivl: 0, ease: EASE_START };
  if (grade === 'again') return '<10 min';
  if (grade === 'hard') return Math.max(1, Math.round((s.ivl || 1) * 1.2)) + 'd';
  // good
  if (s.reps === 0) return '1d';
  if (s.reps === 1) return '3d';
  return Math.round(s.ivl * s.ease) + 'd';
}
function srsApply(id, grade) {
  const s = srs[id] || { reps: 0, ivl: 0, ease: EASE_START, due: todayStr() };
  if (grade === 'again') {
    s.ease = Math.max(EASE_MIN, s.ease - 0.2);
    s.reps = 0; s.ivl = 0; s.due = todayStr();
  } else if (grade === 'hard') {
    s.ease = Math.max(EASE_MIN, s.ease - 0.15);
    s.ivl = Math.max(1, Math.round((s.ivl || 1) * 1.2));
    s.due = todayStr(s.ivl);
  } else { // good
    s.ease = Math.min(EASE_MAX, s.ease);
    if (s.reps === 0) s.ivl = 1;
    else if (s.reps === 1) s.ivl = 3;
    else s.ivl = Math.round(s.ivl * s.ease);
    s.reps += 1;
    s.due = todayStr(s.ivl);
  }
  srs[id] = s;
  save(K.srs, srs);
  return s;
}
function logToday(field) {
  const t = todayStr();
  if (!log[t]) log[t] = { rev: 0, new: 0 };
  log[t][field] = (log[t][field] || 0) + 1;
  save(K.log, log);
}
function gcSrs() { // remove estados de cartas que não existem mais
  const ids = new Set(cards.map(c => c.id));
  let changed = false;
  for (const id of Object.keys(srs)) if (!ids.has(id)) { delete srs[id]; changed = true; }
  if (changed) save(K.srs, srs);
}

// ── dados: Supabase → cache → seed ──────────────────────────
function sbConfigured() { return HW_CONFIG.SUPABASE_URL && HW_CONFIG.SUPABASE_ANON_KEY; }
function sbHeaders(extra) {
  return Object.assign({
    apikey: HW_CONFIG.SUPABASE_ANON_KEY,
    Authorization: 'Bearer ' + HW_CONFIG.SUPABASE_ANON_KEY,
    'Content-Type': 'application/json'
  }, extra || {});
}
async function fetchCards() {
  const url = HW_CONFIG.SUPABASE_URL + '/rest/v1/cards?select=*&deleted=eq.false&order=created_at.asc';
  const r = await fetch(url, { headers: sbHeaders() });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}
async function loadCards() {
  const cached = load(K.cards, null);
  if (sbConfigured()) {
    try {
      cards = await fetchCards();
      save(K.cards, cards);
      dataSource = 'supabase';
      return;
    } catch (e) {
      if (cached && cached.length) { cards = cached; dataSource = 'cache'; return; }
    }
  } else if (cached && cached.length) {
    cards = cached; dataSource = 'cache-noconfig'; return;
  }
  // fallback: seed local do repo
  try {
    const r = await fetch('./seed/seed_cards.json');
    cards = await r.json();
    dataSource = 'seed';
  } catch (e) {
    cards = []; dataSource = 'vazio';
  }
}
async function sbInsert(card) {
  const r = await fetch(HW_CONFIG.SUPABASE_URL + '/rest/v1/cards', {
    method: 'POST', headers: sbHeaders({ Prefer: 'return=representation' }),
    body: JSON.stringify(card)
  });
  if (!r.ok) throw new Error('HTTP ' + r.status + ': ' + (await r.text()));
  return (await r.json())[0];
}
async function sbUpdate(id, patch) {
  const r = await fetch(HW_CONFIG.SUPABASE_URL + '/rest/v1/cards?id=eq.' + encodeURIComponent(id), {
    method: 'PATCH', headers: sbHeaders(), body: JSON.stringify(patch)
  });
  if (!r.ok) throw new Error('HTTP ' + r.status + ': ' + (await r.text()));
}

function showBanner(kind, msg) {
  const b = $('banner');
  b.className = 'banner show ' + kind;
  b.textContent = msg;
}
function hideBanner() { $('banner').className = 'banner'; }

// ── fila de estudo ──────────────────────────────────────────
function filteredCards() {
  return settings.deck === 'todos' ? cards : cards.filter(c => c.deck === settings.deck);
}
function buildQueue() {
  const t = todayStr();
  const pool = filteredCards();
  const due = pool.filter(c => srs[c.id] && srs[c.id].due <= t)
    .sort((a, b) => srs[a.id].due < srs[b.id].due ? -1 : 1);
  const newToday = (log[t] && log[t].new) || 0;
  const news = shuffle(pool.filter(c => !srs[c.id])).slice(0, Math.max(0, NEW_PER_DAY - newToday));
  queue = due.concat(news).map(c => c.id);
  freeMode = false;
}
function buildFreeQueue() {
  queue = shuffle(filteredCards().map(c => c.id));
  freeMode = true;
}
function dueCount() {
  const t = todayStr();
  const pool = filteredCards();
  const due = pool.filter(c => srs[c.id] && srs[c.id].due <= t).length;
  const newToday = (log[t] && log[t].new) || 0;
  const news = Math.min(pool.filter(c => !srs[c.id]).length, Math.max(0, NEW_PER_DAY - newToday));
  return { due, news };
}

// ── UI: estudar ─────────────────────────────────────────────
function renderChips() {
  const decks = ['todos'].concat([...new Set(cards.map(c => c.deck))]);
  $('deckchips').innerHTML = decks.map(d =>
    '<button class="chip' + (settings.deck === d ? ' active' : '') + '" data-d="' + esc(d) + '">' +
    (d === 'todos' ? 'Todos' : esc(deckLabel(d))) + '</button>').join('');
  $('deckchips').querySelectorAll('.chip').forEach(ch => ch.onclick = () => {
    settings.deck = ch.dataset.d; save(K.settings, settings);
    renderChips(); startSession();
  });
}
function renderCounter() {
  const { due, news } = dueCount();
  $('counter').innerHTML = freeMode
    ? '<b>treino livre</b> · ' + queue.length + ' cartas embaralhadas'
    : '<b>' + due + '</b> para hoje · <b>' + news + '</b> novas';
}
function showCard(card) {
  current = card;
  const f = $('fcard');
  f.classList.remove('flipped');
  const front = $('front-content');
  if (settings.mode === 'zh2pt') {
    front.innerHTML = '<div class="hanzi-lg zh" lang="zh-Hans">' + esc(card.hanzi) + '</div>';
  } else {
    front.innerHTML = '<div class="pt-lg">' + esc(card.pt) + '</div>';
  }
  $('deckpill-f').textContent = deckLabel(card.deck);
  $('deckpill-b').textContent = deckLabel(card.deck);
  $('back-hanzi').textContent = card.hanzi;
  $('back-hanzi').setAttribute('lang', 'zh-Hans');
  $('back-pinyin').textContent = card.pinyin;
  $('back-pt').textContent = card.pt;
  $('back-nota').textContent = card.nota || '';
  // previews de intervalo
  const s = srs[card.id];
  $('iv-again').textContent = srsPreview(s, 'again');
  $('iv-hard').textContent = srsPreview(s, 'hard');
  $('iv-good').textContent = srsPreview(s, 'good');
  $('grades').classList.remove('show');
  $('nextbtn').classList.remove('show');
  $('stage').style.display = '';
  $('done').classList.remove('show');
  renderCounter();
}
function nextCard() {
  if (!queue.length) { finishSession(); return; }
  const id = queue[0];
  const card = cards.find(c => c.id === id);
  if (!card) { queue.shift(); nextCard(); return; }
  showCard(card);
}
function finishSession() {
  current = null;
  $('stage').style.display = 'none';
  $('grades').classList.remove('show');
  $('nextbtn').classList.remove('show');
  $('done').classList.add('show');
  $('done-sub').textContent = freeMode
    ? 'Fim do treino livre. 加油 (jiāyóu — força)!'
    : 'Você revisou tudo que estava agendado. 明天见 (até amanhã)!';
  renderCounter();
}
function startSession() {
  buildQueue();
  if (queue.length) nextCard(); else finishSession();
}
function grade(g) {
  if (!current) return;
  queue.shift();
  if (!freeMode) {
    const isNew = !srs[current.id];
    srsApply(current.id, g);
    logToday('rev');
    if (isNew) logToday('new');
    if (g === 'again') queue.splice(Math.min(3, queue.length), 0, current.id);
  }
  nextCard();
}

// ── UI: cartas ──────────────────────────────────────────────
function renderDeckSelect() {
  const decks = [...new Set(cards.map(c => c.deck))];
  $('f-deck').innerHTML = decks.map(d => '<option value="' + esc(d) + '">' + esc(deckLabel(d)) + '</option>').join('') +
    '<option value="__novo__">➕ novo deck…</option>';
}
function renderList() {
  const q = $('search').value.trim().toLowerCase();
  const list = cards.filter(c => !q ||
    (c.hanzi || '').toLowerCase().includes(q) ||
    (c.pinyin || '').toLowerCase().includes(q) ||
    (c.pt || '').toLowerCase().includes(q));
  $('cardlist').innerHTML = list.map(c =>
    '<div class="card" data-id="' + esc(c.id) + '">' +
    '<div class="rowline">' +
    '<div class="h zh" lang="zh-Hans">' + esc(c.hanzi) + '</div>' +
    '<div class="mid"><div class="p">' + esc(c.pinyin) + '</div><div class="t">' + esc(c.pt) + '</div></div>' +
    '<span class="pill">' + esc(deckLabel(c.deck)) + '</span>' +
    '</div>' +
    '<div class="editbox">' +
    '<label>Hanzi</label><input class="inp zh e-hanzi" value="' + esc(c.hanzi) + '">' +
    '<label>Pinyin</label><input class="inp e-pinyin" value="' + esc(c.pinyin) + '">' +
    '<label>Tradução</label><input class="inp e-pt" value="' + esc(c.pt) + '">' +
    '<label>Nota</label><input class="inp e-nota" value="' + esc(c.nota || '') + '">' +
    '<div class="actions"><button class="btn e-save">Salvar</button>' +
    '<button class="btn danger e-arch">Arquivar</button></div>' +
    '</div></div>').join('') || '<p style="color:var(--mut);text-align:center">Nenhuma carta encontrada.</p>';

  $('cardlist').querySelectorAll('.card').forEach(el => {
    el.querySelector('.rowline').onclick = () => el.querySelector('.editbox').classList.toggle('show');
    el.querySelector('.e-save').onclick = () => saveEdit(el);
    el.querySelector('.e-arch').onclick = () => archiveCard(el);
  });
}
async function saveEdit(el) {
  const id = el.dataset.id;
  const patch = {
    hanzi: el.querySelector('.e-hanzi').value.trim(),
    pinyin: pinyinTones(el.querySelector('.e-pinyin').value.trim()),
    pt: el.querySelector('.e-pt').value.trim(),
    nota: el.querySelector('.e-nota').value.trim() || null
  };
  if (!patch.hanzi || !patch.pinyin || !patch.pt) { alert('Hanzi, pinyin e tradução são obrigatórios.'); return; }
  try {
    if (sbConfigured()) await sbUpdate(id, patch);
    else throw new Error('Supabase não configurado — edição só funciona online.');
    Object.assign(cards.find(c => c.id === id), patch);
    save(K.cards, cards);
    renderList();
  } catch (e) { alert('Não consegui salvar: ' + e.message); }
}
async function archiveCard(el) {
  const id = el.dataset.id;
  const c = cards.find(x => x.id === id);
  if (!confirm('Arquivar a carta "' + c.hanzi + '"? Ela some para todo mundo (dá pra recuperar no banco).')) return;
  try {
    if (sbConfigured()) await sbUpdate(id, { deleted: true });
    else throw new Error('Supabase não configurado.');
    cards = cards.filter(x => x.id !== id);
    save(K.cards, cards);
    renderList(); renderChips(); renderProgress();
  } catch (e) { alert('Não consegui arquivar: ' + e.message); }
}
async function saveNewCard() {
  const hanzi = $('f-hanzi').value.trim();
  const pinyinRaw = $('f-pinyin').value.trim();
  const pt = $('f-pt').value.trim();
  let deck = $('f-deck').value;
  if (deck === '__novo__') deck = ($('f-deck-new').value.trim().toLowerCase().replace(/\s+/g, '-')) || 'geral';
  const quem = $('f-quem').value;
  const nota = $('f-nota').value.trim() || null;
  if (!hanzi || !pinyinRaw || !pt) { alert('Preencha hanzi, pinyin e tradução.'); return; }
  const card = {
    id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
    hanzi, pinyin: pinyinTones(pinyinRaw), pt, deck,
    tags: [], nota, created_by: quem
  };
  settings.quem = quem; save(K.settings, settings);
  try {
    if (!sbConfigured()) throw new Error('Supabase ainda não configurado — peça pro Leo ativar.');
    const saved = await sbInsert(card);
    cards.push(saved || card);
    save(K.cards, cards);
    $('f-hanzi').value = ''; $('f-pinyin').value = ''; $('f-pt').value = ''; $('f-nota').value = '';
    $('f-pyprev').textContent = '';
    $('newcard-form').style.display = 'none';
    renderList(); renderChips(); renderDeckSelect(); renderProgress();
    showBanner('info', '✅ Carta "' + hanzi + '" salva para todo mundo!');
    setTimeout(hideBanner, 3000);
  } catch (e) { alert('Não consegui salvar: ' + e.message); }
}

// ── UI: progresso ───────────────────────────────────────────
function renderProgress() {
  const t = todayStr();
  const { due, news } = dueCount();
  $('s-hoje').textContent = due;
  $('s-novas').textContent = news;
  $('s-aprendidas').textContent = cards.filter(c => srs[c.id] && srs[c.id].ivl >= LEARNED_IVL).length;
  // streak: dias consecutivos com revisão, terminando hoje ou ontem
  let streak = 0;
  let d = (log[t] && log[t].rev) ? 0 : 1; // se hoje ainda não revisou, começa de ontem
  while (true) {
    const key = todayStr(-(d + streak));
    if (log[key] && log[key].rev > 0) streak++;
    else break;
  }
  $('s-streak').textContent = streak;
  // barras 14 dias
  const days = [];
  for (let i = 13; i >= 0; i--) days.push(todayStr(-i));
  const vals = days.map(k => (log[k] && log[k].rev) || 0);
  const max = Math.max(1, ...vals);
  $('bars').innerHTML = vals.map(v =>
    '<div class="bar' + (v === 0 ? ' zero' : '') + '" style="height:' + Math.max(3, Math.round(v / max * 100)) + '%" title="' + v + '"></div>').join('');
  $('barlabels').innerHTML = days.map(k => '<span>' + k.slice(8) + '</span>').join('');
  // por deck
  const decks = [...new Set(cards.map(c => c.deck))];
  $('deckstats').innerHTML = decks.map(dk => {
    const pool = cards.filter(c => c.deck === dk);
    const learned = pool.filter(c => srs[c.id] && srs[c.id].ivl >= LEARNED_IVL).length;
    const seen = pool.filter(c => srs[c.id]).length;
    return '<div class="deckrow"><b>' + esc(deckLabel(dk)) + '</b><span>' + seen + '/' + pool.length +
      ' vistas · ' + learned + ' aprendidas</span></div>';
  }).join('');
}

// ── navegação e eventos ─────────────────────────────────────
function switchView(v) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.v === v));
  document.querySelectorAll('.view').forEach(s => s.classList.toggle('active', s.id === 'view-' + v));
  if (v === 'progresso') renderProgress();
  if (v === 'cartas') renderList();
}
function applyTheme() {
  const pref = settings.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.dataset.theme = pref;
  $('themebtn').textContent = pref === 'dark' ? '☀️' : '🌙';
}

function bindEvents() {
  document.querySelectorAll('.tab').forEach(t => t.onclick = () => switchView(t.dataset.v));
  $('themebtn').onclick = () => {
    settings.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    save(K.settings, settings); applyTheme();
  };
  $('modeseg').querySelectorAll('button').forEach(b => b.onclick = () => {
    settings.mode = b.dataset.m; save(K.settings, settings);
    $('modeseg').querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b));
    if (current) showCard(current);
  });
  $('fcard').onclick = () => {
    if (!current) return;
    const f = $('fcard');
    f.classList.toggle('flipped');
    if (f.classList.contains('flipped')) {
      if (freeMode) $('nextbtn').classList.add('show');
      else $('grades').classList.add('show');
    } else {
      $('grades').classList.remove('show');
      $('nextbtn').classList.remove('show');
    }
  };
  $('g-again').onclick = () => grade('again');
  $('g-hard').onclick = () => grade('hard');
  $('g-good').onclick = () => grade('good');
  $('nextbtn').onclick = () => { queue.shift(); nextCard(); };
  $('freebtn').onclick = () => { buildFreeQueue(); if (queue.length) nextCard(); };
  // cartas
  $('newcard-toggle').onclick = () => {
    const f = $('newcard-form');
    f.style.display = f.style.display === 'none' ? '' : 'none';
    $('f-quem').value = settings.quem || 'leo';
  };
  $('f-cancel').onclick = () => $('newcard-form').style.display = 'none';
  $('f-save').onclick = saveNewCard;
  $('f-pinyin').oninput = () => $('f-pyprev').textContent = pinyinTones($('f-pinyin').value);
  $('f-deck').onchange = () => $('f-deck-new').style.display = $('f-deck').value === '__novo__' ? '' : 'none';
  $('search').oninput = renderList;
  // progresso
  $('resetbtn').onclick = () => {
    if (!confirm('Zerar TODO o seu progresso de estudo neste aparelho? As cartas não são apagadas.')) return;
    srs = {}; log = {};
    localStorage.removeItem(K.srs); localStorage.removeItem(K.log);
    renderProgress(); startSession();
  };
  // debug (?debug=1)
  if (new URLSearchParams(location.search).get('debug')) {
    $('debugbar').classList.add('show');
    const upd = () => $('debug-date').textContent = 'hoje=' + todayStr() + ' offset=' + dayOffset();
    upd();
    $('debug-tomorrow').onclick = () => { localStorage.setItem(K.dayOffset, String(dayOffset() + 1)); upd(); startSession(); renderProgress(); };
    $('debug-reset').onclick = () => { localStorage.removeItem(K.dayOffset); upd(); startSession(); renderProgress(); };
  }
}

// ── init ────────────────────────────────────────────────────
async function init() {
  applyTheme();
  bindEvents();
  await loadCards();
  gcSrs();
  if (dataSource === 'seed' || dataSource === 'cache-noconfig') showBanner('info', 'Rodando com o deck local — Supabase ainda não configurado.');
  else if (dataSource === 'cache') showBanner('info', '📴 Sem conexão — usando as cartas salvas neste aparelho.');
  else if (dataSource === 'vazio') showBanner('error', 'Não consegui carregar nenhuma carta. Verifique a conexão e recarregue.');
  else hideBanner();
  // restaura modo salvo
  $('modeseg').querySelectorAll('button').forEach(x => x.classList.toggle('active', x.dataset.m === settings.mode));
  renderChips();
  renderDeckSelect();
  renderList();
  renderProgress();
  startSession();
}
init();
