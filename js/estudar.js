/* Mànmàn — Fila de estudo e a tela Estudar: carta, diálogo, relâmpago e pausa. */
'use strict';

// ── fila de estudo ──────────────────────────────────────────
// "errei" aqui é Errei + Difícil — a mesma conta que a aba Progresso usa em "mais erro",
// pra que as duas telas nunca discordem sobre qual é a palavra pior.
function erroCount(id) { const s = statOf(id); return s.a + s.h; }
// As já aprendidas ficam de fora: o contador é histórico e não esquece, então sem isto
// 说 (15 erros) moraria no topo da lista muito depois de você ter aprendido a palavra.
function aprendida(id) { return !!(srs[id] && srs[id].ivl >= LEARNED_IVL); }
// A marca da frase vem do banco dentro de `tags` — coluna nova exigiria DDL, que
// ninguém do time tem (o porquê está no schema.sql). Aceita também um campo `tipo`,
// que é como o seed_cards.json escreve e como o banco entregaria se um dia a coluna
// existir; assim as duas fontes servem e nada precisa mudar aqui nesse dia.
function ehFrase(c) {
  return c.tipo === 'frase' || (Array.isArray(c.tags) && c.tags.indexOf('frase') >= 0);
}
function temFrases() { return cards.some(ehFrase); }
// ── a frase herda o desligado das palavras ──────────────────
// Desligar 谢谢 e continuar caindo em 谢谢你 na prática é a mesma carta voltando pela
// porta dos fundos. Então a frase sai da rotação junto: basta o 汉字 de uma palavra
// desligada aparecer dentro dela. Casa por SUBSTRING, e não pela segmentação, porque
// a segmentação devolve null na frase que não fecha a conta de sílabas — e ali o certo
// é bloquear, não deixar passar. O interruptor da própria frase continua sendo dela:
// isto só a tira da rotação, ninguém mexe no `off` dela.
let offVer = 0;                  // sobe a cada escrita em `off` — invalida o cache abaixo
let offHzCache = [], offHzVer = -1;
function offHanzis() {
  if (offHzVer !== offVer) {
    offHzCache = cards.filter(c => !ehFrase(c) && isOff(c.id))
      .map(c => limpaHanzi(c.hanzi)).filter(Boolean);
    offHzVer = offVer;
  }
  return offHzCache;
}
// qual palavra desligada tira esta frase da rotação (null se nenhuma, ou se não é frase)
function palavraDesligada(c) {
  if (!ehFrase(c)) return null;
  const hz = limpaHanzi(c.hanzi);
  return offHanzis().find(h => hz.indexOf(h) >= 0) || null;
}
// fora da rotação = desligada na mão, ou frase que carrega palavra desligada
function foraDaRotacao(c) { return isOff(c.id) || !!palavraDesligada(c); }
// O deck do TIPO escolhido — é ele que todos os filtros fatiam. Palavra e frase não se
// encontram em fila nenhuma: são dois decks que moram na mesma tabela.
function deckAtual() {
  const querFrase = settings.tipo === 'frase';
  return cards.filter(c => ehFrase(c) === querFrase);
}
// O pool dos OUTROS eixos, pra que a contagem do chip de erro seja a da sessão que ele
// vai abrir. Com "Família" marcado, "≥3 erros (2)" tem que dizer 2 palavras de família —
// contar o deck inteiro prometeria carta que o tema já tirou.
function cardsComErro(min) {
  let base = deckAtual();
  if (settings.decks.length) base = base.filter(c => settings.decks.indexOf(c.deck) >= 0);
  if (settings.origens.length) base = base.filter(c => settings.origens.includes(origemDe(c)));
  return base.filter(c => !aprendida(c.id) && erroCount(c.id) >= min);
}
// só as faixas que têm palavra — chip vazio é convite a cair numa sessão de zero cartas.
// A contagem já desconta as desligadas, senão o número do chip mentiria sobre a sessão.
function faixasErro() {
  return ERRO_FAIXAS
    .map(n => ({ n, qtd: cardsComErro(n).filter(c => !foraDaRotacao(c)).length }))
    .filter(f => f.qtd);
}
// A origem de uma carta. Sem `fonte` ela cai em 'fora', pra aparecer num chip em vez de
// sumir do filtro sem ninguém saber por quê.
function origemDe(c) { return c.fonte || 'fora'; }
// Interseção dos eixos ligados; dentro de cada um, união dos chips marcados.
// Eixo com conjunto vazio não filtra — é assim que "Todos" volta a ser todos.
function filteredCards() {
  let base = deckAtual();
  if (settings.decks.length) base = base.filter(c => settings.decks.indexOf(c.deck) >= 0);
  if (settings.origens.length) base = base.filter(c => settings.origens.includes(origemDe(c)));
  if (settings.erro) base = base.filter(c => !aprendida(c.id) && erroCount(c.id) >= settings.erro);
  return base;
}
function algumFiltro() { return !!(settings.decks.length || settings.origens.length || settings.erro); }
// Os capítulos primeiro, pelo número (o cap10 depois do cap9, não do cap1); depois as de
// fora do livro na ordem de ORIGEM_FIM; o que ninguém previu; e 'fora' por último.
function ordemOrigem(o) {
  const m = /^cap(\d+)$/.exec(o);
  if (m) return +m[1];
  if (o === 'fora') return 3000;
  const i = ORIGEM_FIM.indexOf(o);
  return i < 0 ? 2000 : 1000 + i;
}
// Origens presentes na base. A base é parâmetro porque a tela de Estudar só quer as do
// tipo escolhido (origem que só tem palavra não pode virar opção de frase), e a aba
// Cartas passa a dela.
function opcoesOrigem(base) {
  const tem = [...new Set((base || deckAtual()).map(origemDe))];
  return ['todas'].concat(tem.sort((a, b) => ordemOrigem(a) - ordemOrigem(b) || a.localeCompare(b)));
}
function origemLabel(o) {
  if (o === 'todas') return 'Todas';
  const m = /^cap(\d+)$/.exec(o);
  if (m) return 'Cap. ' + m[1];
  return ORIGEM_LABELS[o] || (o.charAt(0).toUpperCase() + o.slice(1));
}
// o filtro, mais as ⭐ favoritas que ele deixou de fora
function activePool() {
  const base = filteredCards().filter(c => !foraDaRotacao(c));
  const ids = new Set(base.map(c => c.id));
  return base.concat(favoritasDaSessao().filter(c => !ids.has(c.id)));
}
// Nem todo modo consegue perguntar de toda palavra:
//   desenho — a grade é uma só, então 你好 e 谢谢 ficam de fora
//   tom     — o tom é de uma sílaba, mesma restrição de um caractere
//   áudio → tom — e ainda tira o tom neutro: isolado, o TTS o fala com tom cheio, então
//                 a pergunta não teria resposta pelo ouvido. No 汉字 → tom o neutro entra:
//                 ali a resposta é o que a palavra É, não o que o alto-falante disse.
// Sorteia o modo desta carta entre os que conseguem perguntar dela: tom só de palavra
// de um caractere, e o de áudio nem de tom neutro nem de palavra que o aparelho não sabe
// falar. Evita repetir o modo da carta anterior quando há alternativa — sem isso o acaso
// entrega sequências de três iguais e a sessão parece travada num modo só.
function sorteiaModo(c) {
  const umSo = [...c.hanzi].length === 1;
  let ok = (ehFrase(c) ? MIX_MODOS_FRASE : MIX_MODOS).filter(k => {
    if ((k === 'zh_tom' || k === 'tons') && !umSo) return false;
    if (k === 'tons' && (toneOf(c.pinyin) === 5 || !canSpeak(c))) return false;
    if (k === 'ordenar' && !segmenta(c)) return false;
    return true;
  });
  const semRepetir = ok.filter(k => k !== modoCartaAnterior);
  if (semRepetir.length) ok = semRepetir;
  return ok[Math.floor(Math.random() * ok.length)] || 'zh_all';
}
function podePerguntar(c) {
  // no aleatório o pool é o inteiro: se um modo não dá conta desta palavra, o sorteio
  // escolhe outro que dê. Sem esta linha o contador do alto encolheria pro tamanho do
  // modo da carta que está na tela — 43 palavras enquanto a pergunta fosse de tom.
  if (mixOn()) return true;
  if ((drawOn() || quizOn()) && [...c.hanzi].length !== 1) return false;
  // Desenhar exige o traçado oficial: sem ele o "✓ Validar" não tem com o que comparar
  // e devolve null — o botão fica mudo e a carta vira beco sem saída. Acontece com toda
  // palavra nova enquanto o build_strokes.py não roda, e com a que o makemeahanzi não
  // tiver. Some da sessão em vez de quebrar dentro dela.
  if (drawOn() && !strokesDB[c.hanzi]) return false;
  if (settings.mode === 'tons' && toneOf(c.pinyin) === 5) return false;
  // Ordenar é exercício de FRASE, e a checagem é aqui e não só no seletor: palavra de
  // pinyin composto também segmenta — 林娜 vira 林|娜, 对不对 vira 对|不|对 — e sem esta
  // linha um modo escolhido pra frase continuaria perguntando a ordem do nome do colega,
  // que não tem ordem pra treinar. Segmentação é o segundo requisito: sem ela não há
  // pílula pra embaralhar.
  if (ordenarOn() && (!ehFrase(c) || !segmenta(c))) return false;
  return true;
}
// O que a SESSÃO pode mostrar — é isso que o contador do alto conta, não o pool inteiro
function poolSessao() { return activePool().filter(podePerguntar); }
function buildQueue() {
  const t = todayStr();
  const pool = poolSessao();
  const due = pool.filter(c => srs[c.id] && srs[c.id].due <= t)
    .sort((a, b) => srs[a.id].due < srs[b.id].due ? -1 : 1);
  // O filtro por erro ignora o agendamento de propósito: você pediu "as 7 que eu mais
  // erro" pra treinar as 7. Palavra muito errada já tem data marcada, então o SRS
  // sozinho te entregaria uma só. As atrasadas vêm na frente; o resto, embaralhado.
  // As respostas continuam reagendando normalmente — só a ordem de hoje muda.
  if (settings.erro) {
    const resto = shuffle(pool.filter(c => !due.includes(c)));
    queue = due.concat(resto).map(c => c.id);
  } else {
    const news = shuffle(pool.filter(c => !srs[c.id])); // sem limite diário: o deck só tem o que a turma já viu
    queue = due.concat(news).map(c => c.id);
  }
  // ⭐ As favoritas que não vencem hoje entram assim mesmo, e na FRENTE: a fila emenda
  // todas as novas do deck, e lá no fim elas nunca chegariam. Uma a cada `favACada` cartas,
  // pra não virar uma rodada só delas. As já vistas vêm adiantadas — ver grade().
  const extras = shuffle(pool.filter(c => isFav(c.id) && !due.includes(c)).map(c => c.id));
  favAdiantadas = new Set(extras.filter(id => srs[id]));
  if (extras.length) queue = espalha(extras, queue.filter(id => !extras.includes(id)), settings.favACada || 3);
  phase = 'sched';
}
// `extras` intercalados no começo de `base`, um a cada `passo` cartas
function espalha(extras, base, passo) {
  const r = []; let i = 0;
  for (const e of extras) { r.push(e); r.push(...base.slice(i, i + passo - 1)); i += passo - 1; }
  return r.concat(base.slice(i));
}
function enterPractice() { // prática livre: deck inteiro embaralhado, sem parar
  queue = shuffle(poolSessao().map(c => c.id));
  phase = 'practice';
}
// sem pool = o deck todo (é o que a aba Progresso quer); com pool = o da sessão
function dueCount(pool) {
  const t = todayStr();
  pool = pool || activePool();
  const due = pool.filter(c => srs[c.id] && (srs[c.id].due <= t || isFav(c.id))).length;
  const news = pool.filter(c => !srs[c.id]).length;
  return { due, news };
}

