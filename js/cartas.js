/* Mànmàn — A tela Cartas (consulta) e a Grade. */
'use strict';

// ── UI: cartas (consulta) ───────────────────────────────────
function renderCartasChips() {
  const porOrigem = cartasFiltro === 'origem';
  // sem frase publicada a linha inteira some, igual à do estudar: um botão que só abre
  // lista vazia é pior que botão nenhum
  const tem = temFrases();
  $('cartas-tipotype').style.display = tem ? '' : 'none';
  if (!tem) cartasTipo = 'palavra';
  $('cartas-tipotype').querySelectorAll('button').forEach(b =>
    b.classList.toggle('active', b.dataset.tp === cartasTipo));

  $('cartas-filtertype').querySelectorAll('button').forEach(b =>
    b.classList.toggle('active', (b.dataset.f === 'origem') === porOrigem));

  // tudo daqui pra baixo vive DENTRO do tipo escolhido: os temas, as origens, a contagem
  // de desligadas. Tema que só existe em frase não vira chip na lista de palavras.
  const base = cartasBase();
  // conta quem está FORA da rotação, não só quem tem o interruptor desligado: a frase
  // que carrega palavra desligada também não vai cair no estudo, e escondê-la aqui
  // deixaria o usuário procurando por que a frase sumiu.
  const nOff = base.filter(c => foraDaRotacao(c)).length;
  const opcoes = porOrigem ? opcoesOrigem(base) : ['todos'].concat([...new Set(base.map(c => c.deck))]);
  if (!opcoes.includes(cartasDeck) && cartasDeck !== '__off__') cartasDeck = opcoes[0];
  let html = opcoes.map(o =>
    '<button class="chip' + (cartasDeck === o ? ' active' : '') + '" data-d="' + esc(o) + '">' +
    (porOrigem ? esc(origemLabel(o)) : o === 'todos' ? 'Todas' : esc(deckLabel(o))) + '</button>').join('');
  if (nOff > 0 || cartasDeck === '__off__') {
    html += '<button class="chip' + (cartasDeck === '__off__' ? ' active' : '') + '" data-d="__off__">🚫 Desligadas (' + nOff + ')</button>';
  }
  $('cartas-chips').innerHTML = html;
  $('cartas-chips').querySelectorAll('.chip').forEach(ch => ch.onclick = () => {
    cartasDeck = ch.dataset.d;
    renderCartasChips(); renderList();
  });
}
// o tipo que a aba está listando — é a base de tudo o que ela mostra e conta
function cartasBase() { return cards.filter(c => ehFrase(c) === (cartasTipo === 'frase')); }
// as cartas que o filtro da aba Cartas está mostrando, ignorando a busca por texto
function cartasFiltradas() {
  const base = cartasBase();
  if (cartasDeck === '__off__') return base.filter(c => foraDaRotacao(c));
  if (cartasFiltro === 'origem') {
    return cartasDeck === 'todas' ? base : base.filter(c => origemDe(c) === cartasDeck);
  }
  return cartasDeck === 'todos' ? base : base.filter(c => c.deck === cartasDeck);
}
// botão de ligar/desligar em bloco — só aparece com um filtro específico escolhido,
// porque "desligar todas" com o filtro em Todas é um tiro no pé sem querer
function renderBulk() {
  const grupo = cartasFiltradas();
  const generico = cartasDeck === 'todos' || cartasDeck === 'todas' || cartasDeck === '__off__';
  if (generico || !grupo.length) { $('bulkbar').innerHTML = ''; return; }
  const ligadas = grupo.filter(c => !isOff(c.id)).length;
  const desligar = ligadas > 0;
  const rotulo = cartasFiltro === 'origem' ? origemLabel(cartasDeck) : deckLabel(cartasDeck);
  $('bulkbar').innerHTML = '<button class="bulkbtn' + (desligar ? '' : ' on') + '" id="bulkbtn">' +
    (desligar ? '🚫 Desligar as ' + ligadas + ' de ' + esc(rotulo)
      : '↩︎ Religar as ' + grupo.length + ' de ' + esc(rotulo)) + '</button>';
  $('bulkbtn').onclick = () => {
    if (desligar && !confirm('Tirar da rotação as ' + ligadas + ' cartas de ' + rotulo +
      '? Elas somem do estudo até você religar. O progresso delas fica guardado.')) return;
    grupo.forEach(c => { if (isOff(c.id) === desligar) setOff(c.id, desligar); });
    renderCartasChips(); renderList(); renderGrade(); startSession();
  };
}
// uma linha da lista — separada pra servir tanto a lista corrida quanto os grupos
function cartaLinha(c) {
  // a frase bloqueada por palavra desligada fica apagada como as desligadas, mas com o
  // interruptor ligado — porque ele é dela. A linha diz qual palavra a está segurando.
  const bloq = palavraDesligada(c);
  return '<div class="card' + (isOff(c.id) || bloq ? ' offrow' : '') + '"><div class="rowline">' +
    '<div class="h zh" lang="zh-Hans">' + esc(c.hanzi) + '</div>' +
    '<div class="mid"><div class="p">' + pinyinColored(c.pinyin) + '</div><div class="t">' + esc(c.pt) + '</div>' +
    (c.nota ? '<div class="n">' + esc(c.nota) + '</div>' : '') +
    (bloq ? '<div class="n">🚫 fora da rotação: ' + esc(bloq) + ' está desligada</div>' : '') + '</div>' +
    '<span class="pill">' + esc(deckLabel(c.deck)) + '</span>' +
    '<button class="fav-row' + (isFav(c.id) ? ' on' : '') + '" data-id="' + esc(c.id) + '" title="' +
      (isFav(c.id) ? 'Tirar das favoritas' : 'Favoritar: aparece em toda sessão, mesmo fora do filtro') +
      '" aria-pressed="' + isFav(c.id) + '">' + (isFav(c.id) ? '★' : '☆') + '</button>' +
    '<button class="spk-row" data-id="' + esc(c.id) + '" title="Ouvir">🔊</button>' +
    '<label class="switch" title="ativa / desligada"><input type="checkbox" class="offtgl" data-id="' + esc(c.id) + '"' +
    (isOff(c.id) ? '' : ' checked') + '><span class="knob"></span></label>' +
    '</div></div>';
}
// as seções da lista quando "agrupar por" está ligado. Independente do filtro de cima:
// agrupa o que quer que tenha sobrado dele. Grupo é ordenado (tema por rótulo, origem
// pela ordem dos capítulos); dentro dele a ordem é a do deck.
function cartasGrupos(list) {
  if (cartasGrupo === 'tema') {
    return [...new Set(list.map(c => c.deck))]
      .sort((a, b) => deckLabel(a).localeCompare(deckLabel(b), 'pt'))
      .map(d => ({ rot: deckLabel(d), cards: list.filter(c => c.deck === d) }));
  }
  if (cartasGrupo === 'origem') {
    return opcoesOrigem(list).filter(o => o !== 'todas')
      .map(o => ({ rot: origemLabel(o), cards: list.filter(c => origemDe(c) === o) }))
      .filter(g => g.cards.length);
  }
  return [{ rot: null, cards: list }];
}
const CARTAS_GRUPOS = [['nada', '⬜ Sem grupo'], ['tema', '🏷️ Tema'], ['origem', '📖 Origem']];
function renderCartasGrupobar() {
  $('cartas-grupobar').innerHTML = '<span class="rot">Agrupar</span>' + CARTAS_GRUPOS.map(([k, t]) =>
    '<button class="chip' + (cartasGrupo === k ? ' active' : '') + '" data-g="' + k + '">' +
    t + '</button>').join('');
  $('cartas-grupobar').querySelectorAll('.chip').forEach(ch => ch.onclick = () => {
    cartasGrupo = ch.dataset.g; renderList();
  });
}
function renderList() {
  const q = $('search').value.trim().toLowerCase();
  const list = cartasFiltradas().filter(c =>
    (!q ||
      (c.hanzi || '').toLowerCase().includes(q) ||
      (c.pinyin || '').toLowerCase().includes(q) ||
      (c.pt || '').toLowerCase().includes(q)));
  // conta o que está na tela; quando há filtro ou busca, mostra também o total do deck
  renderBulk();
  // o nome e o total seguem o TIPO na tela. Antes o rótulo era "cartas" assim que
  // entrava frase no deck, porque "palavras" mentiria sobre um total que somava as duas;
  // agora que a aba lista um tipo por vez, ela pode voltar a chamar cada coisa pelo nome.
  const base = cartasBase().length;
  const nome = cartasTipo === 'frase' ? 'frases' : 'palavras';
  $('cartas-count').innerHTML = list.length !== base
    ? '<b>' + list.length + '</b> de ' + base + ' ' + nome
    : '<b>' + base + '</b> ' + nome + ' no deck';
  $('cardlist').className = cartasTipo === 'frase' ? 'frases' : '';
  renderCartasGrupobar();
  const vazio = '<p style="color:var(--mut);text-align:center">Nenhuma ' +
      (cartasTipo === 'frase' ? 'frase' : 'palavra') + ' encontrada.</p>';
  $('cardlist').innerHTML = list.length ? cartasGrupos(list).map(g =>
    (g.rot ? '<h3 class="cartas-sec">' + esc(g.rot) + ' <span>' + g.cards.length + '</span></h3>' : '') +
    g.cards.map(cartaLinha).join('')).join('') : vazio;
  $('cardlist').querySelectorAll('.spk-row').forEach(bt => bt.onclick = () => {
    const c = cards.find(x => x.id === bt.dataset.id);
    if (c) speak(c);
  });
  $('cardlist').querySelectorAll('.fav-row').forEach(bt => bt.onclick = () => {
    setFav(bt.dataset.id, !isFav(bt.dataset.id));
    renderList();
    if (phase === 'sched' || phase === 'practice') renderCounter();
  });
  $('cardlist').querySelectorAll('.offtgl').forEach(t => t.onchange = () => {
    setOff(t.dataset.id, !t.checked);
    renderCartasChips(); renderList(); renderGrade();
    if (phase !== 'quiz') { // realinha a fila de estudo mantendo a carta atual na frente
      if (phase === 'sched') buildQueue(); else enterPractice();
      if (current && !foraDaRotacao(current)) {
        queue = queue.filter(x => x !== current.id);
        queue.unshift(current.id);
        renderCounter();
      } else {
        nextCard();
      }
    }
  });
}

