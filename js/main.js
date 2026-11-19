/* Mànmàn — Navegação, eventos e o init — carrega por ÚLTIMO, depois de todos os outros. */
'use strict';

// ── navegação e eventos ─────────────────────────────────────
const TITULOS = { curso: 'Curso', hoje: 'Hoje', estudar: 'Estudar', palavras: 'Palavras', frases: 'Frases',
  grade: 'Grade', competicao: 'Competição', progresso: 'Progresso' };
// Zerar o progresso: botão do cabeçalho do Progresso (DESIGN_SYSTEM.md 6)
function zeraProgresso() {
  if (!confirm('Zerar TODO o seu progresso de estudo (' + nomeDe(settings.user) + ')? As cartas não são apagadas.')) return;
  srs = {}; log = {}; dirty = []; stats = {}; fav = {}; dirtyFav = false;
  localStorage.removeItem(uk(K.fav)); localStorage.removeItem(uk(K.dirtyFav));
  localStorage.removeItem(uk(K.srs)); localStorage.removeItem(uk(K.log));
  localStorage.removeItem(uk(K.dirty)); localStorage.removeItem(uk(K.stats));
  // as provas também: o syncReset leva as linhas prova:capN do banco junto com as outras
  localStorage.removeItem(uk(K_PROVAS)); localStorage.removeItem(uk(K_PROVAS_DIRTY));
  syncReset();
  renderProgress(); startSession();
}
// Palavras e Frases são dois itens do menu e uma tela só (a das Cartas), com o tipo trocado.
function switchView(v) {
  if (v === 'cartas') v = cartasTipo === 'frase' ? 'frases' : 'palavras';
  const tela = v === 'palavras' || v === 'frases' ? 'cartas' : v;
  if (tela === 'cartas') {
    const tp = v === 'frases' ? 'frase' : 'palavra';
    if (cartasTipo !== tp) {
      cartasTipo = tp;
      // os temas de palavra e de frase não são os mesmos, e a busca por "水" não devolve
      // nada em frase: trocar de tipo recomeça a consulta em vez de herdar o filtro
      cartasTemas = []; cartasOrigens = [];
      $('search').value = '';
    }
    renderCartasChips();
  }
  // a Teoria saiu do menu: ela só abre pelo Curso (uma nota, os sons), e é ele que fica aceso
  const noMenu = v === 'teoria' ? 'curso' : v;
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.v === noMenu));
  $('pagetitulo').textContent = TITULOS[noMenu] || '';
  $('pageacoes').innerHTML = '';
  document.querySelectorAll('.view').forEach(s => s.classList.toggle('active', s.id === 'view-' + tela));
  v = tela;
  if (v === 'progresso') {
    renderProgress();
    $('pageacoes').innerHTML = '<button class="pageacao perigo" id="resetbtn">Zerar meu progresso</button>';
    $('resetbtn').onclick = zeraProgresso;
  }
  if (v === 'teoria') abreTeoria(); else saiTeoria();
  if (v === 'curso') renderCurso();
  if (v === 'hoje') renderHoje();
  if (v === 'cartas') renderList();
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
  const e = escopoResumo();
  $('escopo-ico').textContent = e.ico;
  $('escopo-atual').textContent = e.txt;
  renderEstudoBarra();
}
// ── a barra do Estudar (DESIGN_SYSTEM.md 9) ─────────────────
// No lugar do botão grande que abria a folha "Sua sessão": o jogo é um filtro de uma
// escolha só, o deck (Palavras/Frases) é um seletor, e Tema, Origem e Erros são os
// mesmos filtros da lista. O que é de UM jogo (o relâmpago e o tempo dele, no 汉字 →
// pinyin + tradução) só aparece com aquele jogo escolhido. O que vale pra todos (falar,
// devagar, pronúncia, tema na carta, ideogramas, favoritas) mora no botão Opções.
// Toda mudança passa pelos mesmos caminhos da folha antiga, que continua no HTML sem
// botão que a abra — é ela que guarda os interruptores e os handlers.
const JOGO_ICONE = { mix: '🔀', pt_type: '⌨️', zh_all: '汉', ordenar: '🧩', dialogo: '💬', draw: '✍️', zh_tom: '🎯', tons: '🎧' };
const JOGO_NOME = { mix: 'Aleatório', pt_type: 'Tradução → teclado', zh_all: '汉字 → pinyin + tradução', ordenar: 'Ordenar as palavras',
  dialogo: 'Diálogo', draw: 'Desenhar o 汉字', zh_tom: '汉字 → tom', tons: 'Áudio → tom' };