// ── UI: estudar ─────────────────────────────────────────────
function renderChips() {
  // sem frase no deck a linha inteira some: um botão "Frases" que abre sessão vazia é
  // pior que botão nenhum. Enquanto o Leo não publicar as frases, nada muda de lugar.
  const tem = temFrases();
  $('tipotype').style.display = tem ? '' : 'none';
  if (!tem && settings.tipo !== 'palavra') { settings.tipo = 'palavra'; save(K.settings, settings); }
  $('tipotype').querySelectorAll('button').forEach(b =>
    b.classList.toggle('active', b.dataset.tp === settings.tipo));
  const eixo = settings.filtro;
  // O ícone diz duas coisas diferentes: `active` é a fila de chips que está na tela
  // (navegação), e `filtrando` é o eixo que está de fato cortando o deck. Sem o segundo,
  // marcar "Família" e ir olhar o 📅 esconderia que o 🏷️ continua ligado — e a sessão
  // seria menor do que os chips na tela explicam.
  $('filtertype').querySelectorAll('button').forEach(b => {
    b.classList.toggle('active', b.dataset.f === eixo);
    b.classList.toggle('filtrando',
      b.dataset.f === 'tema' ? !!settings.decks.length :
      b.dataset.f === 'origem' ? !!settings.origens.length : !!settings.erro);
  });

  // o primeiro chip de cada eixo é o "não filtre por isto": ligado quando o conjunto
  // está vazio, e tocar nele limpa o eixo inteiro de uma vez
  const chip = (on, attr, val, txt) => '<button class="chip' + (on ? ' active' : '') +
    '" data-' + attr + '="' + esc(String(val)) + '">' + esc(txt) + '</button>';
  let html;
  if (eixo === 'erro') {
    const faixas = faixasErro();
    // a faixa escolhida pode ter esvaziado (você aprendeu as palavras, ou marcou um tema
    // que não tem nenhuma): desliga o eixo em vez de abrir uma sessão vazia
    if (settings.erro && !faixas.some(f => f.n === settings.erro)) {
      const menor = faixas.filter(f => f.n <= settings.erro).pop();
      settings.erro = menor ? menor.n : (faixas[0] ? faixas[0].n : null);
    }
    html = chip(!settings.erro, 'e', 0, 'Tanto faz') + (faixas.length
      ? faixas.map(f => chip(settings.erro === f.n, 'e', f.n,
          '≥' + f.n + ' erro' + (f.n > 1 ? 's' : '') + ' (' + f.qtd + ')')).join('')
      : '<button class="chip" disabled>nada errado por aqui 🎉</button>');
  } else if (eixo === 'origem') {
    const opcoes = opcoesOrigem().filter(o => o !== 'todas');
    settings.origens = settings.origens.filter(o => opcoes.includes(o)); // origem que não existe neste tipo
    html = chip(!settings.origens.length, 'o', 'todas', 'Todas') +
      opcoes.map(o => chip(settings.origens.includes(o), 'o', o, origemLabel(o))).join('');
  } else {
    const decks = [...new Set(deckAtual().map(c => c.deck))];
    settings.decks = settings.decks.filter(d => decks.includes(d)); // tema que não existe neste tipo
    html = chip(!settings.decks.length, 'd', 'todos', 'Todos') +
      decks.map(d => chip(settings.decks.includes(d), 'd', d, deckLabel(d))).join('');
  }
  $('deckchips').innerHTML = html;
  // alterna em vez de trocar: marcar Família e Comida é pedir as duas. E a folha NÃO
  // fecha mais no toque — quem pode escolher vários precisa da lista aberta pra isso.
  // Quem fecha é o toque no fundo, com a sessão já remontada atrás.
  $('deckchips').querySelectorAll('.chip:not([disabled])').forEach(ch => ch.onclick = () => {
    if (eixo === 'erro') {
      const n = +ch.dataset.e;
      settings.erro = (!n || settings.erro === n) ? null : n; // eixo de valor único: alterna liga/desliga
    } else {
      const alvo = eixo === 'origem' ? 'origens' : 'decks';
      const v = eixo === 'origem' ? ch.dataset.o : ch.dataset.d;
      if (v === 'todas' || v === 'todos') settings[alvo] = [];
      else settings[alvo] = settings[alvo].includes(v)
        ? settings[alvo].filter(x => x !== v)
        : settings[alvo].concat([v]);
    }
    save(K.settings, settings);
    renderChips();
    startSession();
  });
  renderModeUI(); // a pílula do botão é o resumo desta escolha
}
function renderCounter() {
  renderStreak();
  const { due, news } = dueCount(poolSessao()); // o contador conta o que a sessão vai mostrar
  if (phase === 'dialogo') {
    const n = dialAtual ? dialAtual.falas.length : 0;
    // os dois eixos que o diálogo não usa são ditos aqui: sem isto a pílula do modo
    // mostraria "❌ ≥3 erros" e a conversa viria inteira, sem ninguém entender por quê
    const ignora = [settings.origens.length ? '📖' : '', settings.erro ? '❌' : ''].filter(Boolean);
    // a fila ainda tem o diálogo da tela dentro dela até ele acabar (é o queue[0]), então
    // o "faltam" desconta ele — senão a última conversa diria que ainda há uma pela frente
    const restam = Math.max(0, queue.length - (dialAtual && dialFala < n ? 1 : 0));
    $('counter').innerHTML = '<b>💬 ' + esc(dialAtual ? dialAtual.titulo : 'diálogo') + '</b> · fala ' +
      Math.min(dialFala + 1, n) + ' de ' + n + (restam ? ' · mais ' + restam + ' na fila' : ' · última') +
      (ignora.length ? ' · ' + ignora.join('') + ' não valem aqui' : '');
  } else if (phase === 'quiz') {
    $('counter').innerHTML = '<b>quiz de tons · ' + (settings.mode === 'tons' ? 'áudio' : '汉字') +
      '</b> · ' + quizScore.ok + '/' + quizScore.n + ' certas · ' + queue.length + ' restantes';
  } else if (phase === 'flash') {
    $('counter').innerHTML = '<b>relâmpago ' + (settings.flashMs / 1000) + 's</b> · ' +
      flashScore.ok + '/' + flashScore.n + ' certas · ' + queue.length + ' restantes';
  } else if (phase === 'practice') {
    $('counter').innerHTML = 'revisões do dia ✅ · <b>prática livre</b> · "Errei" ainda reagenda';
  } else if (settings.erro) {
    // aqui "para hoje" mentiria: a fila é a faixa inteira, não a agenda do dia
    $('counter').innerHTML = '<b>≥' + settings.erro + ' erro' + (settings.erro > 1 ? 's' : '') +
      '</b>' + (settings.tipo === 'frase' ? ' · 💬 frases' : '') + ' · ' + queue.length + ' restantes';
  } else {
    $('counter').innerHTML = '<b>' + due + '</b> para hoje · <b>' + news + '</b> nova' +
      (news === 1 ? '' : 's') + (settings.tipo === 'frase' ? ' · 💬 frases' : '');
  }
}
function showCard(card) {
  clearFlash(); // carta nova: mata relógio e resposta pendentes da anterior
  $('dialwrap').classList.remove('show'); // veio do diálogo: a carta volta pro palco
  $('fcard').style.display = '';
  current = card;
  quizAnswered = false;
  // o sorteio vem ANTES do modo() — é ele que decide o que este modo() vai responder
  if (mixOn()) { modoCarta = sorteiaModo(card); modoCartaAnterior = modoCarta; }
  else modoCarta = null;
  const m = modo();
  const relampago = flashOn();
  const desenho = !!m.draw;
  const teclado = !!m.type;
  const ordena = !!m.ordenar;
  const f = $('fcard');
  f.classList.remove('flipped');
  f.classList.toggle('draw', desenho);
  f.classList.toggle('type', teclado || ordena); // os dois pedem a frente alta e alinhada
  f.classList.toggle('ord', ordena);
  f.style.minHeight = ''; // zera antes de montar; quem mede é o ajustaAltura, no fim
  $('drawwrap').classList.toggle('show', desenho);
  $('typewrap').classList.toggle('show', teclado);
  $('ordwrap').classList.toggle('show', ordena);
  // carta nova zera tinta, nota e resposta do teclado SEMPRE, mesmo saindo do modo: sem
  // isto os botões ↶ ✕ ✓ continuavam na tela depois de trocar pra um modo que não desenha
  drawInk = []; drawTrecho = null; drawScore = null;
  zeraFacil();
  typeResult = null;
  ordResult = null; ordEscolhido = []; ordPool = [];
  renderDrawTools();
  const front = $('front-content');
  // no desenho e no teclado a pergunta mora dentro do próprio exercício, não aqui
  front.style.display = (desenho || teclado || ordena) ? 'none' : '';
  if (desenho || teclado || ordena) front.innerHTML = '';
  else if (m.front === 'hanzi') front.innerHTML = '<div class="hanzi-lg zh" lang="zh-Hans">' + esc(card.hanzi) + '</div>';
  else { // áudio → tom: a carta não mostra nada, o som é a pergunta inteira
    front.innerHTML = '<button class="bigspk" id="bigspk" title="Ouvir de novo">🔊</button>' +
      '<div class="audiolbl">' + (canSpeak(card) ? 'ouça e escolha o tom' : 'sem voz chinesa neste aparelho') + '</div>';
    $('bigspk').onclick = (e) => { e.stopPropagation(); speak(card); };
  }
  // O 🔊 do canto some em três modos, por dois motivos diferentes. No teclado e no
  // 汉字 → tom ele seria um botão de resposta — dita o que digitar, canta o tom; quem não
  // lembra sai pelo "não lembro", que conta como erro. No desenho ele é só repetido: a
  // pergunta já tem o seu, e os dois ficavam colados na mesma quina.
  // no ordenar o 🔊 entrega a frase inteira falada, que é literalmente a resposta
  $('spk-front').style.display = (m.quiz || m.type || m.draw || m.ordenar) ? 'none' : '';
  $('quizfb').style.display = 'none';
  $('quizfb').innerHTML = '';
  $('tones').classList.toggle('show', !!m.quiz);
  $('tones').querySelectorAll('button').forEach(bt => bt.classList.remove('hit', 'miss'));
  $('hint-f').textContent = desenho ? dicaDesenho()
    : ordena ? 'monte a frase e toque em conferir'
    : teclado ? (ehFrase(card) ? 'escreva a frase no teclado de mandarim'
                               : 'digite o som e escolha o ideograma')
    : m.quiz ? (m.front === 'audio' ? 'ouça e escolha o tom · toque na carta pra repetir'
                                    : 'olhe o ideograma e escolha o tom')
    : relampago ? 'toque assim que reconhecer'
    : 'toque para virar';
  if (desenho) montaDesenho(card);
  if (teclado) montaTeclado(card);
  if (ordena) montaOrdenar(card);
  // o áudio só toca sozinho onde ele É a pergunta (áudio → tom) ou parte dela (desenho).
  // No 汉字 → tom ouvir entregaria a resposta, então ali fica quieto até responder.
  if (m.front === 'audio' || desenho) speak(card, true);
  $('deckpill-f').textContent = deckLabel(card.deck);
  $('deckpill-b').textContent = deckLabel(card.deck);
  // ⭐ só avisa que é uma das que você escolheu martelar; favoritar é na aba Cartas
  $('fcard').classList.toggle('favcard', isFav(card.id));
  // "Números" na carta de 三 é meio caminho da resposta — dá pra desligar no MODO
  $('fcard').classList.toggle('semtag', !settings.tag);
  $('back-hanzi').textContent = card.hanzi;
  renderBackHanzi(card, relampago);
  $('back-pinyin').innerHTML = pinyinColored(card.pinyin);
  $('back-lit').innerHTML = htmlLiteral(card);
  $('back-pt').textContent = card.pt;
  $('back-nota').textContent = card.nota || '';
  // 🧩 de que é feito cada 汉字: fechado a cada carta nova, aberto pelo ⓘ ao lado do 🔊
  $('back-ideias').innerHTML = '';
  $('ideia-btn').classList.toggle('show', temIdeia(card));
  $('ideia-btn').setAttribute('aria-pressed', 'false');
  const s = srs[card.id];
  $('iv-again').textContent = srsPreview(s, 'again');
  $('iv-hard').textContent = phase === 'practice' ? 'prática' : srsPreview(s, 'hard');
  $('iv-good').textContent = phase === 'practice' ? 'prática' : srsPreview(s, 'good');
  $('grades').classList.remove('show');
  $('grades').querySelectorAll('button').forEach(bt => bt.classList.remove('sugerido'));
  $('nextbtn').classList.remove('show');
  $('stage').style.display = '';
  $('offbtn').style.display = '';
  $('done').classList.remove('show');
  renderCounter();
  ajustaAltura(); // frente e verso já montados: agora dá pra saber de quanta altura ela precisa
  if (relampago) { runFlashClock(); renderPausa(); } // por último: relógio com a carta já montada
}
function nextCard() {
  if (!queue.length) {
    // quiz e relâmpago são rodadas fechadas: acabou o baralho, mostra o placar
    if (phase === 'quiz' || phase === 'flash' || !poolSessao().length) { finishSession(); return; }
    if (phase === 'sched') { // acabaram as revisões → emenda na prática, sem parar
      showBanner('info', '🎉 Revisões do dia feitas! Emendando na prática livre — só "Errei" mexe no agendamento.');
      setTimeout(hideBanner, 4500);
    }
    enterPractice(); // na prática, fila vazia = embaralha de novo (infinito)
    if (!queue.length) { finishSession(); return; }
  }
  const id = queue[0];
  const card = cards.find(c => c.id === id);
  if (!card || foraDaRotacao(card)) { queue.shift(); nextCard(); return; }
  showCard(card);
}
function finishSession() {
  clearFlash();
  current = null;
  modoCarta = null; // o placar do fim é do modo escolhido, não do sorteado na última carta
  $('stage').style.display = 'none';
  $('grades').classList.remove('show');
  $('tones').classList.remove('show');
  $('drawtools').classList.remove('show');
  $('drawwrap').classList.remove('show');
  $('typewrap').classList.remove('show');
  $('ordwrap').classList.remove('show');
  $('dialwrap').classList.remove('show');
  $('fcard').style.display = '';
  $('nextbtn').classList.remove('show');
  $('offbtn').style.display = 'none';
  $('done').classList.add('show');
  if (dialogoOn()) {
    const disp = dialogosDisponiveis().length;
    if (!disp) {
      $('done-title').textContent = 'Nenhuma conversa por aqui';
      $('done-sub').textContent = 'Um roteiro só entra quando você tem TODAS as frases dele ligadas — ' +
        (settings.decks.length ? 'e nenhum roteiro é do tema que você marcou. Desmarque o tema no MODO'
                               : 'e nenhum fecha a conta agora. Religue frases na aba Cartas') + '.';
      $('freebtn').style.display = 'none';
    } else {
      $('done-title').textContent = 'Fim das conversas!';
      $('done-sub').textContent = 'Você escreveu ' + dialScore.ok + ' de ' + dialScore.n +
        ' falas certas. ' + (dialScore.n && dialScore.ok / dialScore.n >= 0.8
          ? '厉害 (lìhai — mandou bem)!' : '慢慢来 (mànmàn lái — de novo, com calma).');
      $('freebtn').textContent = '💬 Conversar de novo';
      $('freebtn').style.display = '';
    }
  } else if (flashOn() && flashScore.n) {
    // a nota é sobre o deck INTEIRO da rodada, não só sobre o que foi respondido:
    // deixar o tempo acabar sem dizer nada é resultado, não carta que não existiu
    const total = flashScore.total || flashScore.n;
    const pct = Math.round(flashScore.ok / total * 100);
    const semResposta = flashScore.semResposta
      ? ' (' + flashScore.semResposta + ' você não respondeu a tempo)' : '';
    $('done-title').textContent = 'Fim do relâmpago!';
    $('done-sub').textContent = 'Você acertou ' + flashScore.ok + ' de ' + total + ' — ' + pct + '%' +
      semResposta + ', com ' + (settings.flashMs / 1000) + 's por carta. ' +
      (pct >= 80 ? '厉害 (lìhai — mandou bem)! Tenta com menos tempo.'
       : pct >= 50 ? '加油 (jiāyóu — tá vindo)!'
       : '慢慢来 (mànmàn lái — com calma, tenta com mais tempo).');
    $('freebtn').textContent = '⚡ Jogar de novo';
    $('freebtn').style.display = '';
  } else if (!poolSessao().length && activePool().length) {
    // tem carta no filtro, mas nenhuma que ESTE modo consiga perguntar
    $('done-title').textContent = 'Nada pra perguntar aqui';
    $('done-sub').textContent = (ordenarOn()
      ? 'O ordenar precisa saber onde cada palavra da frase começa, e isso vem do pinyin separado por palavra. Nenhuma frase deste filtro fecha a conta.'
      : drawOn()
      ? 'O modo desenho usa uma grade por caractere, então só entram palavras de um caractere.'
      : 'O tom é de uma sílaba só, então só entram palavras de um caractere' +
        (settings.mode === 'tons' ? ', e sem tom neutro, que o alto-falante não consegue perguntar.' : '.')) +
      ' Não sobrou nenhuma neste filtro — escolha outra faixa/tema/origem ou troque de modo.';
    $('freebtn').style.display = 'none';
  } else if (quizOn()) { // no aleatório o modoCarta já foi zerado, então não cai aqui
    const pct = quizScore.n ? Math.round(quizScore.ok / quizScore.n * 100) : 0;
    $('done-title').textContent = 'Fim do quiz!';
    $('done-sub').textContent = MODE_TITLES[settings.mode] + ': ' + quizScore.ok + '/' + quizScore.n +
      ' (' + pct + '%). ' + (pct >= 80 ? '厉害 (lìhai — mandou bem)!'
        : '加油 (jiāyóu — continua treinando ' + (settings.mode === 'tons' ? 'o ouvido' : 'a memória') + ')!');
    $('freebtn').textContent = '🎯 Jogar de novo';
    $('freebtn').style.display = '';
  } else { // só acontece sem nenhuma carta ativa no filtro
    $('done-title').textContent = 'Nada por aqui';
    $('done-sub').textContent = algumFiltro()
      ? 'Nada sobrou cruzando os filtros de "' + escopoResumo().txt + '". Desmarque um deles no MODO — os três se somam, então cada um corta mais.'
      : 'Nenhuma carta ativa neste deck — religue cartas na aba Cartas ou escolha outro filtro.';
    $('freebtn').style.display = 'none';
  }
  renderCounter();
}
function startSession() {
  clearFlash();
  modoCarta = null; // senão a última carta do aleatório decidiria que sessão começa agora
  if (dialogoOn()) { startDialogo(); return; }
  if (quizOn()) { startToneQuiz(); return; }
  if (flashOn()) { startFlash(); return; }
  buildQueue();
  nextCard(); // fila vazia → nextCard emenda na prática sozinho
}
function startToneQuiz() {
  quizScore = { ok: 0, n: 0 };
  // rodada fechada, como o relâmpago: o placar é o resultado e nada disso mexe no SRS.
  // Quem escolhe o que dá pra perguntar é o podePerguntar, dentro do poolSessao.
  queue = shuffle(poolSessao().map(c => c.id));
  phase = 'quiz';
  if (queue.length) nextCard(); else finishSession();
}
function answerTone(t) {
  if (!current || quizAnswered) return;
  quizAnswered = true;
  const correct = toneOf(current.pinyin);
  // de memória e de ouvido são habilidades diferentes e erram em lugares diferentes,
  // então cada uma tem seu contador — e o par (certo → marcado) vai junto
  bumpHab(current.id, modoKey() === 'tons' ? 'tomO' : 'tomM', t !== correct);
  if (t !== correct) bumpTomX(current.id, correct, t);
  // no quiz puro não vem um grade() depois pra sincronizar esta carta
  if (!mixOn()) syncPush(current.id);
  if (!mixOn()) { quizScore.n++; if (t === correct) quizScore.ok++; }
  $('tones').querySelectorAll('button').forEach(bt => {
    const bt_t = parseInt(bt.dataset.t, 10);
    if (bt_t === correct) bt.classList.add('hit');
    else if (bt_t === t) bt.classList.add('miss');
  });
  $('quizfb').innerHTML = pinyinColored(current.pinyin) + ' · ' + esc(current.pt) +
    '<small>' + esc(TONE_NAMES[correct]) + '</small>';
  $('quizfb').style.display = '';
  ajustaAltura(); // o gabarito do tom entrou na frente
  speak(current, true); // ouve de novo já sabendo a resposta
  // No quiz puro a rodada é fechada e o botão só avança. No aleatório a carta é uma
  // revisão como as outras: a resposta sugere um botão, mas quem decide é você — igual
  // ao desenho e ao teclado, e é assim que o tom entra na meta e no agendamento.
  if (mixOn()) {
    $('grades').classList.add('show');
    $('g-' + (t === correct ? 'good' : 'again')).classList.add('sugerido');
  } else {
    $('nextbtn').classList.add('show');
  }
  renderCounter();
}
// ── diálogo: a conversa inteira ─────────────────────────────
// Os outros modos perguntam de UMA frase, solta. Conversa não é isso: o que faz
// 我很好，你呢 ser a resposta certa é a pergunta que veio antes — e nenhum campo da carta
// sabe disso. Então o roteiro mora fora do deck, no seed/dialogos.json: a lista dos ids
// das frases que JÁ existem, na ordem em que são ditas, e quem diz cada uma.
//
//   outro = o app fala e mostra o 汉字; a tradução só aparece se você pedir
//   voce  = a dica em português, e você escreve a frase no teclado de mandarim
//
// Isso mantém a regra de sempre: conteúdo novo entra pelo seed_cards.json, e o diálogo
// só REORDENA o que já está lá. Roteiro que tem uma frase que você não tem (ou que você
// desligou) não aparece: meia conversa não é conversa, e completar o buraco com uma
// frase parecida ensinaria a conversa errada.
//
// A rodada é fechada, como o quiz de tons e o relâmpago: conta o que a máquina viu
// (acertou ou não a frase) e NÃO mexe no agendamento. Quem manda no SRS é a ordem do
// SRS, não a ordem do roteiro — reagendar 我很好 porque ela calhou de ser a terceira
// fala de um diálogo bagunçaria a fila de quem estuda pelas revisões.
function cardDaFala(f) { return f ? cards.find(c => c.id === f.card) : null; }
function dialogoPronto(d) {
  return Array.isArray(d.falas) && d.falas.length > 0 &&
    d.falas.every(f => { const c = cardDaFala(f); return c && ehFrase(c) && !foraDaRotacao(c); });
}
// O tema fatia os diálogos pelo tema DO ROTEIRO (uma conversa no café atravessa comida e
// estados, e não é a soma dos temas das falas que diz do que ela é). Os outros dois eixos
// ficam de fora: 📖 é o capítulo de cada frase, e ❌ é o seu erro em cada uma — nenhum
// dos dois recorta uma conversa sem parti-la no meio. O contador diz isso na tela, pra
// ninguém ficar procurando o filtro que não pegou.
function dialogosDisponiveis() {
  const list = dialogos.filter(dialogoPronto);
  return settings.decks.length ? list.filter(d => settings.decks.includes(d.deck)) : list;
}
function startDialogo() {
  dialScore = { ok: 0, n: 0 };
  queue = shuffle(dialogosDisponiveis().map(d => d.id));
  phase = 'dialogo';
  abreDialogo();
}
function abreDialogo() {
  if (!queue.length) { finishSession(); return; }
  dialAtual = dialogos.find(d => d.id === queue[0]) || null;
  if (!dialAtual) { queue.shift(); abreDialogo(); return; }
  dialFala = 0; dialResult = null; dialRevelado = false; dialFeito = [];
  palcoDialogo();
  renderDialogo();
  falaDaVez(); // a primeira fala do outro já entra falando
}
// A conversa não é uma carta: não tem frente e verso pra virar, e o que já foi dito
// precisa continuar na tela. Então o palco troca a carta pelo diálogo inteiro, e some
// com tudo que pertence à carta (as três notas, os tons, o "desligar esta carta").
function palcoDialogo() {
  $('stage').style.display = '';
  $('fcard').style.display = 'none';
  $('dialwrap').classList.add('show');
  $('done').classList.remove('show');
  $('grades').classList.remove('show');
  $('tones').classList.remove('show');
  $('drawtools').classList.remove('show');
  $('nextbtn').classList.remove('show');
  $('offbtn').style.display = 'none';
}
function falaDaVez() {
  const f = dialAtual && dialAtual.falas[dialFala];
  const c = cardDaFala(f);
  // a fala do outro toca sozinha: sem o som o exercício vira leitura, e metade do que a
  // conversa treina é reconhecer a frase de ouvido
  if (f && c && f.quem === 'outro') speak(c, true);
}
function bolhaDialogo(f, c, res) {
  const sua = f.quem === 'voce';
  const marca = res && res.ok != null ? '<span class="marca">' + (res.ok ? '✅' : '❌') + '</span>' : '';
  return '<div class="dialbolha ' + (sua ? 'voce' : 'outro') + (res && res.ok === false ? ' errou' : '') + '">' +
    marca + '<div class="zhl zh" lang="zh-Hans">' + esc(c.hanzi) + '</div>' +
    '<div class="py">' + pinyinColored(c.pinyin) + '</div>' +
    '<div class="pt">' + esc(c.pt) + '</div></div>';
}
function renderDialogo() {
  const d = dialAtual;
  if (!d) return;
  $('dialtitulo').textContent = '💬 ' + d.titulo;
  $('dialcena').textContent = d.cena || '';
  $('dialhist').innerHTML = dialFeito
    .map(r => { const c = cardDaFala(r.fala); return c ? bolhaDialogo(r.fala, c, r) : ''; }).join('');
  const f = d.falas[dialFala];
  const t = $('dialturno');
  if (!f) { renderFimDoDialogo(); return; }
  const c = cardDaFala(f);
  if (!c) { proximaFala(); return; } // carta sumiu do deck no meio da conversa
  current = c; // é dela que o 🔊 e o 🐢 falam agora
  if (f.quem === 'outro') {
    t.innerHTML = '<div class="dialbolha outro atual">' +
      '<div class="zhl zh" lang="zh-Hans">' + esc(c.hanzi) + '</div>' +
      (dialRevelado ? '<div class="py">' + pinyinColored(c.pinyin) + '</div>' +
                      '<div class="pt">' + esc(c.pt) + '</div>' : '') +
      '</div>' +
      '<div class="dialrow">' +
      '<button class="typeskip" id="dial-ouvir">🔊 de novo</button>' +
      (dialRevelado ? '' : '<button class="typeskip" id="dial-revela">não entendi</button>') +
      '<button class="typeskip" id="dial-seguir">continuar →</button></div>';
  } else if (!dialResult) {
    // a dica é o que DIZER, não a tradução da frase: é ela que faz você escolher as
    // palavras. A tradução vem embaixo, menor, pra quem travou no meio do caminho.
    t.innerHTML = '<div class="dialdica">🗣️ sua vez — ' + esc(f.dica || c.pt) +
      (f.dica ? '<small>ao pé da letra: ' + esc(c.pt) + '</small>' : '') + '</div>' +
      '<div class="dialrow"><input class="typein" id="dialin" type="text" enterkeyhint="done" ' +
      'lang="zh-Hans" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" ' +
      'placeholder="escreva a frase"></div>' +
      '<div class="dialrow"><button class="typeskip" id="dial-check">conferir</button>' +
      '<button class="typeskip" id="dial-skip">não lembro</button></div>';
  } else {
    const alvo = limpaHanzi(c.hanzi);
    const dado = limpaHanzi(dialResult.escrito);
    t.innerHTML = '<div class="typefb frase ' + (dialResult.ok ? 'ok' : 'ruim') + '">' +
      '<div class="l"><span class="lbl">' + (dialResult.ok ? '对!' : 'era') + '</span></div>' +
      charDiff(alvo, dialResult.ok ? alvo : dado) +
      (!dialResult.ok && dado ? '<div class="l no"><span class="lbl">você</span></div>' +
        charDiff(dado, alvo) : '') +
      '<div class="py">' + pinyinColored(c.pinyin) + '</div></div>' +
      '<div class="dialrow"><button class="typeskip" id="dial-ouvir">🔊 ouvir a fala</button>' +
      '<button class="typeskip" id="dial-seguir">continuar →</button></div>';
  }
  ligaBotoesDialogo(c);
  renderCounter();
  rolaAteAVez();
}
// A conversa cresce pra baixo, e a vez de falar está sempre no fim dela: numa de quinze
// falas o campo de escrever nasce fora da tela, e sem isto a pessoa rolaria a página a
// cada turno pra achar onde responder. Só rola quando já existe histórico — no começo a
// conversa cabe inteira, e puxar a tela ali seria movimento sem motivo.
function rolaAteAVez() {
  if (!dialFeito.length) return;
  const t = $('dialturno');
  // sem `behavior: 'smooth'` de propósito: a animação depende de quadro pra rodar e não
  // sobrevive a duas falas seguidas (a segunda cancela a primeira no meio). Aqui o salto
  // é de um turno, e `end` deixa a fala anterior visível em cima — não desorienta.
  if (t && t.scrollIntoView) t.scrollIntoView({ block: 'end' });
}
function ligaBotoesDialogo(c) {
  const em = (id, fn) => { const b = $(id); if (b) b.onclick = (e) => { e.stopPropagation(); fn(); }; };
  em('dial-ouvir', () => speak(c));
  em('dial-revela', () => { dialRevelado = true; renderDialogo(); });
  em('dial-seguir', proximaFala);
  em('dial-check', confereDialogo);
  em('dial-skip', () => respondeDialogo(null));
  em('dial-prox', () => { abreDialogo(); });
  em('dial-repete', () => { queue.unshift(dialAtual.id); abreDialogo(); });
  em('dial-fim', finishSession);
  const inp = $('dialin');
  if (inp) inp.onkeydown = (e) => {
    if (e.key !== 'Enter' || e.isComposing) return; // Enter dentro do IME é dele, não nosso
    e.preventDefault();
    confereDialogo();
  };
}
function confereDialogo() {
  const inp = $('dialin');
  const v = inp ? inp.value.trim() : '';
  if (v) respondeDialogo(v);
}
function respondeDialogo(hanzi) {
  const f = dialAtual && dialAtual.falas[dialFala];
  const c = cardDaFala(f);
  if (!c || dialResult) return;
  // mesma régua do teclado: pontuação e espaço não são a pergunta
  const ok = !!limpaHanzi(hanzi) && limpaHanzi(hanzi) === limpaHanzi(c.hanzi);
  dialResult = { ok: ok, escrito: hanzi || '' };
  dialScore.n++;
  if (ok) dialScore.ok++;
  bumpHab(c.id, 'frase', !ok);
  syncPush(c.id); // a rodada não passa pelo grade(), então o push é por conta própria
  renderDialogo();
  speak(c, true); // ouvir a fala certa é o fecho do turno, mesmo tendo errado
}
function proximaFala() {
  const f = dialAtual && dialAtual.falas[dialFala];
  if (f) dialFeito.push({ fala: f, ok: dialResult ? dialResult.ok : null });
  dialFala++;
  dialResult = null;
  dialRevelado = false;
  renderDialogo();
  falaDaVez();
}
function renderFimDoDialogo() {
  queue.shift(); // este acabou; o que sobrou na fila é o que ainda dá pra conversar
  const suas = dialFeito.filter(r => r.ok != null);
  const acertos = suas.filter(r => r.ok).length;
  $('dialturno').innerHTML = '<div class="dialfim">🎉 <b>' + esc(dialAtual.titulo) +
    '</b> — conversa inteira. Suas falas: ' + acertos + ' de ' + suas.length + ' certas.</div>' +
    '<div class="dialrow">' +
    '<button class="typeskip" id="dial-repete">repetir esta</button>' +
    (queue.length ? '<button class="typeskip" id="dial-prox">próxima conversa →</button>'
                  : '<button class="typeskip" id="dial-fim">terminar</button>') + '</div>';
  ligaBotoesDialogo(cardDaFala(dialAtual.falas[dialAtual.falas.length - 1]));
  renderCounter();
  rolaAteAVez(); // o placar também nasce no fim de uma tela e meia de conversa
}

