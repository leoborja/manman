// Calibração da nota da ORDEM — os níveis 👣 guiado e 🚦 ao vivo do modo desenho. Roda com:
//   node tools/test_ordem.js
//
// A nota de proximidade (test_nota.js) responde "é este caractere?". Esta responde outra
// pergunta: "é ESTE traço, e neste sentido?". O número que ela precisa acertar é o
// ORD_MIN — o quanto um traço do dedo tem que parecer com um traço oficial pra casar com
// ele. Frouxo demais, o ao vivo aceita qualquer risco no lugar do traço da vez e não
// ensina nada; apertado demais, ele recusa o traço certo e o aluno fica preso no 3º
// traço de 谢 achando que o app quebrou — que é o pior dos dois erros.
//
// Como no test_nota.js, o "dedo" são as próprias medianas do makemeahanzi, deformadas.
// A deformação aqui é MENOR de propósito: nos níveis fáceis o ideograma está na tela e a
// pessoa está cobrindo uma linha que enxerga, não escrevendo de cabeça.
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(raiz, 'app.js'), 'utf8');
const ini = src.indexOf('// ── desenho: a nota do traço');
const fim = src.indexOf('// ── desenho: a grade e a tinta');
if (ini < 0 || fim < 0) {
  console.error('não achei o bloco da nota no app.js — os comentários de seção mudaram?');
  process.exit(1);
}
const strokesDB = JSON.parse(fs.readFileSync(path.join(raiz, 'strokes', 'strokes.json'), 'utf8'));
const { notaOrdem, pareceTraco, mesmaDirecao, ORD_MIN, ORD_SOS } = new Function('strokesDB',
  src.slice(ini, fim) + '\nreturn { notaOrdem, pareceTraco, mesmaDirecao, ORD_MIN, ORD_SOS };')(strokesDB);

const chars = Object.keys(strokesDB).filter(c => c !== '_'); // "_" é o aviso de licença
function ideal(ch) { return strokesDB[ch].m.map(m => m.map(p => [p[0], 900 - p[1]])); }

let semente = 7;
function rnd() { semente = (semente * 1103515245 + 12345) % 2147483648; return semente / 2147483648; }
function g() { return (rnd() + rnd() + rnd() - 1.5) / 1.5; }
// cobrir uma linha que se vê: sai do lugar pouco, mas o dedo continua tremendo e a mão
// continua passando da ponta. nivel 2 é o dedo grosso numa tela de celular.
function cobrindo(tracos, nivel) {
  const desl = [12, 25, 45][nivel];
  const trem = [12, 22, 38][nivel];
  const sobra = [0.04, 0.10, 0.18][nivel]; // passa da ponta ou para antes dela
  return tracos.map(t => {
    const dx = g() * desl, dy = g() * desl, k = 1 + g() * sobra;
    let cx = 0, cy = 0;
    t.forEach(p => { cx += p[0]; cy += p[1]; });
    cx /= t.length; cy /= t.length;
    let jx = 0, jy = 0;
    return t.map(p => {
      jx = Math.max(-trem, Math.min(trem, jx + g() * trem * 0.5));
      jy = Math.max(-trem, Math.min(trem, jy + g() * trem * 0.5));
      return [(p[0] - cx) * k + cx + dx + jx, (p[1] - cy) * k + cy + dy + jy];
    });
  });
}
function pct(v, p) { const s = v.slice().sort((a, b) => a - b); return s[Math.floor(s.length * p)]; }
function linha(nome, v, alvo) {
  console.log('  ' + nome.padEnd(30) +
    'p10 ' + String(pct(v, .1)).padStart(3) +
    ' · mediana ' + String(pct(v, .5)).padStart(3) +
    ' · mín ' + String(Math.min(...v)).padStart(3) +
    // floor e não round: 99,96% não pode virar "100%" num arquivo que existe pra dizer
    // se sobrou caso ruim
    (alvo ? ' · ≥' + alvo + ': ' + (Math.floor(v.filter(x => x >= alvo).length / v.length * 100) + '%').padStart(4) : ''));
}
const notas = t => t.map(x => x.nota);
const multi = chars.filter(c => strokesDB[c].m.length >= 3);

console.log('Nota da ordem — ' + chars.length + ' caracteres do deck (ORD_MIN = ' + ORD_MIN + ')\n');
console.log('DEVE dar 100 (cobriu na ordem certa):');
linha('cobertura perfeita', notas(chars.map(c => notaOrdem(c, ideal(c)))), 100);
for (let n = 0; n < 3; n++) {
  const v = [];
  semente = 31;
  for (let r = 0; r < 6; r++) for (const c of chars) v.push(notaOrdem(c, cobrindo(ideal(c), n)).nota);
  linha(['cobrindo com capricho', 'cobrindo normal', 'dedo grosso, tela pequena'][n], v, 90);
}

