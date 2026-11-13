/* Mànmàn — 🗺️ A aba Curso: o livro como trilha, uma fase por capítulo, e as folhas de
   exercício do professor rodando dentro dela.

   No topo, a faixa de capítulos. Embaixo, o capítulo escolhido: o nome da lição e as
   seções Teoria e Exercícios. Cada peça tem um círculo que enche e vira ✓:
   - a nota, quando é lida (a mesma marca da aba Teoria);
   - as palavras e as frases, conforme cada carta se firma no SRS — fecha quando todas
     estão aprendidas;
   - a folha do professor, quando é feita até o fim.

   Nada aqui é um segundo progresso de carta: tocar em Palavras ou Frases abre uma
   rodada no Estudar com o capítulo como origem, no mesmo SRS de sempre. As folhas NÃO
   mexem no SRS: são uma lista fixa, na ordem do professor, com o gabarito dele, e o que
   fica gravado (neste aparelho, como no iOS) é onde a folha parou e quantas saíram
   certas de primeira.

   Os tipos de folha moram em js/ex-*.js e se registram em EX_TIPOS — ver o contrato
   logo abaixo. Tipo que o app não conhece some da lista em vez de abrir vazio. */
'use strict';

let exerciciosDB = [];
// O nome de cada lição do New Practical Chinese Reader 1. Não vem do dado: nem o seed
// nem a teoria dizem o título. Capítulo que não estiver aqui aparece só como "Cap. N".
const NOMES_CAP = {
  1: ['你好', 'Olá'], 2: ['你忙吗', 'Você está ocupado?'], 3: ['她是哪国人', 'De que país ela é?'],
  4: ['认识你很高兴', 'Prazer em conhecer você'], 5: ['餐厅在哪儿', 'Onde fica o restaurante?'],
  6: ['我们去游泳，好吗', 'Vamos nadar?'], 7: ['你认识不认识他', 'Você conhece ele?'],
  8: ['你们家有几口人', 'Quantas pessoas tem na sua família?']
};
const K_EX_FEITOS = 'manman.ex.feitos.v1';    // por usuário: id → { quando, total, acertos }
const K_EX_PARADOS = 'manman.ex.parados.v1';  // por usuário: id → { proximo, acertos, quando }
const K_CURSO_CAP = 'manman.curso.cap';       // o capítulo aberto na faixa (do aparelho)

// ── o contrato de um tipo de folha ──────────────────────────
// EX_TIPOS[tipo] = { icone: '🧩', montar(el, item, ex, api) }
//   el    — a <div> vazia onde o item se desenha
//   item  — o item da vez (ex.itens[i]); ex — a folha inteira (opcoes, glossario…)
//   api.responde(acertou) — chame UMA vez, quando a pessoa responder. Vale a primeira
//                tentativa, como no papel. O gabarito o próprio tipo mostra, ali mesmo;
//                o "Próxima" aparece sozinho no rodapé.
//   api.respondido()      — true depois do responde (pra travar os botões)
//   api.fala(hanzi)       — fala o texto (gravação da carta se existir; senão TTS)
//   api.silaba(py, tom?)  — toca uma sílaba da tabela de sons
//   api.gabarito(hanzi, pinyin, pt, acertou) — o bloco "对! / era" pronto, em HTML
// montar() é chamado de novo a cada item e a cada refazer, sempre com el limpo.
const EX_TIPOS = {};
// Cada js/ex-*.js traz o seu CSS por aqui, pra não espalhar regra no index.html.
function exEstilo(css) {
  const s = document.createElement('style');
  s.textContent = css;
  document.head.appendChild(s);
}