// ── relâmpago ───────────────────────────────────────────────
// Duas etapas por carta, cada uma com seu relógio:
//   1. exposição — a carta aparece pelo tempo escolhido e some
//   2. pergunta  — a explicação entra e você diz se acertou ou não, dentro do tempo
// Quem pontua é a etapa 2. Não grava SRS nem conta pra meta: é auto-avaliação rápida,
// serve pra saber se está indo bem ou mal, não pra remexer no agendamento.
function clearFlash() {
  clearTimeout(flashTimer);
  flashTimer = null;
  flashState = 'off';
  flashRestante = 0;
  $('flashrow').classList.remove('show');
  $('flashbar').className = 'flashbar';
  $('flashask').classList.remove('show');
  $('flashtag').style.display = 'none';
}
function startFlash() {
  flashScore = { ok: 0, n: 0, semResposta: 0, total: activePool().length };
  clearFlash();
  flashPausa = false;
  queue = shuffle(activePool().map(c => c.id));
  phase = 'flash';
  if (queue.length) nextCard(); else finishSession();
}
function escalaAtual() { // quanto da barra ainda está cheio, no meio da animação
  const m = new DOMMatrixReadOnly(getComputedStyle($('flashfill')).transform);
  return Math.max(0, Math.min(1, m.a));
}
function correBarra(ms, de) { // anima a barra de `de` (0–1) até vazia, em ms
  const fill = $('flashfill');
  fill.style.transition = 'none';
  fill.style.transform = 'scaleX(' + de + ')';
  void fill.getBoundingClientRect(); // reflow: sem isso o navegador junta as duas mudanças
  fill.style.transition = 'transform ' + ms + 'ms linear';
  fill.style.transform = 'scaleX(0)';
}
function runFlashClock() { // etapa 1: exposição
  $('flashrow').classList.add('show');
  $('flashbar').className = 'flashbar';
  $('flashask').classList.remove('show');
  flashState = 'correndo';
  flashRestante = settings.flashMs;
  if (flashPausa) { congelaBarra(1); return; } // entrou pausado: barra cheia, esperando
  flashInicio = performance.now();
  correBarra(settings.flashMs, 1);
  flashTimer = setTimeout(revealFlash, settings.flashMs);
}
function congelaBarra(escala) {
  const fill = $('flashfill');
  fill.style.transition = 'none';
  fill.style.transform = 'scaleX(' + escala + ')';
}
function revealFlash() { // etapa 2: a explicação entra e pergunta
  if (flashState !== 'correndo') return;
  clearTimeout(flashTimer); flashTimer = null;
  flashState = 'perguntando';
  flashRestante = FLASH_RESP_MS;

  $('fcard').classList.add('flipped');
  const tag = $('flashtag');
  tag.className = 'flashtag ask';
  tag.textContent = 'você acertou?';
  tag.style.display = '';
  $('flashask').classList.add('show');
  $('flashbar').className = 'flashbar asking'; // outra cor: agora o relógio é o da resposta
  if (settings.autoSpeak) speak(current, true);
  renderCounter();

  if (flashPausa) { congelaBarra(1); return; }
  flashInicio = performance.now();
  correBarra(FLASH_RESP_MS, 1);
  flashTimer = setTimeout(() => responder(null), FLASH_RESP_MS);
}
// acertou = true | false | null (deixou o tempo acabar sem dizer)
function responder(acertou) {
  if (flashState !== 'perguntando') return;
  clearTimeout(flashTimer); flashTimer = null;
  flashScore.n++;
  if (acertou === true) flashScore.ok++;
  else if (acertou === null) flashScore.semResposta++; // não respondeu conta como errou
  clearFlash();
  queue.shift();
  nextCard();
}

