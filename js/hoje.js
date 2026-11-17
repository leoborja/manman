/* Mànmàn — 📅 A aba Hoje: as lições do dia, cada uma com a rodada a um toque.

   Uma lição é o lembrete do app iOS sem a notificação: um horário, os dias da semana e
   uma PAUTA — de onde saem as cartas (o que vence hoje, as que mais erro, capítulos), o
   tipo, quantas e em que modo. A pauta não é um segundo sistema de estudo: é um recorte
   do mesmo deck, respondido no Estudar com o mesmo SRS. A diferença é que a rodada é
   FECHADA, de N cartas — é promessa cumprida: "as 10 que você mais erra" acaba nas 10.

   O ✓ é do dia e cai quando a rodada chega ao fim. Amanhã as lições voltam abertas.

   As lições e os ✓ seguem a CONTA (tabela `estado`, chaves `licoes` e `licoes_feitas`,
   ver js/estado.js) e são as mesmas do iPhone. Por isso o que fica guardado é o
   `Lembrete` do iOS como ele o grava — id UUID, hora e minuto, dias 1–7 com 1 =
   domingo, a pauta com a fonte como enum ({"recorte": {...}}) — e a tela converte na
   ida e na volta. Lição que a web não sabe rodar (simulado, habilidade) aparece e não
   é tocada; ao editar, a web parte do objeto original e só mexe no que entende. */
'use strict';

const K_LICOES = 'manman.licoes.v2';               // por usuário: { id: Lembrete do iOS + u (ou lápide) }
const K_LICOES_FEITAS = 'manman.licoes.feitas.v2'; // por usuário: { id: 'YYYY-MM-DD' }
const LICAO_LIMITES = [5, 10, 20, 30];
// Os modos que fecham uma rodada carta a carta. O quiz de tom, o relâmpago e o diálogo
// montam a própria fila, e uma lição dentro deles não seria a pauta que se prometeu.
const LICAO_MODOS = { palavra: ['mix', 'zh_all', 'pt_type', 'draw'], frase: ['mix', 'zh_all', 'pt_type', 'ordenar'] };
const DIAS_CURTO = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']; // getDay(): 0 = domingo

// Sem lição nenhuma, três a um toque — o mesmo começo da tela de lembretes do iPhone.
const LICOES_SUGERIDAS = [
  { nome: 'De manhã', hora: '08:00', dias: [1, 2, 3, 4, 5], pauta: { fonte: 'vencidas', tipo: 'palavra', limite: 20, modo: 'mix' } },
  { nome: 'No almoço', hora: '12:30', dias: [0, 1, 2, 3, 4, 5, 6], pauta: { fonte: 'maisErro', tipo: 'palavra', limite: 10, modo: 'mix' } },
  { nome: 'À noite', hora: '21:00', dias: [0, 1, 2, 3, 4, 5, 6], pauta: { fonte: 'vencidas', tipo: 'palavra', limite: 20, modo: 'mix' } }
];
const FONTES_DA_WEB = ['vencidas', 'maisErro', 'recorte'];