// ── UI: grade (o deck inteiro numa tela só) ─────────────────
// A aba Cartas é o navegador do deck: um tipo por vez, um tema por vez, uma linha por
// carta, com interruptor e busca. Ótima pra achar UMA carta, cega pro conjunto.
// A grade é a visão de cima: as cartas todas juntas, sem escolher tema antes, pra
// enxergar a olho o que a lista só sabe contar — o que já está de pé, o que você erra,
// o que nunca abriu. Por isso ela não repete os filtros da Cartas: ela agrupa e ordena
// o deck inteiro, e o que ela pinta é o SEU estado, não o conteúdo da carta.
const GRADE_GRUPOS = [['tema', '🏷️ Tema'], ['origem', '📖 Origem'], ['tipo', '汉 Tipo'], ['meu', '✋ Meu arranjo'], ['nada', '⬜ Nada']];
const GRADE_ORDENS = [['erro', '🔥 Erros'], ['dominio', '🌱 Domínio'], ['pinyin', '🔤 Pinyin'], ['seed', '📋 Deck']];
// O terceiro eixo: cada chip ESCONDE uma classe de carta quando apagado. Todos nascem
// ligados — a Grade abre no deck inteiro, que é a razão dela existir, e tirar coisa da
// tela é o que você faz depois, de propósito. Esconder as 86 aprendidas é o caso que
// pediu isto: o que sobra é exatamente o que ainda falta.
// Carta que casa com MAIS DE UM chip apagado some do mesmo jeito (a frase aprendida sai
// com o 💬 e sai com o ✅) — some se QUALQUER um a pegar, que é como se lê "esconder".
const GRADE_MOSTRAR = [
  ['frases', '💬 Frases', c => ehFrase(c)],
  ['aprendidas', '✅ Aprendidas', c => aprendida(c.id)],
  ['novas', '🌱 Nunca vistas', c => !srs[c.id]],
  ['off', '🚫 Desligadas', c => foraDaRotacao(c)]
];
// Mora dentro do settings pro arranjo sobreviver ao recarregamento, que é o ponto de
// uma tela de consulta: você monta a vista uma vez e volta nela.
// ── Grade: o arranjo à mão ──────────────────────────────────
// Agrupar por tema, aula ou tipo responde perguntas que o deck já sabe responder. A
// pergunta que ele não sabe é "quais destas eu confundo uma com a outra" — books 书 e
// 书? 我 e 找? Isso não está em campo nenhum, está na sua cabeça, e a única forma de
// botar na tela é você arrastar uma pra perto da outra.
// Carta que você não arrastou fica no monte do fim; ela não some, só não foi arrumada.
function arranjoOn() { return gradeCfg().grupo === 'meu'; }
function salvaArranjo() { save(uk(K.arranjo), arranjo); }
function grupoDe(id) { return arranjo.grupos.find(g => g.ids.indexOf(id) >= 0) || null; }
function novoGrupo(nome) {
  const g = { id: 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    nome: nome || 'Monte ' + (arranjo.grupos.length + 1), ids: [] };
  arranjo.grupos.push(g);
  return g;
}
// Tira o id de onde ele estiver e põe no destino, na posição pedida. Um id só vive num
// monte — arrastar é MOVER, não copiar; a mesma carta em dois montes desfaria o sentido
// de "estas eu confundo".
function moveCarta(id, destino, antesDe) {
  arranjo.grupos.forEach(g => {
    const i = g.ids.indexOf(id);
    if (i >= 0) g.ids.splice(i, 1);
  });
  if (!destino) { salvaArranjo(); return; }  // destino nulo = volta pro monte do fim
  const alvo = antesDe != null ? destino.ids.indexOf(antesDe) : -1;
  if (alvo >= 0) destino.ids.splice(alvo, 0, id); else destino.ids.push(id);
  salvaArranjo();
}
// Os montes do arranjo + o resto, na ordem escolhida no eixo Ordenar. Dentro de um monte
// SEU a ordem é a que você arrastou — ordenar por erro ali desfaria o arranjo a cada
// revisão, que é o oposto de arrumar.
function gradeMeusGrupos(list) {
  const dentro = new Set();
  const porId = {};
  list.forEach(c => { porId[c.id] = c; });
  const out = arranjo.grupos.map(g => {
    const cards = g.ids.map(id => { dentro.add(id); return porId[id]; }).filter(Boolean);
    return { rot: g.nome, grupo: g, cards };
  });
  out.push({ rot: 'Sem monte', grupo: null, sem: true, cards: list.filter(c => !dentro.has(c.id)) });
  return out;
}
// ── Grade: arrastar com o dedo ──────────────────────────────
// Sem a API de drag-and-drop do HTML: ela não existe em toque, e o app vive no celular.
// Isto é pointer event na mão, que serve o mouse e o dedo com o mesmo par de handlers.
// No dedo o arrasto só começa depois de ~230ms PARADO. Sem essa espera não sobraria
// como rolar uma tela de 300 cartas — o dedo que desliza é rolagem, o dedo que espera é
// arrasto, e é a única forma de os dois caberem no mesmo gesto inicial.
const DRAG_ESPERA = 230;         // ms parado até virar arrasto, no toque
const DRAG_FOLGA = 10;           // px que ainda contam como "parado"
let dragId = null, dragEl = null, dragGhost = null, dragTimer = null;
let dragX = 0, dragY = 0, dragOff = null, dragAtivo = false;
let dragScroll = null, dragAlvo = null, dragAntes = null, dragMexeu = false, dragTipo = '';

