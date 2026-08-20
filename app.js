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
const LEARNED_IVL = 21;          // intervalo (dias) p/ considerar "aprendida"
const META_DIARIA = 30;          // revisões/dia pra fechar o dia — meta, não teto: pode fazer mais
// 20/08 é o primeiro dia em que o contador funciona: até 19/08 a prática livre só
// registrava os erros, então aqueles números estão subestimados e não dá pra julgá-los
// por meta nenhuma. Antes dessa data vale a regra antiga, "≥1 revisão no dia".
const META_DESDE = '2026-08-20';
const EASE_START = 2.5, EASE_MIN = 1.3, EASE_MAX = 2.8;
const USERS = { leo: 'Leo', henrique: 'Henrique', david: 'David', convidado: 'Convidado' };
const K = {                      // chaves do localStorage (as por-usuário ganham sufixo .<user>)
  cards: 'manman.cards.v1',
  srs: 'manman.srs.v1',
  stats: 'manman.stats.v1',
  log: 'manman.log.v1',
  dirty: 'manman.dirty.v1',
  off: 'manman.off.v1',
  dirtyOff: 'manman.dirtyoff.v1',
  settings: 'manman.settings.v1',
  dayOffset: 'manman.dayoffset'
};
const DECK_LABELS = { saudacoes: 'Saudações', numeros: 'Números', pronomes: 'Pronomes',
  verbos: 'Verbos', uteis: 'Úteis', radicais: 'Radicais', estados: 'Como estou',
  nomes: 'Nomes', familia: 'Família', geral: 'Geral' };
// modos: front = o que aparece; staged = revela pinyin antes de virar
const MODES = {
  zh_all:   { front: 'hanzi', staged: false },
  zh_py_pt: { front: 'hanzi', staged: true },
  pt_zh:    { front: 'pt', staged: false },
  py_zh:    { front: 'pinyin', staged: false },
  audio:    { front: 'audio', staged: false },
  tons:     { front: 'hanzi', staged: false, quiz: true }
};
const MIX_POOL = ['zh_all', 'pt_zh', 'py_zh'];
const MODE_TITLES = {
  zh_all: '汉字 → pinyin + tradução',
  zh_py_pt: '汉字 → pinyin → tradução',
  pt_zh: 'tradução → 汉字',
  py_zh: 'pinyin → 汉字',
  audio: '🎧 Só áudio → lembrar tudo',
  mix: '🔀 Aleatório',
  tons: '🎯 Quiz de tons'
};

// ── tons: detecção e cores ──────────────────────────────────
// Convenção de cores (estilo MDBG/Pleco): 1º vermelho, 2º laranja, 3º verde, 4º azul, neutro cinza
const TONE_COLORS = { 1: '#d64541', 2: '#dd8500', 3: '#2e9e5b', 4: '#3b6fd4', 5: '#8b9098' };
const TONE_NAMES = { 1: '1º tom — alto e constante', 2: '2º tom — subindo', 3: '3º tom — desce e sobe', 4: '4º tom — caindo', 5: 'tom neutro — curto e leve' };
const TONE_MARK_OF = { 'ā':1,'ē':1,'ī':1,'ō':1,'ū':1,'ǖ':1,'Ā':1,'Ē':1,'Ō':1,
  'á':2,'é':2,'í':2,'ó':2,'ú':2,'ǘ':2,'Á':2,'É':2,'Ó':2,
  'ǎ':3,'ě':3,'ǐ':3,'ǒ':3,'ǔ':3,'ǚ':3,'Ǎ':3,'Ě':3,'Ǒ':3,
  'à':4,'è':4,'ì':4,'ò':4,'ù':4,'ǜ':4,'À':4,'È':4,'Ò':4 };
