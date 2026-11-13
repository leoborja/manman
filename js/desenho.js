/* Mànmàn — Traçado animado e o modo desenhar: nota do traço, nota da ordem, grade e tinta. */
'use strict';

// ── traçado animado (dados do makemeahanzi) ─────────────────
let strokesDB = {};
let svgUid = 0;
// traço → componente de cada caractere (gerado pelo tools/build_radicals.py). É o que
// deixa a Grade pintar um radical de azul dentro do pictograma.
let radicalsDB = {};
// Os roteiros de conversa. Arquivo estático como os traçados, e não tabela no banco:
// é ORDEM de frases que já existem, não carta nova — e coluna nova exigiria DDL, que
// ninguém do time tem. Falhou o fetch (primeira abertura offline), o modo simplesmente
// não tem o que abrir e diz isso na tela.
async function loadDialogos() {
  try { dialogos = await (await fetch('./seed/dialogos.json')).json(); }
  catch (e) { dialogos = []; }
}
async function loadStrokes() {
  try { strokesDB = await (await fetch('./strokes/strokes.json')).json(); }
  catch (e) { strokesDB = {}; }
  try { radicalsDB = await (await fetch('./strokes/radicals.json')).json(); }
  catch (e) { radicalsDB = {}; }
}
// Os radicais que viram opção no seletor, com o que cada um quer dizer. É conhecimento
// (o significado do radical), não recorte do deck — por isso mora aqui e não no arquivo
// gerado. Só entram os que ENSINAM uma relação; traço solto que a decomposição separa
// (一, 丿, 亠…) fica de fora, mesmo aparecendo em muita carta. A lista some sozinha pro
// que o deck não tem: o seletor só mostra radical presente em ≥2 cartas da tela.
const RADICAIS = [
  ['氵', 'água'], ['木', 'árvore'], ['艹', 'planta'], ['火', 'fogo'], ['灬', 'fogo'],
  ['日', 'sol / dia'], ['月', 'lua / carne'], ['田', 'campo'], ['土', 'terra'], ['米', 'arroz'],
  ['口', 'boca'], ['女', 'mulher'], ['亻', 'pessoa'], ['人', 'pessoa'], ['子', 'filho'],
  ['父', 'pai'], ['马', 'cavalo'], ['扌', 'mão'], ['又', 'mão / de novo'], ['忄', 'coração'],
  ['心', 'coração'], ['讠', 'fala'], ['饣', 'comida'], ['彳', 'passo'], ['囗', 'cerca'],
  ['宀', 'teto'], ['疒', 'doença'], ['力', 'força'], ['阝', 'monte / cidade'],
  ['食', 'comida'], ['尸', 'construção'], ['厂', 'construção'], ['辶', 'movimento'],
  ['王', 'jade'],
];
const RADICAL_PT = Object.fromEntries(RADICAIS);
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
// plain = hanzi em texto, sem traçado. É o caso do relâmpago: o traçado leva ~1s pra
// desenhar e a resposta fica menos que isso na tela — apareceria pela metade.
function renderBackHanzi(card, plain) {
  const box = $('back-strokes');
  box.innerHTML = '';
  const chars = [...card.hanzi];
  if (!plain && chars.length && chars.every(c => strokesDB[c])) {
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

// ── desenho: a nota do traço ────────────────────────────────
// Compara ESQUELETO com ESQUELETO: reamostra as medianas do caractere e os traços do
// dedo em pontos igualmente espaçados e mede, dos DOIS lados, o quanto um cobre o outro.
// Só cobertura premiaria o rabisco que passa por tudo; só precisão premiaria o traço
// caprichado que esquece metade do caractere. A média harmônica exige os dois juntos.
const DRAW_BOX = 1024;      // o quadro do makemeahanzi; a grade na tela é esse quadro
const DRAW_PASSO = 12;      // reamostragem: um ponto a cada 12 unidades de traço
// Tolerância calibrada contra os 57 caracteres do deck (tools/test_nota.js): com 25/90
// um traço trêmulo mas certo passa dos 90 e NENHUM par de caracteres diferentes passa —
// o pior é 吗 contra 喝, que dá 88 porque dividem o 口 e quase toda a estrutura.
// Afrouxar pra 58/200 fazia 38% dos caracteres errados "acertarem".
const DRAW_PERTO = 25;      // até aqui o ponto vale 1
const DRAW_LONGE = 90;      // daqui pra fora vale 0, e no meio decai reto
const DRAW_ESC = [0.9, 1.12];  // o quanto o tamanho do desenho pode ser corrigido
const DRAW_DESLOC = 70;     // ...e o quanto a posição pode (7% do quadro)
const DRAW_OK = 90;         // a partir daqui é acerto
const DRAW_QUASE = 75;      // ...e daqui, "quase"
function reamostra(pts, passo) { // polilinha → pontos igualmente espaçados
  if (pts.length < 2) return pts.slice();
  const out = [pts[0].slice()];
  let falta = passo;
  for (let i = 1; i < pts.length; i++) {
    let x = pts[i - 1][0], y = pts[i - 1][1];
    const x1 = pts[i][0], y1 = pts[i][1];
    let resto = Math.hypot(x1 - x, y1 - y);
    while (resto >= falta && resto > 0) {
      const t = falta / resto;
      x += (x1 - x) * t; y += (y1 - y) * t;
      out.push([x, y]);
      resto -= falta;
      falta = passo;
    }
    falta -= resto;
  }
  return out;
}
function nuvemAlvo(ch) { // esqueleto oficial do caractere, já com o Y virado pra tela
  const d = strokesDB[ch];
  if (!d || !d.m) return null;
  const out = [];
  d.m.forEach(m => reamostra(m.map(p => [p[0], 900 - p[1]]), DRAW_PASSO).forEach(p => out.push(p)));
  return out.length ? out : null;
}
function centroRaio(pts) {
  let sx = 0, sy = 0;
  pts.forEach(p => { sx += p[0]; sy += p[1]; });
  const cx = sx / pts.length, cy = sy / pts.length;
  let s = 0;
  pts.forEach(p => { s += (p[0] - cx) * (p[0] - cx) + (p[1] - cy) * (p[1] - cy); });
  return { cx, cy, r: Math.sqrt(s / pts.length) };
}
// Encaixe com trava: corrige um pouco de tamanho e de posição, porque escrever com o dedo
// nunca cai no lugar exato. A trava é o que impede desenhar minúsculo num canto e tirar 100
// — a grade está ali justamente pra ensinar proporção e lugar.
function encaixa(tinta, alvo) {
  const a = centroRaio(tinta), b = centroRaio(alvo);
  const s = Math.min(DRAW_ESC[1], Math.max(DRAW_ESC[0], a.r > 1 ? b.r / a.r : 1));
  const dx = Math.max(-DRAW_DESLOC, Math.min(DRAW_DESLOC, b.cx - a.cx));
  const dy = Math.max(-DRAW_DESLOC, Math.min(DRAW_DESLOC, b.cy - a.cy));
  return tinta.map(p => [(p[0] - a.cx) * s + a.cx + dx, (p[1] - a.cy) * s + a.cy + dy]);
}
function proximidade(a, b) { // média do crédito de cada ponto de `a` ao vizinho mais perto em `b`
  let soma = 0;
  for (let i = 0; i < a.length; i++) {
    let melhor = Infinity;
    for (let j = 0; j < b.length; j++) {
      const dx = a[i][0] - b[j][0], dy = a[i][1] - b[j][1];
      const d2 = dx * dx + dy * dy;
      if (d2 < melhor) melhor = d2;
    }
    const d = Math.sqrt(melhor);
    soma += d <= DRAW_PERTO ? 1 : d >= DRAW_LONGE ? 0 : (DRAW_LONGE - d) / (DRAW_LONGE - DRAW_PERTO);
  }
  return a.length ? soma / a.length : 0;
}
function notaDesenho(ch, tracos) { // tracos: lista de polilinhas já em 0–1024
  const alvo = nuvemAlvo(ch);
  if (!alvo || !tracos || !tracos.length) return null;
  let tinta = [];
  tracos.forEach(t => reamostra(t, DRAW_PASSO).forEach(p => tinta.push(p)));
  if (tinta.length < 2) return null;
  tinta = encaixa(tinta, alvo);
  const cobertura = proximidade(alvo, tinta); // quanto do caractere você desenhou
  const precisao = proximidade(tinta, alvo);  // quanto do que você desenhou é o caractere
  const soma = cobertura + precisao;
  return {
    nota: Math.round(soma ? 2 * cobertura * precisao / soma * 100 : 0),
    cobertura, precisao,
    tracos: tracos.length,
    oficial: strokesDB[ch].m.length
  };
}

// ── desenho fácil: a nota da ORDEM ──────────────────────────
// Com o ideograma na tela a nota de proximidade deixa de medir: qualquer um cobre o
// fantasma e tira 100. O que sobra pra cobrar é justamente o que a outra nota não
// enxerga — a ORDEM e o SENTIDO dos traços, que é metade do que se aprende num 汉字 e o
// que o professor corrige na lousa. Duas notas diferentes porque são duas perguntas
// diferentes, não porque uma é a outra com desconto.
const ORD_MIN = 0.55;   // abaixo disto o traço não casa com traço oficial nenhum
// A válvula do ao vivo. O tools/test_ordem.js mostra que as duas faixas encostam (o pior
// traço certo dá 0.52 e o melhor traço de fora da vez dá 0.69), e o dedo de verdade treme
// mais que o dedo do teste — então existe o traço certo que o app teima em recusar. Ficar
// preso no 3º traço de 谢 achando que o app quebrou é pior que deixar passar um traço
// torto, então a partir da terceira tentativa (com o traço da vez já aceso na grade) a
// régua afrouxa. Não é nota de graça: quem chegou aqui já perdeu o "de primeira".
const ORD_SOS = 0.40;
const ORD_OK = 90;      // a partir daqui é acerto
const ORD_QUASE = 70;   // ...e daqui, "quase"
function medianaTela(d, i) { // traço oficial i, com o Y já virado pro sentido da tela
  return d.m[i].map(p => [p[0], 900 - p[1]]);
}
// O quanto um traço do dedo e um traço oficial são o MESMO traço: média harmônica de
// cobertura e precisão, igual à nota do desenho, mas de um traço só contra um traço só.
function pareceTraco(tinta, oficial) {
  const a = reamostra(tinta, DRAW_PASSO), b = reamostra(oficial, DRAW_PASSO);
  if (!a.length || !b.length) return 0;
  const cob = proximidade(b, a), pre = proximidade(a, b);
  return cob + pre ? 2 * cob * pre / (cob + pre) : 0;
}
// 一 escrito da direita pra esquerda é o mesmo desenho e o traço errado — e é erro que a
// nuvem de pontos nunca pegaria. Compara as duas pontas com as duas do oficial, direto e
// invertido: ganha o que estiver mais perto.
function mesmaDirecao(tinta, oficial) {
  const a0 = tinta[0], a1 = tinta[tinta.length - 1];
  const b0 = oficial[0], b1 = oficial[oficial.length - 1];
  const d = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
  return d(a0, b0) + d(a1, b1) <= d(a0, b1) + d(a1, b0);
}
// Quais dos seus traços estão em ordem ENTRE SI (maior subsequência crescente). É mais
// justo que exigir "o seu 3º é o 3º oficial": quem parte um traço em dois erra UM traço e
// não todos os que vêm depois, e quem troca dois de lugar erra os dois. O(n²), e n é 9.
function maiorCrescente(seq) {
  const dp = seq.map(() => 0), pai = seq.map(() => -1);
  let fim = -1, melhor = 0;
  for (let i = 0; i < seq.length; i++) {
    if (seq[i] < 0) continue; // traço que não casou com nada não entra em ordem nenhuma
    dp[i] = 1;
    for (let j = 0; j < i; j++)
      if (seq[j] >= 0 && seq[j] < seq[i] && dp[j] + 1 > dp[i]) { dp[i] = dp[j] + 1; pai[i] = j; }
    if (dp[i] > melhor) { melhor = dp[i]; fim = i; }
  }
  const dentro = new Set();
  for (let i = fim; i >= 0; i = pai[i]) dentro.add(i);
  return dentro;
}
function notaOrdem(ch, tracos) { // tracos: lista de polilinhas já em 0–1024
  const d = strokesDB[ch];
  if (!d || !d.m || !tracos || !tracos.length) return null;
  const of = d.m.map((_, i) => medianaTela(d, i));
  // cada traço seu vira o traço oficial mais parecido; o que não parece com nenhum, e o
  // que foi feito ao contrário, fica de fora da contagem de ordem
  const passos = tracos.map(t => {
    let achou = -1, sim = 0;
    of.forEach((o, j) => { const v = pareceTraco(t, o); if (v > sim) { sim = v; achou = j; } });
    if (sim < ORD_MIN) achou = -1;
    const dir = achou >= 0 && mesmaDirecao(t, of[achou]);
    return { achou, dir, alvo: achou >= 0 && dir ? achou : -1 };
  });
  const dentro = maiorCrescente(passos.map(p => p.alvo));
  passos.forEach((p, i) => p.ok = dentro.has(i));
  // o denominador é o maior dos dois: traço a menos e traço a mais custam igual
  const total = Math.max(tracos.length, of.length);
  return { ordem: true, nota: Math.round(dentro.size / total * 100), certos: dentro.size,
    total, tracos: tracos.length, oficial: of.length, passos };
}

// ── desenho: a grade e a tinta ──────────────────────────────
function corVar(nome, alt) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
  return v || alt;
}
function montaPad() { // canvas quadrado, do tamanho que a carta deixar
  const cv = $('drawpad');
  const larg = $('drawwrap').clientWidth || $('fcard').clientWidth - 32;
  const L = Math.max(160, Math.min(Math.round(larg), 252)); // o teto é o que sobra de altura na carta
  const dpr = window.devicePixelRatio || 1;
  cv.width = Math.round(L * dpr); cv.height = Math.round(L * dpr);
  cv.style.width = L + 'px'; cv.style.height = L + 'px';
  drawCtx = cv.getContext('2d');
  drawCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawPx = L;
  repintaPad();
}
function repintaPad() {
  if (!drawCtx || !drawPx) return;
  const c = drawCtx, L = drawPx, k = L / DRAW_BOX;
  c.clearRect(0, 0, L, L);
  // 田字格: moldura e a cruz pontilhada que divide em quatro quadrantes — é ela que
  // ensina onde cada parte do caractere mora dentro do quadrado
  c.save();
  c.strokeStyle = corVar('--line', '#e7e9ee');
  c.lineWidth = 1.5;
  c.strokeRect(0.75, 0.75, L - 1.5, L - 1.5);
  c.setLineDash([4, 6]);
  c.beginPath();
  c.moveTo(L / 2, 3); c.lineTo(L / 2, L - 3);
  c.moveTo(3, L / 2); c.lineTo(L - 3, L / 2);
  c.stroke();
  c.restore();
  // O fantasma do caractere. Nos níveis fáceis ele está lá desde o começo — é ele que se
  // cobre; no de memória aparece só depois de validar, pra mostrar onde o traço saiu do
  // lugar. Cinza translúcido e não --pill: tem que ficar POR BAIXO da tinta, senão a
  // parte que você acertou o esconde e some justamente a comparação.
  if ((drawScore || escritaFacil()) && current && strokesDB[current.hanzi]) {
    const d = strokesDB[current.hanzi];
    const vivo = aoVivoOn();
    c.save();
    c.scale(k, k); c.translate(0, 900); c.scale(1, -1); // o Y do makemeahanzi é invertido
    c.fillStyle = corVar('--txt', '#1b1d21');
    c.globalAlpha = drawScore ? 0.22 : 0.14; // antes de validar é só um guia: bem apagado
    // no ao vivo o traço que já colou sai do fantasma e vira tinta de verdade, logo abaixo
    d.s.forEach((pd, i) => { if (!(vivo && i < drawFeitos)) c.fill(new Path2D(pd)); });
    if (vivo) {
      c.globalAlpha = 1;
      c.fillStyle = corVar('--ok', '#2e9e5b');
      for (let i = 0; i < drawFeitos; i++) c.fill(new Path2D(d.s[i]));
      // errou duas vezes no mesmo traço: ele acende, e a bolinha diz por onde se começa.
      // Duas e não uma: a primeira recusa ainda é chance de lembrar sozinho.
      if (drawTentativas >= 2 && drawFeitos < d.s.length) {
        c.globalAlpha = 0.45;
        c.fillStyle = corVar('--red', '#c8102e');
        c.fill(new Path2D(d.s[drawFeitos]));
      }
    }
    c.restore();
    if (vivo && drawTentativas >= 2 && drawFeitos < d.m.length) {
      const p0 = d.m[drawFeitos][0];
      c.save();
      c.fillStyle = corVar('--red', '#c8102e');
      c.beginPath();
      c.arc(p0[0] * k, (900 - p0[1]) * k, Math.max(5, L * 0.026), 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
  }
  // a tinta do dedo
  c.save();
  c.lineWidth = Math.max(7, L * 0.05);
  c.lineCap = 'round'; c.lineJoin = 'round';
  // No guiado a nota é por traço, então a cor também é: cada traço fica verde ou vermelho
  // conforme entrou na ordem ou não. Nos outros a cor é uma só, a da nota inteira.
  const passos = drawScore && drawScore.passos;
  const corBase = !drawScore ? corVar('--txt', '#1b1d21')
    : drawScore.nota >= (drawScore.ordem ? ORD_OK : DRAW_OK) ? corVar('--ok', '#2e9e5b')
    : drawScore.nota >= (drawScore.ordem ? ORD_QUASE : DRAW_QUASE) ? corVar('--warn', '#d98a00')
    : corVar('--err', '#c8102e');
  const risca = (t) => {
    if (t.length === 1) { // toque seco: um ponto (o 、 é isso mesmo)
      c.beginPath();
      c.arc(t[0][0] * k, t[0][1] * k, c.lineWidth / 2, 0, Math.PI * 2);
      c.fill();
      return;
    }
    c.beginPath();
    t.forEach((p, i) => i ? c.lineTo(p[0] * k, p[1] * k) : c.moveTo(p[0] * k, p[1] * k));
    c.stroke();
  };
  drawInk.forEach((t, i) => {
    const pas = passos && passos[i];
    c.strokeStyle = c.fillStyle = pas
      ? (pas.ok ? corVar('--ok', '#2e9e5b') : corVar('--err', '#c8102e')) : corBase;
    risca(t);
  });
  // o traço que o ao vivo acabou de recusar: pisca em vermelho e some
  if (drawRecusado) {
    c.strokeStyle = c.fillStyle = corVar('--err', '#c8102e');
    c.globalAlpha = 0.55;
    risca(drawRecusado);
    c.globalAlpha = 1;
  }
  c.restore();
  // No guiado, o número em cima do traço errado diz que traço ele era de verdade: "esse
  // que você fez em terceiro é o quinto". Só nos errados — nos nove todos viraria sopa.
  if (passos) {
    c.save();
    c.font = '700 ' + Math.max(10, Math.round(L * 0.055)) + 'px system-ui, sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = corVar('--err', '#c8102e');
    passos.forEach((pas, i) => {
      if (pas.ok || !drawInk[i] || !drawInk[i].length) return;
      const p0 = drawInk[i][0];
      c.fillText(pas.achou >= 0 ? String(pas.achou + 1) : '?', p0[0] * k, p0[1] * k - L * 0.045);
    });
    c.restore();
  }
}
function padXY(e) { // px da tela → o quadro 0–1024, que é onde a tinta é guardada
  const r = $('drawpad').getBoundingClientRect();
  const k = DRAW_BOX / (r.width || 1);
  // gruda na borda em vez de sair do quadro: assim o que aparece na tela é exatamente
  // o que vai ser medido (fora do quadro o traço some, mas continuaria contando)
  const preso = (v) => Math.max(0, Math.min(DRAW_BOX, v));
  return [preso((e.clientX - r.left) * k), preso((e.clientY - r.top) * k)];
}
// A pergunta do desenho é a palavra inteira menos o ideograma: o som (pinyin escrito e
// falado) e o significado. Já foram três modos separados, um por pista — mas escrever é
// difícil o bastante sem também ter que adivinhar de que palavra se está falando.
function montaDesenho(card) {
  drawInk = []; drawTrecho = null; drawScore = null;
  zeraFacil();
  const ask = $('drawask');
  ask.className = 'drawask';
  ask.innerHTML = '<span class="py">' + pinyinColored(card.pinyin) + '</span>' +
    '<span class="pt">' + esc(card.pt) + '</span>' +
    '<button class="spkbig" id="drawspk" title="Ouvir de novo">🔊</button>';
  $('drawspk').onclick = (e) => { e.stopPropagation(); speak(card); };
  $('drawfb').className = 'drawfb';
  $('drawfb').innerHTML = '';
  renderEscritaChips();
  montaPad();
  renderDrawTools();
}
function zeraFacil() {
  drawFeitos = 0; drawPrimeira = 0; drawTentativas = 0; drawErros = 0;
  drawRecusado = null; drawFimEm = 0;
}
// Os três níveis ficam na própria carta, e não no menu: o nível certo é o da PALAVRA —
// 人 se escreve de cabeça, 谢 não — então trocar tem que custar um toque, no meio da
// sessão, com a carta na frente.
function renderEscritaChips() {
  const box = $('drawlvl');
  // com a nota na tela eles apagam: trocar a régua embaixo de uma nota já dada deixaria
  // um número que não quer dizer mais nada, e chip que não faz nada tem que parecer isso
  box.innerHTML = ESCRITAS.map(k =>
    '<button data-esc="' + k + '" title="' + esc(ESCRITA_DICA[k]) + '"' +
    (drawScore ? ' disabled' : '') +
    (settings.escrita === k ? ' class="on"' : '') + '>' + ESCRITA_LABEL[k] + '</button>').join('');
  box.querySelectorAll('button').forEach(b =>
    b.onclick = (e) => { e.stopPropagation(); trocaEscrita(b.dataset.esc); });
}
function trocaEscrita(k) {
  // depois de validar não troca: a nota na tela é de uma régua, e mudar a régua embaixo
  // dela deixaria uma nota que não quer dizer mais nada
  if (!ESCRITAS.includes(k) || k === settings.escrita || drawScore) return;
  settings.escrita = k;
  save(K.settings, settings);
  if (!current || !drawOn()) return;
  montaDesenho(current); // régua nova, desenho novo: recomeça a carta do zero
  $('hint-f').textContent = dicaDesenho();
  ajustaAltura();
}
function dicaDesenho() {
  return settings.escrita === 'aovivo' ? 'cubra os traços na ordem — o errado não cola'
    : settings.escrita === 'guiado' ? 'cubra o ideograma e toque em Validar'
    : 'escreva o ideograma na grade e toque em Validar';
}
function renderDrawTools() {
  const vale = drawOn() && !!current && !drawScore;
  $('drawtools').classList.toggle('show', vale);
  const vazio = !drawInk.length;
  // No ao vivo cada traço já foi conferido quando saiu do dedo: não sobra o que validar
  // no fim, e desfazer um traço que o app aceitou seria desfazer a correção. Sobra o ✕,
  // que ali quer dizer recomeçar a palavra — e ocupa a linha sozinho.
  const vivo = aoVivoOn();
  $('draw-undo').style.display = vivo ? 'none' : '';
  $('draw-check').style.display = vivo ? 'none' : '';
  $('draw-clear').classList.toggle('soz', vivo);
  $('draw-clear').textContent = vivo ? '✕ Recomeçar' : '✕';
  $('draw-undo').disabled = vazio;
  $('draw-clear').disabled = vivo ? !drawFeitos && !drawTentativas : vazio;
  $('draw-check').disabled = vazio;
}
function validaDesenho() {
  // o ao vivo não tem botão: ele fecha sozinho quando o último traço cola
  if (!current || drawScore || !drawInk.length || aoVivoOn()) return;
  const r = escritaFacil() ? notaOrdem(current.hanzi, drawInk) : notaDesenho(current.hanzi, drawInk);
  if (!r) return;
  drawScore = r;
  mostraNota();
}
function mostraNota() {
  const r = drawScore;
  const facil = escritaFacil();
  const ok = facil ? ORD_OK : DRAW_OK, quase = facil ? ORD_QUASE : DRAW_QUASE;
  // No ao vivo o caractere SEMPRE sai inteiro e na ordem — o traço errado não cola. Então
  // a linha de corte é outra: "Errei" não tem o que querer dizer aqui, e o que varia é
  // quanta ajuda foi preciso. Sair sem tropeço nenhum é Acertei; um tropeço que seja é
  // Difícil, e a carta volta mais cedo. Nos outros dois a nota tem as três faixas.
  const limpo = r.vivo ? r.nota >= 100 : r.nota >= ok;
  // Duas notas, dois contadores. O 'esc' é "escrever de memória", e só o nível de memória
  // o alimenta: no guiado o ideograma está na tela, e jogar isso no mesmo número
  // estragaria o diagnóstico que ele existe pra dar. O que os fáceis treinam tem contador
  // próprio — e quem conta é a nota, não o botão que você aperta depois.
  bumpHab(current.id, facil ? 'traco' : 'esc', !limpo);
  repintaPad();
  renderEscritaChips(); // a nota apaga os chips
  const g = r.vivo ? (limpo ? 'good' : 'hard')
    : r.nota >= ok ? 'good' : r.nota >= quase ? 'hard' : 'again';
  ajustaAltura(); // a nota entrou embaixo da grade
  const fb = $('drawfb');
  const cab = (g === 'good' ? '对! ' : g === 'hard' ? 'Quase — ' : '');
  fb.className = 'drawfb ' + (g === 'good' ? 'ok' : g === 'hard' ? 'quase' : 'ruim');
  if (r.vivo) {
    // "de primeira" é a nota: o traço que só colou depois de o app acender a dica não conta
    const rec = r.erros ? ' · ' + r.erros + ' recusa' + (r.erros > 1 ? 's' : '') + ' no caminho' : '';
    fb.innerHTML = (limpo ? '对! ' : '') + 'acertou ' + r.nota + '% da ordem' +
      '<small>' + esc(current.hanzi) + ' · ' + r.certos + ' de ' + r.total +
      ' traços de primeira' + rec + '</small>';
  } else if (r.ordem) {
    fb.innerHTML = cab + r.nota + '% da ordem' +
      '<small>' + esc(current.hanzi) + ' · ' + r.certos + ' de ' + r.total +
      ' traços na ordem certa' +
      (r.tracos !== r.oficial ? ' · você fez ' + r.tracos + ', o ideograma tem ' + r.oficial : '') +
      '</small>';
  } else {
    fb.innerHTML = cab + r.nota + '% de proximidade' +
      '<small>' + esc(current.hanzi) + ' · ' + r.tracos + ' traço' + (r.tracos > 1 ? 's' : '') +
      ' seus, ' + r.oficial + ' no ideograma</small>';
  }
  $('hint-f').textContent = 'toque na carta pra ver o traçado certo';
  $('grades').classList.add('show');
  $('g-' + g).classList.add('sugerido'); // sugestão da nota; quem decide ainda é você
  renderDrawTools();
  if (settings.autoSpeak) speak(current, true);
}
function desfazTraco() {
  if (drawScore || aoVivoOn() || !drawInk.length) return;
  drawInk.pop();
  repintaPad(); renderDrawTools();
}
function limpaDesenho() {
  if (drawScore) return;
  drawInk = []; drawTrecho = null;
  zeraFacil();
  repintaPad(); renderDrawTools();
}
// Fim do traço. No ao vivo é aqui que o app confere, e a conferência é uma pergunta só:
// este é o PRÓXIMO traço da ordem oficial, no sentido certo? Se não for, ele não cola —
// é a recusa na hora que ensina a ordem, em vez de contar o estrago no fim.
function fechaTraco() {
  const t = drawTrecho;
  drawTrecho = null;
  if (!t || !aoVivoOn() || !current || drawScore) return;
  const d = strokesDB[current.hanzi];
  if (!d || drawFeitos >= d.m.length) return;
  const alvo = medianaTela(d, drawFeitos);
  // o sentido continua valendo sempre: 一 ao contrário é erro que não tem "quase"
  const limite = drawTentativas >= 2 ? ORD_SOS : ORD_MIN;
  const passou = pareceTraco(t, alvo) >= limite && mesmaDirecao(t, alvo);
  drawInk.pop(); // a tinta solta nunca fica: ou vira traço aceito, ou some
  if (passou) {
    if (!drawTentativas) drawPrimeira++; // "de primeira" é a nota: acertar depois de ver a dica não conta
    drawFeitos++; drawTentativas = 0;
    repintaPad(); renderDrawTools();
    if (drawFeitos >= d.m.length) fechaAoVivo();
    return;
  }
  drawTentativas++; drawErros++;
  drawRecusado = t;
  repintaPad(); renderDrawTools();
  setTimeout(() => { if (drawRecusado === t) { drawRecusado = null; repintaPad(); } }, 450);
}
function fechaAoVivo() {
  drawFimEm = Date.now(); // ver o listener de click do pad: o gesto que fecha não pode virar a carta
  const total = strokesDB[current.hanzi].m.length;
  drawScore = { vivo: true, nota: Math.round(drawPrimeira / total * 100),
    certos: drawPrimeira, total, tracos: total, oficial: total, erros: drawErros };
  mostraNota();
}
// No DEDO o desenho é feito com eventos de toque, não com Pointer Events. Duas tentativas
// de segurar a rolagem no iOS falharam antes desta, e as duas pelo mesmo motivo de fundo:
// o preventDefault chegava tarde ou não chegava.
//
//   1ª — touch-action:none no CSS mais preventDefault no touchmove do canvas. O
//        setPointerCapture desviava o fluxo de toque e o listener nem rodava.
//   2ª — tirei a captura e levei o bloqueio pro documento. Continuou rolando, porque o
//        bloqueio só valia com traço em andamento e quem criava o traço era o pointerdown:
//        se o primeiro touchmove chega antes do pointerdown (e no WebKit os eventos de
//        ponteiro são derivados dos de toque, então chega), a rolagem já começou. Depois
//        que o iOS decide que o gesto é rolagem, preventDefault nenhum a traz de volta.
//
// Com touchstart o traço nasce e a rolagem é cancelada no MESMO evento, antes de existir
// gesto pra interpretar. Eventos de toque também vão sempre pro elemento onde o dedo
// encostou, do começo ao fim, então seguir o dedo pra fora do quadrado não precisa de
// captura nenhuma. Mouse e caneta seguem nos Pointer Events, que ali funcionam bem.
// Os dois listeners de toque precisam de passive:false: sem isso o preventDefault é
// ignorado sem erro no console — falha silenciosa, que foi o que escondeu tudo isso.
function bindPad() {
  const pad = $('drawpad');
  const podeDesenhar = () => drawOn() && !drawScore && !!current;
  function comecaTraco(p) {
    drawTrecho = [p];
    drawInk.push(drawTrecho);
    repintaPad(); renderDrawTools();
  }
  function continuaTraco(p) {
    const u = drawTrecho[drawTrecho.length - 1];
    if (Math.hypot(p[0] - u[0], p[1] - u[1]) < 6) return; // ponto colado no anterior não acrescenta nada
    drawTrecho.push(p);
    repintaPad();
  }
  // ── dedo ──
  pad.addEventListener('touchstart', (e) => {
    if (!podeDesenhar()) return;
    e.preventDefault(); // aqui, e não no touchmove: é o que impede a rolagem de nascer
    if (drawTrecho) return; // segundo dedo no meio do traço: ignora, não recomeça
    comecaTraco(padXY(e.changedTouches[0]));
  }, { passive: false });
  pad.addEventListener('touchmove', (e) => {
    if (!drawTrecho) return;
    e.preventDefault();
    continuaTraco(padXY(e.changedTouches[0]));
  }, { passive: false });
  const largou = () => { fechaTraco(); };
  pad.addEventListener('touchend', largou);
  pad.addEventListener('touchcancel', largou);
  // ── mouse e caneta ──
  pad.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch' || !podeDesenhar()) return; // o dedo já foi tratado acima
    e.preventDefault(); e.stopPropagation();
    comecaTraco(padXY(e));
  });
  document.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch' || !drawTrecho) return;
    e.preventDefault();
    continuaTraco(padXY(e));
  });
  document.addEventListener('pointerup', largou);
  document.addEventListener('pointercancel', largou);
  // Enquanto não validou, o toque na grade não pode virar a carta — entregaria a
  // resposta. Depois de validar pode: a grade é o maior alvo da tela e a dica manda
  // tocar na carta pra ver o traçado.
  //
  // Menos num instante: no ao vivo quem fecha a carta é o último traço, e o navegador
  // dispara o `click` logo DEPOIS do pointerup que encaixou esse traço. Aí a nota já
  // existe, o clique passava direto pro fcard e a carta virava no mesmo gesto — a pessoa
  // nunca via o quanto acertou. Então o clique que vem colado no fechamento é engolido.
  // Janela curta, e não uma trava: o toque SEGUINTE tem que virar, que é o que a dica manda.
  pad.addEventListener('click', (e) => {
    if (!drawScore || Date.now() - drawFimEm < 500) e.stopPropagation();
  });
}