// ── o formato do iOS ↔ o da tela ────────────────────────────
// Guardado: { id: {id, hora, minuto, dias:[1..7], ativo, pauta:{fonte:{tipo:{…}}, tipo,
// limite, modoPedido, …}, u} }. Na tela: {id, hora:'08:00', dias:[0..6], pauta:{fonte:
// 'recorte', origens, temas, tipo, limite, modo, favoritas, misto}, suportada}.
const dois2 = n => String(n).padStart(2, '0');
function paraTela(raw) {
  const p = raw.pauta || {}, f = p.fonte || {}, k = Object.keys(f)[0] || '?';
  const rec = f.recorte || {};
  return {
    id: raw.id, hora: dois2(raw.hora || 0) + ':' + dois2(raw.minuto || 0),
    dias: (raw.dias || []).map(d => d - 1), ativo: raw.ativo !== false,
    suportada: FONTES_DA_WEB.includes(k),
    pauta: { fonte: k, origens: rec.origens || [], temas: rec.temas || [], tipo: p.tipo === 'frase' ? 'frase' : 'palavra',
      limite: p.limite || 20, modo: p.modoPedido || 'mix', favoritas: !!p.favoritas, misto: !!p.misto,
      habilidade: f.habilidade && f.habilidade._0 }
  };
}
// Parte do objeto guardado e só troca o que a tela entende: os campos do iOS que a web
// não conhece (modosPedidos, questoesPorTipo, soltos…) voltam como estavam.
function paraGuardar(l, raw) {
  const o = raw ? JSON.parse(JSON.stringify(raw)) : { ativo: true, pauta: {
    modosPedidos: [], sortear: false, soltos: false, favoritas: false, misto: false, questoesPorTipo: {} } };
  const [h, m] = (l.hora || '08:00').split(':').map(Number);
  o.id = l.id; o.hora = h || 0; o.minuto = m || 0;
  o.dias = l.dias.map(d => d + 1).sort((a, b) => a - b);
  const p = o.pauta, w = l.pauta;
  if (FONTES_DA_WEB.includes(w.fonte)) {
    p.fonte = w.fonte === 'recorte' ? { recorte: { temas: w.temas || [], origens: w.origens || [] } } : { [w.fonte]: {} };
    p.tipo = w.tipo; p.limite = w.limite;
    // o modo só é trocado se a pessoa mexeu: um modo que só o iPhone tem fica intacto
    if (!raw || (LICAO_MODOS[w.tipo] || []).includes(w.modo)) p.modoPedido = w.modo;
  }
  o.u = Date.now();
  delete o.apagada;
  return o;
}
function licoesGuardadas() { return load(uk(K_LICOES), {}); }
function licoes() {
  // o id é a CHAVE do mapa: o iPhone pode mandar o objeto sem o id dentro, e a grafia
  // da chave é a que o outro lado reconhece
  return Object.entries(licoesGuardadas()).filter(([, r]) => r && !r.apagada && r.pauta && Array.isArray(r.dias))
    .map(([id, r]) => paraTela(Object.assign({}, r, { id })));
}
function salvaLicao(l) {
  const g = licoesGuardadas();
  g[l.id] = paraGuardar(l, g[l.id]);
  save(uk(K_LICOES), g);
  marcaEstado('licoes');
}
// Apagar deixa a lápide: sem ela, o outro aparelho traria a lição de volta.
function apagaLicao(id) {
  const g = licoesGuardadas();
  g[id] = { u: Date.now(), apagada: true };
  save(uk(K_LICOES), g);
  marcaEstado('licoes');
}
function novoIdDeLicao() {
  return (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16);
  })).toUpperCase(); // o UUID() do Swift escreve em maiúsculas
}
function feitasHoje() {
  const f = load(uk(K_LICOES_FEITAS), {}), t = todayStr();
  return Object.keys(f).filter(id => f[id] === t);
}
function marcaFeita(id) {
  const f = load(uk(K_LICOES_FEITAS), {});
  f[id] = todayStr();
  save(uk(K_LICOES_FEITAS), f);
  marcaEstado('licoes_feitas');
  registraDia();
}
function hojeDia() { const [a, m, d] = todayStr().split('-').map(Number); return new Date(a, m - 1, d).getDay(); }
function licoesDeHoje() {
  const d = hojeDia();
  return licoes().filter(l => l.dias.includes(d)).sort((a, b) => a.hora.localeCompare(b.hora));
}