async function loadExercicios() {
  try { exerciciosDB = await (await fetch('./seed/exercicios.json')).json(); } catch (e) { exerciciosDB = []; }
  if (!Array.isArray(exerciciosDB)) exerciciosDB = [];
}
function exerciciosDoCap(cap) {
  return exerciciosDB.filter(e => e.capitulo === cap && EX_TIPOS[e.tipo]).sort((a, b) => a.ordem - b.ordem);
}
function numCap(cap) { const m = /^cap(\d+)$/.exec(cap || ''); return m ? +m[1] : null; }
// Só capítulos: os extras e o Duolingo não são fase de livro nenhum.
function capitulosDoCurso() {
  const s = new Set(cards.map(c => c.fonte).filter(Boolean));
  teoriaDB.forEach(t => s.add(t.capitulo));
  exerciciosDB.forEach(e => s.add(e.capitulo));
  return [...s].filter(c => numCap(c) !== null).sort((a, b) => numCap(a) - numCap(b));
}
// As cartas que contam pro círculo: sem as desligadas (não caem em rodada nenhuma, e com
// elas o círculo nunca fecharia).
function cartasDoCap(cap, frase) {
  return cards.filter(c => c.fonte === cap && ehFrase(c) === frase && !isOff(c.id) && !palavraDesligada(c));
}
// Cada carta vale de 0 (nunca vista) a 1 (aprendida), pelo intervalo do agendamento:
// a primeira aprendida de verdade leva semanas, e um círculo parado em zero esse tempo
// todo não mostraria nada do que a pessoa já fez.
function progressoDe(lista) {
  let soma = 0, aprendidas = 0, vistas = 0;
  for (const c of lista) {
    const s = srs[c.id];
    soma += Math.min(1, ((s && s.ivl) || 0) / LEARNED_IVL);
    if (s && s.ivl >= LEARNED_IVL) aprendidas++;
    if (s && (s.reps > 0 || s.ivl > 0)) vistas++;
  }
  return { fracao: lista.length ? soma / lista.length : 0, aprendidas, vistas };
}
function exFeitos() { return load(uk(K_EX_FEITOS), {}); }
function exParados() { return load(uk(K_EX_PARADOS), {}); }
function pecasDoCap(cap) {
  const lidas = load(uk(K_TEORIA_LIDA), {}), feitos = exFeitos();
  let feitas = 0, total = 0;
  teoriaDoCap(cap).forEach(t => { total++; if (lidas[t.id]) feitas++; });
  exerciciosDoCap(cap).forEach(e => { total++; if (feitos[e.id]) feitas++; });
  [false, true].forEach(fr => {
    const l = cartasDoCap(cap, fr);
    if (!l.length) return;
    total++;
    if (progressoDe(l).aprendidas === l.length) feitas++;
  });
  return { feitas, total };
}

