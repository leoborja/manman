/* Mànmàn — O que veio do app iOS: a literal das frases, de que é feito cada 汉字, as
   notas de teoria e a tabela de sons do pinyin.

   O conteúdo é escrito à mão no repositório do iOS e chega aqui pelo
   tools/traz_do_ios.sh (seed/literal.json, ideogramas.json, teoria.json, sons.json e
   audio/sons/). Nada disso tem coluna no banco: é texto do app, igual pra todo mundo.
   Faltou um arquivo (primeira abertura offline), a parte dele some sem erro. */
'use strict';

let literalDB = {};      // id da frase → "我=eu|是=ser|巴西=Brasil|人=pessoa"
let ideogramasDB = {};   // 汉字 → { sentido, tipo, partes: [{c, py?, pt, papel}], explica }
let teoriaDB = [];       // [{ id, capitulo, ordem, titulo, resumo, blocos: [...] }]
let sonsDB = null;       // { grupos, finais, iniciais, dicaInicial, dicaFinal, silabas }
const K_TEORIA_LIDA = 'manman.teoria.lida.v1'; // por usuário: id da nota → ms da última leitura

async function loadConteudoIOS() {
  const pega = async (arq, vazio) => {
    try { return await (await fetch('./seed/' + arq)).json(); } catch (e) { return vazio; }
  };
  [literalDB, ideogramasDB, teoriaDB, sonsDB] = await Promise.all([
    pega('literal.json', {}), pega('ideogramas.json', {}), pega('teoria.json', []), pega('sons.json', null)]);
  if (!Array.isArray(teoriaDB)) teoriaDB = [];
}

// ── literal: a frase palavra a palavra ──────────────────────
// Só vale quando os pedaços colados dão o 汉字 da carta: a frase mudou no banco e a linha
// do literal.json ficou pra trás? Literal ausente é melhor que literal de outra frase.
function literalPedacos(card) {
  if (!ehFrase(card)) return null; // palavra não tem literal: ela É a tradução
  const txt = literalDB[card.id];
  if (!txt) return null;
  const out = [];
  for (const parte of txt.split('|')) {
    const i = parte.indexOf('=');
    if (i <= 0 || i === parte.length - 1) return null;
    out.push({ hanzi: parte.slice(0, i), pt: parte.slice(i + 1) });
  }
  return out.map(p => p.hanzi).join('') === limpaHanzi(card.hanzi) ? out : null;
}
// A partícula sem palavra equivalente (吗 [pergunta]) sai mais apagada: diz o que FAZ.
function htmlLiteral(card) {
  const ps = literalPedacos(card);
  if (!ps) return '';
  return '<div class="literal" aria-label="Literal: ' + esc(ps.map(p => p.pt).join(', ')) + '">' +
    ps.map(p => '<span class="lit' + (p.pt.charAt(0) === '[' ? ' fn' : '') + '"><b class="zh" lang="zh-Hans">' +
      esc(p.hanzi) + '</b><i>' + esc(p.pt) + '</i></span>').join('') + '</div>';
}

// ── de que é feito cada 汉字 ────────────────────────────────
const IDEIA_TIPO = { desenho: 'desenho', ideia: 'ideia', som: 'sentido + som', outro: 'outra origem' };
// Os caracteres da carta que têm explicação, na ordem e sem repetir (谢谢 explica o 谢 uma
// vez só). Frase não ganha: já tem a literal, e dez blocos empurrariam a tradução pra longe.
function ideogramasDaCarta(card) {
  if (ehFrase(card)) return [];
  const vistos = new Set();
  return [...card.hanzi].filter(c => ideogramasDB[c] && !vistos.has(c) && vistos.add(c))
    .map(c => [c, ideogramasDB[c]]);
}
function temIdeia(card) { return settings.ideias !== false && ideogramasDaCarta(card).length > 0; }
// 昨  ontem                        sentido + som
//     日 sol, dia  +  乍 zhà · som
//     O 日 põe a palavra no campo do tempo; o 乍 só empresta o som.
function htmlIdeogramas(card) {
  return ideogramasDaCarta(card).map(([c, e]) =>
    '<div class="ideia">' +
      '<div class="ic zh" lang="zh-Hans">' + esc(c) + '</div>' +
      '<div class="ib">' +
        '<div class="ih"><b>' + esc(e.sentido) + '</b><span>' + esc(IDEIA_TIPO[e.tipo] || '') + '</span></div>' +
        ((e.partes || []).length ? '<div class="ip">' + e.partes.map((p, i) =>
          (i ? '<span class="mais">+</span>' : '') + '<span class="pc"><b class="zh" lang="zh-Hans">' + esc(p.c) + '</b>' +
          (p.papel === 'som'
            ? '<i class="som">' + (p.py ? esc(p.py) + ' · ' : '') + 'som</i>'
            : '<i class="' + (p.papel === 'ideia' ? 'id' : '') + '">' + esc(p.pt) + '</i>') +
          '</span>').join('') + '</div>' : '') +
        '<div class="ix">' + esc(e.explica) + '</div>' +
      '</div></div>').join('');
}