// ── a pauta: que cartas a rodada entrega ────────────────────
function nomeDaPauta(p) {
  const base = nomeDaFonte(p);
  if (!p.favoritas) return base;
  if (p.fonte === 'recorte') return (p.origens || []).length || (p.temas || []).length ? 'Favoritas de ' + base : 'Minhas favoritas';
  return base + ' · favoritas';
}
function nomeDaFonte(p) {
  if (p.fonte === 'vencidas') return 'O que vence hoje';
  if (p.fonte === 'maisErro') return 'As que eu mais erro';
  if (p.fonte === 'simulado') return 'Simulado curto';
  if (p.fonte === 'habilidade') return 'Treino de uma habilidade';
  if (p.fonte !== 'recorte') return 'Lição do iPhone';
  const nomes = (p.origens || []).slice().sort((a, b) => ordemOrigem(a) - ordemOrigem(b)).map(origemLabel)
    .concat((p.temas || []).map(deckLabel));
  if (!nomes.length) return 'Capítulos';
  return nomes.length > 3 ? nomes.slice(0, 2).join(' + ') + ' + ' + (nomes.length - 2) + ' mais' : nomes.join(' + ');
}
// As cartas da rodada, na ordem em que vêm. Roda com o modo e o tipo da lição JÁ
// aplicados, pra que o podePerguntar descarte o que este modo não sabe perguntar.
function cartasDaPauta(p) {
  const t = todayStr();
  if (!FONTES_DA_WEB.includes(p.fonte)) return [];
  const base = cards.filter(c => (p.misto || ehFrase(c) === (p.tipo === 'frase')) && !foraDaRotacao(c) && podePerguntar(c)
    && (!p.favoritas || isFav(c.id)));
  const vence = c => srs[c.id] && srs[c.id].due <= t;
  const porDue = (a, b) => (srs[a.id].due < srs[b.id].due ? -1 : 1);
  let lista;
  if (p.fonte === 'vencidas') {
    lista = base.filter(vence).sort(porDue);
  } else if (p.fonte === 'maisErro') {
    const erros = c => { const s = stats[c.id]; return s ? (s.h || 0) + (s.a || 0) : 0; };
    lista = base.filter(c => erros(c) > 0).sort((a, b) => erros(b) - erros(a));
  } else {
    // capítulos SOMADOS: tudo do 2 e tudo do 3. As vencidas na frente, depois as novas,
    // depois o resto — quem marcou um capítulo quer o capítulo, não só o que venceu.
    // capítulo OU tema: "Cap. 2 + Comida" é tudo do 2 e toda a Comida. Sem nada marcado
    // e com a ⭐, são todas as favoritas.
    const o = new Set(p.origens || []), t = new Set(p.temas || []);
    const doRecorte = (!o.size && !t.size) ? base : base.filter(c => o.has(origemDe(c)) || t.has(c.deck));
    lista = doRecorte.filter(vence).sort(porDue)
      .concat(shuffle(doRecorte.filter(c => !srs[c.id])))
      .concat(shuffle(doRecorte.filter(c => srs[c.id] && !vence(c))));
  }
  return lista.slice(0, p.limite || 20);
}
// Quantas a rodada traria agora. Muda o modo só pra perguntar e devolve o de antes:
// contar não pode mexer na sessão que está aberta no Estudar.
function quantasNaPauta(p) {
  if (!FONTES_DA_WEB.includes(p.fonte)) return 0;
  const antes = { mode: settings.mode, tipo: settings.tipo }, mc = modoCarta;
  settings.mode = (LICAO_MODOS[p.tipo] || []).includes(p.modo) ? p.modo : 'mix'; settings.tipo = p.tipo; modoCarta = null;
  try { return cartasDaPauta(p).length; }
  finally { settings.mode = antes.mode; settings.tipo = antes.tipo; modoCarta = mc; }
}
function textoDaPauta(p, n) {
  if (!n) return p.fonte === 'vencidas' ? 'em dia, nada vence agora' : p.fonte === 'maisErro' ? 'nenhum erro pendente' : 'nenhuma carta neste recorte';
  const fr = p.tipo === 'frase';
  return n + ' ' + (n === 1 ? (fr ? 'frase' : 'palavra') : (fr ? 'frases' : 'palavras'));
}

