// Calibração da nota do modo desenho. Roda com:
//   node tools/test_nota.js
//
// A pergunta que este arquivo responde é uma só: onde colocar a tolerância pra que um
// traço trêmulo mas CERTO passe dos 90% e um caractere ERRADO não passe. Sem isto os
// números DRAW_PERTO/DRAW_LONGE do app.js seriam chute — e chute frouxo (58/200, o
// primeiro que tentei) aprovava 38% dos caracteres errados.
//
// O teste não desenha de verdade: usa as medianas do próprio makemeahanzi como se
// fossem o dedo, e as deforma pra imitar aluno (traço deslocado, torto, com sobra e
// falta na ponta, dedo tremendo). É aproximação, mas é o que dá pra automatizar.
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
const { notaDesenho } = new Function('strokesDB',
  src.slice(ini, fim) + '\nreturn { notaDesenho };')(strokesDB);

const chars = Object.keys(strokesDB).filter(c => c !== '_'); // "_" é o aviso de licença
// o caractere desenhado do jeito perfeito, já com o Y virado pra tela
function ideal(ch) { return strokesDB[ch].m.map(m => m.map(p => [p[0], 900 - p[1]])); }

// aleatório com semente: o resultado do teste não pode mudar a cada rodada
let semente = 7;
function rnd() { semente = (semente * 1103515245 + 12345) % 2147483648; return semente / 2147483648; }
function g() { return (rnd() + rnd() + rnd() - 1.5) / 1.5; }

// nivel: 0 = caprichado, 1 = médio, 2 = desengonçado
function aluno(tracos, nivel) {
  const desl = [30, 55, 85][nivel];       // o traço inteiro sai do lugar
  const gira = [0.05, 0.10, 0.17][nivel]; // e sai torto (radianos)
  const comp = [0.06, 0.12, 0.20][nivel]; // e mais curto ou mais comprido
  const trem = [18, 30, 45][nivel];       // e o dedo treme no caminho
  return tracos.map(t => {
    const dx = g() * desl, dy = g() * desl, a = g() * gira, k = 1 + g() * comp;
    let cx = 0, cy = 0;
    t.forEach(p => { cx += p[0]; cy += p[1]; });
    cx /= t.length; cy /= t.length;
    let jx = 0, jy = 0;
    return t.map(p => {
      const x = (p[0] - cx) * k, y = (p[1] - cy) * k;
      jx = Math.max(-trem, Math.min(trem, jx + g() * trem * 0.5));
      jy = Math.max(-trem, Math.min(trem, jy + g() * trem * 0.5));
      return [cx + x * Math.cos(a) - y * Math.sin(a) + dx + jx,
              cy + x * Math.sin(a) + y * Math.cos(a) + dy + jy];
    });
  });
}
const notas = t => t.map(x => x.nota);
function pct(v, p) { const s = v.slice().sort((a, b) => a - b); return s[Math.floor(s.length * p)]; }
function linha(nome, v) {
  console.log('  ' + nome.padEnd(30) +
    'p10 ' + String(pct(v, .1)).padStart(3) +
    ' · mediana ' + String(pct(v, .5)).padStart(3) +
    ' · máx ' + String(Math.max(...v)).padStart(3) +
    ' · ≥90: ' + (Math.round(v.filter(x => x >= 90).length / v.length * 100) + '%').padStart(4));
}

console.log('Nota do modo desenho — ' + chars.length + ' caracteres do deck\n');
console.log('DEVE passar dos 90:');
linha('desenho perfeito', notas(chars.map(c => notaDesenho(c, ideal(c)))));
for (let n = 0; n < 3; n++) {
  const v = [];
  semente = 31;
  for (let r = 0; r < 6; r++) for (const c of chars) v.push(notaDesenho(c, aluno(ideal(c), n)).nota);
  linha(['aluno caprichado', 'aluno médio', 'aluno desengonçado'][n], v);
}

console.log('\nNÃO deve passar dos 90:');
const err = [];
const pares = [];
for (const a of chars) for (const b of chars) if (a !== b) {
  const n = notaDesenho(b, ideal(a)).nota;
  err.push(n); pares.push([a + ' desenhado na carta de ' + b, n]);
}
linha('caractere errado', err);
const rabisco = [[]];
for (let i = 0; i <= 40; i++) rabisco[0].push([100 + (i % 2) * 820, 100 + i * 20]);
linha('rabisco cobrindo o quadro', notas(chars.map(c => notaDesenho(c, rabisco))));
linha('certo, 45% do tamanho, canto', notas(chars.map(c =>
  notaDesenho(c, ideal(c).map(t => t.map(p => [p[0] * 0.45 + 60, p[1] * 0.45 + 60]))))));
const multi = chars.filter(c => strokesDB[c].m.length >= 3);
linha('faltando o último traço', notas(multi.map(c => notaDesenho(c, ideal(c).slice(0, -1)))));

pares.sort((a, b) => b[1] - a[1]);
console.log('\nAs confusões mais perigosas (caracteres que se parecem de verdade):');
pares.slice(0, 5).forEach(p => console.log('  ' + p[1] + '%  ' + p[0]));

const furos = err.filter(v => v >= 90).length;
console.log('\n' + (furos
  ? '❌ ' + furos + ' caractere(s) ERRADO(s) passariam de 90% — afrouxou demais.'
  : '✅ nenhum caractere errado passa dos 90%.'));
process.exit(furos ? 1 : 0);