// ── pausa ───────────────────────────────────────────────────
// Vale nas duas etapas: pausar só a exposição deixaria a pergunta expirando sozinha
// bem quando você quis parar pra ler a explicação com calma.
function togglePausa() {
  if (phase !== 'flash' || flashState === 'off') return;
  flashPausa ? despausar() : pausar();
  renderPausa();
}
function duracaoEtapa() { return flashState === 'perguntando' ? FLASH_RESP_MS : settings.flashMs; }
function pausar() {
  flashPausa = true;
  flashRestante = Math.max(0, duracaoEtapa() - (performance.now() - flashInicio));
  congelaBarra(escalaAtual());
  clearTimeout(flashTimer); flashTimer = null;
}
function despausar() {
  flashPausa = false;
  flashInicio = performance.now() - (duracaoEtapa() - flashRestante);
  correBarra(flashRestante, escalaAtual());
  flashTimer = setTimeout(flashState === 'perguntando' ? () => responder(null) : revealFlash, flashRestante);
}
function renderPausa() {
  const b = $('flashpause');
  b.textContent = flashPausa ? '▶' : '⏸';
  b.title = flashPausa ? 'Continuar' : 'Pausar';
  b.classList.toggle('paused', flashPausa);
}

// Sair da aba ou bloquear o celular não pode deixar o relógio correndo: a rodada inteira
// passaria sozinha no bolso. Congela ao sair e retoma a mesma carta ao voltar.
let flashSuspenso = null;
function pauseFlash() {
  if (phase !== 'flash' || flashState === 'off') return;
  flashSuspenso = flashState;
  clearFlash();
}
function resumeFlash() {
  if (!flashSuspenso || !$('view-estudar').classList.contains('active')) return;
  flashSuspenso = null;
  // desligou a carta enquanto estava fora → pula; senão a carta recomeça da exposição,
  // que é mais justo do que cobrar a resposta de uma explicação que ele não viu
  if (!current || foraDaRotacao(current)) { queue.shift(); nextCard(); }
  else showCard(current);
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
  // "reconhecer" só é medível no modo que revela tudo de uma vez. Nos outros, responder
  // já é outra coisa — digitar, desenhar, marcar o tom — e a nota mediria aquilo. Aqui o
  // botão É a medida, porque não existe resultado objetivo: "Difícil" é acerto, você
  // lembrou. Sem isso a taxa de "rec" não seria comparável com a dos outros cinco.
  if (modoKey() === 'zh_all' && !flashOn()) bumpHab(current.id, 'rec', g === 'again');
  // A ⭐ favorita puxada antes do dia é prática, não revisão: acertá-la todo dia jogaria
  // o intervalo pra meses e ela sumiria do agendado justo por ser a que você mais treina.
  if (phase === 'sched' && favAdiantadas.has(current.id) && g !== 'again') {
    syncPush(current.id);
  } else if (phase === 'sched') {
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
  const m = modo();
  const f = $('fcard');
  if (flashOn()) {
    // já reconheceu antes do tempo? o toque adianta a explicação — quem pontua são os
    // botões da etapa 2, então adiantar não dá nem tira ponto de ninguém
    if (!flashPausa && flashState === 'correndo') revealFlash();
    return;
  }
  // Desenho e teclado: antes de responder, tocar não faz nada — virar a carta entregaria
  // justamente o que se está tentando lembrar. Depois de responder, vira normalmente.
  if (m.draw || m.type) {
    if (m.draw ? !drawScore : !typeResult) return;
    if (f.classList.contains('flipped')) { f.classList.remove('flipped'); renderBackHanzi(current); }
    else { f.classList.add('flipped'); setTimeout(animateBackStrokes, 300); }
    return;
  }
  if (f.classList.contains('flipped')) { // desvirar
    f.classList.remove('flipped');
    $('grades').classList.remove('show');
    $('nextbtn').classList.remove('show');
    renderBackHanzi(current); // reseta o traçado pro próximo flip
    return;
  }
  // no quiz de ouvido tocar repete o som; no de ideograma o som é a resposta, então cala
  if (m.quiz) { if (m.front === 'audio') speak(current, true); return; }
  f.classList.add('flipped');
  setTimeout(animateBackStrokes, 300); // começa a desenhar quando a virada tá terminando
  if (settings.autoSpeak) speak(current, true);
  $('grades').classList.add('show');
}
