/* Mànmàn — Navegação, eventos e o init — carrega por ÚLTIMO, depois de todos os outros. */
'use strict';

// ── navegação e eventos ─────────────────────────────────────
function switchView(v) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.v === v));
  document.querySelectorAll('.view').forEach(s => s.classList.toggle('active', s.id === 'view-' + v));
  if (v === 'progresso') renderProgress();
  if (v === 'teoria') abreTeoria(); else saiTeoria();
  if (v === 'curso') renderCurso();
  if (v === 'cartas') renderList();
  if (v === 'grade') renderGrade();
  if (v === 'competicao') {
    renderCompeticao(); renderTurma();
    // busca a cada visita: o colega pode ter estudado agora
    loadCompeticao().then(() => { renderCompeticao(); renderTurma(); });
  }
  if (v === 'estudar') resumeFlash(); else pauseFlash();
  // desligar uma carta na aba Cartas pode trocar a carta atual com a aba Estudar
  // escondida — e aí a grade nasceu sem largura pra medir. Volta, remede.
  if (v === 'estudar' && drawOn() && current) montaPad();
}
// O que está na fila, em três palavras — serve tanto pra pílula do botão quanto pra
// linha fechada dentro da folha, pra que as duas nunca digam coisas diferentes.
// A fila em uma linha. Agora ela pode ter três partes somadas — "Família + Comida ·
// Cap. 2 · ≥3 erros" — e é o único lugar onde o estado inteiro aparece de uma vez: dentro
// da folha você só vê a fila de chips de um eixo por vez.
function escopoResumo() {
  const partes = [];
  if (settings.decks.length) partes.push(settings.decks.map(deckLabel).join(' + '));
  if (settings.origens.length) partes.push(settings.origens.map(origemLabel).join(' + '));
  if (settings.erro) partes.push('≥' + settings.erro + ' erro' + (settings.erro > 1 ? 's' : ''));
  // o ícone é o do primeiro eixo ligado; sem nenhum, o do eixo que está na tela
  const ico = settings.decks.length ? '🏷️' : settings.origens.length ? '📖' : settings.erro ? '❌'
    : settings.filtro === 'origem' ? '📖' : settings.filtro === 'erro' ? '❌' : '🏷️';
  if (!partes.length) {
    return { ico, txt: settings.tipo === 'frase' ? 'Todas as frases' : 'Todas as palavras' };
  }
  // o tipo vem na frente porque é a escolha de cima: primeiro que deck, depois que fatia
  return { ico, txt: (settings.tipo === 'frase' ? 'Frases · ' : '') + partes.join(' · ') };
}
function renderModeUI() {
  $('modecur').textContent = (flashOn() ? '⚡ ' : '') + (MODE_TITLES[settings.mode] || MODE_TITLES.zh_all);
  const e = escopoResumo();
  $('modescope').textContent = e.ico + ' ' + e.txt;
  $('escopo-ico').textContent = e.ico;
  $('escopo-atual').textContent = e.txt;
}
function renderEscopo() {
  const open = !!settings.escopoOpen;
  $('escopo-body').classList.toggle('open', open);
  $('escopo-toggle').classList.toggle('open', open);
  $('escopo-toggle').setAttribute('aria-expanded', open ? 'true' : 'false');
}
// Que tipo de fila a combinação pede: cada uma monta a sessão de um jeito diferente.
// Os dois quizzes de tom viram tipos distintos porque o pool não é o mesmo — o de áudio
// tira os neutros. O teclado é fila normal: mesmo pool, só a pergunta muda.
function queueKind() {
  if (mixOn()) return 'normal'; // fila normal: quem varia é a pergunta, carta a carta
  // o ordenar tem pool próprio (só frase que a segmentação fecha), então é família à
  // parte: trocar pra ele ou sair dele remonta a fila em vez de reaproveitar a atual
  return quizOn() ? 'quiz:' + settings.mode : drawOn() ? 'draw'
    : ordenarOn() ? 'ordenar' : dialogoOn() ? 'dialogo' : flashOn() ? 'flash' : 'normal';
}
function renderModeSheet() {
  renderChips(); // as faixas de erro mudam sozinhas conforme você estuda
  renderEscopo();
  const validos = modosDoTipo();
  document.querySelectorAll('.modeopt[data-m]').forEach(b => {
    b.style.display = validos.includes(b.dataset.m) ? '' : 'none';
    b.classList.toggle('active', b.dataset.m === settings.mode);
  });
  $('autospeak-opt').classList.toggle('active', !!settings.autoSpeak);
  $('lento-opt').classList.toggle('active', !!settings.lento);
  $('tag-opt').classList.toggle('active', !!settings.tag);
  $('pron-opt').classList.toggle('active', !!settings.pron);
  $('ideias-opt').classList.toggle('active', settings.ideias !== false);
  $('flash-opt').classList.toggle('active', !!settings.flash);
  $('flashtime').querySelectorAll('button').forEach(b =>
    b.classList.toggle('active', parseInt(b.dataset.ms, 10) === settings.flashMs));
  $('favtime').querySelectorAll('button').forEach(b =>
    b.classList.toggle('active', parseInt(b.dataset.n, 10) === settings.favACada));
  // só um modo vira a carta; nos outros responder já é outra coisa (digitar, desenhar,
  // marcar o tom) e a chave do relâmpago fica visivelmente sem efeito
  const semEfeito = mixOn() || quizOn() || drawOn() || typeOn() || ordenarOn() || dialogoOn();
  $('flash-opt').classList.toggle('disabled', semEfeito);
  // só apaga o tempo quando o modo não aceita relâmpago; com a chave desligada ele
  // continua clicável, e tocar num tempo liga a chave
  $('flashtime').classList.toggle('disabled', semEfeito);
}
// a aproximação sai do HTML sempre; quem decide se aparece é esta classe no <html>.
// Assim o interruptor vale na hora pra carta na tela, pra lista de Cartas e pro que já
// está montado — nada precisa ser redesenhado.
function applyPron() {
  document.documentElement.classList.toggle('sempron', !settings.pron);
}