// ── som de uma sílaba solta (a voz da tabela) ───────────────
// "bā" → audio/sons/som-ba1.mp3. ü vira v no nome do arquivo. O neutro não tem gravação
// (sílaba sem tom não existe sozinha), e aí fica quieto — igual ao iOS.
function silabaSemTom(s) {
  return String(s).normalize('NFD').replace(/[̀́̄̌]/g, '').normalize('NFC').toLowerCase();
}
let somTocando = null;
function tocaSilaba(sil, tom) {
  const t = tom || toneOf(sil);
  if (t < 1 || t > 4) return;
  if (somTocando) somTocando.pause();
  if ('speechSynthesis' in window) speechSynthesis.cancel(); // som novo cala o anterior
  const a = new Audio('./audio/sons/som-' + silabaSemTom(sil).replace(/ü/g, 'v') + t + '.mp3');
  if (settings.lento) { a.preservesPitch = a.webkitPreservesPitch = true; a.playbackRate = VEL_LENTA; }
  somTocando = a;
  a.play().catch(() => {});
}
// O exemplo da teoria fala com a gravação da carta quando ele É uma carta do deck (as
// frases guardam o hanzi sem a pontuação do fim); senão, com a voz do aparelho.
function falaTexto(hanzi) {
  const limpo = limpaHanzi(hanzi);
  const c = cards.find(x => limpaHanzi(x.hanzi) === limpo);
  speak(c || { hanzi: hanzi }, false);
}