function bindArranjo() {
  const wrap = $('gradewrap');
  wrap.onpointerdown = arrDown;
  wrap.querySelectorAll('[data-ren]').forEach(b => b.onclick = () => {
    const g = arranjo.grupos.find(x => x.id === b.dataset.ren);
    const nome = prompt('Nome do monte:', g.nome);
    if (nome && nome.trim()) { g.nome = nome.trim().slice(0, 30); salvaArranjo(); renderGrade(); }
  });
  wrap.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
    const g = arranjo.grupos.find(x => x.id === b.dataset.del);
    // as cartas não somem com o monte: voltam pro "Sem monte" e continuam no deck.
    // Por isso o aviso é leve — desfazer um monte não perde nada além do arranjo dele.
    if (g.ids.length && !confirm('Desfazer "' + g.nome + '"? As ' + g.ids.length +
      ' cartas voltam pro Sem monte.')) return;
    arranjo.grupos = arranjo.grupos.filter(x => x.id !== g.id);
    salvaArranjo(); renderGrade();
  });
  const novo = $('gnovo');
  if (novo) novo.onclick = () => { novoGrupo(); salvaArranjo(); renderGrade(); };
}
function arrDown(e) {
  const el = e.target.closest('.gcard');
  if (!el || e.button > 0) return;
  dragEl = el; dragId = el.dataset.id;
  dragX = e.clientX; dragY = e.clientY; dragAtivo = false; dragTipo = e.pointerType;
  // no mouse não há rolagem por arrasto pra desempatar, então não precisa da espera —
  // mas também não começa no clique parado, senão todo toque pra ouvir a carta piscaria
  // um fantasma. Ali quem manda é o primeiro pixel de movimento (ver arrMove).
  if (dragTipo !== 'mouse') dragTimer = setTimeout(arrComeca, DRAG_ESPERA);
  window.addEventListener('pointermove', arrMove, { passive: false });
  window.addEventListener('pointerup', arrUp);
  window.addEventListener('pointercancel', arrCancela);
}
function arrComeca() {
  if (!dragEl) return;
  dragAtivo = true;
  const r = dragEl.getBoundingClientRect();
  dragOff = { x: dragX - r.left, y: dragY - r.top };
  dragGhost = dragEl.cloneNode(true);
  dragGhost.classList.add('fantasma');
  dragGhost.style.width = r.width + 'px';
  dragGhost.style.height = r.height + 'px';
  document.body.appendChild(dragGhost);
  arrFantasma(dragX, dragY);
  dragEl.classList.add('saindo');
  // O touch-action:pan-y deixa o dedo rolar a página, e é o que faz a espera de 230ms
  // funcionar. Mas depois que o arrasto pegou, arrastar pra baixo rolaria a tela com o
  // fantasma junto. Um preventDefault no touchmove segura a rolagem do navegador — e só
  // pega porque o dedo ficou parado até aqui: gesto de rolagem já começado é tarde.
  // A rolagem do arrasto passa a ser a do arrRola, na borda da tela.
  document.addEventListener('touchmove', arrSemRolar, { passive: false });
  if (navigator.vibrate) navigator.vibrate(12); // o único aviso de que o arrasto pegou
}
function arrSemRolar(e) { if (dragAtivo) e.preventDefault(); }
function arrFantasma(x, y) {
  dragGhost.style.left = (x - dragOff.x) + 'px';
  dragGhost.style.top = (y - dragOff.y) + 'px';
}
function arrMove(e) {
  if (!dragEl) return;
  if (!dragAtivo) {
    const longe = Math.abs(e.clientX - dragX) > (dragTipo === 'mouse' ? 4 : DRAG_FOLGA) ||
      Math.abs(e.clientY - dragY) > (dragTipo === 'mouse' ? 4 : DRAG_FOLGA);
    if (!longe) return;
    // no mouse, sair do lugar É o arrasto; no dedo, é a rolagem que o timer ia atrapalhar
    if (dragTipo === 'mouse') { arrComeca(); dragMexeu = true; } else arrTermina();
    return;
  }
  e.preventDefault();
  dragMexeu = true;
  arrFantasma(e.clientX, e.clientY);
  arrMarca(e.clientX, e.clientY);
  arrRola(e.clientY);
}
// Onde a carta vai cair. O fantasma tem pointer-events:none, então o elementFromPoint
// enxerga o que está embaixo dele e não ele mesmo.
function arrMarca(x, y) {
  arrLimpa();
  const sob = document.elementFromPoint(x, y);
  const grupo = sob && sob.closest('.gradegrupo');
  if (!grupo) { dragAlvo = null; return; }
  dragAlvo = grupo;
  grupo.classList.add('alvo');
  dragAntes = null;
  const carta = sob.closest('.gcard');
  if (carta && carta !== dragEl) {
    // metade esquerda entra ANTES dela; metade direita, antes da próxima — que é o
    // mesmo que "depois desta", e não precisa de um segundo caso
    const r = carta.getBoundingClientRect();
    const prox = carta.nextElementSibling;
    dragAntes = x < r.left + r.width / 2 ? carta.dataset.id
      : prox && prox.classList.contains('gcard') ? prox.dataset.id : null;
    carta.classList.add(x < r.left + r.width / 2 ? 'antes' : 'depois');
  }
}
function arrLimpa() {
  document.querySelectorAll('.gradegrupo.alvo').forEach(el => el.classList.remove('alvo'));
  document.querySelectorAll('.gcard.antes,.gcard.depois').forEach(el =>
    el.classList.remove('antes', 'depois'));
}
// arrastar até a borda rola a tela: com 300 cartas o monte de destino quase nunca está
// na mesma tela que a carta que você pegou
function arrRola(y) {
  const zona = 90;
  const v = y < zona ? -(zona - y) / 4
    : y > window.innerHeight - zona ? (y - (window.innerHeight - zona)) / 4 : 0;
  if (!v) { arrParaRolagem(); return; }
  if (dragScroll) { dragScroll.v = v; return; }
  dragScroll = { v, t: setInterval(() => window.scrollBy(0, dragScroll.v), 16) };
}
function arrParaRolagem() { if (dragScroll) { clearInterval(dragScroll.t); dragScroll = null; } }
function arrUp() {
  const solto = dragAtivo && dragAlvo;
  const id = dragId, alvo = dragAlvo, antes = dragAntes;
  arrTermina();
  if (!solto) return;
  // monte sem data-g é o "Sem monte": destino nulo tira a carta de todos os montes,
  // que é exatamente o que "tirei do arranjo" quer dizer
  const destino = alvo.dataset.g ? arranjo.grupos.find(g => g.id === alvo.dataset.g) : null;
  moveCarta(id, destino, antes);
  renderGrade();
}
function arrCancela() { arrTermina(); }
function arrTermina() {
  clearTimeout(dragTimer); dragTimer = null;
  window.removeEventListener('pointermove', arrMove);
  window.removeEventListener('pointerup', arrUp);
  window.removeEventListener('pointercancel', arrCancela);
  document.removeEventListener('touchmove', arrSemRolar, { passive: false });
  if (dragGhost) { dragGhost.remove(); dragGhost = null; }
  if (dragEl) dragEl.classList.remove('saindo');
  arrLimpa(); arrParaRolagem();
  dragEl = null; dragId = null; dragAlvo = null; dragAntes = null; dragAtivo = false;
  // o pointerup vira um click logo em seguida, e sem isto soltar a carta também a faria
  // falar. Volta a valer no próximo tique, pra que o toque seco continue tocando o som.
  if (dragMexeu) { dragMexeu = false; dragClick = true; setTimeout(() => { dragClick = false; }, 0); }
}
let dragClick = false;