// ── a trilha ────────────────────────────────────────────────
let cursoFolha = null;   // a folha aberta por cima da trilha, ou null
function capituloAtual() {
  const caps = capitulosDoCurso();
  const salvo = localStorage.getItem(K_CURSO_CAP);
  if (caps.includes(salvo)) return salvo;
  // o capítulo mais adiantado que o deck já tem: é onde a turma está
  return caps.length ? caps[caps.length - 1] : null;
}
// O círculo: um anel que enche, e o ✓ quando fecha.
function anel(fracao) {
  if (fracao >= 1) return '<span class="anel ok">✓</span>';
  const g = Math.round(Math.max(0, fracao) * 360);
  return '<span class="anel" style="background:conic-gradient(var(--red) ' + g + 'deg, var(--line) 0)"><i></i></span>';
}
function linhaCurso(attrs, icone, titulo, sub, fracao) {
  return '<button class="cursolinha" ' + attrs + '>' + anel(fracao) +
    '<span class="cl-ico">' + icone + '</span><span class="cl-tx"><b>' + esc(titulo) + '</b><small>' + esc(sub) + '</small></span>' +
    '<span class="cl-seta">›</span></button>';
}
function renderCurso() {
  const box = $('curso-corpo');
  if (cursoFolha) return renderFolha();
  const caps = capitulosDoCurso();
  const cap = capituloAtual();
  if (!cap) { box.innerHTML = '<p class="vazio">Nenhum capítulo no deck ainda.</p>'; $('curso-faixa').innerHTML = ''; return; }
  $('curso-faixa').innerHTML = caps.map(c => {
    const p = pecasDoCap(c);
    const f = p.total ? p.feitas / p.total : 0;
    return '<button class="capchip' + (c === cap ? ' active' : '') + '" data-cap="' + c + '" style="--f:' + Math.round(f * 360) + 'deg">' +
      '<span>' + numCap(c) + '</span></button>';
  }).join('');
  $('curso-faixa').querySelectorAll('.capchip').forEach(b => b.onclick = () => {
    localStorage.setItem(K_CURSO_CAP, b.dataset.cap); renderCurso();
  });
  const nome = NOMES_CAP[numCap(cap)];
  const lidas = load(uk(K_TEORIA_LIDA), {}), feitos = exFeitos(), parados = exParados();
  let h = '<div class="capcard"><small>' + esc(origemLabel(cap)) + '</small><b class="zh" lang="zh-Hans">' +
    esc(nome ? nome[0] : origemLabel(cap)) + '</b>' + (nome ? '<span>' + esc(nome[1]) + '</span>' : '') + '</div>';
  const notas = teoriaDoCap(cap);
  if (notas.length) {
    h += '<div class="sheetsep">teoria</div>';
    notas.forEach((t, i) => { h += linhaCurso('data-nota="' + i + '"', '📚', t.titulo, t.resumo || '', lidas[t.id] ? 1 : 0); });
  }
  const palavras = cartasDoCap(cap, false), frases = cartasDoCap(cap, true), folhas = exerciciosDoCap(cap);
  if (palavras.length || frases.length || folhas.length) {
    h += '<div class="sheetsep">exercícios</div>';
    [[false, palavras, 'Palavras', '汉'], [true, frases, 'Frases', '💬']].forEach(([fr, l, nomeT, ico]) => {
      if (!l.length) return;
      const p = progressoDe(l);
      const sub = p.vistas === 0 ? l.length + (fr ? ' frases novas' : ' palavras novas') : p.aprendidas + ' de ' + l.length + ' aprendidas';
      h += linhaCurso('data-cartas="' + (fr ? 'frase' : 'palavra') + '"', ico, nomeT, sub, p.aprendidas === l.length ? 1 : Math.min(p.fracao, 0.99));
    });
    folhas.forEach(e => {
      const f = feitos[e.id], par = parados[e.id] && parados[e.id].proximo < e.itens.length ? parados[e.id] : null;
      // largada no meio fala mais alto que feita antes: é o que se vai encontrar ao tocar
      const sub = par ? 'Parou no ' + (par.proximo + 1) + ' de ' + e.itens.length + ' · toque para continuar'
        : f ? f.acertos + ' de ' + f.total + ' de primeira · toque para refazer' : e.resumo;
      const fr = par ? Math.min(0.99, par.proximo / Math.max(1, e.itens.length)) : f ? 1 : 0;
      h += linhaCurso('data-folha="' + esc(e.id) + '"', EX_TIPOS[e.tipo].icone || '📋', e.titulo, sub, fr);
    });
    h += '<p class="cursonota">' + (folhas.length
      ? 'As palavras e as frases enchem o círculo conforme se firmam na revisão. Os exercícios do professor fecham quando são feitos até o fim — e não mexem na revisão.'
      : 'As palavras e as frases enchem o círculo conforme se firmam na revisão; ele fecha quando todas estão aprendidas.') + '</p>';
  }
  box.innerHTML = h;
  box.querySelectorAll('[data-nota]').forEach(b => b.onclick = () => abreNotaDoCurso(cap, +b.dataset.nota));
  box.querySelectorAll('[data-cartas]').forEach(b => b.onclick = () => estudarCapitulo(cap, b.dataset.cartas));
  box.querySelectorAll('[data-folha]').forEach(b => b.onclick = () => abreFolha(exerciciosDB.find(e => e.id === b.dataset.folha)));
}
// A nota abre no leitor da aba Teoria, e o ‹ de lá volta pra cá.
function abreNotaDoCurso(cap, i) {
  switchView('teoria');
  leitura = { titulo: origemLabel(cap), notas: teoriaDoCap(cap), i };
  teoriaTela = 'nota';
  teoriaVoltaPro = 'curso';
  renderTeoria();
}
// A rodada do capítulo: o Estudar com o capítulo como única origem, no 🔀 (que já
// sorteia um modo por carta). Troca o escopo salvo de propósito — é o que a pessoa vai
// encontrar no Estudar, e é o mesmo gesto de escolher o chip "Cap. N" lá.
function estudarCapitulo(cap, tipo) {
  settings.tipo = tipo;
  settings.decks = []; settings.origens = [cap]; settings.erro = null;
  settings.mode = 'mix';
  save(K.settings, settings);
  renderModeSheet(); renderModeUI(); startSession();
  switchView('estudar');
}