function applyTheme() {
  const pref = settings.theme || 'light'; // light é o padrão; dark só se a pessoa escolher
  document.documentElement.dataset.theme = pref;
  document.querySelectorAll('#perfilsheet [data-t]').forEach(b =>
    b.classList.toggle('active', b.dataset.t === pref));
}

function bindEvents() {
  document.querySelectorAll('.tab').forEach(t => t.onclick = () => switchView(t.dataset.v));
  $('profilebtn').onclick = () => { renderPerfilSheet(); $('perfilsheet').classList.add('show'); };
  $('perfilsheet-bg').onclick = () => $('perfilsheet').classList.remove('show');
  document.querySelectorAll('#perfilsheet [data-t]').forEach(b => b.onclick = () => {
    settings.theme = b.dataset.t; save(K.settings, settings); applyTheme();
  });
  // trocar de usuário recarrega progresso e sessão; tocar em quem já está só fecha
  document.querySelectorAll('#perfilsheet [data-pu]').forEach(b => b.onclick = () => {
    if (b.dataset.pu === settings.user) { $('perfilsheet').classList.remove('show'); return; }
    selectUser(b.dataset.pu);
  });
  $('modebtn').onclick = () => { renderModeSheet(); $('modesheet').classList.add('show'); };
  $('modesheet-bg').onclick = () => $('modesheet').classList.remove('show');
  // a folha se monta no próprio renderGrade, então abrir é só mostrar
  $('gradebtn').onclick = () => $('gradesheet').classList.add('show');
  $('gradesheet-bg').onclick = () => $('gradesheet').classList.remove('show');
  // A−/A+ mexem no tamanho do cartão. Parte do efetivo (o escolhido, ou a base) e anda
  // um passo; fica salvo, e vale no celular também (menos/mais colunas).
  $('grade-tam').querySelectorAll('button').forEach(b => b.onclick = () => {
    const cfg = gradeCfg();
    const atual = cfg.tam != null ? cfg.tam : GTAM_BASE;
    cfg.tam = Math.max(GTAM_MIN, Math.min(GTAM_MAX, atual + (+b.dataset.d) * GTAM_PASSO));
    save(K.settings, settings); renderGrade();
  });
  $('grade-sig').onclick = () => {
    gradeCfg().sig = !gradeCfg().sig; save(K.settings, settings); renderGrade();
  };
  $('escopo-toggle').onclick = () => {
    settings.escopoOpen = !settings.escopoOpen; save(K.settings, settings);
    renderEscopo();
  };
  // Palavras ↔ Frases é a escolha de cima: troca o deck inteiro, então zera a fatia
  // (uma origem pode ter palavra e frase, outra só palavra) e, se o modo
  // atual não souber perguntar do tipo novo, cai no de virar a carta.
  $('tipotype').querySelectorAll('button').forEach(b => b.onclick = () => {
    if (b.dataset.tp === settings.tipo) return;
    settings.tipo = b.dataset.tp;
    settings.decks = []; settings.origens = [];
    if (!modosDoTipo().includes(settings.mode)) settings.mode = 'zh_all';
    save(K.settings, settings);
    renderModeSheet(); renderModeUI(); startSession();
  });
  $('ordwrap').onclick = (e) => { if (!ordResult) e.stopPropagation(); };
  $('ord-check').onclick = (e) => { e.stopPropagation(); respondeOrdenar(false); };
  $('ord-skip').onclick = (e) => { e.stopPropagation(); respondeOrdenar(true); };
  // trocar de eixo não fecha a folha: depois do ❌ ainda falta escolher a faixa
  $('filtertype').querySelectorAll('button').forEach(b => b.onclick = () => {
    settings.filtro = b.dataset.f; save(K.settings, settings);
    renderChips(); startSession();
  });
  $('cartas-filtertype').querySelectorAll('button').forEach(b => b.onclick = () => {
    cartasFiltro = b.dataset.f;
    cartasDeck = cartasFiltro === 'origem' ? 'todas' : 'todos';
    renderCartasChips(); renderList();
  });
  $('cartas-tipotype').querySelectorAll('button').forEach(b => b.onclick = () => {
    cartasTipo = b.dataset.tp;
    // os temas de palavra e de frase não são os mesmos, e a busca por "水" não devolve
    // nada em frase: trocar de tipo recomeça a consulta em vez de herdar um filtro que
    // provavelmente não existe do outro lado
    cartasDeck = cartasFiltro === 'origem' ? 'todas' : 'todos';
    $('search').value = '';
    renderCartasChips(); renderList();
  });
  $('credbtn').onclick = () => $('credsheet').classList.add('show');
  $('credsheet-bg').onclick = () => $('credsheet').classList.remove('show');
  $('credclose').onclick = () => $('credsheet').classList.remove('show');
  document.querySelectorAll('.modeopt[data-m]').forEach(b => b.onclick = () => {
    const antes = queueKind();
    settings.mode = b.dataset.m; save(K.settings, settings);
    renderModeUI();
    $('modesheet').classList.remove('show');
    // quiz e relâmpago montam a fila do seu jeito — trocar de família reconstrói a sessão
    if (antes !== queueKind()) startSession();
    else if (current) showCard(current);
  });
  $('flash-opt').onclick = () => { // a chave do relâmpago: liga por cima do modo atual
    if (quizOn() || drawOn() || typeOn() || ordenarOn() || dialogoOn()) return;
    settings.flash = !settings.flash; save(K.settings, settings);
    renderModeSheet(); renderModeUI();
    startSession(); // ligar ou desligar troca o tipo de fila
  };
  $('flashtime').querySelectorAll('button').forEach(b => b.onclick = () => {
    settings.flashMs = parseInt(b.dataset.ms, 10);
    settings.flash = true; // escolher o tempo é dizer que quer relâmpago — antes o
    save(K.settings, settings); // seletor ficava morto com a chave desligada e parecia quebrado
    renderModeSheet(); renderModeUI();
    startSession(); // tempo novo, rodada nova: o placar velho não vale mais
  });
  $('favtime').querySelectorAll('button').forEach(b => b.onclick = () => {
    settings.favACada = parseInt(b.dataset.n, 10);
    save(K.settings, settings);
    renderModeSheet();
    startSession(); // o espaçamento novo só vale numa fila nova
  });
  $('autospeak-opt').onclick = () => {
    settings.autoSpeak = !settings.autoSpeak; save(K.settings, settings);
    renderModeSheet();
  };
  $('lento-opt').onclick = () => {
    settings.lento = !settings.lento; save(K.settings, settings);
    renderModeSheet();
    if (current) speak(current); // ouve na hora a diferença que acabou de ligar
  };
  $('ideias-opt').onclick = () => {
    settings.ideias = settings.ideias === false; save(K.settings, settings);
    renderModeSheet();
    if (current) { // a carta na tela já obedece
      $('ideia-btn').classList.toggle('show', temIdeia(current));
      if (!temIdeia(current)) { $('back-ideias').innerHTML = ''; ajustaAltura(); }
    }
  };
  $('pron-opt').onclick = () => {
    settings.pron = !settings.pron; save(K.settings, settings);
    renderModeSheet(); applyPron();
    if (current) ajustaAltura(); // a aproximação some/volta e o pinyin muda de linhas
  };
  $('tag-opt').onclick = () => {
    settings.tag = !settings.tag; save(K.settings, settings);
    renderModeSheet();
    // a carta na tela é a de agora: sem isto a mudança só apareceria na próxima
    $('fcard').classList.toggle('semtag', !settings.tag);
  };
  $('spk-back').onclick = (e) => { e.stopPropagation(); if (current) speak(current); };
  $('ideia-btn').onclick = (e) => {
    e.stopPropagation(); // tocar no ⓘ não pode desvirar a carta
    if (!current) return;
    const abrir = !$('back-ideias').innerHTML;
    $('back-ideias').innerHTML = abrir ? htmlIdeogramas(current) : '';
    $('ideia-btn').setAttribute('aria-pressed', String(abrir));
    ajustaAltura();
  };
  $('back-ideias').onclick = (e) => e.stopPropagation(); // ler a explicação não vira a carta
  $('teoria-voltar').onclick = voltaTeoria;
  $('spk-front').onclick = (e) => { e.stopPropagation(); if (current) speak(current); };
  bindPad();
  // Enquanto não respondeu, o toque no teclado não pode virar a carta — o campo e os
  // candidatos ocupam quase toda a frente, e virar entregaria a resposta. Depois de
  // responder o clique passa: a dica manda tocar na carta pra ver tudo.
  $('typewrap').onclick = (e) => { if (!typeResult) e.stopPropagation(); };
  $('typein').oninput = renderTypeCheck;
  // o pinyin cru só existe aqui dentro: no `input` o campo já traz o ideograma escolhido
  $('typein').addEventListener('compositionupdate', (e) => { if (e.data) typePinyin = e.data; });
  $('typein').onkeydown = (e) => {
    if (e.key !== 'Enter' || e.isComposing) return; // Enter dentro do IME é dele, não nosso
    e.preventDefault();
    confereTeclado();
  };
  $('type-check').onclick = (e) => { e.stopPropagation(); confereTeclado(); };
  // sem esta saída, quem não lembra o som fica preso
  $('type-skip').onclick = (e) => { e.stopPropagation(); respondeTeclado(null); };
  $('draw-undo').onclick = (e) => { e.stopPropagation(); desfazTraco(); };
  $('draw-clear').onclick = (e) => { e.stopPropagation(); limpaDesenho(); };
  $('draw-check').onclick = (e) => { e.stopPropagation(); validaDesenho(); };
  // a grade é medida em px: mudou o tamanho da tela, redesenha (a tinta vive em 0–1024)
  window.addEventListener('resize', () => {
    if (drawOn() && current) montaPad();
    // largura nova quebra as linhas em outro lugar: a altura medida antes não vale mais.
    // É o caso de virar o celular no meio de uma frase longa.
    if (current) ajustaAltura();
  });
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
  $('freebtn').onclick = () => {
    if (dialogoOn()) startDialogo();
    else if (quizOn()) startToneQuiz();
    else if (flashOn()) startFlash();
  };
  $('flashpause').onclick = togglePausa;
  $('fa-hit').onclick = () => responder(true);
  $('fa-miss').onclick = () => responder(false);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseFlash(); else resumeFlash();
  });
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
  // progresso
  $('resetbtn').onclick = () => {
    if (!confirm('Zerar TODO o seu progresso de estudo (' + (USERS[settings.user] || '') + ')? As cartas não são apagadas.')) return;
    srs = {}; log = {}; dirty = []; stats = {}; fav = {}; dirtyFav = false;
    localStorage.removeItem(uk(K.fav)); localStorage.removeItem(uk(K.dirtyFav));
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
  applyPron();
  bindEvents();
  bindTips();
  renderModeUI();
  await Promise.all([loadCards(), loadStrokes(), loadDialogos(), loadConteudoIOS(), loadExercicios()]);
  if (dataSource === 'seed' || dataSource === 'cache-noconfig') showBanner('info', 'Rodando com o deck local — Supabase ainda não configurado.');
  else if (dataSource === 'cache') showBanner('info', '📴 Sem conexão — usando as cartas salvas neste aparelho.');
  else if (dataSource === 'vazio') showBanner('error', 'Não consegui carregar nenhuma carta. Verifique a conexão e recarregue.');
  else hideBanner();
  prepararOffline();
  if (settings.user) { // estado do usuário ANTES de qualquer render (off/srs afetam chips e fila)
    renderUserPill();
    loadUserState();
    gcSrs();
  }
  renderChips();
  renderCartasChips();
  renderList();
  renderGrade();
  renderProgress();
  renderStreak();
  if (settings.user) {
    startSession();
    const changed = await syncPull();
    flushDirty();
    if (changed && gradedThisSession === 0) startSession();
    renderCartasChips();
    renderList();
    renderGrade();
    renderProgress();
    renderStreak(); // o syncPull pode ter trazido revisões feitas em outro aparelho
  } else {
    $('login').classList.add('show');
    startSession();
  }
}
init();