console.log('\nNÃO deve dar 100 (a ordem ou o sentido saíram errados):');
linha('dois traços trocados', notas(multi.map(c => {
  const t = ideal(c); const x = t[0]; t[0] = t[1]; t[1] = x; return notaOrdem(c, t);
})));
linha('ordem inteira ao contrário', notas(multi.map(c => notaOrdem(c, ideal(c).slice().reverse()))));
linha('ordem certa, sentido invertido', notas(chars.map(c =>
  notaOrdem(c, ideal(c).map(t => t.slice().reverse())))));
linha('último traço esquecido', notas(multi.map(c => notaOrdem(c, ideal(c).slice(0, -1)))));
linha('um traço partido em dois', notas(multi.map(c => {
  const t = ideal(c), m = t[0], meio = Math.max(1, Math.floor(m.length / 2));
  return notaOrdem(c, [m.slice(0, meio + 1), m.slice(meio)].concat(t.slice(1)));
})));

// ── o ao vivo: a decisão de aceitar ou recusar UM traço ──
// Dois erros, e eles não custam igual. Recusar o traço certo trava a pessoa na grade sem
// saída; aceitar o traço errado só deixa passar um erro que o próximo traço ainda pega.
let falsoNao = 0, falsoSim = 0, certos = 0, errados = 0, presos = [];
// a margem: entre o pior traço certo e o melhor traço de fora da vez é onde o ORD_MIN
// pode morar. Margem larga é o que dá folga pro dedo de verdade, que treme mais que este.
let piorCerto = 1, melhorErrado = 0, sos = 0;
for (const c of chars) {
  const of = ideal(c);
  for (let n = 0; n < 3; n++) {
    semente = 101 + n;
    for (let r = 0; r < 4; r++) {
      const dedo = cobrindo(of, n);
      of.forEach((_, j) => {
        certos++;
        const sim = pareceTraco(dedo[j], of[j]);
        if (sim < piorCerto) piorCerto = sim;
        const dir = mesmaDirecao(dedo[j], of[j]);
        const passa = sim >= ORD_MIN && dir;
        if (!passa) { falsoNao++; if (n < 2) presos.push(c + ' traço ' + (j + 1)); }
        if (!passa && !(sim >= ORD_SOS && dir)) sos++; // nem a válvula salvaria este
        of.forEach((_, i) => { // o traço j oferecido quando a vez era do traço i
          if (i === j) return;
          errados++;
          const s2 = pareceTraco(dedo[j], of[i]);
          if (s2 > melhorErrado && mesmaDirecao(dedo[j], of[i])) melhorErrado = s2;
          if (s2 >= ORD_MIN && mesmaDirecao(dedo[j], of[i])) falsoSim++;
        });
      });
    }
  }
}
console.log('\nAo vivo, traço a traço:');
console.log('  traço CERTO recusado    ' + falsoNao + ' de ' + certos +
  ' (' + (falsoNao / certos * 100).toFixed(2) + '% — trava a pessoa na grade, é o erro caro)');
console.log('  traço ERRADO aceito     ' + falsoSim + ' de ' + errados +
  ' (' + (falsoSim / errados * 100).toFixed(2) + '% — erro que o traço seguinte ainda pega)');
console.log('  ...e recusado 3x seguidas ' + sos + ' de ' + certos +
  ' (' + (sos / certos * 100).toFixed(2) + '% — aqui a válvula ORD_SOS = ' + ORD_SOS + ' destrava)');
console.log('  margem                  pior traço certo ' + piorCerto.toFixed(2) +
  ' · melhor traço fora da vez ' + melhorErrado.toFixed(2) + ' (ORD_MIN = ' + ORD_MIN + ')');
if (presos.length) {
  const conta = {};
  presos.forEach(k => conta[k] = (conta[k] || 0) + 1);
  const piores = Object.entries(conta).sort((a, b) => b[1] - a[1]).slice(0, 5);
  console.log('  onde mais trava: ' + piores.map(p => p[0] + ' (' + p[1] + 'x)').join(', '));
}

const ruim = falsoNao / certos > 0.05;
console.log('\n' + (ruim
  ? '❌ o ao vivo recusa traço certo demais — ORD_MIN está apertado.'
  : '✅ o ao vivo aceita o traço certo e recusa o de fora da vez.'));
process.exit(ruim ? 1 : 0);