function escolheJogo(k) {
  const antes = queueKind();
  settings.mode = k; save(K.settings, settings);
  renderModeSheet(); renderModeUI();
  // quiz e relâmpago montam a fila do seu jeito — trocar de família reconstrói a sessão
  if (antes !== queueKind()) startSession();
  else if (current) showCard(current);
}
function mudaEscopo(f) {
  f(); save(K.settings, settings);
  renderChips(); startSession(); renderModeUI();
}
function renderEstudoBarra() {
  const esq = $('estudo-filtros'), dir = $('estudo-dir');
  if (!esq) return;
  esq.innerHTML = ''; dir.innerHTML = '';
  const modos = modosDoTipo();
  // o jogo: escolha obrigatória, sem "todos"
  const jogo = document.createElement('button');
  jogo.type = 'button'; jogo.className = 'ft-btn cheio largo';
  jogo.title = 'Jogo: ' + (MODE_TITLES[settings.mode] || '');
  jogo.innerHTML = '<span>' + esc((JOGO_ICONE[settings.mode] || '') + ' ' + (JOGO_NOME[settings.mode] || '')) + '</span>' + icone('seta', 'ft-seta');
  jogo.onclick = () => abrePop(jogo, 320, el => popItens(el, 'Jogo', modos.map(k => [k, esc(MODE_TITLES[k])]), settings.mode, k => { if (k) escolheJogo(k); }));
  esq.append(jogo);
  if (licaoAtiva) {
    // a lição do Hoje é rodada fechada: os filtros do deck não valem enquanto ela dura
    const l = document.createElement('span');
    l.className = 'ft-btn cheio ft-fixo'; l.title = 'Lição do Hoje — mexer num filtro encerra a lição';
    l.innerHTML = '<span>📅 ' + esc(licaoAtiva.nome) + '</span>';
    esq.append(l);
  }
  if (temFrases()) esq.append(seletorVisao([['palavra', 'Palavras', 'tabela'], ['frase', 'Frases', 'grade']].map(([k, t]) => [k, t, null]), settings.tipo, tp => {
    if (tp === settings.tipo) return;
    mudaEscopo(() => {
      settings.tipo = tp;
      settings.decks = []; settings.origens = [];
      if (!modosDoTipo().includes(settings.mode)) settings.mode = 'zh_all';
    });
    renderModeSheet();
  }));
  const base = deckAtual();
  const decks = [...new Set(base.map(c => c.deck))].sort((a, b) => deckLabel(a).localeCompare(deckLabel(b), 'pt')).map(d => [d, esc(deckLabel(d))]);
  esq.append(filtroMulti('Tema', decks, settings.decks, s => mudaEscopo(() => { settings.decks = s; })));
  // o diálogo ignora origem e erros (ele monta a conversa inteira): os dois saem da barra
  if (!dialogoOn()) {
    const origens = opcoesOrigem().filter(o => o !== 'todas').map(o => [o, esc(origemLabel(o))]);
    esq.append(filtroMulti('Origem', origens, settings.origens, s => mudaEscopo(() => { settings.origens = s; })));
    const faixas = faixasErro();
    esq.append(filtroUnico('Erros', faixas.map(f => [String(f.n), '≥' + f.n + ' erro' + (f.n > 1 ? 's' : '') + ' <small>' + f.qtd + '</small>']),
      settings.erro ? String(settings.erro) : null, k => mudaEscopo(() => { settings.erro = k ? +k : null; })));
  }
  // específico do jogo: o relâmpago só existe no 汉字 → pinyin + tradução
  if (settings.mode === 'zh_all') {
    const rel = document.createElement('button');
    rel.type = 'button'; rel.className = 'ft-quad txt' + (settings.flash ? ' ligado' : '');
    rel.textContent = '⚡ Relâmpago'; rel.setAttribute('aria-pressed', !!settings.flash);
    rel.title = 'A carta pisca e some, e você diz se acertou';
    rel.onclick = () => { $('flash-opt').onclick(); renderEstudoBarra(); };
    esq.append(rel);
    if (settings.flash) {
      const ms = [[1000, '1s'], [2000, '2s'], [3000, '3s']];
      const t = document.createElement('button');
      t.type = 'button'; t.className = 'ft-btn cheio curto'; t.title = 'Quanto a carta fica na tela';
      t.innerHTML = '<span>⏱ ' + ((ms.find(([v]) => v === settings.flashMs) || [, '2s'])[1]) + '</span>' + icone('seta', 'ft-seta');
      t.onclick = () => abrePop(t, 160, el => popItens(el, 'Tempo do relâmpago', ms.map(([v, x]) => [String(v), x]), String(settings.flashMs),
        k => { if (k) { const b = $('flashtime').querySelector('[data-ms="' + k + '"]'); if (b) b.onclick(); renderEstudoBarra(); } }));
      esq.append(t);
    }
  }
  // Opções: as chaves que valem pra qualquer jogo
  const OPC = [['pron', 'pron-opt', '🗣️ Pronúncia aproximada', () => !!settings.pron], ['ideias', 'ideias-opt', '🧩 De que é feito cada 汉字', () => settings.ideias !== false],
    ['tag', 'tag-opt', '🏷️ Mostrar o tema na carta', () => !!settings.tag], ['auto', 'autospeak-opt', '🔊 Falar ao revelar', () => !!settings.autoSpeak],
    ['lento', 'lento-opt', '🐢 Falar devagar', () => !!settings.lento]];
  const FAV = [[1, 'todas'], [2, '2'], [3, '3'], [5, '5'], [10, '10']];
  dir.append(botaoQuadrado('opcoes', 'Opções', false, b => abrePop(b, 280, el => {
    const desenha = () => {
      el.innerHTML = '<div class="ft-pop-tit">Opções</div>' +
        OPC.map(([k, , t, on]) => '<button class="ft-item' + (on() ? ' on' : '') + '" data-o="' + k + '"><i class="ft-q"></i><span>' + t + '</span></button>').join('') +
        '<div class="ft-sep"></div><div class="ft-pop-tit">⭐ Favoritas: uma a cada</div><div class="ft-segs">' +
        FAV.map(([n, t]) => '<button class="' + (settings.favACada === n ? 'on' : '') + '" data-f="' + n + '">' + t + '</button>').join('') + '</div>';
      el.querySelectorAll('[data-o]').forEach(x => x.onclick = () => { $(OPC.find(o => o[0] === x.dataset.o)[1]).onclick(); desenha(); });
      el.querySelectorAll('[data-f]').forEach(x => x.onclick = () => { const bt = $('favtime').querySelector('[data-n="' + x.dataset.f + '"]'); if (bt) bt.onclick(); desenha(); });
    };
    desenha();
  })));
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
  $('modesheet-bg').onclick = () => $('modesheet').classList.remove('show');
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
  $('cartas-tipotype').querySelectorAll('button').forEach(b => b.onclick = () => {
    cartasTipo = b.dataset.tp;
    // os temas de palavra e de frase não são os mesmos, e a busca por "水" não devolve
    // nada em frase: trocar de tipo recomeça a consulta em vez de herdar um filtro que
    // provavelmente não existe do outro lado
    cartasTemas = []; cartasOrigens = [];
    $('search').value = '';
    renderCartasChips(); renderList();
  });
  // os créditos abrem pela folha do Perfil: fecha ela e abre a deles
  $('credbtn').onclick = () => { $('perfilsheet').classList.remove('show'); $('credsheet').classList.add('show'); };
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
    if (current) { mostraIdeias(current); ajustaAltura(); } // a carta na tela já obedece
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
  $('licaosheet-bg').onclick = fechaEditorLicao;
  $('freebtn').onclick = () => {
    if ($('freebtn').dataset.hoje) { delete $('freebtn').dataset.hoje; switchView('hoje'); return; }
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
  // progresso

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
  const peloEmail = await trataLinkDoEmail(); // abriu pelo link de "esqueci a senha"?
  await garanteToken(); // a sessão de ontem pode ter vencido: renova antes da primeira leitura
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
  renderProgress();
  renderStreak();
  // Quem estava num dos nomes fixos (sem senha) precisa entrar com a conta: o progresso
  // deste navegador fica guardado no nome e volta quando a conta recuperar o nome antigo.
  const semConta = settings.user && settings.user !== 'convidado' && !sessaoAuth;
  if (peloEmail) {
    startSession(); // a tela de senha nova (ou o aviso do link) já está aberta
  } else if (sessaoAuth && !settings.conta) {
    // entrou mas não terminou o cadastro (fechou no meio do @ ou do código)
    startSession();
    mostraLogin();
    continuarComConta().catch(() => {});
  } else if (semConta) {
    startSession();
    mostraLogin('O Mànmàn agora tem conta, com e-mail e senha. Entre (ou crie a sua) e, se você estudava como ' +
      nomeDe(settings.user) + ', o código que recebeu traz o progresso de volta.');
  } else if (settings.user) {
    startSession();
    const changed = await syncPull();
    flushDirty();
    if (changed && gradedThisSession === 0) startSession();
    renderCartasChips();
    renderList();
    renderProgress();
    renderStreak(); // o syncPull pode ter trazido revisões feitas em outro aparelho
  } else {
    mostraLogin();
    startSession();
  }
  // o token dura uma hora: renova de tempos em tempos e quando a aba volta da sombra
  setInterval(garanteToken, 4 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) garanteToken(); });
}
init();