// O rótulo de cada degrau da escala, derivado do próprio ERRO_FAIXAS: mexer nas faixas
// do filtro 🔥 reescreve estes chips sozinho, em vez de deixar dois números divergindo.
function faixaRot(t) {
  if (t === 0) return 'sem tropeço';
  const de = ERRO_FAIXAS[t - 1];
  const ate = ERRO_FAIXAS[t] ? ERRO_FAIXAS[t] - 1 : null;
  return ate === null ? de + '+' : de === ate ? String(de) : de + '–' + ate;
}
const GRADE_FAIXAS = [0, 1, 2, 3, 4];
function gradeCfg() {
  const g = settings.grade || (settings.grade = {});
  if (g.grupo === 'aula') g.grupo = 'origem'; // renomeado quando o filtro virou 'origem'
  if (!GRADE_GRUPOS.some(([k]) => k === g.grupo)) g.grupo = 'tema';
  if (!GRADE_ORDENS.some(([k]) => k === g.ordem)) g.ordem = 'erro';
  // o 💬 solto virou um chip do Mostrar: quem já tinha desligado as frases não vê elas
  // voltarem sozinhas depois da atualização
  if (!g.mostrar) {
    g.mostrar = {};
    GRADE_MOSTRAR.forEach(([k]) => { g.mostrar[k] = g.frases === false && k === 'frases' ? false : true; });
  }
  GRADE_MOSTRAR.forEach(([k]) => { if (g.mostrar[k] === undefined) g.mostrar[k] = true; });
  // um liga/desliga por degrau da escala de vermelho — "quero ver só as que eu sou
  // muito ruim" é apagar os degraus claros
  if (!Array.isArray(g.faixas) || g.faixas.length !== GRADE_FAIXAS.length) {
    g.faixas = GRADE_FAIXAS.map(() => true);
  }
  if (g.radical && !RADICAL_PT[g.radical]) g.radical = null; // radical que saiu da lista
  if (!['pintar', 'agrupar', 'so'].includes(g.radModo)) g.radModo = 'pintar';
  // tamanho do cartão: null = deixa o CSS decidir (76 no celular, 96 no PC); número =
  // escolha do usuário, que vale nos dois. Clampado pra não sumir nem virar pôster.
  if (g.tam != null && (typeof g.tam !== 'number' || g.tam < GTAM_MIN || g.tam > GTAM_MAX)) {
    g.tam = null;
  }
  g.sig = !!g.sig; // mostrar o significado embaixo do pinyin
  delete g.frases;
  return g;
}
const GTAM_MIN = 56, GTAM_MAX = 168, GTAM_PASSO = 16, GTAM_BASE = 96;
const RAD_MODOS = [['pintar', '🖌️ Pintar'], ['agrupar', '📑 Agrupar'], ['so', '🔎 Só essas']];
// os dois montes do modo Agrupar: com o radical em cima, sem embaixo. Substitui o eixo
// Agrupar enquanto o radical está ligado — aninhar "tema dentro de com-氵" viraria
// sub-sub-grupo e poluiria a tela.
function gradeRadicalGrupos(list, rad) {
  const com = list.filter(c => temRadical(c, rad));
  const sem = list.filter(c => !temRadical(c, rad));
  const out = [];
  if (com.length) out.push({ rot: rad + ' ' + (RADICAL_PT[rad] || ''), cards: com });
  if (sem.length) out.push({ rot: 'sem ' + rad, cards: sem });
  return out;
}
// os traços do caractere `ch` que pertencem ao radical `rad` (vazio se não tem)
function tracosDoRadical(ch, rad) {
  const r = radicalsDB[ch];
  return (r && r[rad]) || [];
}
// a carta contém o radical? (qualquer um dos seus caracteres)
function temRadical(c, rad) {
  return [...limpaHanzi(c.hanzi)].some(ch => tracosDoRadical(ch, rad).length);
}
// os radicais rotulados que aparecem em ≥2 cartas da lista dada — o seletor só oferece
// o que tem relação pra mostrar. Cada um vem com a contagem, que é o que o chip exibe.
function radicaisDisponiveis(list) {
  return RADICAIS.map(([rad, pt]) => {
    const n = list.filter(c => temRadical(c, rad)).length;
    return { rad, pt, n };
  }).filter(r => r.n >= 2);
}
// O pictograma desenhado a pincel (mesma técnica do traçado animado, parada), com os
// traços do radical em azul e o resto na cor do texto. É a única forma de pintar UM
// pedaço do caractere: a fonte pinta o glifo inteiro de uma cor só.
function radicalSvg(ch, rad, size) {
  const d = strokesDB[ch];
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 1024 1024');
  svg.setAttribute('width', size); svg.setAttribute('height', size);
  const g = document.createElementNS(NS, 'g');
  g.setAttribute('transform', 'scale(1,-1) translate(0,-900)');
  svg.appendChild(g);
  const azuis = new Set(tracosDoRadical(ch, rad));
  d.s.forEach((p, i) => {
    const id = 'rk' + (++svgUid);
    const clip = document.createElementNS(NS, 'clipPath');
    clip.setAttribute('id', id);
    const cp = document.createElementNS(NS, 'path');
    cp.setAttribute('d', p);
    clip.appendChild(cp);
    g.appendChild(clip);
    const m = d.m[i];
    const line = document.createElementNS(NS, 'path');
    line.setAttribute('d', 'M' + m.map(pt => pt[0] + ' ' + pt[1]).join(' L'));
    line.setAttribute('clip-path', 'url(#' + id + ')');
    line.setAttribute('fill', 'none');
    line.setAttribute('stroke', azuis.has(i) ? 'var(--rad)' : 'currentColor');
    line.setAttribute('stroke-width', '180');
    line.setAttribute('stroke-linecap', 'round');
    g.appendChild(line);
  });
  return svg;
}
// troca o hanzi de fonte pela versão SVG com o radical pintado, nas cartas que o têm.
// Feito depois do innerHTML, e não dentro do gradeTile, porque SVG é DOM, não string —
// montar à mão o clipPath de cada traço em texto seria ilegível.
function pintaRadical(rad) {
  $('gradewrap').querySelectorAll('.gcard.radhit').forEach(card => {
    const c = cards.find(x => x.id === card.dataset.id);
    if (!c) return;
    const gh = card.querySelector('.gh');
    const chars = [...limpaHanzi(c.hanzi)].filter(ch => strokesDB[ch]);
    if (!chars.length) return;
    const size = ehFrase(c) ? 30 : chars.length > 2 ? 26 : chars.length > 1 ? 34 : 42;
    gh.textContent = '';
    chars.forEach(ch => gh.appendChild(radicalSvg(ch, rad, size)));
  });
}
// Quanto da carta já está de pé: 0 = nunca vista, 1 = aprendida. A régua é o mesmo
// LEARNED_IVL do Progresso, pra que "aprendida" queira dizer a mesma coisa nas duas
// telas. Carta já vista mas de intervalo ainda zero não vale 0: tem um piso, senão
// ficaria indistinguível da que você nunca abriu — e essas duas pedem coisas diferentes.
function dominio(id) {
  const s = srs[id];
  if (!s || !s.reps) return 0;
  return Math.max(0.15, Math.min(1, (s.ivl || 0) / LEARNED_IVL));
}
// A força do vermelho, nas mesmas faixas do filtro 🔥 (1, 3, 5, 8). A já aprendida sai
// zerada pelo mesmo motivo que sai daquele filtro: o contador é histórico e não esquece,
// e 说 com 15 tropeços parar de ser vermelho é justamente o que se quer ver acontecer.
function erroTier(c) {
  if (aprendida(c.id)) return 0;
  const n = erroCount(c.id);
  for (let i = ERRO_FAIXAS.length - 1; i >= 0; i--) if (n >= ERRO_FAIXAS[i]) return i + 1;
  return 0;
}
// a aprendida vai pro FIM da ordem por erro, não pro meio junto das de zero: ela não
// está "sem tropeço nenhum", está fora da conta
function erroKey(c) { return aprendida(c.id) ? -1 : erroCount(c.id); }
function gradeOrdena(list) {
  const o = gradeCfg().ordem;
  const arr = list.slice(); // sort estável: o empate cai na ordem do deck, que é a do seed
  if (o === 'erro') return arr.sort((a, b) => erroKey(b) - erroKey(a));
  if (o === 'dominio') return arr.sort((a, b) => dominio(a.id) - dominio(b.id));
  if (o === 'pinyin') return arr.sort((a, b) =>
    (a.pinyin || '').localeCompare(b.pinyin || '', 'pt', { sensitivity: 'base' }));
  return arr;
}
// Ordena primeiro, agrupa depois — o filter é estável, então cada grupo herda a ordem
// escolhida. Grupo vazio não vira título: com as frases desligadas, "Frases" sumiria
// como cabeçalho de nada.
function gradeGrupos(list) {
  const g = gradeCfg().grupo;
  if (g === 'meu') return gradeMeusGrupos(list);
  if (g === 'nada') return [{ rot: '', cards: list }];
  if (g === 'tipo') {
    return TIPOS.map(t => ({ rot: TIPO_LABEL[t], cards: list.filter(c => ehFrase(c) === (t === 'frase')) }))
      .filter(x => x.cards.length);
  }
  if (g === 'origem') {
    return opcoesOrigem(list).filter(o => o !== 'todas')
      .map(o => ({ rot: origemLabel(o), cards: list.filter(c => origemDe(c) === o) }))
      .filter(x => x.cards.length);
  }
  return [...new Set(list.map(c => c.deck))]
    .sort((a, b) => deckLabel(a).localeCompare(deckLabel(b), 'pt'))
    .map(d => ({ rot: deckLabel(d), cards: list.filter(c => c.deck === d) }));
}
// O quadradinho: pictograma em cima, pinyin embaixo.
// UMA codificação só, e ela é do fundo: branco = tranquila, e vai ficando vermelho
// conforme você tropeça. Aprendida é fundo branco com borda verde — a carta saiu da
// escala, não é o primeiro degrau dela.
// Já teve uma segunda camada aqui, a opacidade do texto dizendo o quanto você sabe.
// Duas escalas no mesmo quadrado não se leem: você olhava e não sabia se aquele tom
// mais claro queria dizer "ainda não sei" ou "não erro". Uma escala e uma borda, que
// são coisas de natureza diferente, a tela inteira se lê de longe.
// Pinyin sem as cores de tom de propósito: em 76px, com fundo vermelho atrás, cinco
// cores de sílaba viram ruído em cima do código que esta tela existe pra mostrar.
function gradeTile(c) {
  const gc = gradeCfg();
  const rad = gc.radical;
  const tier = erroTier(c);
  const fora = foraDaRotacao(c);
  const erros = erroCount(c.id);
  const hit = rad && temRadical(c, rad);
  const tip = [c.pt,
    srs[c.id] ? Math.round(dominio(c.id) * 100) + '% de domínio' : 'nunca vista',
    erros ? erros + (erros > 1 ? ' tropeços' : ' tropeço') : null,
    fora ? '🚫 fora da rotação' : null].filter(Boolean).join(' · ');
  // 30px só cabe no pictograma solto: 汉堡肉 nesse tamanho quebra em duas linhas e
  // desalinha a fileira inteira. A palavra comprida encolhe a letra em vez de quebrar.
  const n = Math.min(4, limpaHanzi(c.hanzi).length || 1);
  // com radical ligado o vermelho do erro SAI: são duas perguntas diferentes (o que eu
  // erro / como o caractere é feito), e pintar as duas de uma vez é o problema das duas
  // escalas de novo. A carta acende (tem o radical) ou recua (não tem).
  return '<button class="gcard n' + n + (ehFrase(c) ? ' frase' : '') +
    (rad ? (hit ? ' radhit' : (gc.radModo === 'pintar' ? ' raddim' : '')) : (tier ? ' e' + tier : '')) +
    (aprendida(c.id) && !rad ? ' ok' : '') + (fora ? ' off' : '') +
    '" data-id="' + esc(c.id) + '" data-tip="' + esc(tip) + '">' +
    '<span class="gh zh" lang="zh-Hans">' + esc(c.hanzi) + '</span>' +
    '<span class="gp">' + esc(c.pinyin) + '</span>' +
    (gc.sig ? '<span class="gsig">' + esc(c.pt) + '</span>' : '') + '</button>';
}
// A frase ocupa a linha inteira, então intercalada com as palavras ela parte a grade:
// cada palavra sobra sozinha na sua fileira e o bloco de pictogramas, que é o que se veio
// ver, some. Dentro do grupo elas ficam depois, empilhadas.
function gradeCorpo(list, vazioVisivel) {
  const pal = list.filter(c => !ehFrase(c));
  const fr = list.filter(ehFrase);
  // monte recém-criado não tem carta nenhuma, e um monte de altura zero não dá onde
  // soltar — no arranjo ele nasce com uma faixa tracejada que aceita o que cair nela
  return (pal.length || vazioVisivel
    ? '<div class="grade' + (pal.length ? '' : ' vazia') + '">' + pal.map(gradeTile).join('') +
      (pal.length ? '' : '<span class="gdica">solte uma carta aqui</span>') + '</div>'
    : '') +
    (fr.length ? '<div class="gradefrases">' + fr.map(gradeTile).join('') + '</div>' : '');
}
// O botão diz os três eixos em uma linha, porque é o único lugar onde eles aparecem
// juntos — dentro da folha você vê um eixo de cada vez. A pílula leva o agrupamento
// (é o que muda a cara da tela) e o texto leva a ordem mais o que está escondido.
function gradeResumo() {
  const cfg = gradeCfg();
  const rot = k => (GRADE_GRUPOS.concat(GRADE_ORDENS).find(([x]) => x === k) || [, k])[1];
  const escondido = GRADE_MOSTRAR.filter(([k]) => !cfg.mostrar[k] && (k !== 'frases' || temFrases()));
  const partes = [rot(cfg.ordem)];
  // "≥5 tropeços" quando as faixas ligadas são as mais vermelhas em sequência — que é o
  // caso que motivou o filtro. Fora disso, lista os degraus, que é sempre verdade.
  if (!cfg.faixas.every(Boolean)) {
    const ligadas = GRADE_FAIXAS.filter(t => cfg.faixas[t]);
    const seguidasAteOFim = ligadas.length &&
      ligadas[ligadas.length - 1] === GRADE_FAIXAS.length - 1 &&
      ligadas.length === GRADE_FAIXAS.length - ligadas[0];
    partes.push(!ligadas.length ? 'nenhuma faixa'
      : seguidasAteOFim && ligadas[0] > 0 ? '≥' + ERRO_FAIXAS[ligadas[0] - 1] + ' tropeços'
      : 'só ' + ligadas.map(faixaRot).join(', '));
  }
  // "sem aprendidas" e não "aprendidas": o chip apagado ESCONDE, e o resumo tem que
  // dizer o que sumiu, senão ele lê como se estivesse mostrando só aquilo
  if (escondido.length) {
    partes.push('sem ' + escondido.map(([, t]) => t.replace(/^\S+\s/, '').toLowerCase()).join(', '));
  }
  if (cfg.radical) {
    partes.push(cfg.radModo === 'so' ? 'só ' + cfg.radical
      : cfg.radModo === 'agrupar' ? 'radical ' + cfg.radical
      : 'radical ' + cfg.radical + ' em azul');
  }
  const escopo = (cfg.radical && cfg.radModo === 'agrupar') ? '🔵 ' + cfg.radical
    : cfg.grupo === 'nada' ? '⬜ Sem grupo' : rot(cfg.grupo);
  return { escopo, txt: partes.join(' · ') };
}
function renderGrade() {
  const cfg = gradeCfg();
  const chips = (arr, sel, attr) => arr.map(([k, t]) =>
    '<button class="chip' + (sel === k ? ' active' : '') + '" data-' + attr + '="' + k + '">' +
    t + '</button>').join('');
  $('grade-grupo').innerHTML = chips(GRADE_GRUPOS, cfg.grupo, 'g');
  $('grade-ordem').innerHTML = chips(GRADE_ORDENS, cfg.ordem, 'o');
  // sem frase publicada o chip de frase some, igual ao da aba Cartas: botão que só liga
  // uma lista vazia é pior que botão nenhum
  const tem = temFrases();
  $('grade-mostrar').innerHTML = GRADE_MOSTRAR.filter(([k]) => k !== 'frases' || tem)
    .map(([k, t]) => '<button class="chip' + (cfg.mostrar[k] ? ' active' : '') +
      '" data-m="' + k + '">' + t + '</button>').join('');

  $('grade-faixas').innerHTML = GRADE_FAIXAS.map(t =>
    '<button class="chip' + (cfg.faixas[t] ? ' active' : '') + '" data-t="' + t + '">' +
    '<i class="lg' + (t ? ' e' + t : '') + '"></i>' + faixaRot(t) + '</button>').join('');

  // Some se QUALQUER filtro ligado a pegar — é como se lê "esconder".
  // A aprendida não passa pelas faixas: ela está FORA da escala do vermelho (é o que a
  // borda verde diz), então quem manda nela é só o chip ✅. Sem essa exceção, apagar
  // "sem tropeço" pra ver as difíceis levaria as aprendidas junto, e o ✅ ficaria aceso
  // dizendo que elas estão na tela.
  const escondidos = GRADE_MOSTRAR.filter(([k]) => !cfg.mostrar[k]);
  const todasFaixas = cfg.faixas.every(Boolean);
  let list = (escondidos.length || !todasFaixas)
    ? cards.filter(c => !escondidos.some(([, , pega]) => pega(c)) &&
        (aprendida(c.id) || cfg.faixas[erroTier(c)]))
    : cards.slice();
  // "só essas": some com quem não tem o radical, em vez de só recuar pro fundo
  if (cfg.radical && cfg.radModo === 'so') list = list.filter(c => temRadical(c, cfg.radical));
  const apr = list.filter(c => aprendida(c.id)).length;
  const nunca = list.filter(c => !srs[c.id]).length;
  // com filtro ligado o total do deck continua na linha: sem ele, "178 cartas" parece o
  // tamanho do deck, e não o que sobrou do que você escondeu.
  // A categoria escondida sai do contador em vez de aparecer zerada — "0 aprendidas"
  // logo abaixo do chip ✅ riscado se lê como "você não aprendeu nenhuma".
  const partes = [list.length !== cards.length
    ? '<b>' + list.length + '</b> de ' + cards.length + ' cartas'
    : '<b>' + cards.length + '</b> cartas'];
  if (cfg.mostrar.aprendidas) partes.push('<b>' + apr + '</b> aprendidas');
  if (cfg.mostrar.novas) partes.push('<b>' + nunca + '</b> nunca vistas');
  $('grade-count').innerHTML = partes.join(' · ');
  const r = gradeResumo();
  $('gradescope').textContent = r.escopo;
  $('gradecur').textContent = r.txt;
  // o seletor de radical: os rotulados presentes em ≥2 cartas da tela. "nenhum" volta
  // pro pictograma normal e devolve o vermelho do erro.
  const disp = radicaisDisponiveis(list);
  $('grade-radical').innerHTML =
    '<button class="chip' + (!cfg.radical ? ' active' : '') + '" data-r="">nenhum</button>' +
    disp.map(d => '<button class="chip' + (cfg.radical === d.rad ? ' active' : '') +
      '" data-r="' + esc(d.rad) + '"><span class="zh">' + esc(d.rad) + '</span> ' +
      esc(d.pt) + ' <i>' + d.n + '</i></button>').join('');
  $('grade-radmodo').innerHTML = cfg.radical
    ? RAD_MODOS.map(([k, t]) => '<button class="chip' + (cfg.radModo === k ? ' active' : '') +
        '" data-rm="' + k + '">' + t + '</button>').join('')
    : '';
  const arr = arranjoOn();
  $('gradewrap').classList.toggle('arrastando', arr);
  const grupos = (cfg.radical && cfg.radModo === 'agrupar')
    ? gradeRadicalGrupos(gradeOrdena(list), cfg.radical)
    : gradeGrupos(gradeOrdena(list));
  $('gradewrap').innerHTML = grupos.map(gr =>
    // o "+ novo monte" vem antes do Sem monte, não depois de tudo: com 161 cartas no
    // fim da lista, um botão embaixo delas é um botão que ninguém acha
    (arr && gr.sem ? '<button class="gnovo" id="gnovo">+ novo monte</button>' : '') +
    '<div class="gradegrupo"' + (gr.grupo ? ' data-g="' + esc(gr.grupo.id) + '"' : '') + '>' +
    (gr.rot ? '<h3>' + esc(gr.rot) + ' <span>' + gr.cards.length + '</span>' +
      (arr && gr.grupo ? '<button class="gbtn" data-ren="' + esc(gr.grupo.id) + '" title="Renomear">✏️</button>' +
        '<button class="gbtn" data-del="' + esc(gr.grupo.id) + '" title="Desfazer o monte">✕</button>' : '') +
      '</h3>' : '') +
    gradeCorpo(gr.cards, arr && gr.grupo) + '</div>').join('') ||
    '<p style="color:var(--mut);text-align:center">Nenhuma carta sobrou — religue um chip do Mostrar.</p>';
  if (arr) bindArranjo(); else $('gradewrap').onpointerdown = null;
  // tocar fala a carta; o balão com a tradução quem abre é o bindTips, pelo data-tip
  $('gradewrap').querySelectorAll('.gcard').forEach(b => b.onclick = () => {
    if (dragClick) return; // acabou de soltar um arrasto: não é um toque pra ouvir
    const c = cards.find(x => x.id === b.dataset.id);
    if (c) speak(c);
  });
  if (cfg.radical) pintaRadical(cfg.radical); // depois do innerHTML: SVG precisa do DOM pronto
  if (cfg.tam != null) $('gradewrap').style.setProperty('--gtam', cfg.tam + 'px');
  else $('gradewrap').style.removeProperty('--gtam');
  // nos extremos o botão correspondente apaga, pra não parecer que ainda dá pra crescer
  const efet = cfg.tam != null ? cfg.tam : GTAM_BASE;
  $('grade-tam').querySelector('[data-d="-1"]').disabled = efet <= GTAM_MIN;
  $('grade-tam').querySelector('[data-d="1"]').disabled = efet >= GTAM_MAX;
  $('grade-sig').classList.toggle('on', cfg.sig);
  $('grade-grupo').querySelectorAll('.chip').forEach(ch => ch.onclick = () => {
    cfg.grupo = ch.dataset.g; save(K.settings, settings); renderGrade();
  });
  $('grade-ordem').querySelectorAll('.chip').forEach(ch => ch.onclick = () => {
    cfg.ordem = ch.dataset.o; save(K.settings, settings); renderGrade();
  });
  $('grade-mostrar').querySelectorAll('.chip').forEach(ch => ch.onclick = () => {
    cfg.mostrar[ch.dataset.m] = !cfg.mostrar[ch.dataset.m];
    save(K.settings, settings); renderGrade();
  });
  $('grade-faixas').querySelectorAll('.chip').forEach(ch => ch.onclick = () => {
    const t = +ch.dataset.t;
    cfg.faixas[t] = !cfg.faixas[t];
    save(K.settings, settings); renderGrade();
  });
  $('grade-radical').querySelectorAll('.chip').forEach(ch => ch.onclick = () => {
    cfg.radical = ch.dataset.r || null;
    save(K.settings, settings); renderGrade();
  });
  $('grade-radmodo').querySelectorAll('.chip').forEach(ch => ch.onclick = () => {
    cfg.radModo = ch.dataset.rm;
    save(K.settings, settings); renderGrade();
  });
}
