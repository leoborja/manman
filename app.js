/* Mànmàn 慢慢 — flashcards de mandarim
   Sem build, sem dependências. Cartas: Supabase (leitura) → cache → seed.
   Progresso: localStorage por usuário + sync com Supabase (tabelas progress/review_log). */
'use strict';

// migração: o app se chamava Jìzhù — mesmo origin (github.io), então dá pra herdar o progresso
(function migrateFromJizhu() {
  const olds = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.indexOf('jizhu.') === 0) olds.push(k);
  }
  olds.forEach(k => {
    const nk = 'manman.' + k.slice(6);
    if (localStorage.getItem(nk) === null) localStorage.setItem(nk, localStorage.getItem(k));
    localStorage.removeItem(k);
  });
})();

// ── constantes ──────────────────────────────────────────────
const NEW_PER_DAY = 10;          // novas cartas por dia
const LEARNED_IVL = 21;          // intervalo (dias) p/ considerar "aprendida"
const EASE_START = 2.5, EASE_MIN = 1.3, EASE_MAX = 2.8;
const USERS = { leo: 'Leo', henrique: 'Henrique', david: 'David', convidado: 'Convidado' };
const K = {                      // chaves do localStorage (as por-usuário ganham sufixo .<user>)
  cards: 'manman.cards.v1',
  srs: 'manman.srs.v1',
  log: 'manman.log.v1',
  dirty: 'manman.dirty.v1',
  settings: 'manman.settings.v1',
  dayOffset: 'manman.dayoffset'
};
const DECK_LABELS = { saudacoes: 'Saudações', numeros: 'Números', pronomes: 'Pronomes',
  verbos: 'Verbos', uteis: 'Úteis', radicais: 'Radicais', geral: 'Geral' };
// modos: front = o que aparece; staged = revela pinyin antes de virar
const MODES = {
  zh_all:   { front: 'hanzi', staged: false },
  zh_py_pt: { front: 'hanzi', staged: true },
  pt_zh:    { front: 'pt', staged: false },
  py_zh:    { front: 'pinyin', staged: false }
};
const MIX_POOL = ['zh_all', 'pt_zh', 'py_zh'];
const MODE_TITLES = {
  zh_all: '汉字 → pinyin + tradução',
  zh_py_pt: '汉字 → pinyin → tradução',
  pt_zh: 'tradução → 汉字',
  py_zh: 'pinyin → 汉字',
  mix: '🔀 Aleatório'
};

// ── estado ──────────────────────────────────────────────────
let cards = [];                  // deck completo (não deletadas)
let settings = load(K.settings, { mode: 'zh_all', deck: 'todos', user: null, theme: null });
if (MODES[settings.mode] === undefined && settings.mode !== 'mix') settings.mode = 'zh_all';
let srs = {};                    // id → {reps, ivl, ease, due, u}
let log = {};                    // 'YYYY-MM-DD' → {rev, new}
let dirty = [];                  // ids com sync pendente
let queue = [];                  // fila da sessão (ids)
let current = null;              // carta atual
let curMode = 'zh_all';          // modo efetivo da carta atual (p/ aleatório)
let stage = 0;                   // 0 = frente, 1 = pinyin revelado (modo 2 toques)
let freeMode = false;            // treino livre (não grava SRS)
let gradedThisSession = 0;       // p/ não resetar a fila embaixo do usuário após sync
let dataSource = '';             // 'supabase' | 'cache' | 'cache-noconfig' | 'seed' | 'vazio'
let cartasDeck = 'todos';        // filtro da aba Cartas

