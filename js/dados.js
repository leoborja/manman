/* Mànmàn — SRS, cartas desligadas, ⭐ favoritas, usuário, carga das cartas e sync com o Supabase. */
'use strict';

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
// V2.7 — erro por HABILIDADE, não por modo. "Errei no teclado" é ambíguo: pode ser não
// lembrar o som ou trocar o ideograma entre dois homófonos, e são fraquezas diferentes,
// com treinos diferentes. O app já sabe qual das duas metades falhou — só não guardava.
// O `alvo` diz só ONDE a habilidade aparece enquanto ainda não tem medição nenhuma. A
// contagem de verdade é agrupada pela CARTA que a gerou, não por este campo: reconhecer
// é 'ambos' porque o flashcard mostra frase e palavra, e cada uma conta do seu lado.
// O `porGrupo` é pra esse caso: é a MESMA medida, mas na frase ela não se chama a mesma
// coisa — falar em "ideograma" no meio de uma frase inteira descreve o exercício errado.
const HABS = [
  { k: 'rec',   alvo: 'ambos',   nome: 'reconhecer o 汉字',   dica: 'vê o ideograma e lembra o que é',
    porGrupo: { frase: { nome: 'ler a frase', dica: 'vê a frase e entende o que ela diz' } } },
  { k: 'som',   alvo: 'palavra', nome: 'lembrar o som',       dica: 'no teclado, digitar o pinyin certo' },
  { k: 'ideo',  alvo: 'palavra', nome: 'achar o ideograma',   dica: 'com o pinyin certo, escolher entre os homófonos' },
  { k: 'esc',   alvo: 'palavra', nome: 'escrever de memória', dica: 'desenho com menos de ' + DRAW_OK + '% de proximidade' },
  { k: 'traco', alvo: 'palavra', nome: 'a ordem dos traços',  dica: 'cobrindo o ideograma, seguir a ordem e o sentido certos' },
  { k: 'ordem', alvo: 'frase',   nome: 'a ordem da frase',    dica: 'montar a frase com as palavras na ordem certa' },
  { k: 'frase', alvo: 'frase',   nome: 'escrever a frase',    dica: 'digitar a frase inteira no teclado' },
  { k: 'tomM',  alvo: 'palavra', nome: 'tom de memória',      dica: 'marcar o tom vendo o ideograma' },
  { k: 'tomO',  alvo: 'palavra', nome: 'tom de ouvido',       dica: 'marcar o tom só ouvindo' }
];
// Palavra e frase são duas coisas diferentes de aprender, e numa lista só pareciam
// concorrer na mesma escala — "a ordem da frase" com 40% de erro ao lado de "lembrar o
// som" com 12% comparava alhos com bugalhos. Separadas, cada metade se lê por si.
const HAB_GRUPOS = [
  { g: 'palavra', titulo: 'Palavras', dica: 'o 汉字, o som e o tom de cada palavra' },
  { g: 'frase',   titulo: 'Frases',   dica: 'pôr as palavras juntas, na ordem certa' }
];
const TOM_CURTO = { 1: '1º', 2: '2º', 3: '3º', 4: '4º', 5: 'neutro' };
function bumpStat(id, grade) {
  const k = GRADE_KEY[grade];
  if (!k) return;
  const s = stats[id] || { g: 0, h: 0, a: 0 };
  s[k] = (s[k] || 0) + 1;
  stats[id] = s;
  save(uk(K.stats), stats);
}
function statOf(id) { return stats[id] || { g: 0, h: 0, a: 0 }; }
// Grava um resultado OBJETIVO. Objetivo é a palavra que importa: no desenho e no teclado
// quem aperta "Errei" é você e o app só sugere, então misturar o botão com o que a
// máquina mediu estragaria o número. Aqui entra só o que a máquina viu.
// Não sincroniza sozinho: quem responde uma carta passa pelo grade(), que já dá o push.
// A exceção é o quiz puro de tom, que não passa por lá e empurra por conta própria.
function bumpHab(id, k, errou) {
  const s = stats[id] || { g: 0, h: 0, a: 0 };
  if (!s.hab) s.hab = {};
  const c = s.hab[k] || (s.hab[k] = { n: 0, e: 0 });
  c.n++;
  if (errou) c.e++;
  stats[id] = s;
  save(uk(K.stats), stats);
}
// O par (tom certo → tom marcado). A contagem crua de erros de tom não distingue trocar
// 2º por 3º — que é um problema de ouvido específico — de chutar qualquer coisa.
function bumpTomX(id, certo, marcado) {
  const s = stats[id] || { g: 0, h: 0, a: 0 };
  if (!s.tomX) s.tomX = {};
  const par = certo + '>' + marcado;
  s.tomX[par] = (s.tomX[par] || 0) + 1;
  stats[id] = s;
  save(uk(K.stats), stats);
}
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
  if (changedOff) { save(uk(K.off), off); offVer++; }
  if (changedStats) save(uk(K.stats), stats);
}