// ── a rodada da lição, dentro do Estudar ────────────────────
// O Estudar só olha estas duas: licaoPendente é a lição que o próximo startSession vai
// abrir; licaoAtiva é a que está rodando. Qualquer outro startSession (trocar modo,
// filtro…) encerra a lição — a pessoa saiu dela por conta própria.
let licaoPendente = null, licaoAtiva = null;
function abreLicao(l) {
  if (!l || !l.suportada) return;
  settings.tipo = l.pauta.tipo;
  // modo que só o iPhone tem (casar, falar…) roda no 🔀 aqui
  settings.mode = (LICAO_MODOS[l.pauta.tipo] || []).includes(l.pauta.modo) ? l.pauta.modo : 'mix';
  save(K.settings, settings);
  const ids = cartasDaPauta(l.pauta).map(c => c.id);
  if (!ids.length) return;
  licaoPendente = { id: l.id, nome: l.nome || nomeDaPauta(l.pauta), ids, total: ids.length };
  renderModeSheet(); renderModeUI(); startSession();
  switchView('estudar');
}
// chamada do startSession: decide se a sessão que começa é a da lição
function trocaDeSessao() {
  licaoAtiva = licaoPendente;
  licaoPendente = null;
  if (licaoAtiva) $('modescope').textContent = '📅 ' + licaoAtiva.nome;
}
function concluiLicao() {
  const l = licaoAtiva;
  licaoAtiva = null;
  marcaFeita(l.id);
  finishSession();
  $('done-title').textContent = 'Lição feita!';
  $('done-sub').textContent = l.nome + ': as ' + l.total + ' cartas da rodada. ' +
    'O ✓ fica no Hoje até amanhã, e refazer pode sempre.';
  $('freebtn').textContent = '📅 Voltar ao Hoje';
  $('freebtn').style.display = '';
  $('freebtn').dataset.hoje = '1';
}