// ── uma folha do professor ──────────────────────────────────
// Cada item se responde UMA vez: vale a primeira tentativa. Respondido, o gabarito
// aparece ali mesmo e o rodapé passa para o próximo. Sair no meio não perde nada: cada
// resposta grava de onde a folha continua, e o item que estava na tela sem resposta
// recomeça limpo — meia montagem não é resposta.
let folhaIdx = 0, folhaAcertos = 0, folhaResp = null, folhaFim = false;
function abreFolha(ex) {
  if (!ex) return;
  cursoFolha = ex;
  folhaIdx = 0; folhaAcertos = 0; folhaResp = null; folhaFim = false;
  const p = exParados()[ex.id];
  if (p) {
    folhaAcertos = p.acertos;
    if (p.proximo >= ex.itens.length) { registraFolha(); folhaFim = true; } else folhaIdx = p.proximo;
  }
  renderCurso();
  window.scrollTo(0, 0);
}
function fechaFolha() {
  cursoFolha = null;
  if (somTocando) somTocando.pause();
  renderCurso();
}
function paraFolha(valor) {
  const ps = exParados();
  if (valor) ps[cursoFolha.id] = valor; else delete ps[cursoFolha.id];
  save(uk(K_EX_PARADOS), ps);
}
function registraFolha() {
  const fs = exFeitos();
  fs[cursoFolha.id] = { quando: Date.now(), total: cursoFolha.itens.length, acertos: folhaAcertos };
  save(uk(K_EX_FEITOS), fs);
  paraFolha(null);
}
function refazFolha() {
  paraFolha(null);
  folhaIdx = 0; folhaAcertos = 0; folhaResp = null; folhaFim = false;
  renderFolha();
}
function exGabarito(hanzi, pinyin, pt, acertou) {
  return '<div class="exgab ' + (acertou ? 'ok' : 'erro') + '"><small>' + (acertou ? '对!' : 'era') + '</small>' +
    '<b class="zh" lang="zh-Hans">' + esc(hanzi) + '</b>' +
    (pinyin ? '<span class="pinyin">' + pinyinColored(pinyin).replace(/<span class="pron">.*?<\/span>/, '') + '</span>' : '') +
    (pt ? '<span class="pt">' + esc(pt) + '</span>' : '') + '</div>';
}
function renderFolha() {
  const ex = cursoFolha, n = ex.itens.length;
  $('curso-faixa').innerHTML = '';
  const box = $('curso-corpo');
  const temAndamento = !folhaFim && (folhaIdx > 0 || folhaResp !== null);
  let h = '<div class="teoria-cab"><button class="tvolta" id="folha-sair" title="Voltar ao curso">‹</button>' +
    '<h3>' + esc(ex.titulo) + '</h3>' +
    (temAndamento ? '<button class="tvolta" id="folha-recomeca" title="Recomeçar do zero">↺</button>' : '') + '</div>';
  if (folhaFim) {
    const r = folhaAcertos / Math.max(1, n);
    h += '<div class="exfim ' + (folhaAcertos === n ? 'ok' : r >= 0.5 ? 'meio' : 'erro') + '"><b>' + folhaAcertos + ' de ' + n + '</b>' +
      '<span>certos de primeira</span>' + (ex.origem ? '<small>' + esc(ex.origem) + '</small>' : '') + '</div>' +
      '<div class="exbotoes"><button class="exprox" id="folha-volta">Voltar ao curso</button>' +
      '<button class="typeskip" id="folha-refaz">↺ Refazer</button></div>';
    box.innerHTML = h;
    $('folha-sair').onclick = fechaFolha;
    $('folha-volta').onclick = fechaFolha;
    $('folha-refaz').onclick = refazFolha;
    return;
  }
  const feitosAqui = folhaIdx + (folhaResp === null ? 0 : 1);
  h += '<div class="exandamento"><span>' + (EX_TIPOS[ex.tipo].icone || '📋') + ' ' + (folhaIdx + 1) + ' de ' + n +
    ' · do professor · não mexe na revisão</span><div class="exbarra"><i style="width:' + (100 * feitosAqui / n) + '%"></i></div></div>' +
    '<div class="excard"><div class="exitem" id="exitem"></div><div class="exrodape" id="exrodape"></div></div>';
  box.innerHTML = h;
  $('folha-sair').onclick = fechaFolha;
  if ($('folha-recomeca')) $('folha-recomeca').onclick = () => {
    if (confirm('Recomeçar do zero? As respostas desta volta somem e a folha começa do primeiro item.')) refazFolha();
  };
  const api = {
    responde(acertou) {
      if (folhaResp !== null) return;
      folhaResp = !!acertou;
      if (acertou) folhaAcertos++;
      paraFolha({ proximo: folhaIdx + 1, acertos: folhaAcertos, quando: Date.now() });
      rodapeFolha();
      // o andamento sobe junto, sem redesenhar o item (o gabarito está nele)
      const barra = box.querySelector('.exbarra i');
      if (barra) barra.style.width = (100 * (folhaIdx + 1) / n) + '%';
    },
    respondido() { return folhaResp !== null; },
    fala: falaTexto,
    silaba: tocaSilaba,
    gabarito: exGabarito
  };
  try { EX_TIPOS[ex.tipo].montar($('exitem'), ex.itens[folhaIdx], ex, api); }
  catch (e) { $('exitem').innerHTML = '<p class="vazio">Este item não abriu: ' + esc(e.message) + '</p>'; console.error(e); }
  rodapeFolha();
}
function rodapeFolha() {
  const r = $('exrodape');
  if (!r) return;
  if (folhaResp === null) { r.innerHTML = ''; return; }
  const ultimo = folhaIdx + 1 >= cursoFolha.itens.length;
  r.innerHTML = '<button class="exprox" id="exprox">' + (ultimo ? 'Terminar' : 'Próxima') + '</button>';
  $('exprox').onclick = () => {
    if (ultimo) { registraFolha(); folhaFim = true; }
    else { folhaIdx++; folhaResp = null; }
    renderFolha();
    window.scrollTo(0, 0);
  };
}
function saiCurso() { /* a folha fica onde está: voltar à aba cai no mesmo item */ }