function toneOf(syllable) { // 5 = neutro (sem marca)
  for (const ch of syllable) if (TONE_MARK_OF[ch]) return TONE_MARK_OF[ch];
  return 5;
}
// Palavra de 2+ sílabas ("Lìbō") vem colada, mas cada sílaba tem o SEU tom —
// então quebra em sílabas antes de pintar. Sílaba = inicial? + vogais + (ng|n|r)?
const PY_VOGAIS = 'aeiouüāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ';
const PY_SILABA = new RegExp('(?:zh|ch|sh|[bpmfdtnlgkhjqxrzcsyw])?[' + PY_VOGAIS + ']+(?:ng|n|r)?', 'g');
function silabas(tok) {
  const low = tok.toLowerCase();
  const out = [];
  let pos = 0, m;
  PY_SILABA.lastIndex = 0;
  while ((m = PY_SILABA.exec(low)) !== null) {
    if (m.index !== pos) return [tok]; // sobrou letra entre sílabas → não é pinyin limpo, não arrisca
    out.push(tok.slice(pos, pos + m[0].length));
    pos += m[0].length;
  }
  return (pos === tok.length && out.length) ? out : [tok];
}
function pinyinColored(py) { // cada sílaba pintada com a cor do seu tom
  return String(py || '').split(/([\s'’]+)/).map(tok => // ’ curvo também: teclado do iPhone gera
    /[a-zA-ZüÜāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/.test(tok)
      ? silabas(tok).map(s =>
        '<span style="color:' + TONE_COLORS[toneOf(s)] + '">' + esc(s) + '</span>').join('')
      : esc(tok)
  ).join('');
}

// ── estado ──────────────────────────────────────────────────
let cards = [];                  // deck completo (não deletadas)
let settings = load(K.settings, { mode: 'zh_all', deck: 'todos', filtro: 'tema', aula: 'todas',
  user: null, theme: null, autoSpeak: true });
if (settings.filtro !== 'aula') settings.filtro = 'tema'; // quem já usava o app não tem o campo
if (!settings.aula) settings.aula = 'todas';
if (MODES[settings.mode] === undefined && settings.mode !== 'mix') settings.mode = 'zh_all';
if (settings.autoSpeak === undefined) settings.autoSpeak = true;
let srs = {};                    // id → {reps, ivl, ease, due, u}
// id → {g, h, a} — quantas vezes acertou, marcou difícil e errou, desde sempre.
// Fica FORA do srs de propósito: na prática livre você avalia carta que nunca foi
// agendada, e criar estado de srs pra ela a tiraria da fila de novas.
let stats = {};
let log = {};                    // 'YYYY-MM-DD' → {rev, new}
let dirty = [];                  // ids com sync pendente (SRS)
let off = {};                    // id → {off: bool, u: ms} — cartas desligadas pelo usuário
let dirtyOff = [];               // ids com sync de desligamento pendente
let queue = [];                  // fila da sessão (ids)
let current = null;              // carta atual
let curMode = 'zh_all';          // modo efetivo da carta atual (p/ aleatório)
let stage = 0;                   // 0 = frente, 1 = pinyin revelado (modo 2 toques)
let phase = 'sched';             // 'sched' (revisões+novas) | 'practice' (prática infinita) | 'quiz' (tons)
let gradedThisSession = 0;       // p/ não resetar a fila embaixo do usuário após sync
let quizScore = { ok: 0, n: 0 }; // placar da sessão do quiz de tons
let quizAnswered = false;
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
// escapa aspas também: o retorno vai tanto em texto quanto dentro de atributos
// (data-tip, data-id, title). Em texto, &quot; renderiza como " — não muda nada.
function esc(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML.replace(/"/g, '&quot;');
}
function dayOffset() { return parseInt(localStorage.getItem(K.dayOffset) || '0', 10); }
function todayStr(plusDays) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset() + (plusDays || 0));
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}
function deckLabel(d) { return DECK_LABELS[d] || (d.charAt(0).toUpperCase() + d.slice(1)); }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// ── áudio de pronúncia ──────────────────────────────────────
// Voz chinesa do próprio aparelho (Web Speech API). Se a carta tiver
// audio_url (V2, vozes gravadas), o MP3 tem prioridade.
let zhVoice = null;
function pickZhVoice() {
  const voices = speechSynthesis.getVoices().filter(v => v.lang && v.lang.replace('_', '-').toLowerCase().startsWith('zh'));
  zhVoice = voices.find(v => /tingting|ting-ting/i.test(v.name)) ||
    voices.find(v => v.lang.replace('_', '-').toLowerCase().startsWith('zh-cn')) ||
    voices[0] || null;
}
if ('speechSynthesis' in window) {
  pickZhVoice();
  speechSynthesis.onvoiceschanged = pickZhVoice; // iOS/Chrome carregam vozes async
}
// Decisão do Leo (12/08): partículas faladas SOZINHAS, mais fácil de identificar.
// (Por isso cartas de tom neutro ficam fora do quiz de tons — isolado, o TTS
// fala 吗 com tom cheio, o que contradiria o gabarito "neutro".)
let warnedNoVoice = false;
function canSpeak(card) {
  if (card.audio_url) return true;
  if (!('speechSynthesis' in window)) return false;
  if (!zhVoice) pickZhVoice();
  return !!zhVoice;
}
function speak(card, auto) {
  // MP3 gravado tem prioridade, mas se ele falhar (404, offline, formato) cai pro TTS —
  // ficar mudo é o pior desfecho num app que ensina tom.
  if (card.audio_url) {
    new Audio(card.audio_url).play().catch(() => falaTTS(card, auto));
    return;
  }
  falaTTS(card, auto);
}
function falaTTS(card, auto) {
  if (!('speechSynthesis' in window)) return;
  if (!zhVoice) pickZhVoice();
  if (!zhVoice) {
    // no modo automático falha em silêncio; alerta só quando a pessoa toca no 🔊
    if (!auto && !warnedNoVoice) { warnedNoVoice = true; alert('Seu aparelho não tem voz chinesa instalada (Ajustes → Acessibilidade → Conteúdo Falado → Vozes → Chinês).'); }
    return;
  }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(card.hanzi);
  u.voice = zhVoice;
  u.lang = zhVoice.lang;
  u.rate = 0.8; // mais devagar pra aluno — 慢慢!
  speechSynthesis.speak(u);
}

// ── traçado animado (dados do makemeahanzi) ─────────────────
let strokesDB = {};
let svgUid = 0;
async function loadStrokes() {
  try { strokesDB = await (await fetch('./strokes/strokes.json')).json(); }
  catch (e) { strokesDB = {}; }
}
function medianLen(m) {
  let L = 0;
  for (let i = 1; i < m.length; i++) L += Math.hypot(m[i][0] - m[i - 1][0], m[i][1] - m[i - 1][1]);
  return L;
}
function buildStrokeSvg(ch, size, startDelay) {
  const d = strokesDB[ch];
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 1024 1024');
  svg.setAttribute('width', size); svg.setAttribute('height', size);
  const g = document.createElementNS(NS, 'g');
  g.setAttribute('transform', 'scale(1,-1) translate(0,-900)'); // makemeahanzi tem Y invertido
  svg.appendChild(g);
  d.s.forEach(p => { // fantasma do caractere completo
    const ph = document.createElementNS(NS, 'path');
    ph.setAttribute('d', p); ph.setAttribute('fill', 'var(--pill)');
    g.appendChild(ph);
  });
  let delay = startDelay;
  d.s.forEach((p, i) => {
    const id = 'sk' + (++svgUid);
    const clip = document.createElementNS(NS, 'clipPath');
    clip.setAttribute('id', id);
    const cp = document.createElementNS(NS, 'path');
    cp.setAttribute('d', p);
    clip.appendChild(cp);
    g.appendChild(clip);
    // linha grossa pela mediana, recortada pelo contorno = pincelada
    const m = d.m[i];
    const line = document.createElementNS(NS, 'path');
    line.setAttribute('d', 'M' + m.map(pt => pt[0] + ' ' + pt[1]).join(' L'));
    line.setAttribute('clip-path', 'url(#' + id + ')');
    line.setAttribute('fill', 'none');
    line.setAttribute('stroke', 'currentColor');
    line.setAttribute('stroke-width', '200');
    line.setAttribute('stroke-linecap', 'round');
    const len = medianLen(m) + 200; // margem pro linecap cobrir as pontas
    const dur = Math.min(600, Math.max(220, len / 2.5));
    line.style.strokeDasharray = len;
    line.style.strokeDashoffset = len;
    line.style.transition = 'stroke-dashoffset ' + Math.round(dur) + 'ms ease-in-out ' + Math.round(delay) + 'ms';
    delay += dur + 120;
    g.appendChild(line);
  });
  return { svg, endDelay: delay };
}
function renderBackHanzi(card) {
  const box = $('back-strokes');
  box.innerHTML = '';
  const chars = [...card.hanzi];
  if (chars.length && chars.every(c => strokesDB[c])) {
    $('back-hanzi').style.display = 'none';
    box.style.display = '';
    const size = chars.length > 2 ? 72 : 108;
    let delay = 150;
    chars.forEach(c => {
      const r = buildStrokeSvg(c, size, delay);
      box.appendChild(r.svg);
      delay = r.endDelay; // caracteres desenham em sequência
    });
  } else { // sem dados de traçado: hanzi em texto mesmo
    $('back-hanzi').style.display = '';
    box.style.display = 'none';
  }
}
function animateBackStrokes() {
  $('back-strokes').querySelectorAll('path[clip-path]').forEach(l => {
    void l.getBoundingClientRect(); // força reflow pra transição valer
    l.style.strokeDashoffset = '0';
  });
}

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
function diaLabel(d) { return d.slice(8) + '/' + d.slice(5, 7); }
function rotuloRev(v) {
  if (!v) return 'não estudou';
  return v + (v === 1 ? ' revisão' : ' revisões') + (v >= META_DIARIA ? ' ✅' : '');
}
function revsDoDia(dia, registro) { return ((registro || log)[dia] || {}).rev || 0; }
function diaFechado(dia, registro) {
  const n = revsDoDia(dia, registro);
  return dia >= META_DESDE ? n >= META_DIARIA : n >= 1;
}
// sequência de dias fechados; hoje só entra depois de fechado, senão o número
// cairia sozinho à meia-noite e pareceria que a pessoa perdeu o streak
function calcStreak(registro) {
  let streak = 0;
  let d = diaFechado(todayStr(), registro) ? 0 : 1;
  while (diaFechado(todayStr(-(d + streak)), registro)) streak++;
  return streak;
}
// conta no grade() e não no srsApply(): na prática livre o srsApply só roda no
// "Errei", e contar por lá daria um retrato só dos erros — o mesmo defeito que
// o contador do dia tinha até 20/08.
const GRADE_KEY = { good: 'g', hard: 'h', again: 'a' };
function bumpStat(id, grade) {
  const k = GRADE_KEY[grade];
  if (!k) return;
  const s = stats[id] || { g: 0, h: 0, a: 0 };
  s[k] = (s[k] || 0) + 1;
  stats[id] = s;
  save(uk(K.stats), stats);
}
function statOf(id) { return stats[id] || { g: 0, h: 0, a: 0 }; }
function logToday(field) {
  const t = todayStr();
  if (!log[t]) log[t] = { rev: 0, new: 0 };
  log[t][field] = (log[t][field] || 0) + 1;
  save(uk(K.log), log);
}
function gcSrs() { // remove estados de cartas que não existem mais
  const ids = new Set(cards.map(c => c.id));
  let changed = false, changedOff = false;
  let changedStats = false;
  for (const id of Object.keys(srs)) if (!ids.has(id)) { delete srs[id]; changed = true; }
  for (const id of Object.keys(off)) if (!ids.has(id)) { delete off[id]; changedOff = true; }
  for (const id of Object.keys(stats)) if (!ids.has(id)) { delete stats[id]; changedStats = true; }
  if (changed) save(uk(K.srs), srs);
  if (changedOff) save(uk(K.off), off);
  if (changedStats) save(uk(K.stats), stats);
}

// ── cartas desligadas ───────────────────────────────────────
function isOff(id) { return !!(off[id] && off[id].off); }
function offCount() { return cards.filter(c => isOff(c.id)).length; }
function setOff(id, val) {
  off[id] = { off: val, u: Date.now() };
  save(uk(K.off), off);
  pushOff(id);
}

// ── usuário / login ─────────────────────────────────────────
function loadUserState() {
  srs = load(uk(K.srs), {});
  stats = load(uk(K.stats), {});
  log = load(uk(K.log), {});
  dirty = load(uk(K.dirty), []);
  off = load(uk(K.off), {});
  dirtyOff = load(uk(K.dirtyOff), []);
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
// log de TODO mundo, pro gráfico da turma. Só leitura e sem dado sensível —
// a policy de review_log já é aberta. Falhou? o gráfico some, o resto do app segue.
let logTurma = null;
async function loadLogTurma() {
  if (!sbConfigured()) return;
  try {
    const desde = todayStr(-13);
    const r = await fetch(HW_CONFIG.SUPABASE_URL +
      '/rest/v1/review_log?select=user_name,day,rev&day=gte.' + desde + '&order=day.asc',
      { headers: sbHeaders() });
    if (r.ok) logTurma = await r.json();
  } catch (e) { logTurma = null; }
}
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
        if (row.due !== null && (!local || (row.updated_ms || 0) > (local.u || 0))) {
          srs[row.card_id] = { reps: row.reps, ivl: row.ivl, ease: row.ease, due: row.due, u: row.updated_ms || 0 };
          changed = true;
        }
        const lo = off[row.card_id];
        if ((row.off_ms || 0) > 0 && (!lo || row.off_ms > lo.u)) {
          off[row.card_id] = { off: !!row.suspended, u: row.off_ms };
          changed = true;
        }
        // contagens só crescem, então o maior lado vence — sem timestamp e sem
        // risco de um aparelho desatualizado zerar o que o outro somou
        const rem = { g: row.n_good || 0, h: row.n_hard || 0, a: row.n_again || 0 };
        if (rem.g || rem.h || rem.a) {
          const loc = stats[row.card_id] || { g: 0, h: 0, a: 0 };
          stats[row.card_id] = {
            g: Math.max(loc.g || 0, rem.g), h: Math.max(loc.h || 0, rem.h), a: Math.max(loc.a || 0, rem.a)
          };
        }
      }
      save(uk(K.srs), srs);
      save(uk(K.off), off);
      save(uk(K.stats), stats);
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
  // a linha pode ter só contagem e nenhum agendamento (carta avaliada na prática
  // livre sem nunca ter entrado na fila) — por isso os campos de srs são opcionais
  const linha = { user_name: settings.user, card_id: id };
  if (s) Object.assign(linha, { reps: s.reps, ivl: s.ivl, ease: s.ease, due: s.due, updated_ms: s.u });
  if (stats[id]) Object.assign(linha, { n_good: stats[id].g, n_hard: stats[id].h, n_again: stats[id].a });
  // o total do dia vai ANTES e por conta própria: são dados independentes, e uma
  // falha no progress (schema desatualizado, por exemplo) não pode levar junto
  // o contador que alimenta a meta e o gráfico da turma
  fetch(HW_CONFIG.SUPABASE_URL + '/rest/v1/review_log?on_conflict=user_name,day', {
    method: 'POST',
    headers: sbHeaders({ Prefer: 'resolution=merge-duplicates' }),
    body: JSON.stringify({ user_name: settings.user, day: t, rev: l.rev, new_cnt: l.new })
  }).catch(() => {});
  try {
    const r = await fetch(HW_CONFIG.SUPABASE_URL + '/rest/v1/progress?on_conflict=user_name,card_id', {
      method: 'POST',
      headers: sbHeaders({ Prefer: 'resolution=merge-duplicates' }),
      body: JSON.stringify(linha)
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    dirty = dirty.filter(x => x !== id);
    save(uk(K.dirty), dirty);
  } catch (e) {
    if (!dirty.includes(id)) { dirty.push(id); save(uk(K.dirty), dirty); }
  }
}
async function pushOff(id) {
  if (!syncEnabled()) return;
  const o = off[id];
  if (!o) return;
  try {
    const r = await fetch(HW_CONFIG.SUPABASE_URL + '/rest/v1/progress?on_conflict=user_name,card_id', {
      method: 'POST',
      headers: sbHeaders({ Prefer: 'resolution=merge-duplicates' }),
      body: JSON.stringify({ user_name: settings.user, card_id: id, suspended: o.off, off_ms: o.u })
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    dirtyOff = dirtyOff.filter(x => x !== id);
    save(uk(K.dirtyOff), dirtyOff);
  } catch (e) {
    if (!dirtyOff.includes(id)) { dirtyOff.push(id); save(uk(K.dirtyOff), dirtyOff); }
  }
}
function flushDirty() {
  if (!syncEnabled()) return;
  [...dirty].forEach(id => { if (srs[id] || stats[id]) syncPush(id); });
  [...dirtyOff].forEach(id => { if (off[id]) pushOff(id); });
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
  if (settings.filtro === 'aula') {
    if (settings.aula === 'todas') return cards;
    if (settings.aula === 'fora') return cards.filter(c => !c.data_aula);
    return cards.filter(c => c.data_aula === settings.aula);
  }
  return settings.deck === 'todos' ? cards : cards.filter(c => c.deck === settings.deck);
}
// datas de aula presentes no deck, da mais antiga pra mais recente
function aulas() { return [...new Set(cards.map(c => c.data_aula).filter(Boolean))].sort(); }
function aulaLabel(d) { const [, m, dia] = d.split('-'); return dia + '/' + m; }
function activePool() { return filteredCards().filter(c => !isOff(c.id)); }
function buildQueue() {
  const t = todayStr();
  const pool = activePool();
  const due = pool.filter(c => srs[c.id] && srs[c.id].due <= t)
    .sort((a, b) => srs[a.id].due < srs[b.id].due ? -1 : 1);
  const news = shuffle(pool.filter(c => !srs[c.id])); // sem limite diário: o deck só tem o que a turma já viu
  queue = due.concat(news).map(c => c.id);
  phase = 'sched';
}
function enterPractice() { // prática livre: deck inteiro embaralhado, sem parar
  queue = shuffle(activePool().map(c => c.id));
  phase = 'practice';
}
function dueCount() {
  const t = todayStr();
  const pool = activePool();
  const due = pool.filter(c => srs[c.id] && srs[c.id].due <= t).length;
  const news = pool.filter(c => !srs[c.id]).length;
  return { due, news };
}

// ── UI: estudar ─────────────────────────────────────────────
function renderChips() {
  const porAula = settings.filtro === 'aula';
  $('filtertype').querySelectorAll('button').forEach(b =>
    b.classList.toggle('active', (b.dataset.f === 'aula') === porAula));

  let html;
  if (porAula) {
    const temFora = cards.some(c => !c.data_aula);
    const opcoes = ['todas'].concat(aulas(), temFora ? ['fora'] : []);
    if (!opcoes.includes(settings.aula)) settings.aula = 'todas'; // aula sumiu do deck
    html = opcoes.map(a =>
      '<button class="chip' + (settings.aula === a ? ' active' : '') + '" data-a="' + esc(a) + '">' +
      (a === 'todas' ? 'Todas' : a === 'fora' ? 'Por fora' : aulaLabel(a)) + '</button>').join('');
  } else {
    const decks = ['todos'].concat([...new Set(cards.map(c => c.deck))]);
    html = decks.map(d =>
      '<button class="chip' + (settings.deck === d ? ' active' : '') + '" data-d="' + esc(d) + '">' +
      (d === 'todos' ? 'Todos' : esc(deckLabel(d))) + '</button>').join('');
  }
  $('deckchips').innerHTML = html;
  $('deckchips').querySelectorAll('.chip').forEach(ch => ch.onclick = () => {
    if (porAula) settings.aula = ch.dataset.a; else settings.deck = ch.dataset.d;
    save(K.settings, settings);
    renderChips(); startSession();
  });
}
function renderCounter() {
  renderStreak();
  const { due, news } = dueCount();
  if (phase === 'quiz') {
    $('counter').innerHTML = '<b>quiz de tons</b> · ' + quizScore.ok + '/' + quizScore.n + ' certas · ' + queue.length + ' restantes';
  } else if (phase === 'practice') {
    $('counter').innerHTML = 'revisões do dia ✅ · <b>prática livre</b> · "Errei" ainda reagenda';
  } else {
    $('counter').innerHTML = '<b>' + due + '</b> para hoje · <b>' + news + '</b> novas';
  }
}
function showCard(card) {
  current = card;
  stage = 0;
  quizAnswered = false;
  curMode = settings.mode === 'mix' ? MIX_POOL[Math.floor(Math.random() * MIX_POOL.length)] : settings.mode;
  const m = MODES[curMode];
  const f = $('fcard');
  f.classList.remove('flipped');
  const front = $('front-content');
  if (m.front === 'hanzi') front.innerHTML = '<div class="hanzi-lg zh" lang="zh-Hans">' + esc(card.hanzi) + '</div>';
  else if (m.front === 'pt') front.innerHTML = '<div class="pt-lg">' + esc(card.pt) + '</div>';
  else if (m.front === 'audio') {
    // só áudio: a carta não mostra NADA — a pessoa ouve e tem que lembrar 汉字, pinyin e significado
    front.innerHTML = '<button class="bigspk" id="bigspk" title="Ouvir de novo">🔊</button>' +
      '<div class="audiolbl">' + (canSpeak(card) ? 'ouça e lembre de tudo' : 'sem voz chinesa neste aparelho') + '</div>';
    $('bigspk').onclick = (e) => { e.stopPropagation(); speak(card); };
  }
  else front.innerHTML = '<div class="py-lg">' + pinyinColored(card.pinyin) + '</div>';
  $('stagepy').style.display = 'none';
  $('stagepy').textContent = '';
  $('quizfb').style.display = 'none';
  $('quizfb').innerHTML = '';
  $('tones').classList.toggle('show', !!m.quiz);
  $('tones').querySelectorAll('button').forEach(bt => bt.classList.remove('hit', 'miss'));
  $('hint-f').textContent = m.quiz ? 'ouça e escolha o tom · toque na carta pra repetir'
    : m.front === 'audio' ? '🔊 repete · toque na carta pra virar'
    : (m.staged ? 'toque para ver o pinyin' : 'toque para virar');
  if (m.quiz || m.front === 'audio') speak(card, true); // aqui o áudio É a pergunta
  $('deckpill-f').textContent = deckLabel(card.deck);
  $('deckpill-b').textContent = deckLabel(card.deck);
  $('back-hanzi').textContent = card.hanzi;
  renderBackHanzi(card);
  $('back-pinyin').innerHTML = pinyinColored(card.pinyin);
  $('back-pt').textContent = card.pt;
  $('back-nota').textContent = card.nota || '';
  const s = srs[card.id];
  $('iv-again').textContent = srsPreview(s, 'again');
  $('iv-hard').textContent = phase === 'practice' ? 'prática' : srsPreview(s, 'hard');
  $('iv-good').textContent = phase === 'practice' ? 'prática' : srsPreview(s, 'good');
  $('grades').classList.remove('show');
  $('nextbtn').classList.remove('show');
  $('stage').style.display = '';
  $('offbtn').style.display = '';
  $('done').classList.remove('show');
  renderCounter();
}
function nextCard() {
  if (!queue.length) {
    if (phase === 'quiz' || !activePool().length) { finishSession(); return; }
    if (phase === 'sched') { // acabaram as revisões → emenda na prática, sem parar
      showBanner('info', '🎉 Revisões do dia feitas! Emendando na prática livre — só "Errei" mexe no agendamento.');
      setTimeout(hideBanner, 4500);
    }
    enterPractice(); // na prática, fila vazia = embaralha de novo (infinito)
    if (!queue.length) { finishSession(); return; }
  }
  const id = queue[0];
  const card = cards.find(c => c.id === id);
  if (!card || isOff(id)) { queue.shift(); nextCard(); return; }
  showCard(card);
}
function finishSession() {
  current = null;
  $('stage').style.display = 'none';
  $('grades').classList.remove('show');
  $('tones').classList.remove('show');
  $('nextbtn').classList.remove('show');
  $('offbtn').style.display = 'none';
  $('done').classList.add('show');
  if (settings.mode === 'tons') {
    const pct = quizScore.n ? Math.round(quizScore.ok / quizScore.n * 100) : 0;
    $('done-title').textContent = 'Fim do quiz!';
    $('done-sub').textContent = 'Quiz de tons: ' + quizScore.ok + '/' + quizScore.n + ' (' + pct + '%). ' +
      (pct >= 80 ? '厉害 (lìhai — mandou bem)!' : '加油 (jiāyóu — continua treinando o ouvido)!');
    $('freebtn').textContent = '🎯 Jogar de novo';
    $('freebtn').style.display = '';
  } else { // só acontece sem nenhuma carta ativa no filtro
    $('done-title').textContent = 'Nada por aqui';
    $('done-sub').textContent = 'Nenhuma carta ativa neste deck — religue cartas na aba Cartas ou escolha outro filtro.';
    $('freebtn').style.display = 'none';
  }
  renderCounter();
}
function startSession() {
  if (settings.mode === 'tons') { startToneQuiz(); return; }
  buildQueue();
  nextCard(); // fila vazia → nextCard emenda na prática sozinho
}
function startToneQuiz() {
  quizScore = { ok: 0, n: 0 };
  // só monossílabos, e sem tom neutro (isolado o TTS fala com tom cheio); não grava SRS
  queue = shuffle(activePool().filter(c => [...c.hanzi].length === 1 && toneOf(c.pinyin) !== 5).map(c => c.id));
  phase = 'quiz';
  if (queue.length) nextCard(); else finishSession();
}
function answerTone(t) {
  if (!current || quizAnswered) return;
  quizAnswered = true;
  const correct = toneOf(current.pinyin);
  quizScore.n++;
  if (t === correct) quizScore.ok++;
  $('tones').querySelectorAll('button').forEach(bt => {
    const bt_t = parseInt(bt.dataset.t, 10);
    if (bt_t === correct) bt.classList.add('hit');
    else if (bt_t === t) bt.classList.add('miss');
  });
  $('quizfb').innerHTML = pinyinColored(current.pinyin) + ' · ' + esc(current.pt) +
    '<small>' + esc(TONE_NAMES[correct]) + '</small>';
  $('quizfb').style.display = '';
  speak(current, true); // ouve de novo já sabendo a resposta
  $('nextbtn').classList.add('show');
  renderCounter();
}
function grade(g) {
  if (!current) return;
  queue.shift();
  gradedThisSession++;
  // TODA carta avaliada conta no dia, inclusive na prática livre. Antes só o "Errei"
  // da prática registrava, o que fazia acertar valer zero e só o erro contar — inofensivo
  // enquanto era estatística, perverso depois que o streak passou a depender da meta.
  logToday('rev');
  bumpStat(current.id, g);
  if (phase === 'sched') {
    const isNew = !srs[current.id];
    srsApply(current.id, g);
    if (isNew) logToday('new');
    syncPush(current.id);
    if (g === 'again') queue.splice(Math.min(3, queue.length), 0, current.id);
  } else if (phase === 'practice' && g === 'again') {
    // na prática, "Errei" ainda vale: esqueceu de verdade, o agendamento precisa saber
    srsApply(current.id, 'again');
    syncPush(current.id);
    queue.splice(Math.min(3, queue.length), 0, current.id);
  } else {
    // acerto na prática: o agendamento não muda, mas a contagem da palavra e o
    // total do dia mudam — o syncPush já lida com linha sem estado de srs
    syncPush(current.id);
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
    renderBackHanzi(current); // reseta o traçado pro próximo flip
    return;
  }
  if (m.quiz) { speak(current, true); return; } // no quiz, tocar a carta repete o áudio
  if (m.staged && stage === 0) { // revela pinyin na frente
    stage = 1;
    $('stagepy').innerHTML = pinyinColored(current.pinyin);
    $('stagepy').style.display = '';
    $('hint-f').textContent = 'toque para ver a tradução';
    if (settings.autoSpeak) speak(current, true);
    return;
  }
  f.classList.add('flipped');
  setTimeout(animateBackStrokes, 300); // começa a desenhar quando a virada tá terminando
  if (settings.autoSpeak && stage === 0) speak(current, true); // staged já falou no 1º toque
  $('grades').classList.add('show');
}

// ── UI: cartas (consulta) ───────────────────────────────────
function renderCartasChips() {
  const decks = ['todos'].concat([...new Set(cards.map(c => c.deck))]);
  const nOff = offCount();
  let html = decks.map(d =>
    '<button class="chip' + (cartasDeck === d ? ' active' : '') + '" data-d="' + esc(d) + '">' +
    (d === 'todos' ? 'Todas' : esc(deckLabel(d))) + '</button>').join('');
  if (nOff > 0 || cartasDeck === '__off__') {
    html += '<button class="chip' + (cartasDeck === '__off__' ? ' active' : '') + '" data-d="__off__">🚫 Desligadas (' + nOff + ')</button>';
  }
  $('cartas-chips').innerHTML = html;
  $('cartas-chips').querySelectorAll('.chip').forEach(ch => ch.onclick = () => {
    cartasDeck = ch.dataset.d;
    renderCartasChips(); renderList();
  });
}
function renderList() {
  const q = $('search').value.trim().toLowerCase();
  const list = cards.filter(c =>
    (cartasDeck === 'todos' || (cartasDeck === '__off__' ? isOff(c.id) : c.deck === cartasDeck)) &&
    (!q ||
      (c.hanzi || '').toLowerCase().includes(q) ||
      (c.pinyin || '').toLowerCase().includes(q) ||
      (c.pt || '').toLowerCase().includes(q)));
  // conta o que está na tela; quando há filtro ou busca, mostra também o total do deck
  const filtrado = list.length !== cards.length;
  $('cartas-count').innerHTML = filtrado
    ? '<b>' + list.length + '</b> de ' + cards.length + ' palavras'
    : '<b>' + cards.length + '</b> palavras no deck';
  $('cardlist').innerHTML = list.map(c =>
    '<div class="card' + (isOff(c.id) ? ' offrow' : '') + '"><div class="rowline">' +
    '<div class="h zh" lang="zh-Hans">' + esc(c.hanzi) + '</div>' +
    '<div class="mid"><div class="p">' + pinyinColored(c.pinyin) + '</div><div class="t">' + esc(c.pt) + '</div>' +
    (c.nota ? '<div class="n">' + esc(c.nota) + '</div>' : '') + '</div>' +
    '<span class="pill">' + esc(deckLabel(c.deck)) + '</span>' +
    '<button class="spk-row" data-id="' + esc(c.id) + '" title="Ouvir">🔊</button>' +
    '<label class="switch" title="ativa / desligada"><input type="checkbox" class="offtgl" data-id="' + esc(c.id) + '"' +
    (isOff(c.id) ? '' : ' checked') + '><span class="knob"></span></label>' +
    '</div></div>').join('') || '<p style="color:var(--mut);text-align:center">Nenhuma carta encontrada.</p>';
  $('cardlist').querySelectorAll('.spk-row').forEach(bt => bt.onclick = () => {
    const c = cards.find(x => x.id === bt.dataset.id);
    if (c) speak(c);
  });
  $('cardlist').querySelectorAll('.offtgl').forEach(t => t.onchange = () => {
    setOff(t.dataset.id, !t.checked);
    renderCartasChips(); renderList();
    if (phase !== 'quiz') { // realinha a fila de estudo mantendo a carta atual na frente
      if (phase === 'sched') buildQueue(); else enterPractice();
      if (current && !isOff(current.id)) {
        queue = queue.filter(x => x !== current.id);
        queue.unshift(current.id);
        renderCounter();
      } else {
        nextCard();
      }
    }
  });
}

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
    statOrder = ch.dataset.s; renderWordStats();
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

  $('wordstats').innerHTML = linhas.map(l => {
    const pill = (n, cls) => '<span class="' + (n ? cls : 'zero') + '">' + n + '</span>';
    return '<div class="wrow"><span class="hz zh" lang="zh-Hans">' + esc(l.c.hanzi) + '</span>' +
      '<span class="info"><b>' + esc(l.c.pt) + '</b><small>' + pinyinColored(l.c.pinyin) +
      ' · ' + esc(deckLabel(l.c.deck)) + '</small></span>' +
      '<span class="tally" data-tip="' + esc(l.c.hanzi + ': ' + l.g + ' acertos, ' + l.h +
        ' difícil, ' + l.a + ' erros') + '">' +
      pill(l.g, 'g') + pill(l.h, 'h') + pill(l.a, 'a') + '</span></div>';
  }).join('');
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
      esc(USERS[u] || u) + '</span><span class="dias">' + celulas + '</span>' +
      '<span class="tot">' + tot + '</span></div>';
  }).join('') +
    '<p class="turmaleg">últimos 7 dias · <i></i> meta de ' + META_DIARIA + ' batida</p>';
}

// ── UI: progresso ───────────────────────────────────────────
function renderProgress() {
  renderTurma();
  renderWordStats();
  const t = todayStr();
  const { due, news } = dueCount();
  const nOff = offCount();
  $('s-total').textContent = cards.length;
  $('s-total-lbl').textContent = 'palavras no deck' + (nOff ? ' · ' + nOff + ' desligada' + (nOff > 1 ? 's' : '') : '');
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
    return '<div class="deckrow"><b>' + esc(deckLabel(dk)) + '</b><span>' + seen + '/' + pool.length +
      ' vistas · ' + learned + ' aprendidas' + (nOff ? ' · ' + nOff + ' 🚫' : '') + '</span></div>';
  }).join('');
}