// ── a tela ──────────────────────────────────────────────────
const ICO_LICAO = {
  vencidas: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="M12 14v2l1.5 1.5"/>',
  maisErro: '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
  recorte: '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
  feita: '<path d="M20 6 9 17l-5-5"/>'
};
const svgIco = p => '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">' + p + '</svg>';
function diasTexto(d) {
  const s = d.slice().sort();
  if (s.length === 7) return 'todo dia';
  if (s.join() === '1,2,3,4,5') return 'seg a sex';
  if (s.join() === '0,6') return 'fim de semana';
  return s.map(i => ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][i]).join(', ');
}
// `dia`: o dia escolhido na faixa (o ✓ é o daquele dia), ou null na lista dos outros dias.
// Só a de hoje abre a rodada: lição de ontem não se faz ontem.
function linhaDeLicao(l, dia) {
  const deHoje = dia !== null;
  const feita = deHoje && load(uk(K_LICOES_FEITAS), {})[l.id] === dia;
  const n = quantasNaPauta(l.pauta);
  const modo = MODE_TITLES[l.pauta.modo] || 'um modo do iPhone';
  const sub = l.hora + (deHoje ? '' : ' · ' + diasTexto(l.dias)) + ' · ' +
    (l.suportada ? textoDaPauta(l.pauta, n) + ' · ' + modo : 'só no iPhone');
  return '<div class="licao' + (feita ? ' feita' : '') + (n ? '' : ' vazia') + '">' +
    '<button class="licao-abre" data-abre="' + esc(l.id) + '"' + (n && (dia === null || dia === todayStr()) ? '' : ' disabled') + '>' +
      '<span class="licao-ico">' + svgIco(feita ? ICO_LICAO.feita : (ICO_LICAO[l.pauta.fonte] || ICO_LICAO.recorte)) + '</span>' +
      '<span class="licao-tx"><b>' + esc(l.nome || nomeDaPauta(l.pauta)) + '</b><small>' + esc(sub) + '</small></span></button>' +
    '<button class="licao-edita" data-edita="' + esc(l.id) + '" title="Editar lição" aria-label="Editar lição">' +
      svgIco('<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>') + '</button></div>';
}
// ── a faixa de dias ─────────────────────────────────────────
// Os últimos 21 dias até hoje. O contorno de cada dia é a fração das lições dele que
// foram feitas, correndo a partir do topo como um relógio — fechado, o dia cumpriu
// todas. O número em vermelho diz que houve estudo naquele dia, com lição ou sem; o
// fogo embaixo é a meta de revisões batida, o dia que entrou na sequência. Dia sem
// lição registrada fica sem contorno: nunca um anel zerado inventado.
const K_DIAS_LICAO = 'manman.licoes.dias.v1'; // por usuário: { 'YYYY-MM-DD': {feitas, total, parcial?} }
const GRUPOS_DE_LICAO = ['Palavras', 'Frases', 'Palavras + frases', 'Simulados'];
const DIAS_FAIXA = 21;
let hojeDiaSel = null;
function grupoDaLicao(l) {
  if (l.pauta.fonte === 'simulado') return 'Simulados';
  if (l.pauta.misto) return 'Palavras + frases';
  return l.pauta.tipo === 'frase' ? 'Frases' : 'Palavras';
}
function diaDaSemana(dia) { const [a, m, d] = dia.split('-').map(Number); return new Date(a, m - 1, d).getDay(); }
// O placar de hoje, gravado a cada vez que o Hoje se desenha e a cada lição fechada.
// O que o iPhone deixou pela metade (parcial) fica — esta web não faz meia rodada.
function registraDia() {
  const t = todayStr(), hoje = licoesDeHoje(), fs = load(uk(K_LICOES_FEITAS), {});
  const dias = load(uk(K_DIAS_LICAO), {}), antes = dias[t];
  const feitas = hoje.filter(l => fs[l.id] === t).length;
  const novo = { feitas, total: hoje.length };
  if (antes && antes.parcial) {
    const p = {};
    for (const id of Object.keys(antes.parcial)) if (fs[id] !== t) p[id] = antes.parcial[id];
    if (Object.keys(p).length) novo.parcial = p;
  }
  if (!hoje.length && !antes) return;
  if (JSON.stringify(novo) === JSON.stringify(antes)) return;
  dias[t] = novo;
  save(uk(K_DIAS_LICAO), dias);
  marcaEstado('dias_de_licao');
}
function progressoDoDia(dia) {
  const d = load(uk(K_DIAS_LICAO), {})[dia];
  if (!d || !d.total) return null;
  const parcial = Object.values(d.parcial || {}).reduce((a, b) => a + b, 0);
  return Math.min(1, (d.feitas + parcial) / d.total);
}
const NOMES_DIA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const NOMES_MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
function faixaDeDias(sel) {
  const hoje = todayStr();
  let chips = '';
  for (let i = DIAS_FAIXA - 1; i >= 0; i--) {
    const d = todayStr(-i), wd = diaDaSemana(d), f = progressoDoDia(d);
    const rev = (log[d] && log[d].rev) || 0;
    chips += '<button class="dia' + (d === sel ? ' sel' : '') + (d === hoje ? ' hoje' : '') + (rev ? ' estudou' : '') + '" data-dia="' + d + '"' +
      (f === null ? '' : ' style="--f:' + Math.round(f * 360) + 'deg"') + ' title="' + (f === null ? 'sem lição' : Math.round(f * 100) + '% das lições') + '">' +
      '<span class="dsem">' + DIAS_CURTO[wd] + '</span><span class="dnum">' + Number(d.slice(8)) + '</span>' +
      '<span class="dfogo">' + (rev >= META_DIARIA ? '🔥' : '') + '</span>' + (f === null ? '' : '<i class="danel' + (f >= 1 ? ' cheio' : '') + '"></i>') + '</button>';
  }
  const [a, m, dd] = sel.split('-').map(Number);
  const rev = (log[sel] && log[sel].rev) || 0, f = progressoDoDia(sel);
  const titulo = (sel === hoje ? 'Hoje, ' : NOMES_DIA[diaDaSemana(sel)] + ', ') + dd + ' de ' + NOMES_MES[m - 1];
  const resumo = [f === null ? null : Math.round(f * 100) + '% das lições', rev ? rev + ' revisões' : 'sem estudo'].filter(Boolean).join(' · ');
  return '<div class="faixa-cab"><b>' + esc(titulo) + '</b><span>' + esc(resumo) + '</span></div><div class="faixa-dias">' + chips + '</div>';
}