// ── 📚 teoria ───────────────────────────────────────────────
// A lista é por capítulo, na ordem do livro, e cada linha diz quando aquela nota foi lida
// pela última vez: é isso que mostra o que está esquecido. O "Relembrar" faz a conta por
// você — abre todas, as nunca lidas primeiro e depois a lida há mais tempo.
// A marca de lida fica neste aparelho (como no iOS): é lembrete, não progresso.
let teoriaLida = {};
let teoriaTela = 'lista';   // 'lista' | 'nota' | 'sons'
let leitura = null;         // { titulo, notas, i }
let teoriaVoltaPro = null;  // 'curso' quando a nota foi aberta pela trilha: o ‹ volta pra lá
function capitulosDaTeoria() {
  return [...new Set(teoriaDB.map(t => t.capitulo))].sort((a, b) => ordemOrigem(a) - ordemOrigem(b) || a.localeCompare(b));
}
function teoriaDoCap(cap) { return teoriaDB.filter(t => t.capitulo === cap).sort((a, b) => a.ordem - b.ordem); }
function teoriaParaRelembrar() {
  return capitulosDaTeoria().flatMap(teoriaDoCap).map((t, i) => [t, i]).sort((a, b) => {
    const la = teoriaLida[a[0].id], lb = teoriaLida[b[0].id];
    if ((la || 0) === (lb || 0)) return a[1] - b[1];
    if (!la) return -1;
    if (!lb) return 1;
    return la - lb;
  }).map(x => x[0]);
}
function quandoLida(ms) {
  if (!ms) return 'nunca lida';
  const dia = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); };
  const n = Math.round((dia(Date.now()) - dia(ms)) / 864e5);
  return n < 1 ? 'lida hoje' : n === 1 ? 'lida ontem' : 'lida há ' + n + ' dias';
}
function marcaLida(t) {
  teoriaLida[t.id] = Date.now();
  save(uk(K_TEORIA_LIDA), teoriaLida);
}
// A aba Teoria do menu. Entrar nela volta sempre pra lista: quem saiu no meio de uma
// nota e voltou dias depois quer ver o que está esquecido, não a página onde parou.
function abreTeoria() {
  teoriaLida = load(uk(K_TEORIA_LIDA), {});
  teoriaVoltaPro = null;
  teoriaTela = 'lista';
  sonsSilaba = null;
  renderTeoria();
}
function saiTeoria() { if (somTocando) somTocando.pause(); }
function renderTeoria() {
  const box = $('teoria-corpo');
  if (teoriaTela === 'nota') return renderNota(box);
  if (teoriaTela === 'sons') return renderSons(box);
  $('teoria-titulo').textContent = 'Teoria';
  $('teoria-voltar').style.display = 'none';
  if (!teoriaDB.length) {
    box.innerHTML = '<p class="vazio">Nenhuma nota de teoria carregada — abra com internet uma vez.</p>';
    return;
  }
  const nunca = teoriaDB.filter(t => !teoriaLida[t.id]).length;
  let h = '<button class="tlinha topo" data-acao="relembrar"><span class="ticone">↻</span><span class="tinfo"><b>Relembrar</b><small>' +
    (nunca ? (nunca === 1 ? '1 nota nunca lida' : nunca + ' notas nunca lidas') : 'começa pela que você leu há mais tempo') +
    '</small></span></button>';
  if (sonsDB) h += '<button class="tlinha topo" data-acao="sons"><span class="ticone">🔤</span><span class="tinfo"><b>Sons do pinyin</b><small>iniciais × finais, cada sílaba nos quatro tons</small></span></button>';
  for (const cap of capitulosDaTeoria()) {
    h += '<div class="sheetsep">' + esc(origemLabel(cap)) + '</div>';
    teoriaDoCap(cap).forEach((t, i) => {
      h += '<button class="tlinha" data-cap="' + esc(cap) + '" data-i="' + i + '">' +
        '<span class="tponto' + (teoriaLida[t.id] ? '' : ' on') + '"></span>' +
        '<span class="tinfo"><b>' + esc(t.titulo) + '</b><small>' + esc(t.resumo || '') + '</small>' +
        '<em>' + quandoLida(teoriaLida[t.id]) + '</em></span></button>';
    });
  }
  box.innerHTML = h;
  window.scrollTo(0, 0);
  box.querySelectorAll('.tlinha').forEach(b => b.onclick = () => {
    if (b.dataset.acao === 'sons') { teoriaTela = 'sons'; renderTeoria(); return; }
    leitura = b.dataset.acao === 'relembrar'
      ? { titulo: 'Relembrar', notas: teoriaParaRelembrar(), i: 0 }
      : { titulo: origemLabel(b.dataset.cap), notas: teoriaDoCap(b.dataset.cap), i: +b.dataset.i };
    teoriaTela = 'nota';
    renderTeoria();
  });
}
function renderNota(box) {
  const t = leitura.notas[leitura.i];
  marcaLida(t); // a nota que fica na tela conta como lida
  $('teoria-titulo').textContent = leitura.titulo + (leitura.notas.length > 1 ? ' · ' + (leitura.i + 1) + ' de ' + leitura.notas.length : '');
  $('teoria-voltar').style.display = '';
  let h = '<div class="nota-t"><h4>' + esc(t.titulo) + '</h4><p class="res">' + esc(t.resumo || '') + '</p>';
  t.blocos.forEach((b, i) => { h += blocoHtml(b, i); });
  h += '</div><div class="nota-nav">' +
    '<button class="typeskip" id="nota-ant"' + (leitura.i ? '' : ' disabled') + '>‹ anterior</button>' +
    '<button class="typeskip" id="nota-prox"' + (leitura.i < leitura.notas.length - 1 ? '' : ' disabled') + '>próxima ›</button></div>';
  box.innerHTML = h;
  window.scrollTo(0, 0);
  t.blocos.forEach((b, i) => { if (b.tipo === 'tracos') montaTracos(box.querySelector('[data-tr="' + i + '"]'), b); });
  box.querySelectorAll('[data-som]').forEach(el => el.onclick = () => tocaSilaba(el.dataset.som));
  box.querySelectorAll('[data-fala]').forEach(el => el.onclick = () => falaTexto(el.dataset.fala));
  $('nota-ant').onclick = () => { leitura.i--; renderTeoria(); };
  $('nota-prox').onclick = () => { leitura.i++; renderTeoria(); };
}
// Bloco de tipo que este app não conhece não aparece: o teoria.json pode andar na frente.
function blocoHtml(b, i) {
  switch (b.tipo) {
    case 'texto': return b.pt ? '<p>' + esc(b.pt) + '</p>' : '';
    case 'padrao': return '<div class="b-padrao">' + (b.hanzi ? '<b class="zh" lang="zh-Hans">' + esc(b.hanzi) + '</b>' : '') +
      (b.pt ? '<span>' + esc(b.pt) + '</span>' : '') + '</div>';
    case 'cuidado': return b.pt ? '<div class="b-cuidado">⚠️ ' + esc(b.pt) + '</div>' : '';
    case 'exemplo': return b.hanzi ? '<button class="b-exemplo" data-fala="' + esc(b.hanzi) + '">' +
      '<span><b class="zh" lang="zh-Hans">' + esc(b.hanzi) + '</b>' +
      (b.pinyin ? '<span class="pinyin">' + pinyinColored(b.pinyin).replace(/<span class="pron">.*?<\/span>/, '') + '</span>' : '') +
      (b.pt ? '<small>' + esc(b.pt) + '</small>' : '') + '</span><span class="ouvir">🔊</span></button>' : '';
    case 'som': return '<div class="b-som"><div class="l1">' + (b.hanzi ? '<b>' + esc(b.hanzi) + '</b>' : '') +
      (b.pt ? '<span>' + esc(b.pt) + '</span>' : '') + '</div>' +
      (b.pinyin ? '<div class="l2">' + b.pinyin.split(' ').filter(Boolean).map(s =>
        '<button data-som="' + esc(s) + '" style="color:' + TONE_COLORS[toneOf(s)] + '">' + esc(s) + ' 🔊</button>').join('') + '</div>' : '') + '</div>';
    case 'tracos': return '<div class="b-tracos" data-tr="' + i + '"></div>';
    default: return '';
  }
}
// As regras de escrita do livro (Lição introdutória). Dois jeitos: com `destaque`, um
// traço só em azul dentro de um ideograma conhecido, com o nome dele ao lado (横 héng);
// sem, os ideogramas se escrevem sozinhos um depois do outro, e tocar repete.
function montaTracos(el, b) {
  if (!el) return;
  const chars = [...(b.hanzi || '')].filter(c => strokesDB[c]);
  if (!chars.length) { el.innerHTML = '<b class="zh" lang="zh-Hans" style="font-size:40px">' + esc(b.hanzi || '') + '</b>'; return; }
  if (Array.isArray(b.destaque)) {
    const d = strokesDB[chars[0]];
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 1024 1024'); svg.setAttribute('width', 64); svg.setAttribute('height', 64);
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('transform', 'scale(1,-1) translate(0,-900)');
    d.s.forEach((p, k) => {
      const ph = document.createElementNS(NS, 'path');
      ph.setAttribute('d', p);
      ph.setAttribute('fill', b.destaque.includes(k) ? 'var(--rad)' : 'var(--pill)');
      g.appendChild(ph);
    });
    svg.appendChild(g);
    el.classList.add('destaque');
    el.appendChild(svg);
    const info = document.createElement('div');
    info.innerHTML = (b.nome ? '<b class="zh" lang="zh-Hans">' + esc(b.nome) + '</b>' : '') +
      (b.pinyin ? '<span class="py">' + esc(b.pinyin) + '</span>' : '') + (b.pt ? '<small>' + esc(b.pt) + '</small>' : '');
    el.appendChild(info);
    return;
  }
  const desenha = () => {
    el.innerHTML = '';
    let delay = 150;
    chars.forEach(c => { const r = buildStrokeSvg(c, 64, delay); el.appendChild(r.svg); delay = r.endDelay; });
    requestAnimationFrame(() => el.querySelectorAll('path[clip-path]').forEach(l => {
      void l.getBoundingClientRect(); l.style.strokeDashoffset = '0';
    }));
  };
  el.title = 'Toque para repetir';
  el.onclick = desenha;
  desenha();
}