// ── navegação e eventos ─────────────────────────────────────
function switchView(v) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.v === v));
  document.querySelectorAll('.view').forEach(s => s.classList.toggle('active', s.id === 'view-' + v));
  if (v === 'progresso') {
    renderProgress();
    loadLogTurma().then(renderTurma); // busca a cada visita: o colega pode ter estudado agora
  }
  if (v === 'cartas') renderList();
}
function renderModeUI() {
  $('modecur').textContent = MODE_TITLES[settings.mode] || MODE_TITLES.zh_all;
}
function renderModeSheet() {
  document.querySelectorAll('.modeopt[data-m]').forEach(b =>
    b.classList.toggle('active', b.dataset.m === settings.mode));
  $('autospeak-opt').classList.toggle('active', !!settings.autoSpeak);
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
  $('filtertype').querySelectorAll('button').forEach(b => b.onclick = () => {
    settings.filtro = b.dataset.f; save(K.settings, settings);
    renderChips(); startSession();
  });
  $('credbtn').onclick = () => $('credsheet').classList.add('show');
  $('credsheet-bg').onclick = () => $('credsheet').classList.remove('show');
  $('credclose').onclick = () => $('credsheet').classList.remove('show');
  document.querySelectorAll('.modeopt[data-m]').forEach(b => b.onclick = () => {
    const wasQuiz = settings.mode === 'tons';
    settings.mode = b.dataset.m; save(K.settings, settings);
    renderModeUI();
    $('modesheet').classList.remove('show');
    // entrar/sair do quiz troca o tipo de fila — reconstrói a sessão
    if (wasQuiz !== (settings.mode === 'tons')) startSession();
    else if (current) showCard(current);
  });
  $('autospeak-opt').onclick = () => {
    settings.autoSpeak = !settings.autoSpeak; save(K.settings, settings);
    renderModeSheet();
  };
  $('spk-back').onclick = (e) => { e.stopPropagation(); if (current) speak(current); };
  $('spk-front').onclick = (e) => { e.stopPropagation(); if (current) speak(current); };
  $('back-strokes').onclick = (e) => { // repetir o traçado sem desvirar a carta
    e.stopPropagation();
    if (!current) return;
    renderBackHanzi(current);
    animateBackStrokes();
  };
  $('fcard').onclick = tapCard;
  $('g-again').onclick = () => grade('again');
  $('g-hard').onclick = () => grade('hard');
  $('g-good').onclick = () => grade('good');
  $('nextbtn').onclick = () => { queue.shift(); nextCard(); };
  $('freebtn').onclick = () => { if (settings.mode === 'tons') startToneQuiz(); };
  $('tones').querySelectorAll('button').forEach(bt => bt.onclick = () => answerTone(parseInt(bt.dataset.t, 10)));
  $('offbtn').onclick = () => {
    if (!current) return;
    setOff(current.id, true);
    queue.shift();
    showBanner('info', '🚫 "' + current.hanzi + '" desligada — religue na aba Cartas.');
    setTimeout(hideBanner, 3000);
    renderCartasChips();
    nextCard();
  };
  $('search').oninput = renderList;
  // login
  document.querySelectorAll('#login [data-u]').forEach(b => b.onclick = () => selectUser(b.dataset.u));
  $('userbtn').onclick = () => $('login').classList.add('show');
  // progresso
  $('resetbtn').onclick = () => {
    if (!confirm('Zerar TODO o seu progresso de estudo (' + (USERS[settings.user] || '') + ')? As cartas não são apagadas.')) return;
    srs = {}; log = {}; dirty = []; stats = {};
    localStorage.removeItem(uk(K.srs)); localStorage.removeItem(uk(K.log));
    localStorage.removeItem(uk(K.dirty)); localStorage.removeItem(uk(K.stats));
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
  bindTips();
  renderModeUI();
  await Promise.all([loadCards(), loadStrokes()]);
  if (dataSource === 'seed' || dataSource === 'cache-noconfig') showBanner('info', 'Rodando com o deck local — Supabase ainda não configurado.');
  else if (dataSource === 'cache') showBanner('info', '📴 Sem conexão — usando as cartas salvas neste aparelho.');
  else if (dataSource === 'vazio') showBanner('error', 'Não consegui carregar nenhuma carta. Verifique a conexão e recarregue.');
  else hideBanner();
  if (settings.user) { // estado do usuário ANTES de qualquer render (off/srs afetam chips e fila)
    renderUserPill();
    loadUserState();
    gcSrs();
  }
  renderChips();
  renderCartasChips();
  renderList();
  renderProgress();
  renderStreak();
  if (settings.user) {
    startSession();
    const changed = await syncPull();
    flushDirty();
    if (changed && gradedThisSession === 0) startSession();
    renderCartasChips();
    renderList();
    renderProgress();
    renderStreak(); // o syncPull pode ter trazido revisões feitas em outro aparelho
    loadLogTurma().then(renderTurma);
  } else {
    $('login').classList.add('show');
    startSession();
  }
}
init();