function renderHoje() {
  $('pageacoes').innerHTML = '<button class="pageacao" id="hoje-nova">+ Nova lição</button>';
  $('hoje-nova').onclick = () => abreEditorLicao(null);
  const box = $('hoje-corpo');
  const todas = licoes();
  if (!todas.length) {
    box.innerHTML = '<div class="painel"><h3 class="hoje-tit">Monte o seu dia</h3>' +
      '<p class="cursonota" style="margin:0 0 12px">Cada lição é uma rodada fechada, com hora marcada. As do dia aparecem aqui, e o ✓ dura até amanhã.</p>' +
      LICOES_SUGERIDAS.map((s, i) => '<button class="licao-sug" data-sug="' + i + '">' +
        '<span class="licao-ico">' + svgIco(ICO_LICAO[s.pauta.fonte]) + '</span><span class="licao-tx"><b>' + esc(s.nome) + '</b>' +
        '<small>' + s.hora + ' · ' + diasTexto(s.dias) + ' · ' + nomeDaPauta(s.pauta).toLowerCase() + '</small></span><span class="licao-mais">+</span></button>').join('') +
      '</div>';
    box.querySelectorAll('[data-sug]').forEach(b => b.onclick = () => {
      const s = LICOES_SUGERIDAS[+b.dataset.sug];
      salvaLicao({ id: novoIdDeLicao(), hora: s.hora, dias: s.dias.slice(), pauta: Object.assign({ origens: [], temas: [] }, s.pauta) });
      renderHoje();
    });
    return;
  }
  registraDia();
  const dia = hojeDiaSel || todayStr(), wd = diaDaSemana(dia);
  const doDia = todas.filter(l => l.dias.includes(wd)).sort((x, y) => x.hora.localeCompare(y.hora));
  const ids = new Set(doDia.map(l => l.id)), outras = todas.filter(l => !ids.has(l.id));
  const fs = load(uk(K_LICOES_FEITAS), {}), feitas = doDia.filter(l => fs[l.id] === dia).length;
  let h = faixaDeDias(dia);
  // Duas seções, como no iPhone: as de palavra e as de frase não se misturam na tela
  // (cada uma é uma rodada de outro deck). Grupo vazio não aparece.
  const grupos = GRUPOS_DE_LICAO.map(g => [g, doDia.filter(l => grupoDaLicao(l) === g)]).filter(([, ls]) => ls.length);
  if (!doDia.length) h += '<div class="painel"><p class="vazio">Nenhuma lição marcada para ' + (dia === todayStr() ? 'hoje' : 'este dia') + '.</p></div>';
  grupos.forEach(([g, ls], i) => {
    h += '<div class="painel hoje-sec"><h3 class="hoje-tit">' + esc(g) + '</h3>' + ls.map(l => linhaDeLicao(l, dia)).join('') + '</div>';
  });
  if (doDia.length) h += '<p class="cursonota hoje-rodape">' + (dia !== todayStr()
    ? feitas + ' de ' + doDia.length + ' feitas neste dia.'
    : feitas === doDia.length ? 'Tudo feito por hoje. Amanhã as lições voltam abertas.'
    : feitas + ' de ' + doDia.length + ' feitas. Uma lição fica feita quando a rodada chega ao fim.') + '</p>';
  if (outras.length) h += '<div class="painel hoje-sec"><h3 class="hoje-tit">Outros dias</h3>' + outras.map(l => linhaDeLicao(l, null)).join('') + '</div>';
  box.innerHTML = h;
  box.querySelectorAll('[data-abre]').forEach(b => b.onclick = () => abreLicao(licoes().find(l => l.id === b.dataset.abre)));
  box.querySelectorAll('[data-dia]').forEach(b => b.onclick = () => { hojeDiaSel = b.dataset.dia; renderHoje(); });
  const fx = box.querySelector('.faixa-dias');
  // o dia escolhido no meio da faixa (hoje, de cara, fica no fim — não tem amanhã)
  // (já, e não num requestAnimationFrame: medir força o layout, e aba em segundo plano
  // nunca roda o frame)
  const sel = fx && fx.querySelector('.dia.sel');
  if (sel) fx.scrollLeft += sel.getBoundingClientRect().left - fx.getBoundingClientRect().left - fx.clientWidth / 2 + sel.clientWidth / 2;
  box.querySelectorAll('[data-edita]').forEach(b => b.onclick = () => {
    const l = licoes().find(x => x.id === b.dataset.edita);
    if (l && !l.suportada) { alert('Esta lição (' + nomeDaPauta(l.pauta) + ') só roda no iPhone. Edite por lá.'); return; }
    abreEditorLicao(l);
  });
}