exEstilo(`
.curso-faixa{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;padding:2px 0 12px;}
.curso-faixa::-webkit-scrollbar{display:none;}
.capchip{flex:0 0 auto;width:46px;height:46px;border-radius:50%;border:0;padding:3px;cursor:pointer;
  background:conic-gradient(var(--red) var(--f), var(--line) 0);font:inherit;}
.capchip span{display:flex;width:100%;height:100%;border-radius:50%;align-items:center;justify-content:center;
  background:var(--surface);color:var(--txt);font-weight:800;font-size:16px;}
.capchip.active span{background:var(--red);color:#fff;}
.capcard{display:flex;flex-direction:column;gap:2px;padding:18px;border-radius:var(--radius);background:var(--surface2);border:1px solid var(--line);}
.capcard small{color:var(--mut);font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:.4px;}
.capcard b{font-size:30px;font-weight:500;}
.capcard span{color:var(--mut);font-size:15px;}
.cursolinha{display:flex;align-items:center;gap:12px;width:100%;text-align:left;padding:12px;margin-bottom:6px;
  border:1px solid var(--line);border-radius:14px;background:var(--surface);color:var(--txt);font:inherit;cursor:pointer;}
.cursolinha:hover{background:var(--surface2);}
.anel{flex:0 0 26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;}
.anel i{width:18px;height:18px;border-radius:50%;background:var(--surface);}
.anel.ok{background:var(--ok);color:#fff;font-size:14px;font-weight:800;}
.cl-ico{flex:0 0 26px;text-align:center;font-size:19px;}
.cl-tx{flex:1;display:flex;flex-direction:column;gap:2px;min-width:0;}
.cl-tx b{font-size:16px;}
.cl-tx small{font-size:13px;color:var(--mut);}
.cl-seta{color:var(--soft);font-size:22px;}
.cursonota{color:var(--soft);font-size:12.5px;line-height:1.45;margin:6px 4px 0;}
.exandamento{display:flex;flex-direction:column;gap:6px;margin:0 0 12px;color:var(--mut);font-size:13px;font-weight:600;}
.exbarra{height:4px;border-radius:99px;background:var(--line);overflow:hidden;}
.exbarra i{display:block;height:100%;background:var(--red);transition:width .25s;}
.excard{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow);
  padding:20px 16px;display:flex;flex-direction:column;gap:16px;min-height:340px;}
.exitem{flex:1;display:flex;flex-direction:column;gap:14px;}
.exrodape:empty{display:none;}
/* o "Próxima" fica preso no pé da tela: na leitura o texto é longo, e rolar até o fim
   dele a cada afirmação era o gesto mais repetido da folha */
.exrodape{position:sticky;bottom:12px;z-index:2;}
.exrodape .exprox{box-shadow:var(--shadow);}
.exprox{width:100%;border:0;border-radius:12px;background:var(--red);color:#fff;font:inherit;font-weight:800;font-size:16px;padding:14px;cursor:pointer;}
.exgab{display:flex;flex-direction:column;align-items:center;gap:4px;padding:12px;border-radius:14px;text-align:center;}
.exgab.ok{background:var(--ok-bg);} .exgab.erro{background:var(--err-bg);}
.exgab small{font-weight:800;font-size:13px;color:var(--mut);}
.exgab.ok small{color:var(--ok);} .exgab.erro small{color:var(--err);}
.exgab b{font-size:26px;font-weight:500;}
.exgab .pinyin{font-size:16px;}
.exgab .pt{color:var(--mut);font-size:14px;}
.exfim{display:flex;flex-direction:column;align-items:center;gap:6px;padding:28px 16px;border-radius:22px;margin-bottom:16px;}
.exfim.ok{background:var(--ok-bg);} .exfim.meio{background:var(--warn-bg);} .exfim.erro{background:var(--err-bg);}
.exfim b{font-size:40px;}
.exfim span{color:var(--mut);font-weight:700;}
.exfim small{color:var(--soft);font-size:12px;}
.exbotoes{display:flex;flex-direction:column;gap:10px;align-items:center;}
`);