// ── helpers ─────────────────────────────────────────────────
function load(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v === null || v === undefined ? fallback : v; }
  catch (e) { return fallback; }
}
function save(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
function uk(base) { return base + '.' + (settings.user || 'anon'); }
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
function srsPreview(state, grade) { // rótulo do próximo intervalo
  const s = state || { reps: 0, ivl: 0, ease: EASE_START };
  if (grade === 'again') return '<10 min';
  if (grade === 'hard') return Math.max(1, Math.round((s.ivl || 1) * 1.2)) + 'd';
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
  s.u = Date.now();
  srs[id] = s;
  save(uk(K.srs), srs);
  return s;
}
function logToday(field) {
  const t = todayStr();
  if (!log[t]) log[t] = { rev: 0, new: 0 };
  log[t][field] = (log[t][field] || 0) + 1;
  save(uk(K.log), log);
}
function gcSrs() { // remove estados de cartas que não existem mais
  const ids = new Set(cards.map(c => c.id));
  let changed = false;
  for (const id of Object.keys(srs)) if (!ids.has(id)) { delete srs[id]; changed = true; }
  if (changed) save(uk(K.srs), srs);
}

// ── usuário / login ─────────────────────────────────────────
function loadUserState() {
  srs = load(uk(K.srs), {});
  log = load(uk(K.log), {});
  dirty = load(uk(K.dirty), []);
  // migração: progresso antigo sem usuário vira do primeiro que logar
  if (!Object.keys(srs).length && localStorage.getItem(K.srs)) {
    srs = load(K.srs, {}); log = load(K.log, {});
    save(uk(K.srs), srs); save(uk(K.log), log);
    localStorage.removeItem(K.srs); localStorage.removeItem(K.log);
  }
}
function renderUserPill() {
  $('userbtn').textContent = settings.user ? '👤 ' + (USERS[settings.user] || settings.user) : '👤';
}
async function selectUser(u) {
  settings.user = u; save(K.settings, settings);
  $('login').classList.remove('show');
  renderUserPill();
  loadUserState();
  gcSrs();
  await syncPull();
  flushDirty();
  renderChips(); renderCartasChips(); renderList(); renderProgress();
  startSession();
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
async function loadCards() {
  const cached = load(K.cards, null);
  if (sbConfigured()) {
    try {
      const r = await fetch(HW_CONFIG.SUPABASE_URL + '/rest/v1/cards?select=*&deleted=eq.false&order=created_at.asc',
        { headers: sbHeaders() });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      cards = await r.json();
      save(K.cards, cards);
      dataSource = 'supabase';
      return;
    } catch (e) {
      if (cached && cached.length) { cards = cached; dataSource = 'cache'; return; }
    }
  } else if (cached && cached.length) {
    cards = cached; dataSource = 'cache-noconfig'; return;
  }
  try {
    const r = await fetch('./seed/seed_cards.json');
    cards = await r.json();
    dataSource = 'seed';
  } catch (e) {
    cards = []; dataSource = 'vazio';
  }
}

// ── sync de progresso (Supabase) ────────────────────────────
function syncEnabled() { return sbConfigured() && settings.user && settings.user !== 'convidado'; }
async function syncPull() {
  if (!syncEnabled()) return false;
  let changed = false;
  try {
    const u = encodeURIComponent(settings.user);
    const [pr, lr] = await Promise.all([
      fetch(HW_CONFIG.SUPABASE_URL + '/rest/v1/progress?user_name=eq.' + u + '&select=*', { headers: sbHeaders() }),
      fetch(HW_CONFIG.SUPABASE_URL + '/rest/v1/review_log?user_name=eq.' + u + '&select=*', { headers: sbHeaders() })
    ]);
    if (pr.ok) {
      for (const row of await pr.json()) {
        const local = srs[row.card_id];
        if (!local || (row.updated_ms || 0) > (local.u || 0)) {
          srs[row.card_id] = { reps: row.reps, ivl: row.ivl, ease: row.ease, due: row.due, u: row.updated_ms || 0 };
          changed = true;
        }
      }
      save(uk(K.srs), srs);
    }
    if (lr.ok) {
      for (const row of await lr.json()) {
        const local = log[row.day] || { rev: 0, new: 0 };
        log[row.day] = { rev: Math.max(local.rev, row.rev || 0), new: Math.max(local.new, row.new_cnt || 0) };
      }
      save(uk(K.log), log);
    }
  } catch (e) { /* offline — segue local */ }
  return changed;
}
async function syncPush(id) {
  if (!syncEnabled()) return;
  const s = srs[id];
  const t = todayStr();
  const l = log[t] || { rev: 0, new: 0 };
  try {
    const r = await fetch(HW_CONFIG.SUPABASE_URL + '/rest/v1/progress?on_conflict=user_name,card_id', {
      method: 'POST',
      headers: sbHeaders({ Prefer: 'resolution=merge-duplicates' }),
      body: JSON.stringify({ user_name: settings.user, card_id: id, reps: s.reps, ivl: s.ivl, ease: s.ease, due: s.due, updated_ms: s.u })
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    fetch(HW_CONFIG.SUPABASE_URL + '/rest/v1/review_log?on_conflict=user_name,day', {
      method: 'POST',
      headers: sbHeaders({ Prefer: 'resolution=merge-duplicates' }),
      body: JSON.stringify({ user_name: settings.user, day: t, rev: l.rev, new_cnt: l.new })
    }).catch(() => {});
    dirty = dirty.filter(x => x !== id);
    save(uk(K.dirty), dirty);
  } catch (e) {
    if (!dirty.includes(id)) { dirty.push(id); save(uk(K.dirty), dirty); }
  }
}
function flushDirty() {
  if (!syncEnabled() || !dirty.length) return;
  [...dirty].forEach(id => { if (srs[id]) syncPush(id); });
}
async function syncReset() { // apaga progresso remoto do usuário
  if (!syncEnabled()) return;
  const u = encodeURIComponent(settings.user);
  try {
    await Promise.all([
      fetch(HW_CONFIG.SUPABASE_URL + '/rest/v1/progress?user_name=eq.' + u, { method: 'DELETE', headers: sbHeaders() }),
      fetch(HW_CONFIG.SUPABASE_URL + '/rest/v1/review_log?user_name=eq.' + u, { method: 'DELETE', headers: sbHeaders() })
    ]);
  } catch (e) { /* melhor esforço */ }
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
  stage = 0;
  curMode = settings.mode === 'mix' ? MIX_POOL[Math.floor(Math.random() * MIX_POOL.length)] : settings.mode;
  const m = MODES[curMode];
  const f = $('fcard');
  f.classList.remove('flipped');
  const front = $('front-content');
  if (m.front === 'hanzi') front.innerHTML = '<div class="hanzi-lg zh" lang="zh-Hans">' + esc(card.hanzi) + '</div>';
  else if (m.front === 'pt') front.innerHTML = '<div class="pt-lg">' + esc(card.pt) + '</div>';
  else front.innerHTML = '<div class="py-lg">' + esc(card.pinyin) + '</div>';
  $('stagepy').style.display = 'none';
  $('stagepy').textContent = '';
  $('hint-f').textContent = m.staged ? 'toque para ver o pinyin' : 'toque para virar';
  $('deckpill-f').textContent = deckLabel(card.deck);
  $('deckpill-b').textContent = deckLabel(card.deck);
  $('back-hanzi').textContent = card.hanzi;
  $('back-pinyin').textContent = card.pinyin;
  $('back-pt').textContent = card.pt;
  $('back-nota').textContent = card.nota || '';
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
  gradedThisSession++;
  if (!freeMode) {
    const isNew = !srs[current.id];
    srsApply(current.id, g);
    logToday('rev');
    if (isNew) logToday('new');
    syncPush(current.id);
    if (g === 'again') queue.splice(Math.min(3, queue.length), 0, current.id);
  }
  nextCard();
}
function tapCard() {
  if (!current) return;
  const m = MODES[curMode];
  const f = $('fcard');
  if (f.classList.contains('flipped')) { // desvirar
    f.classList.remove('flipped');
    $('grades').classList.remove('show');
    $('nextbtn').classList.remove('show');
    return;
  }
  if (m.staged && stage === 0) { // revela pinyin na frente
    stage = 1;
    $('stagepy').textContent = current.pinyin;
    $('stagepy').style.display = '';
    $('hint-f').textContent = 'toque para ver a tradução';
    return;
  }
  f.classList.add('flipped');
  if (freeMode) $('nextbtn').classList.add('show');
  else $('grades').classList.add('show');
}

// ── UI: cartas (consulta) ───────────────────────────────────
function renderCartasChips() {
  const decks = ['todos'].concat([...new Set(cards.map(c => c.deck))]);
  $('cartas-chips').innerHTML = decks.map(d =>
    '<button class="chip' + (cartasDeck === d ? ' active' : '') + '" data-d="' + esc(d) + '">' +
    (d === 'todos' ? 'Todas' : esc(deckLabel(d))) + '</button>').join('');
  $('cartas-chips').querySelectorAll('.chip').forEach(ch => ch.onclick = () => {
    cartasDeck = ch.dataset.d;
    renderCartasChips(); renderList();
  });
}
function renderList() {
  const q = $('search').value.trim().toLowerCase();
  const list = cards.filter(c =>
    (cartasDeck === 'todos' || c.deck === cartasDeck) &&
    (!q ||
      (c.hanzi || '').toLowerCase().includes(q) ||
      (c.pinyin || '').toLowerCase().includes(q) ||
      (c.pt || '').toLowerCase().includes(q)));
  $('cardlist').innerHTML = list.map(c =>
    '<div class="card"><div class="rowline">' +
    '<div class="h zh" lang="zh-Hans">' + esc(c.hanzi) + '</div>' +
    '<div class="mid"><div class="p">' + esc(c.pinyin) + '</div><div class="t">' + esc(c.pt) + '</div>' +
    (c.nota ? '<div class="n">' + esc(c.nota) + '</div>' : '') + '</div>' +
    '<span class="pill">' + esc(deckLabel(c.deck)) + '</span>' +
    '</div></div>').join('') || '<p style="color:var(--mut);text-align:center">Nenhuma carta encontrada.</p>';
}

// ── UI: progresso ───────────────────────────────────────────
function renderProgress() {
  const t = todayStr();
  const { due, news } = dueCount();
  $('s-hoje').textContent = due;
  $('s-novas').textContent = news;
  $('s-aprendidas').textContent = cards.filter(c => srs[c.id] && srs[c.id].ivl >= LEARNED_IVL).length;
  let streak = 0;
  let d = (log[t] && log[t].rev) ? 0 : 1; // se hoje ainda não revisou, começa de ontem
  while (true) {
    const key = todayStr(-(d + streak));
    if (log[key] && log[key].rev > 0) streak++;
    else break;
  }
  $('s-streak').textContent = streak;
  const days = [];
  for (let i = 13; i >= 0; i--) days.push(todayStr(-i));
  const vals = days.map(k => (log[k] && log[k].rev) || 0);
  const max = Math.max(1, ...vals);
  $('bars').innerHTML = vals.map(v =>
    '<div class="bar' + (v === 0 ? ' zero' : '') + '" style="height:' + Math.max(3, Math.round(v / max * 100)) + '%" title="' + v + '"></div>').join('');
  $('barlabels').innerHTML = days.map(k => '<span>' + k.slice(8) + '</span>').join('');
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
function renderModeUI() {
  $('modecur').textContent = MODE_TITLES[settings.mode] || MODE_TITLES.zh_all;
}
function renderModeSheet() {
  document.querySelectorAll('.modeopt').forEach(b =>
    b.classList.toggle('active', b.dataset.m === settings.mode));
}
function applyTheme() {
  const pref = settings.theme || 'light'; // light é o padrão; dark só se a pessoa escolher
  document.documentElement.dataset.theme = pref;
  $('themebtn').textContent = pref === 'dark' ? '☀️' : '🌙';
}

function bindEvents() {
  document.querySelectorAll('.tab').forEach(t => t.onclick = () => switchView(t.dataset.v));
  $('themebtn').onclick = () => {
    settings.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    save(K.settings, settings); applyTheme();
  };
  $('modebtn').onclick = () => { renderModeSheet(); $('modesheet').classList.add('show'); };
  $('modesheet-bg').onclick = () => $('modesheet').classList.remove('show');
  document.querySelectorAll('.modeopt').forEach(b => b.onclick = () => {
    settings.mode = b.dataset.m; save(K.settings, settings);
    renderModeUI();
    $('modesheet').classList.remove('show');
    if (current) showCard(current);
  });
  $('fcard').onclick = tapCard;
  $('g-again').onclick = () => grade('again');
  $('g-hard').onclick = () => grade('hard');
  $('g-good').onclick = () => grade('good');
  $('nextbtn').onclick = () => { queue.shift(); nextCard(); };
  $('freebtn').onclick = () => { buildFreeQueue(); if (queue.length) nextCard(); };
  $('search').oninput = renderList;
  // login
  document.querySelectorAll('#login [data-u]').forEach(b => b.onclick = () => selectUser(b.dataset.u));
  $('userbtn').onclick = () => $('login').classList.add('show');
  // progresso
  $('resetbtn').onclick = () => {
    if (!confirm('Zerar TODO o seu progresso de estudo (' + (USERS[settings.user] || '') + ')? As cartas não são apagadas.')) return;
    srs = {}; log = {}; dirty = [];
    localStorage.removeItem(uk(K.srs)); localStorage.removeItem(uk(K.log)); localStorage.removeItem(uk(K.dirty));
    syncReset();
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
  renderModeUI();
  await loadCards();
  if (dataSource === 'seed' || dataSource === 'cache-noconfig') showBanner('info', 'Rodando com o deck local — Supabase ainda não configurado.');
  else if (dataSource === 'cache') showBanner('info', '📴 Sem conexão — usando as cartas salvas neste aparelho.');
  else if (dataSource === 'vazio') showBanner('error', 'Não consegui carregar nenhuma carta. Verifique a conexão e recarregue.');
  else hideBanner();
  renderChips();
  renderCartasChips();
  renderList();
  if (settings.user) {
    renderUserPill();
    loadUserState();
    gcSrs();
    renderProgress();
    startSession();
    const changed = await syncPull();
    flushDirty();
    if (changed && gradedThisSession === 0) startSession();
    renderProgress();
  } else {
    $('login').classList.add('show');
    renderProgress();
    startSession();
  }
}
init();