// ── o editor (folha de baixo) ───────────────────────────────
let licaoEditando = null;
function abreEditorLicao(l) {
  licaoEditando = l ? JSON.parse(JSON.stringify(l))
    : { id: novoIdDeLicao(), hora: '08:00', dias: [1, 2, 3, 4, 5], pauta: { fonte: 'vencidas', tipo: 'palavra', limite: 20, modo: 'mix', origens: [], temas: [] }, nova: true };
  renderEditorLicao();
  $('licaosheet').classList.add('show');
}
function fechaEditorLicao() { $('licaosheet').classList.remove('show'); licaoEditando = null; }
function renderEditorLicao() {
  const l = licaoEditando, p = l.pauta;
  if (!LICAO_MODOS[p.tipo].includes(p.modo)) p.modo = 'mix';
  const chip = (ativo, attrs, txt) => '<button class="chip' + (ativo ? ' active' : '') + '" ' + attrs + '>' + txt + '</button>';
  const caps = capitulosDoCurso();
  let h = '<h3>' + (l.nova ? 'Nova lição' : 'Editar lição') + '</h3>' +
    '<div class="sheetsep">de onde vêm as cartas</div><div class="chips le-chips">' +
    chip(p.fonte === 'vencidas', 'data-fonte="vencidas"', 'O que vence hoje') +
    chip(p.fonte === 'maisErro', 'data-fonte="maisErro"', 'As que eu mais erro') +
    chip(p.fonte === 'recorte', 'data-fonte="recorte"', 'Capítulos') + '</div>';
  if (p.fonte === 'recorte') h += '<div class="chips le-chips">' + caps.map(c =>
    chip((p.origens || []).includes(c), 'data-cap="' + c + '"', origemLabel(c))).join('') + '</div>';
  h += '<div class="sheetsep">o quê</div><div class="chips le-chips">' +
    chip(p.tipo === 'palavra', 'data-tipo="palavra"', 'Palavras') + (temFrases() ? chip(p.tipo === 'frase', 'data-tipo="frase"', 'Frases') : '') + '</div>' +
    '<div class="sheetsep">quantas</div><div class="chips le-chips">' + LICAO_LIMITES.map(n => chip(p.limite === n, 'data-lim="' + n + '"', n)).join('') + '</div>' +
    '<div class="sheetsep">como pergunta</div><div class="chips le-chips">' + LICAO_MODOS[p.tipo].map(m =>
      chip(p.modo === m, 'data-modo="' + m + '"', esc(MODE_TITLES[m] || m))).join('') + '</div>' +
    '<div class="sheetsep">quando</div><div class="le-quando"><input type="time" id="le-hora" value="' + esc(l.hora) + '">' +
    '<div class="le-dias">' + DIAS_CURTO.map((d, i) => chip(l.dias.includes(i), 'data-dia="' + i + '"', d)).join('') + '</div></div>' +
    '<div class="le-botoes"><button class="exprox" id="le-salva">Salvar</button>' +
    (l.nova ? '' : '<button class="typeskip le-apaga" id="le-apaga">Apagar lição</button>') + '</div>';
  const box = $('licao-corpo');
  box.innerHTML = h;
  const re = () => { l.hora = $('le-hora').value || l.hora; renderEditorLicao(); };
  box.querySelectorAll('[data-fonte]').forEach(b => b.onclick = () => { p.fonte = b.dataset.fonte; re(); });
  box.querySelectorAll('[data-cap]').forEach(b => b.onclick = () => {
    const o = new Set(p.origens || []); o.has(b.dataset.cap) ? o.delete(b.dataset.cap) : o.add(b.dataset.cap); p.origens = [...o]; re();
  });
  box.querySelectorAll('[data-tipo]').forEach(b => b.onclick = () => { p.tipo = b.dataset.tipo; re(); });
  box.querySelectorAll('[data-lim]').forEach(b => b.onclick = () => { p.limite = +b.dataset.lim; re(); });
  box.querySelectorAll('[data-modo]').forEach(b => b.onclick = () => { p.modo = b.dataset.modo; re(); });
  box.querySelectorAll('[data-dia]').forEach(b => b.onclick = () => {
    const d = +b.dataset.dia; l.dias = l.dias.includes(d) ? l.dias.filter(x => x !== d) : l.dias.concat([d]); re();
  });
  $('le-salva').onclick = () => {
    l.hora = $('le-hora').value || '08:00';
    if (!l.dias.length) { alert('Marque pelo menos um dia da semana.'); return; }
    if (p.fonte === 'recorte' && !(p.origens || []).length) { alert('Marque pelo menos um capítulo.'); return; }
    delete l.nova;
    salvaLicao(l); fechaEditorLicao(); renderHoje();
  };
  if ($('le-apaga')) $('le-apaga').onclick = () => {
    if (!confirm('Apagar a lição "' + nomeDaPauta(p) + '"? Ela some do iPhone também.')) return;
    apagaLicao(l.id); fechaEditorLicao(); renderHoje();
  };
}