// ── cartas desligadas ───────────────────────────────────────
function isOff(id) { return !!(off[id] && off[id].off); }
function offCount() { return cards.filter(c => isOff(c.id)).length; }
function setOff(id, val) {
  off[id] = { off: val, u: Date.now() };
  offVer++;
  save(uk(K.off), off);
  pushOff(id);
}

// ── ⭐ favoritas ────────────────────────────────────────────
// A favorita entra em toda sessão do tipo dela, por cima dos filtros de tema, origem e
// erro e do agendamento: é a palavra que você quer martelar sempre.
//
// Mora no `progress` numa linha que não é carta nenhuma — card_id 'favoritas' —, com o
// mapa no `hab`: {"num-1": {n: <ms da última mudança>, e: 1 favorita | 0 tirada}}. Sem
// coluna nova (ninguém tem DDL). Tirar não apaga a chave: o 0 mais novo é o que avisa o
// outro aparelho que a estrela saiu. No merge ganha o `n` maior. O iOS faz igual.
const FAV_ROW = 'favoritas';
function linhaEspecial(id) { return id === FAV_ROW || /^prova:/.test(id); }
function isFav(id) { return !!(fav[id] && fav[id].fav); }
function favDoBanco(hab) {
  const m = {};
  for (const k of Object.keys(hab || {})) m[k] = { fav: (hab[k].e || 0) > 0, u: hab[k].n || 0 };
  return m;
}
function mesclaFav(a, b) {
  const r = Object.assign({}, a);
  for (const k of Object.keys(b)) if (!r[k] || b[k].u > r[k].u) r[k] = b[k];
  return r;
}
function setFav(id, val) {
  fav[id] = { fav: val, u: Date.now() };
  save(uk(K.fav), fav);
  dirtyFav = true; save(uk(K.dirtyFav), true);
  pushFav();
}
// Lê a linha antes de gravar e sobe a UNIÃO: o upsert troca o `hab` inteiro, e sem a
// leitura a estrela que o iPhone pôs desde o último pull seria apagada por esta aba.
async function pushFav() {
  if (!syncEnabled()) return;
  const base = HW_CONFIG.SUPABASE_URL + '/rest/v1/progress';
  try {
    const u = encodeURIComponent(settings.user);
    const r0 = await fetch(base + '?user_name=eq.' + u + '&card_id=eq.' + FAV_ROW + '&select=hab', { headers: sbHeaders() });
    if (!r0.ok) throw new Error('HTTP ' + r0.status);
    const [row] = await r0.json();
    if (row && row.hab) { fav = mesclaFav(fav, favDoBanco(row.hab)); save(uk(K.fav), fav); }
    const hab = {};
    for (const k of Object.keys(fav)) hab[k] = { n: fav[k].u, e: fav[k].fav ? 1 : 0 };
    const r = await fetch(base + '?on_conflict=user_name,card_id', {
      method: 'POST',
      headers: sbHeaders({ Prefer: 'resolution=merge-duplicates' }),
      body: JSON.stringify({ user_name: settings.user, card_id: FAV_ROW, hab })
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    dirtyFav = false;
  } catch (e) { dirtyFav = true; }
  save(uk(K.dirtyFav), dirtyFav);
}
// As favoritas que a sessão puxa: as do TIPO dela, em rotação, e do TEMA e da ORIGEM que
// a sessão está estudando — estudar o Cap. 3 traz as favoritas do Cap. 3, não as do
// Cap. 1. Sem tema nem origem marcados, todas. O que elas pulam é o filtro de erro (a
// favorita que você já não erra continua sendo a que você quer martelar) e o agendamento.
function favoritasDaSessao() {
  return deckAtual().filter(c => isFav(c.id) && !foraDaRotacao(c) &&
    (!settings.decks.length || settings.decks.includes(c.deck)) &&
    (!settings.origens.length || settings.origens.includes(origemDe(c))));
}

// ── usuário / login ─────────────────────────────────────────
function loadUserState() {
  srs = load(uk(K.srs), {});
  stats = load(uk(K.stats), {});
  log = load(uk(K.log), {});
  dirty = load(uk(K.dirty), []);
  off = load(uk(K.off), {});
  offVer++;
  dirtyOff = load(uk(K.dirtyOff), []);
  fav = load(uk(K.fav), {});
  dirtyFav = load(uk(K.dirtyFav), false);
  arranjo = load(uk(K.arranjo), { grupos: [] });
  if (!Array.isArray(arranjo.grupos)) arranjo = { grupos: [] };
  // migração: progresso antigo sem usuário vira do primeiro que logar
  if (!Object.keys(srs).length && localStorage.getItem(K.srs)) {
    srs = load(K.srs, {}); log = load(K.log, {});
    save(uk(K.srs), srs); save(uk(K.log), log);
    localStorage.removeItem(K.srs); localStorage.removeItem(K.log);
  }
}
function renderUserPill() {
  const nome = settings.user ? (USERS[settings.user] || settings.user) : '';
  const b = $('profilebtn');
  b.textContent = nome ? nome[0].toUpperCase() : '👤'; // o nome inteiro não cabe no topo
  b.title = nome ? 'Perfil · ' + nome : 'Perfil';
}
// a folha de perfil guarda os dois estados que o botão redondo esconde: quem está
// estudando e o tema
function renderPerfilSheet() {
  document.querySelectorAll('#perfilsheet [data-pu]').forEach(b =>
    b.classList.toggle('active', b.dataset.pu === settings.user));
  applyTheme();
}
async function selectUser(u) {
  settings.user = u; save(K.settings, settings);
  $('login').classList.remove('show');
  $('perfilsheet').classList.remove('show');
  renderUserPill(); renderPerfilSheet();
  loadUserState();
  gcSrs();
  await syncPull();
  flushDirty();
  renderChips(); renderCartasChips(); renderList(); renderGrade(); renderProgress();
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
// Uma leitura INTEIRA de uma tabela. O PostgREST do Supabase devolve no máximo 1.000
// linhas por resposta e corta o resto calado — sem erro, sem aviso. O progress da turma
// já passou disso (a Competição contava só parte dele), o deck está em 936 e o progress
// de cada um cresce uma linha por carta. Então toda leitura que pode crescer pagina aqui.
// A consulta precisa de `order` com desempate, senão a página seguinte pode repetir ou
// pular linha. Falhou alguma página? Lança: dado pela metade é pior que dado nenhum.
const SB_PAGINA = 1000;
async function sbTodas(consulta, opcoes) {
  const out = [];
  for (let ini = 0; ; ini += SB_PAGINA) {
    const r = await fetch(HW_CONFIG.SUPABASE_URL + '/rest/v1/' + consulta + '&limit=' + SB_PAGINA + '&offset=' + ini,
      Object.assign({ headers: sbHeaders() }, opcoes || {}));
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const pag = await r.json();
    out.push(...pag);
    if (pag.length < SB_PAGINA) return out;
  }
}
async function loadCards() {
  const cached = load(K.cards, null);
  if (sbConfigured()) {
    try {
      // Com cartas salvas, a rede ganha 4s: sinal ruim (metrô, elevador) não pode deixar a
      // tela em branco esperando — é pior que estar sem internet, que falha na hora e cai no
      // cache. Sem cartas salvas não há plano B, então aí espera o quanto for.
      const ctrl = new AbortController();
      const prazo = cached && cached.length ? setTimeout(() => ctrl.abort(), 4000) : null;
      const todas = await sbTodas('cards?select=*&deleted=eq.false&order=created_at.asc,id.asc', { signal: ctrl.signal });
      clearTimeout(prazo);
      cards = todas;
      save(K.cards, cards);
      dataSource = 'supabase';
      cartasEm = Date.now();
      return;
    } catch (e) {
      if (cached && cached.length) { cards = cached; dataSource = 'cache'; return; }
    }
  } else if (cached && cached.length) {
    cards = cached; dataSource = 'cache-noconfig'; return;
  }
  try {
    const r = await fetch('./seed/seed_cards.json');
    // o banco já entrega sem as tiradas (deleted=eq.false); o JSON cru precisa do mesmo corte
    cards = (await r.json()).filter(c => !c.deleted);
    dataSource = 'seed';
  } catch (e) {
    cards = []; dataSource = 'vazio';
  }
}

// ── sync de progresso (Supabase) ────────────────────────────
function syncEnabled() { return sbConfigured() && settings.user && settings.user !== 'convidado'; }
// Vira false quando o banco responde que ainda não tem as colunas da V2.7. Só nesta
// sessão: na próxima o ALTER TABLE já pode ter rodado, e ela tenta de novo.
let habColunaOk = true;
// log de TODO mundo, pro gráfico da turma. Só leitura e sem dado sensível —
// a policy de review_log já é aberta. Falhou? o gráfico some, o resto do app segue.
let logTurma = null;
async function loadLogTurma() {
  if (!sbConfigured()) return;
  try {
    const desde = todayStr(-13);
    logTurma = await sbTodas('review_log?select=user_name,day,rev&day=gte.' + desde + '&order=day.asc,user_name.asc');
  } catch (e) { logTurma = null; }
}
async function syncPull() {
  if (!syncEnabled()) return false;
  let changed = false;
  try {
    const u = encodeURIComponent(settings.user);
    // cada uma pode falhar sozinha: sem o log, o progresso das cartas ainda entra
    const [prows, lrows] = await Promise.all([
      sbTodas('progress?user_name=eq.' + u + '&select=*&order=card_id.asc').catch(() => null),
      sbTodas('review_log?user_name=eq.' + u + '&select=*&order=day.asc').catch(() => null)
    ]);
    if (prows) {
      for (const row of prows) {
        // a linha das ⭐ e as das provas do iOS não são carta
        if (row.card_id === FAV_ROW) {
          const antes = JSON.stringify(fav);
          fav = mesclaFav(fav, favDoBanco(row.hab));
          if (JSON.stringify(fav) !== antes) changed = true;
          continue;
        }
        // as provas (do iOS ou deste app) somam por tentativa — ver js/prova.js
        if (/^prova:/.test(row.card_id)) { mesclaProvas(row.card_id.slice(6), row.hab); continue; }
        if (linhaEspecial(row.card_id)) continue;
        const local = srs[row.card_id];
        if (row.due !== null && (!local || (row.updated_ms || 0) > (local.u || 0))) {
          srs[row.card_id] = { reps: row.reps, ivl: row.ivl, ease: row.ease, due: row.due, u: row.updated_ms || 0 };
          changed = true;
        }
        const lo = off[row.card_id];
        if ((row.off_ms || 0) > 0 && (!lo || row.off_ms > lo.u)) {
          off[row.card_id] = { off: !!row.suspended, u: row.off_ms };
          offVer++;
          changed = true;
        }
        // contagens só crescem, então o maior lado vence — sem timestamp e sem
        // risco de um aparelho desatualizado zerar o que o outro somou
        const rem = { g: row.n_good || 0, h: row.n_hard || 0, a: row.n_again || 0 };
        if (rem.g || rem.h || rem.a) {
          const loc = stats[row.card_id] || { g: 0, h: 0, a: 0 };
          stats[row.card_id] = Object.assign(loc, {
            g: Math.max(loc.g || 0, rem.g), h: Math.max(loc.h || 0, rem.h), a: Math.max(loc.a || 0, rem.a)
          });
        }
        // habilidade e confusão de tons seguem a mesma regra dos contadores: só crescem,
        // o maior lado vence. Quem não tem a coluna (aparelho antes da V2.7) manda nada
        // e não apaga o que o outro somou.
        if (row.hab && typeof row.hab === 'object') {
          const loc = stats[row.card_id] || (stats[row.card_id] = { g: 0, h: 0, a: 0 });
          const h = loc.hab || (loc.hab = {});
          for (const k of Object.keys(row.hab)) {
            const r = row.hab[k] || {}, l = h[k] || { n: 0, e: 0 };
            h[k] = { n: Math.max(l.n || 0, r.n || 0), e: Math.max(l.e || 0, r.e || 0) };
          }
        }
        if (row.tom_x && typeof row.tom_x === 'object') {
          const loc = stats[row.card_id] || (stats[row.card_id] = { g: 0, h: 0, a: 0 });
          const x = loc.tomX || (loc.tomX = {});
          for (const par of Object.keys(row.tom_x)) x[par] = Math.max(x[par] || 0, row.tom_x[par] || 0);
        }
      }
      save(uk(K.srs), srs);
      save(uk(K.off), off);
      save(uk(K.stats), stats);
      save(uk(K.fav), fav);
    }
    if (lrows) {
      for (const row of lrows) {
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
  if (stats[id]) {
    Object.assign(linha, { n_good: stats[id].g, n_hard: stats[id].h, n_again: stats[id].a });
    if (habColunaOk && stats[id].hab) linha.hab = stats[id].hab;
    if (habColunaOk && stats[id].tomX) linha.tom_x = stats[id].tomX;
  }
  // o total do dia vai ANTES e por conta própria: são dados independentes, e uma
  // falha no progress (schema desatualizado, por exemplo) não pode levar junto
  // o contador que alimenta a meta e o gráfico da turma
  fetch(HW_CONFIG.SUPABASE_URL + '/rest/v1/review_log?on_conflict=user_name,day', {
    method: 'POST',
    headers: sbHeaders({ Prefer: 'resolution=merge-duplicates' }),
    body: JSON.stringify({ user_name: settings.user, day: t, rev: l.rev, new_cnt: l.new })
  }).catch(() => {});
  const post = (corpo) => fetch(HW_CONFIG.SUPABASE_URL + '/rest/v1/progress?on_conflict=user_name,card_id', {
    method: 'POST',
    headers: sbHeaders({ Prefer: 'resolution=merge-duplicates' }),
    body: JSON.stringify(corpo)
  });
  try {
    let r = await post(linha);
    // Banco ainda sem as colunas da V2.7 — o PostgREST devolve 400 e recusa a linha
    // INTEIRA. Sem esta saída, publicar o app antes de rodar o ALTER TABLE derrubaria a
    // sincronia toda (agendamento e contagens junto), não só a medição nova. Reenvia sem
    // elas e para de mandá-las até a próxima sessão.
    if (r.status === 400 && (linha.hab || linha.tom_x)) {
      habColunaOk = false;
      delete linha.hab;
      delete linha.tom_x;
      r = await post(linha);
    }
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
  if (dirtyFav) pushFav();
  flushProvas();
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
// limpa o texto junto: escondido com o texto dentro, o aviso 📴 continuava casando com as
// checagens de startsWith('📴') depois de sumir da tela
function hideBanner() { $('banner').className = 'banner'; $('banner').textContent = ''; }

// ── sem internet ────────────────────────────────────────────
// O sw.js guarda a casca do app sozinho; os áudios ele só conhece pela lista de cartas,
// então o app manda a lista a cada abertura e ele baixa o que faltar em segundo plano.
function prepararOffline() {
  if (!('serviceWorker' in navigator)) return;
  const urls = [...new Set(cards.map(c => c.audio_url).filter(Boolean))].map(u => new URL(u, location.href).href);
  navigator.serviceWorker.ready.then(reg => { if (reg.active) reg.active.postMessage({ tipo: 'baixar-audios', urls }); });
}
const AVISO_OFFLINE = '📴 Sem internet — o que você estudar fica salvo e sobe quando a conexão voltar.';
window.addEventListener('offline', () => showBanner('info', AVISO_OFFLINE));
window.addEventListener('online', async () => {
  if ($('banner').textContent.startsWith('📴')) hideBanner();
  await recarregaCartas();
  if (!settings.user) return;
  // a conexão voltou com o app aberto: sobe agora o que foi respondido offline, sem esperar a
  // próxima abertura, e traz o que a pessoa fez em outro aparelho nesse meio-tempo
  const changed = await syncPull();
  flushDirty();
  if (changed && gradedThisSession === 0) startSession();
  renderProgress(); renderStreak();
});
// O iPhone guarda o app aberto na memória e não roda o init de novo quando a pessoa volta pra
// ele — as cartas ficavam as da última abertura por dias, e o deck reorganizado no banco não
// chegava (13/09: frases ainda em "Treino" num celular, com o banco já em capítulos). O mesmo
// valia pra quem abriu com sinal ruim e caiu nas cartas salvas: nada buscava de novo depois.
const RECARREGA_MS = 5 * 60 * 1000;
let recarregando = false;
async function recarregaCartas() {
  if (recarregando || !sbConfigured() || !navigator.onLine) return;
  recarregando = true;
  try {
    const antes = JSON.stringify(cards);
    await loadCards();
    if (dataSource !== 'supabase') return;          // o banco não respondeu de novo: fica como está
    if ($('banner').textContent.startsWith('📴')) hideBanner();
    if (JSON.stringify(cards) === antes) return;     // nada mudou: não mexe na sessão de ninguém
    prepararOffline();
    renderChips(); renderCartasChips(); renderList(); renderProgress(); renderStreak();
    if (gradedThisSession === 0) startSession();    // no meio de uma rodada, a fila atual termina antes
  } finally {
    recarregando = false;
  }
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  if (dataSource !== 'supabase' || Date.now() - cartasEm > RECARREGA_MS) recarregaCartas();
});
