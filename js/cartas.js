/* Mànmàn — A tela Cartas (consulta) e a Grade. */
'use strict';

// ── UI: cartas (consulta) ───────────────────────────────────
// O que sobrou dos chips de tema/origem: a aba Frases some quando não há frase
// publicada. Os filtros em si moram na barra (renderCartasBarra), desenhada pela lista.
function renderCartasChips() {
  const tem = temFrases();
  $('cartas-tipotype').style.display = 'none';
  $('tab-frases').style.display = tem ? '' : 'none';
  if (!tem) cartasTipo = 'palavra';
}
// o tipo que a aba está listando — é a base de tudo o que ela mostra e conta
function cartasBase() { return cards.filter(c => ehFrase(c) === (cartasTipo === 'frase')); }
// as cartas que os filtros Tema e Origem deixam passar, ignorando a busca e a Situação.
// Os dois SOMAM (E entre filtros, OU dentro de cada um): "Comida do Cap. 2".
function cartasFiltradas() {
  return cartasBase().filter(c =>
    (!cartasTemas.length || cartasTemas.includes(c.deck)) &&
    (!cartasOrigens.length || cartasOrigens.includes(origemDe(c))));
}
function filtroLigado() { return cartasTemas.length > 0 || cartasOrigens.length > 0; }
function filtroRotulo() {
  return cartasTemas.map(deckLabel).concat(cartasOrigens.map(origemLabel)).join(' + ');
}
// botão de ligar/desligar em bloco — só aparece com Tema ou Origem escolhido,
// porque "desligar todas" sem filtro é um tiro no pé sem querer
function renderBulk() {
  const grupo = cartasFiltradas();
  if (!filtroLigado() || !grupo.length) { $('bulkbar').innerHTML = ''; return; }
  const ligadas = grupo.filter(c => !isOff(c.id)).length;
  const desligar = ligadas > 0;
  const rotulo = filtroRotulo();
  $('bulkbar').innerHTML = '<button class="bulkbtn' + (desligar ? '' : ' on') + '" id="bulkbtn">' +
    (desligar ? '🚫 Desligar as ' + ligadas + ' de ' + esc(rotulo)
      : '↩︎ Religar as ' + grupo.length + ' de ' + esc(rotulo)) + '</button>';
  $('bulkbtn').onclick = () => {
    if (desligar && !confirm('Tirar da rotação as ' + ligadas + ' cartas de ' + rotulo +
      '? Elas somem do estudo até você religar. O progresso delas fica guardado.')) return;
    grupo.forEach(c => { if (isOff(c.id) === desligar) setOff(c.id, desligar); });
    renderCartasChips(); renderList(); startSession();
  };
}
// uma linha da lista — separada pra servir tanto a lista corrida quanto os grupos
// Uma linha da tabela. O 🔊 vem primeiro (é o gesto mais comum aqui: ouvir), o
// interruptor de ligada/desligada fica na ponta direita. Frase bloqueada por palavra
// desligada fica apagada como as desligadas, mas com o interruptor ligado — porque ele
// é dela —, e a nota diz qual palavra a está segurando.
const CARTAS_COLUNAS = 8;
function cartaLinha(c) {
  const bloq = palavraDesligada(c);
  const nota = (c.nota ? esc(c.nota) : '') + (bloq ? (c.nota ? '<br>' : '') + '🚫 fora da rotação: ' + esc(bloq) + ' está desligada' : '');
  return '<tr class="cl' + (isOff(c.id) || bloq ? ' offrow' : '') + '" data-id="' + esc(c.id) + '">' +
    '<td class="c-som"><button class="spk-row" data-id="' + esc(c.id) + '" title="Ouvir" aria-label="Ouvir">🔊</button></td>' +
    '<td class="c-hz zh" lang="zh-Hans">' + esc(c.hanzi) + '</td>' +
    '<td class="c-py">' + pinyinColored(c.pinyin) + '</td>' +
    '<td class="c-pt">' + esc(c.pt) + htmlLiteral(c) + '</td>' +
    '<td class="c-nota">' + nota + '</td>' +
    '<td class="c-tema"><span class="pill">' + esc(deckLabel(c.deck)) + '</span></td>' +
    '<td class="c-fav"><button class="fav-row' + (isFav(c.id) ? ' on' : '') + '" data-id="' + esc(c.id) + '" title="' +
      (isFav(c.id) ? 'Tirar das favoritas' : 'Favoritar: aparece em toda sessão, mesmo fora do filtro') +
      '" aria-pressed="' + isFav(c.id) + '">' + (isFav(c.id) ? '★' : '☆') + '</button></td>' +
    '<td class="c-on"><label class="switch" title="ativa / desligada"><input type="checkbox" class="offtgl" data-id="' + esc(c.id) + '"' +
    (isOff(c.id) ? '' : ' checked') + '><span class="knob"></span></label></td></tr>';
}
// as seções da lista quando "agrupar por" está ligado. Independente do filtro de cima:
// agrupa o que quer que tenha sobrado dele. Grupo é ordenado (tema por rótulo, origem
// pela ordem dos capítulos); dentro dele a ordem é a do deck.
// ── a vista da lista: agrupar, ordenar, isolar, mostrar ─────
// A mesma folha da aba Cartas do iPhone (CardsConfig). Fica no aparelho, como lá: é
// como VOCÊ gosta de ver a lista, não progresso.
//   Agrupar  — sem grupo, tema, origem, tropeços ou semelhança (os parecidos lado a lado)
//   Ordenar  — dentro de cada grupo: erros, domínio, pinyin ou a ordem do deck
//   Isolar   — "quais são as desligadas?": SUBSTITUI o Mostrar inteiro em vez de se somar
//              a ele. Somado, "só as desligadas" abriria vazio sempre que a desligada
//              também fosse nunca vista (os chips do Mostrar são um E).
//   Mostrar  — cada chip ESCONDE uma classe quando apagado; todos nascem ligados
const K_VISTA = 'manman.cartas.vista.v1';
const VISTA_GRUPOS = [['nada', 'Sem grupo'], ['tema', 'Tema'], ['origem', 'Origem'], ['tropecos', 'Tropeços'], ['semelhanca', 'Semelhança'], ['favoritas', '⭐ Favoritas'], ['meu', '✋ Meu arranjo']];
// Tabela e Grade são dois jeitos de ver a MESMA lista (DESIGN_SYSTEM.md 8.10): os filtros,
// a ordem e o agrupamento valem para os dois; só a Grade tem o Radical e o arrastar.
const VISTA_VISOES = [['tabela', 'Tabela', 'tabela'], ['grade', 'Grade', 'grade']];
const VISTA_ORDENS = [['erro', 'Erros'], ['dominio', 'Domínio'], ['pinyin', 'Pinyin'], ['seed', 'Deck'], ['favoritas', '⭐ Favoritas']];
// A Situação: cada opção é uma classe de carta; marcar duas mostra as duas (OU).
// Substitui o Isolar e o Mostrar da folha antiga — "só as desligadas" é marcar uma,
// "sem as aprendidas" é marcar as outras.
const VISTA_CLASSES = [
  ['favoritas', '⭐ Favoritas', 'favorita', c => isFav(c.id)],
  ['desligadas', '🚫 Desligadas', 'desligada', c => foraDaRotacao(c)],
  ['estudando', '📈 Em estudo', 'em estudo', c => !!srs[c.id] && !aprendida(c.id)],
  ['aprendidas', '✅ Aprendidas', 'aprendida', c => aprendida(c.id)],
  ['nuncaVistas', '🌱 Nunca vistas', 'nunca vista', c => !srs[c.id]]
];
// as colunas que dá pra esconder (o 汉字 e o significado ficam sempre)
const CARTAS_OCULTAVEIS = [['som', 'Som'], ['py', 'Pinyin'], ['nota', 'Nota'], ['tema', 'Tema'], ['fav', 'Favorita'], ['on', 'Ativa']];
function vistaCfg() {
  const v = load(K_VISTA, {});
  if (!VISTA_GRUPOS.some(([k]) => k === v.agrupar)) v.agrupar = 'nada';
  if (!VISTA_ORDENS.some(([k]) => k === v.ordem)) v.ordem = 'erro';
  if (!VISTA_VISOES.some(([k]) => k === v.visao)) v.visao = 'tabela';
  v.situacao = (Array.isArray(v.situacao) ? v.situacao : []).filter(k => VISTA_CLASSES.some(([x]) => x === k));
  v.tropecos = (Array.isArray(v.tropecos) ? v.tropecos : []).filter(t => +t >= 0 && +t <= ERRO_FAIXAS.length).map(String);
  v.ocultas = (Array.isArray(v.ocultas) ? v.ocultas : []).filter(k => CARTAS_OCULTAVEIS.some(([x]) => x === k));
  return v;
}
function salvaVista(v) { save(K_VISTA, { visao: v.visao, agrupar: v.agrupar, ordem: v.ordem, situacao: v.situacao, tropecos: v.tropecos, ocultas: v.ocultas }); }
function vistaFiltra(list) {
  const v = vistaCfg();
  const cls = VISTA_CLASSES.filter(([k]) => v.situacao.includes(k)).map(x => x[3]);
  return list.filter(c =>
    (!cls.length || cls.some(f => f(c))) &&
    (!v.tropecos.length || v.tropecos.includes(String(erroTier(c)))));
}
function vistaOrdena(list) {
  const o = vistaCfg().ordem, arr = list.slice(); // sort estável: o empate cai na ordem do deck
  if (o === 'erro') return arr.sort((a, b) => erroKey(b) - erroKey(a));
  if (o === 'dominio') return arr.sort((a, b) => dominio(a.id) - dominio(b.id));
  if (o === 'pinyin') return arr.sort((a, b) => (a.pinyin || '').localeCompare(b.pinyin || '', 'pt', { sensitivity: 'base' }));
  // as ⭐ primeiro; dentro de cada parte, a ordem de erros (o que mais pega em cima)
  if (o === 'favoritas') return arr.sort((a, b) => (isFav(b.id) - isFav(a.id)) || (erroKey(b) - erroKey(a)));
  return arr;
}
// "Sem parecido" no fim; uma carta mora em TODO grupo de um caractere seu (天气 no de
// 天/夫 e no do 气) — escolher um só esconderia a confusão do outro caractere. Grupo que
// na tela só tem um dos seus caracteres não vira seção: ver 天 sem o 夫 não compara nada.
function gruposDeSemelhanca(list) {
  const usadas = new Set(), out = [];
  for (const g of (semelhantesDB && semelhantesDB.grupos) || []) {
    const chars = [...g];
    const pos = c => chars.findIndex(ch => c.hanzi.includes(ch));
    const dentro = list.filter(c => pos(c) >= 0);
    const presentes = new Set(chars.filter(ch => dentro.some(c => c.hanzi.includes(ch))));
    if (presentes.size < 2) continue;
    out.push({ rot: chars.join(' '), cards: dentro.map((c, i) => [c, i]).sort((x, y) => pos(x[0]) - pos(y[0]) || x[1] - y[1]).map(x => x[0]) });
    dentro.forEach(c => usadas.add(c.id));
  }
  const resto = list.filter(c => !usadas.has(c.id));
  if (resto.length) out.push({ rot: 'Sem parecido', cards: resto });
  return out;
}
function cartasGrupos(list) {
  const g = vistaCfg().agrupar;
  if (g === 'meu') return gradeMeusGrupos(list);
  if (g === 'tema') {
    return [...new Set(list.map(c => c.deck))]
      .sort((a, b) => deckLabel(a).localeCompare(deckLabel(b), 'pt'))
      .map(d => ({ rot: deckLabel(d), cards: list.filter(c => c.deck === d) }));
  }
  if (g === 'origem') {
    return opcoesOrigem(list).filter(o => o !== 'todas')
      .map(o => ({ rot: origemLabel(o), cards: list.filter(c => origemDe(c) === o) }))
      .filter(x => x.cards.length);
  }
  // do pior pro aprendido, que é a ordem em que se olha: o que me derruba primeiro
  if (g === 'tropecos') {
    const out = [];
    for (let t = ERRO_FAIXAS.length; t >= 0; t--) {
      const cs = list.filter(c => !aprendida(c.id) && erroTier(c) === t);
      if (cs.length) out.push({ rot: t ? faixaRot(t) + ' tropeços' : 'Sem tropeço', cards: cs });
    }
    const apr = list.filter(c => aprendida(c.id));
    if (apr.length) out.push({ rot: 'Aprendidas', cards: apr });
    return out;
  }
  if (g === 'semelhanca') return gruposDeSemelhanca(list);
  if (g === 'favoritas') {
    return [{ rot: '⭐ Favoritas', cards: list.filter(c => isFav(c.id)) }, { rot: 'Outras', cards: list.filter(c => !isFav(c.id)) }]
      .filter(x => x.cards.length);
  }
  return [{ rot: null, cards: list }];
}
// A barra da lista (DESIGN_SYSTEM.md 8.1 e 9): busca e filtros à esquerda; Ordenar,
// Agrupar por e Colunas à direita. Redesenhada a cada renderList, menos a busca, que é
// fixa no HTML pra não perder o foco no meio da digitação.
function renderCartasBarra(list) {
  const v = vistaCfg();
  const grade = v.visao === 'grade';
  const base = cartasBase();
  const temas = [...new Set(base.map(c => c.deck))].sort((a, b) => deckLabel(a).localeCompare(deckLabel(b), 'pt'))
    .map(d => [d, esc(deckLabel(d))]);
  const origens = opcoesOrigem(base).filter(o => o !== 'todas').map(o => [o, esc(origemLabel(o))]);
  cartasTemas = cartasTemas.filter(k => temas.some(([x]) => x === k));
  cartasOrigens = cartasOrigens.filter(k => origens.some(([x]) => x === k));
  const muda = f => { const x = vistaCfg(); f(x); salvaVista(x); renderList(); };
  const esq = $('cartas-filtros');
  esq.innerHTML = '';
  esq.append(
    filtroMulti('Tema', temas, cartasTemas, s => { cartasTemas = s; renderList(); }),
    filtroMulti('Origem', origens, cartasOrigens, s => { cartasOrigens = s; renderList(); }),
    filtroMulti('Situação', VISTA_CLASSES.map(([k, t]) => [k, t]), v.situacao, s => muda(x => { x.situacao = s; })),
    filtroMulti('Tropeços', [...Array(ERRO_FAIXAS.length + 1).keys()].reverse()
      .map(t => [String(t), '<i class="lgq e' + t + '"></i>' + (t ? faixaRot(t) + ' tropeços' : 'sem tropeço')]),
      v.tropecos, s => muda(x => { x.tropecos = s; })));
  // Na Grade, o radical: pintar o radical é outra pergunta que não a do erro, então com
  // ele ligado o vermelho sai. O segundo botão diz o que ele faz com a tela.
  if (grade) {
    const gc = gradeCfg();
    const mudaG = f => { f(gc); save(K.settings, settings); renderList(); };
    const disp = radicaisDisponiveis(list);
    if (gc.radical && !disp.some(d => d.rad === gc.radical)) disp.unshift({ rad: gc.radical, pt: RADICAL_PT[gc.radical] || '', n: 0 });
    esq.append(filtroUnico('Radical', disp.map(d => [d.rad, '<span class="zh">' + esc(d.rad) + '</span> ' + esc(d.pt) + (d.n ? ' <small>' + d.n + '</small>' : '')]),
      gc.radical, k => mudaG(x => { x.radical = k; })));
    if (gc.radical) {
      const m = RAD_MODOS.find(([k]) => k === gc.radModo);
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'ft-btn cheio'; b.title = 'O que o radical faz com a tela';
      b.innerHTML = '<span>' + m[1] + '</span>' + icone('seta', 'ft-seta');
      b.onclick = () => abrePop(b, 200, el => popItens(el, 'Radical', RAD_MODOS, gc.radModo, k => mudaG(x => { x.radModo = k || 'pintar'; })));
      esq.append(b);
    }
  }
  const dir = $('cartas-dir');
  dir.innerHTML = '';
  const rot = (l, k) => (l.find(([x]) => x === k) || [, k])[1];
  // o "Meu arranjo" só existe na Grade: é lá que se arrasta uma carta pra um monte
  const grupos = VISTA_GRUPOS.filter(([k]) => k !== 'nada' && (grade || k !== 'meu'));
  dir.append(
    seletorVisao(VISTA_VISOES, v.visao, k => muda(x => { x.visao = k; if (k !== 'grade' && x.agrupar === 'meu') x.agrupar = 'nada'; })),
    botaoQuadrado('ordenar', 'Ordenar: ' + rot(VISTA_ORDENS, v.ordem), v.ordem !== 'erro', b =>
      abrePop(b, 208, el => popItens(el, 'Ordenar por', VISTA_ORDENS, v.ordem, k => muda(x => { x.ordem = k || 'erro'; })))),
    botaoQuadrado('camadas', 'Agrupar por' + (v.agrupar !== 'nada' ? ': ' + rot(VISTA_GRUPOS, v.agrupar) : ''), v.agrupar !== 'nada', b =>
      abrePop(b, 208, el => popItens(el, 'Agrupar por', grupos, v.agrupar,
        k => muda(x => { x.agrupar = k || 'nada'; }), v.agrupar !== 'nada' ? 'Remover agrupamento' : null))));
  if (!grade) dir.append(botaoQuadrado('colunas', 'Colunas', v.ocultas.length > 0, b =>
    abrePop(b, 240, el => popColunas(el, CARTAS_OCULTAVEIS, v.ocultas, s => muda(x => { x.ocultas = s; })))));
}
// O detalhe da carta na gaveta (DESIGN_SYSTEM.md 11.1): a lista continua atrás.
// Ouvir, favoritar e ligar/desligar ficam no cabeçalho; o corpo tem a carta grande,
// os números do seu estudo, os dados, a nota e de que é feito cada caractere.
function abreCartaGaveta(id) {
  const c = cards.find(x => x.id === id);
  if (!c) return;
  const fav = isFav(c.id), off = isOff(c.id), bloq = palavraDesligada(c);
  const s = srs[c.id], st = statOf(c.id);
  const situ = foraDaRotacao(c) ? ['err', 'Desligada'] : aprendida(c.id) ? ['ok', 'Aprendida'] : s ? ['warn', 'Em estudo'] : ['', 'Nunca vista'];
  const bt = (k, txt, on, titulo) => { const b = document.createElement('button'); b.className = 'gbotao' + (on ? ' on' : ''); b.dataset.k = k; b.title = titulo || ''; b.textContent = txt; return b; };
  const acoes = [bt('som', '🔊 Ouvir'), bt('fav', fav ? '★ Favorita' : '☆ Favoritar', fav,
    fav ? 'Tirar das favoritas' : 'Favoritar: aparece em toda sessão, mesmo fora do filtro'),
    bt('on', off ? 'Religar' : 'Desligar', false, off ? 'Volta pra rotação do estudo' : 'Tira da rotação do estudo')];
  const corpo = abreGaveta({ titulo: c.hanzi + ' · ' + c.pt, acoes });
  const frase = ehFrase(c);
  const dataAula = c.data_aula ? new Date(c.data_aula + 'T12:00').toLocaleDateString('pt-BR') : '';
  let h = '<div class="gcodigo"><code>' + esc(c.id) + '</code><span class="gtag ' + situ[0] + '">' + situ[1] + '</span>' +
    (fav ? '<span class="gtag">⭐ favorita</span>' : '') + '</div>' +
    '<div class="ghero' + (frase ? ' frase' : '') + '"><div class="zh" lang="zh-Hans">' + esc(c.hanzi) + '</div><div>' +
    '<div class="gpy">' + pinyinColored(c.pinyin) + '</div><div class="gpt">' + esc(c.pt) + '</div>' + htmlLiteral(c) + '</div></div>';
  h += secaoGaveta('Seu estudo', '', '<div class="gkpis">' +
    '<div class="gkpi"><small>Domínio</small><b>' + (s ? Math.round(dominio(c.id) * 100) + '%' : '—') + '</b></div>' +
    '<div class="gkpi"><small>Acertos</small><b>' + st.g + '</b></div>' +
    '<div class="gkpi"><small>Tropeços</small><b>' + erroCount(c.id) + '</b></div>' +
    '<div class="gkpi"><small>Próxima revisão</small><b>' + (s && s.due ? new Date(s.due + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—') + '</b></div></div>');
  h += secaoGaveta('Dados', '', camposGaveta([
    ['Tipo', frase ? 'Frase' : 'Palavra'],
    ['Tema', esc(deckLabel(c.deck))],
    ['Origem', esc(origemLabel(origemDe(c)))],
    ['Data da aula', dataAula],
    ['Na rotação', foraDaRotacao(c) ? (bloq ? 'Não — ' + esc(bloq) + ' está desligada' : 'Não') : 'Sim']]));
  if (c.nota) h += secaoGaveta('Nota', '', '<div class="gtexto">' + esc(c.nota) + '</div>');
  const ideias = ideogramasDaCarta(c);
  if (ideias.length) h += secaoGaveta('De que é feito cada 汉字', ideias.length, '<div class="ideias">' + htmlIdeogramas(c) + '</div>');
  corpo.innerHTML = h;
  const cab = $('gaveta').querySelector('.gaveta-acoes');
  cab.querySelector('[data-k="som"]').onclick = () => speak(c);
  cab.querySelector('[data-k="fav"]').onclick = () => {
    setFav(c.id, !isFav(c.id)); renderList(); abreCartaGaveta(c.id);
    if (phase === 'sched' || phase === 'practice') renderCounter();
  };
  cab.querySelector('[data-k="on"]').onclick = () => { setOff(c.id, !isOff(c.id)); depoisDeLigar(); abreCartaGaveta(c.id); };
}
function renderList() {
  const q = $('search').value.trim().toLowerCase();
  const list = vistaOrdena(vistaFiltra(cartasFiltradas().filter(c =>
    (!q ||
      (c.hanzi || '').toLowerCase().includes(q) ||
      (c.pinyin || '').toLowerCase().includes(q) ||
      (c.pt || '').toLowerCase().includes(q)))));
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
  renderCartasBarra(list);
  const v = vistaCfg();
  const grade = v.visao === 'grade';
  $('cartas-tabela').hidden = grade;
  $('cartas-gradebox').hidden = !grade;
  if (grade) { desenhaGrade(list, base); return; }
  const vazio = '<p class="dt-vazio">Nenhuma ' + (cartasTipo === 'frase' ? 'frase' : 'palavra') + ' encontrada.</p>';
  // Uma tabela só, com o nome de cada coluna em cima; o agrupar vira uma linha de
  // título dentro dela, pra que as colunas fiquem alinhadas do começo ao fim.
  const frase = cartasTipo === 'frase';
  $('cardlist').innerHTML = list.length ? '<table class="cartas-tab' + v.ocultas.map(k => ' oc-' + k).join('') + '"><thead><tr>' +
    '<th class="c-som"></th><th class="c-hz">' + (frase ? 'Frase' : '汉字') + '</th><th class="c-py">Pinyin</th>' +
    '<th class="c-pt">Significado</th><th class="c-nota">Nota</th><th class="c-tema">Tema</th>' +
    '<th class="c-fav" title="Favorita">⭐</th><th class="c-on">Ativa</th></tr></thead><tbody>' +
    cartasGrupos(list).map(g =>
      (g.rot ? '<tr class="cl-grupo"><td colspan="' + CARTAS_COLUNAS + '">' + esc(g.rot) + ' <span>' + g.cards.length + '</span></td></tr>' : '') +
      g.cards.map(cartaLinha).join('')).join('') + '</tbody></table>' : vazio;
  // Clicar na linha abre a carta na gaveta (DESIGN_SYSTEM.md 11.1). Os controles da
  // própria linha (ouvir, estrela, interruptor) continuam fazendo só o que fazem.
  $('cardlist').querySelectorAll('tr.cl').forEach(tr => tr.onclick = e => {
    if (e.target.closest('button, label, input')) return;
    abreCartaGaveta(tr.dataset.id);
  });
  // a linha de grupo recolhe ao clicar, como no DataTable
  $('cardlist').querySelectorAll('tr.cl-grupo').forEach(tr => tr.onclick = () => {
    const fecha = !tr.classList.contains('fechado');
    tr.classList.toggle('fechado', fecha);
    for (let n = tr.nextElementSibling; n && !n.classList.contains('cl-grupo'); n = n.nextElementSibling) n.hidden = fecha;
  });
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
    depoisDeLigar();
  });
}
// Ligar/desligar uma carta (na linha ou na gaveta) mexe na lista, na grade e na fila
// do estudo, que se realinha mantendo a carta atual na frente.
function depoisDeLigar() {
  renderCartasChips(); renderList();
  if (phase !== 'quiz') {
    if (phase === 'sched') buildQueue(); else enterPractice();
    if (current && !foraDaRotacao(current)) {
      queue = queue.filter(x => x !== current.id);
      queue.unshift(current.id);
      renderCounter();
    } else {
      nextCard();
    }
  }
}

// ── UI: grade (o deck inteiro numa tela só) ─────────────────
// A aba Cartas é o navegador do deck: um tipo por vez, um tema por vez, uma linha por
// carta, com interruptor e busca. Ótima pra achar UMA carta, cega pro conjunto.
// A grade é a visão de cima: as cartas todas juntas, sem escolher tema antes, pra
// enxergar a olho o que a lista só sabe contar — o que já está de pé, o que você erra,
// o que nunca abriu. Por isso ela não repete os filtros da Cartas: ela agrupa e ordena
// o deck inteiro, e o que ela pinta é o SEU estado, não o conteúdo da carta.
// Mora dentro do settings pro arranjo sobreviver ao recarregamento, que é o ponto de
// uma tela de consulta: você monta a vista uma vez e volta nela.
// ── Grade: o arranjo à mão ──────────────────────────────────
// Agrupar por tema, aula ou tipo responde perguntas que o deck já sabe responder. A
// pergunta que ele não sabe é "quais destas eu confundo uma com a outra" — books 书 e
// 书? 我 e 找? Isso não está em campo nenhum, está na sua cabeça, e a única forma de
// botar na tela é você arrastar uma pra perto da outra.
// Carta que você não arrastou fica no monte do fim; ela não some, só não foi arrumada.
function arranjoOn() { const v = vistaCfg(); return v.visao === 'grade' && v.agrupar === 'meu'; }
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
  if (g.radical && !RADICAL_PT[g.radical]) g.radical = null; // radical que saiu da lista
  if (!['pintar', 'agrupar', 'so'].includes(g.radModo)) g.radModo = 'pintar';
  // tamanho do cartão: null = deixa o CSS decidir (76 no celular, 96 no PC); número =
  // escolha do usuário, que vale nos dois. Clampado pra não sumir nem virar pôster.
  if (g.tam != null && (typeof g.tam !== 'number' || g.tam < GTAM_MIN || g.tam > GTAM_MAX)) {
    g.tam = null;
  }
  g.sig = !!g.sig; // mostrar o significado embaixo do pinyin
  // filtros, ordem e agrupamento agora são os da lista (vistaCfg): a Grade é uma visão dela
  ['grupo', 'ordem', 'temas', 'origens', 'tipos', 'situacao', 'tropecos', 'mostrar', 'faixas'].forEach(k => delete g[k]);
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
// A visão Grade da lista: a mesma lista (filtrada, buscada e ordenada) em quadradinhos.
// O que é só dela: o radical (pintar / agrupar / só essas), o tamanho e o significado.
function desenhaGrade(list, total) {
  const cfg = gradeCfg();
  const v = vistaCfg();
  // "só essas": some com quem não tem o radical, em vez de só recuar pro fundo
  if (cfg.radical && cfg.radModo === 'so') list = list.filter(c => temRadical(c, cfg.radical));
  const apr = list.filter(c => aprendida(c.id)).length;
  const nunca = list.filter(c => !srs[c.id]).length;
  const nome = cartasTipo === 'frase' ? 'frases' : 'palavras';
  $('grade-count').innerHTML = [list.length !== total ? list.length + ' de ' + total + ' ' + nome : total + ' ' + nome,
    apr + ' aprendidas', nunca + ' nunca vistas'].join(' · ');
  const arr = arranjoOn();
  $('gradewrap').classList.toggle('arrastando', arr);
  const grupos = (cfg.radical && cfg.radModo === 'agrupar')
    ? gradeRadicalGrupos(list, cfg.radical)
    : cartasGrupos(list).filter(g => g.cards.length || g.grupo);
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
    '<p class="dt-vazio">Nenhuma ' + (cartasTipo === 'frase' ? 'frase' : 'palavra') + ' encontrada.</p>';
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
}
// Quem mexe no arranjo, no tamanho ou no significado redesenha a lista, que é quem
// sabe em que visão ela está.
function renderGrade() { renderList(); }