exEstilo(`
.hoje-tit{margin:0 0 10px;font-size:17px;}
.hoje-sec{margin-top:14px;}
.hoje-rodape{margin:10px 4px 0;}
.faixa-cab{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin:0 2px 8px;}
.faixa-cab b{font-size:15px;}
.faixa-cab span{font-size:13px;color:var(--mut);}
.faixa-dias{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding:4px 2px 6px;}
.faixa-dias::-webkit-scrollbar{display:none;}
.dia{position:relative;flex:0 0 46px;height:68px;border:0;border-radius:23px;background:var(--surface);
  box-shadow:inset 0 0 0 1px var(--line);color:var(--txt);font:inherit;cursor:pointer;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:1px;padding:0;}
.dia .dsem{font-size:11px;font-weight:700;color:var(--soft);}
.dia .dnum{font-size:17px;font-weight:800;line-height:1.1;}
.dia.estudou .dnum{color:var(--red);}
.dia .dfogo{font-size:10px;height:12px;line-height:12px;}
/* o anel: um contorno que enche no sentido do relógio, por cima da borda */
.dia .danel{position:absolute;inset:0;border-radius:23px;pointer-events:none;padding:2.5px;
  background:conic-gradient(var(--red) var(--f), transparent 0);
  -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;}
.dia .danel.cheio{background:var(--ok);}
.dia.sel{background:var(--txt);}
.dia.sel .dsem,.dia.sel .dnum{color:var(--surface);}
.dia.sel.estudou .dnum{color:#ff8a9b;}
.dia.hoje:not(.sel){box-shadow:inset 0 0 0 1.5px var(--txt);}
.licao{display:flex;align-items:center;gap:6px;border-bottom:1px solid var(--line);}
.licao:last-of-type{border-bottom:0;}
.licao-abre,.licao-sug{flex:1;display:flex;align-items:center;gap:12px;text-align:left;border:0;background:none;
  color:var(--txt);font:inherit;padding:12px 6px;border-radius:12px;cursor:pointer;min-width:0;}
.licao-sug{width:100%;border-bottom:1px solid var(--line);border-radius:0;}
.licao-abre:hover:not(:disabled),.licao-sug:hover{background:var(--surface2);}
.licao-abre:disabled{cursor:default;opacity:.55;}
.licao-ico{flex:0 0 34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  background:var(--pill);color:var(--red);}
.licao.feita .licao-ico{background:var(--red);color:#fff;}
.licao-tx{display:flex;flex-direction:column;gap:2px;min-width:0;}
.licao-tx b{font-size:16px;}
.licao-tx small{font-size:13px;color:var(--mut);}
.licao-edita{flex:0 0 36px;height:36px;border:0;background:none;color:var(--soft);border-radius:50%;cursor:pointer;
  display:flex;align-items:center;justify-content:center;}
.licao-edita:hover{background:var(--surface2);color:var(--txt);}
.licao-edita .ico{width:16px;height:16px;}
.licao-mais{font-size:22px;color:var(--red);font-weight:700;padding:0 6px;}
.le-chips{flex-wrap:wrap;padding-bottom:0;}
.le-quando{display:flex;flex-wrap:wrap;align-items:center;gap:10px;}
.le-quando input,.le-nome{border:1px solid var(--line);background:var(--surface2);color:var(--txt);border-radius:10px;
  padding:9px 12px;font:inherit;font-size:15px;}
.le-nome{width:100%;box-sizing:border-box;}
.le-dias{display:flex;gap:6px;}
.le-dias .chip{width:38px;padding:7px 0;text-align:center;}
.le-botoes{display:flex;flex-direction:column;align-items:center;gap:10px;margin-top:20px;}
.le-apaga{color:var(--err);}
`);