// ── 🔤 sons do pinyin ───────────────────────────────────────
// A tabela inteira (21 × 36) não cabe no telefone, e rolar nos dois eixos perde o
// cabeçalho de vista. Então vem fatiada pelo lugar da boca, 3 ou 4 colunas por fatia —
// e a fatia também ensina: j/q/x só têm linhas de i e ü. Tocar na sílaba já a faz soar
// no 1º tom e mostra embaixo os quatro, com a dica de como soa cada pedaço. O "até o
// cap. N" apaga o que o livro ainda não deu, sem esconder.
let sonsGrupo = null;
let sonsSilaba = null;
const SONS_CAP_MAX = 5;
function sonsAteCap() {
  const v = parseInt(localStorage.getItem('manman.sons.ateCap') || '-1', 10);
  if (v >= 0) return v;
  const caps = cards.map(c => /^cap(\d+)$/.exec(c.fonte || '')).filter(Boolean).map(m => +m[1]);
  return Math.min(caps.length ? Math.max(...caps) : SONS_CAP_MAX, SONS_CAP_MAX);
}
function silabaDe(ini, fin) { return sonsDB.silabas.find(s => s.inicial === ini && s.final === fin); }
function renderSons(box) {
  $('teoria-titulo').textContent = 'Sons do pinyin';
  $('teoria-voltar').style.display = '';
  const ate = sonsAteCap();
  const vista = cap => ate === 0 || cap <= ate;
  if (!sonsGrupo) sonsGrupo = sonsDB.grupos[0].id;
  const g = sonsDB.grupos.find(x => x.id === sonsGrupo) || sonsDB.grupos[0];
  const finais = sonsDB.finais.filter(f => g.iniciais.some(i => silabaDe(i, f)));
  let h = '<div class="chips sons-grupos">' + sonsDB.grupos.map(x =>
    '<button class="chip' + (x.id === g.id ? ' active' : '') + '" data-g="' + esc(x.id) + '">' + esc(x.nome) + '</button>').join('') + '</div>';
  h += '<div class="chips sons-cap">' + [1, 2, 3, 4, 5, 0].map(n =>
    '<button class="chip' + (n === ate ? ' active' : '') + '" data-cap="' + n + '">' + (n ? 'até o cap. ' + n : 'todos') + '</button>').join('') + '</div>';
  h += '<table class="sons"><thead><tr><th></th>' + g.iniciais.map(i =>
    '<th class="' + (i === '' || vista(sonsDB.iniciais[i] || 1) ? '' : 'apagado') + '">' + esc(i || '—') + '</th>').join('') + '</tr></thead><tbody>';
  for (const f of finais) {
    h += '<tr><th>' + esc(f) + '</th>' + g.iniciais.map(i => {
      const s = silabaDe(i, f);
      if (!s) return '<td></td>';
      const on = sonsSilaba && sonsSilaba.pinyin === s.pinyin;
      return '<td><button class="sil' + (vista(s.cap) ? '' : ' apagado') + (on ? ' on' : '') + '" data-py="' + esc(s.pinyin) + '">' + esc(s.pinyin) + '</button></td>';
    }).join('') + '</tr>';
  }
  h += '</tbody></table>';
  if (sonsSilaba) {
    const s = sonsSilaba;
    const marca = (py, t) => { // põe o acento do tom na vogal certa: a/e primeiro, depois o o de ou, senão a última
      const M = { a: 'āáǎà', e: 'ēéěè', i: 'īíǐì', o: 'ōóǒò', u: 'ūúǔù', 'ü': 'ǖǘǚǜ' };
      let k = py.search(/[ae]/);
      if (k < 0) k = py.indexOf('ou');
      if (k < 0) { for (let j = py.length - 1; j >= 0; j--) if (M[py[j]]) { k = j; break; } }
      return k < 0 ? py : py.slice(0, k) + M[py[k]][t - 1] + py.slice(k + 1);
    };
    const di = sonsDB.dicaInicial[s.inicial], df = sonsDB.dicaFinal[s.final];
    h += '<div class="sons-folha"><div class="tons4">' + [1, 2, 3, 4].map(t =>
      '<button data-tom="' + t + '" style="color:' + TONE_COLORS[t] + '">' + esc(marca(s.pinyin, t)) + '<small>' + t + 'º</small></button>').join('') + '</div>' +
      (s.inicial && di ? '<p><b>' + esc(s.inicial) + '</b> ' + esc(di) + '</p>' : '') +
      (df ? '<p><b>' + esc(s.final) + '</b> ' + esc(df) + '</p>' : '') + '</div>';
  }
  box.innerHTML = h; // a página não rola sozinha: tocar numa sílaba deixa a tabela onde estava
  box.querySelectorAll('.sons-grupos .chip').forEach(b => b.onclick = () => { sonsGrupo = b.dataset.g; sonsSilaba = null; renderSons(box); });
  box.querySelectorAll('.sons-cap .chip').forEach(b => b.onclick = () => {
    localStorage.setItem('manman.sons.ateCap', b.dataset.cap); renderSons(box);
  });
  box.querySelectorAll('.sil').forEach(b => b.onclick = () => {
    sonsSilaba = sonsDB.silabas.find(s => s.pinyin === b.dataset.py);
    tocaSilaba(sonsSilaba.pinyin, 1);
    renderSons(box);
  });
  box.querySelectorAll('.tons4 button').forEach(b => b.onclick = () => tocaSilaba(sonsSilaba.pinyin, +b.dataset.tom));
}
function voltaTeoria() {
  if (teoriaVoltaPro) { const v = teoriaVoltaPro; teoriaVoltaPro = null; switchView(v); return; }
  teoriaTela = 'lista';
  sonsSilaba = null;
  renderTeoria();
}
