/* Mànmàn — 📝 A prova do capítulo: todas as palavras dele, uma vez cada, só no virar a
   carta, e uma nota de 0 a 10 no fim. A mesma do app iOS, e as notas dos dois somam.

   A prova MEDE, não ensina: não mexe no agendamento, não conta pra meta do dia e não
   soma nos contadores de acerto da carta. É uma fotografia do capítulo naquele momento.
   Refazer vale, e cada tentativa fica gravada: a sequência delas é o que diz se o
   capítulo está firmando ou escapando. A "semana" (de segunda a domingo) só decide o
   rótulo "Prova da semana" e o ✓ do Curso, que volta vazio na segunda.

   Mora no `progress` do Supabase numa linha que não é carta nenhuma — card_id
   "prova:cap7" —, com o histórico no `hab`: {"2026-11-04T19:30:12": {n: 60, e: 12}},
   uma chave por tentativa (data e hora locais), n cartas e e erros. Chave curta
   ("2026-11-02", das primeiras provas do iOS) vale como tentativa daquele dia. O upsert
   troca o `hab` inteiro, então o push LÊ a linha antes e sobe a união: cada tentativa
   tem chave própria e nunca é reescrita, e a do outro aparelho só soma. */
'use strict';

const PROVA_PREFIXO = 'prova:';
const K_PROVAS = 'manman.provas.v1';         // por usuário: cap → chave → { n, e }
const K_PROVAS_DIRTY = 'manman.provas.dirty.v1';

function provasLocais() { return load(uk(K_PROVAS), {}); }
function salvaProvas(p) { save(uk(K_PROVAS), p); }
function provasSujas() { return load(uk(K_PROVAS_DIRTY), []); }
function salvaSujas(l) { save(uk(K_PROVAS_DIRTY), l); }

const dois = n => String(n).padStart(2, '0');
function diaLocal(d) { return d.getFullYear() + '-' + dois(d.getMonth() + 1) + '-' + dois(d.getDate()); }
function chaveDeProva(d) {
  return diaLocal(d) + 'T' + dois(d.getHours()) + ':' + dois(d.getMinutes()) + ':' + dois(d.getSeconds());
}
// A segunda-feira da semana, em YYYY-MM-DD. Segunda e não domingo: a aula é no fim de
// semana, e a semana da prova começa depois de a turma ter visto o capítulo inteiro.
function semanaDe(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return diaLocal(x);
}
function semanaDaChave(k) {
  const [a, m, d] = k.slice(0, 10).split('-').map(Number);
  return semanaDe(new Date(a, m - 1, d));
}
function rotuloDaChave(k) { return k.slice(8, 10) + '/' + k.slice(5, 7); }
// As tentativas de um `hab` de prova, da mais antiga pra mais nova.
function historicoDeProva(cap, hab) {
  return Object.keys(hab || {}).filter(k => (hab[k].n || 0) > 0).sort().map(k => {
    const n = hab[k].n, e = hab[k].e || 0;
    return { cap, quando: k, total: n, erros: e, acertos: Math.max(0, n - e), nota: n ? Math.max(0, n - e) / n * 10 : 0 };
  });
}
// "8,3" — uma casa, com vírgula. "10" sem casa: "10,0" parece que faltou alguma coisa.
function notaTexto(n) {
  const r = Math.round(n * 10) / 10;
  return r === 10 ? '10' : r.toFixed(1).replace('.', ',');
}
function difTexto(d) { return d > 0.05 ? '+' + notaTexto(d) : d < -0.05 ? '−' + notaTexto(-d) : 'igual'; }
function corDaNota(n) { return n >= 7 ? 'var(--ok)' : n >= 5 ? 'var(--warn)' : 'var(--err)'; }

function historicoDoCap(cap) { return historicoDeProva(cap, provasLocais()[cap]); }
function provaDaSemana(cap) {
  const s = semanaDe(new Date());
  return historicoDoCap(cap).filter(r => semanaDaChave(r.quando) === s).pop() || null;
}
// As cartas da prova: as PALAVRAS do capítulo, as mesmas do círculo do Curso. As frases
// ficam de fora — a prova é de ideograma, e frase lida de cabo a rabo mede outra coisa.
function cartasDaProva(cap) { return cartasDoCap(cap, false); }
// O capítulo da prova da semana: o mais recente do livro que tem palavra.
function capituloDaSemana() {
  const caps = capitulosDoCurso().filter(c => cartasDaProva(c).length);
  return caps.length ? caps[caps.length - 1] : null;
}

// ── sync ────────────────────────────────────────────────────
function mesclaProvas(cap, remoto) {
  const p = provasLocais();
  const local = p[cap] || {};
  let mudou = false;
  for (const k of Object.keys(remoto || {})) {
    if (!local[k] && (remoto[k].n || 0) > 0) { local[k] = { n: remoto[k].n, e: remoto[k].e || 0 }; mudou = true; }
  }
  if (mudou) { p[cap] = local; salvaProvas(p); }
  return mudou;
}
async function pushProva(cap) {
  const sujas = () => provasSujas().filter(c => c !== cap);
  const h = provasLocais()[cap];
  if (!syncEnabled() || !h || !Object.keys(h).length) { if (!syncEnabled()) return; salvaSujas(sujas()); return; }
  const base = HW_CONFIG.SUPABASE_URL + '/rest/v1/progress';
  const u = encodeURIComponent(settings.user);
  const id = PROVA_PREFIXO + cap;
  try {
    // lê antes de gravar: a tentativa que o iPhone fez e este aparelho ainda não puxou
    // sumiria no upsert, que troca o `hab` inteiro
    const r0 = await fetch(base + '?user_name=eq.' + u + '&card_id=eq.' + encodeURIComponent(id) + '&select=hab', { headers: sbHeaders() });
    if (!r0.ok) throw new Error('HTTP ' + r0.status);
    const [row] = await r0.json();
    if (row && row.hab) mesclaProvas(cap, row.hab);
    // Só card_id e hab: sem `due`, nenhum pull toma a linha por carta agendada
    const r = await fetch(base + '?on_conflict=user_name,card_id', {
      method: 'POST',
      headers: sbHeaders({ Prefer: 'resolution=merge-duplicates' }),
      body: JSON.stringify({ user_name: settings.user, card_id: id, hab: provasLocais()[cap] })
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    salvaSujas(sujas());
  } catch (e) {
    const l = provasSujas();
    if (!l.includes(cap)) { l.push(cap); salvaSujas(l); }
  }
}
function flushProvas() { provasSujas().forEach(pushProva); }
function registraProva(cap, total, erros) {
  if (!total) return null;
  const quando = chaveDeProva(new Date());
  const p = provasLocais();
  (p[cap] = p[cap] || {})[quando] = { n: total, e: erros };
  salvaProvas(p);
  const l = provasSujas();
  if (!l.includes(cap)) { l.push(cap); salvaSujas(l); }
  pushProva(cap);
  return historicoDeProva(cap, { [quando]: { n: total, e: erros } })[0];
}

// ── a tela da prova (por cima da trilha do Curso) ───────────
// Errei ou Acertei — sem o Difícil, que numa prova não é resposta. Errar não devolve a
// carta pra fila: ela passa uma vez, como numa prova de papel. O andamento mostra
// quantas faltam, e não quantas errou: placar no meio faz jogar contra ele.
let cursoProva = null;   // o capítulo da prova aberta, ou null
let provaFila = [], provaIdx = 0, provaVirada = false, provaErradas = [], provaResultado = null;
function abreProva(cap) {
  cursoProva = cap;
  provaFila = shuffle(cartasDaProva(cap).slice());
  provaIdx = 0; provaVirada = false; provaErradas = []; provaResultado = null;
  renderCurso();
  window.scrollTo(0, 0);
}
function fechaProva() { cursoProva = null; renderCurso(); }
function saiDaProva() {
  if (!provaResultado && provaIdx > 0 &&
      !confirm('Sair da prova? Ela só vale inteira: saindo agora, nada do que você respondeu fica gravado.')) return;
  fechaProva();
}
function renderProva() {
  const cap = cursoProva, box = $('curso-corpo');
  $('curso-faixa').innerHTML = '';
  let h = '<div class="teoria-cab"><button class="tvolta" id="prova-sair" title="Voltar ao curso">‹</button>' +
    '<h3>Prova · ' + esc(origemLabel(cap)) + '</h3></div>';
  if (provaResultado) {
    box.innerHTML = h + resultadoDaProvaHtml(provaResultado);
    $('prova-sair').onclick = fechaProva;
    $('prova-volta').onclick = fechaProva;
    $('prova-refaz').onclick = () => abreProva(cap);
    box.querySelectorAll('.pv-err [data-id]').forEach(b => b.onclick = () => {
      const c = cards.find(x => x.id === b.dataset.id); if (c) speak(c);
    });
    return;
  }
  const c = provaFila[provaIdx];
  if (!c) {
    box.innerHTML = h + '<p class="vazio">' + esc(origemLabel(cap)) + ' ainda não tem palavras para a prova.</p>';
    $('prova-sair').onclick = fechaProva;
    return;
  }
  h += '<div class="exandamento"><span>📝 ' + (provaIdx + 1) + ' de ' + provaFila.length +
    ' · uma vez cada · não mexe na revisão</span><div class="exbarra"><i style="width:' + (100 * provaIdx / provaFila.length) + '%"></i></div></div>' +
    '<div class="excard pv-carta" id="pv-carta"><div class="pv-hanzi zh" lang="zh-Hans">' + esc(c.hanzi) + '</div>' +
    (provaVirada
      ? '<div class="pinyin">' + pinyinColored(c.pinyin) + '</div><div class="pt-back">' + esc(c.pt) + '</div>'
      : '<span class="pv-dica">toque na carta para revelar</span>') + '</div>' +
    (provaVirada ? '<div class="pv-resp"><button class="pv-b errei" id="pv-errei">Errei</button><button class="pv-b acertei" id="pv-acertei">Acertei</button></div>' : '');
  box.innerHTML = h;
  $('prova-sair').onclick = saiDaProva;
  // sem o tema na carta: "Números" no 三 é meia resposta, e prova não dá dica
  $('pv-carta').onclick = () => {
    provaVirada = !provaVirada;
    if (provaVirada && settings.autoSpeak) speak(c, true);
    renderProva();
  };
  if (provaVirada) {
    $('pv-errei').onclick = () => respondeProva(false);
    $('pv-acertei').onclick = () => respondeProva(true);
  }
}
function respondeProva(acertou) {
  const c = provaFila[provaIdx];
  if (!acertou) provaErradas.push(c);
  provaVirada = false;
  if (provaIdx + 1 < provaFila.length) provaIdx++;
  else provaResultado = registraProva(cursoProva, provaFila.length, provaErradas.length);
  renderProva();
}
// A nota, a comparação com a anterior e com a primeira, e as palavras que pegaram.
function resultadoDaProvaHtml(r) {
  const antes = historicoDoCap(r.cap).filter(x => x.quando < r.quando);
  let comp;
  if (antes.length) {
    const a = antes[antes.length - 1], p = antes[0];
    comp = '<span>' + difTexto(r.nota - a.nota) + ' desde a anterior, de ' + rotuloDaChave(a.quando) + ' (' + notaTexto(a.nota) + ')</span>' +
      (antes.length > 1 ? '<span>' + difTexto(r.nota - p.nota) + ' desde a primeira, de ' + rotuloDaChave(p.quando) + ' (' + notaTexto(p.nota) + ')</span>' : '') +
      '<small>' + (antes.length + 1) + 'ª tentativa deste capítulo</small>';
  } else {
    comp = '<small>Primeira prova do ' + esc(origemLabel(r.cap).toLowerCase()) + '. As próximas tentativas comparam com esta.</small>';
  }
  const nivel = r.nota >= 7 ? 'ok' : r.nota >= 5 ? 'meio' : 'erro';
  return '<div class="exfim ' + nivel + ' pv-nota"><b style="color:' + corDaNota(r.nota) + '">' + notaTexto(r.nota) + '</b>' +
    '<span>' + r.acertos + ' de ' + r.total + ' palavras</span>' + comp + '</div>' +
    (provaErradas.length ? '<div class="sheetsep">as que pegaram</div><div class="pv-err">' + provaErradas.map(c =>
      '<button data-id="' + esc(c.id) + '"><b class="zh" lang="zh-Hans">' + esc(c.hanzi) + '</b><span><i>' + esc(c.pt) + '</i>' +
      '<small>' + pinyinColored(c.pinyin).replace(/<span class="pron">.*?<\/span>/, '') + '</small></span><em>🔊</em></button>').join('') + '</div>' : '') +
    '<div class="exbotoes"><button class="exprox" id="prova-volta">Voltar ao curso</button>' +
    '<button class="typeskip" id="prova-refaz">↺ Refazer a prova</button></div>';
}
// A linha da prova na trilha. O ✓ vale a semana: segunda o círculo volta vazio, como a
// lição de hoje volta aberta amanhã. Refazer pode sempre.
function linhaDaProva(cap) {
  const n = cartasDaProva(cap).length;
  if (!n) return '';
  const feita = provaDaSemana(cap);
  const sub = feita ? 'Nota ' + notaTexto(feita.nota) + ' nesta semana · toque para refazer'
    : n + ' palavras, uma vez cada · nota de 0 a 10';
  return '<div class="sheetsep">provas</div>' +
    linhaCurso('data-prova="' + esc(cap) + '"', '📝', capituloDaSemana() === cap ? 'Prova da semana' : 'Prova', sub, feita ? 1 : 0);
}

// ── as notas da turma (aba Competição) ──────────────────────
// Um cartão por capítulo, uma linha por pessoa: as tentativas em barrinhas, a última
// nota e quanto ela andou desde a primeira. Ordenado pela última nota; quem ainda não
// fez fica embaixo com um travessão.
let provasTurma = {};   // user → cap → tentativas
function guardaProvaDaTurma(row) {
  const m = /^prova:(cap\d+)$/.exec(row.card_id || ''); // os simulados do HSK também moram aqui; não são capítulo
  if (!m || !row.user_name || row.user_name === 'convidado') return;
  const h = historicoDeProva(m[1], row.hab);
  if (h.length) (provasTurma[row.user_name] = provasTurma[row.user_name] || {})[m[1]] = h;
}
function renderProvasTurma() {
  const el = $('comp-provas');
  if (!el) return;
  const caps = [...new Set(Object.values(provasTurma).flatMap(p => Object.keys(p)))].sort((a, b) => numCap(a) - numCap(b));
  if (!caps.length) { el.innerHTML = '<p class="vazio">Ninguém fez prova ainda. Ela fica no Curso, em cada capítulo.</p>'; return; }
  const gente = Object.keys(USERS).filter(u => u !== 'convidado');
  el.innerHTML = caps.map(cap => {
    const nome = NOMES_CAP[numCap(cap)];
    const linhas = gente.map(u => [u, (provasTurma[u] || {})[cap] || []]).sort((a, b) => {
      const x = a[1][a[1].length - 1], y = b[1][b[1].length - 1];
      return x && y ? y.nota - x.nota : x ? -1 : y ? 1 : 0;
    });
    return '<div class="pvt-cap"><div class="pvt-cab"><b>' + esc(origemLabel(cap)) + '</b>' +
      (nome ? '<span class="zh" lang="zh-Hans">' + esc(nome[0]) + ' · ' + esc(nome[1]) + '</span>' : '') + '</div>' +
      linhas.map(([u, h]) => {
        const z = h[h.length - 1];
        const sub = !h.length ? 'ainda não fez' : h.length === 1 ? '1 tentativa'
          : h.length + ' tentativas · ' + difTexto(z.nota - h[0].nota) + ' desde a 1ª';
        return '<div class="pvt-linha' + (u === settings.user ? ' eu' : '') + '"><span class="pvt-nome"><b>' + esc(USERS[u] || u) + '</b><small>' + sub + '</small></span>' +
          '<span class="pvt-barras">' + h.slice(-10).map(r => '<i style="height:' + Math.max(8, r.nota * 10) + '%;background:' + corDaNota(r.nota) +
          ';opacity:' + (r === z ? 1 : 0.45) + '"></i>').join('') + '</span>' +
          '<span class="pvt-nota" style="color:' + (z ? corDaNota(z.nota) : 'var(--soft)') + '">' + (z ? notaTexto(z.nota) : '—') + '</span></div>';
      }).join('') + '</div>';
  }).join('') + '<p class="cursonota">A nota grande é a última tentativa de cada um; as barrinhas, todas elas, da mais antiga pra mais nova. Refazer a prova conta — é assim que se vê quem está firmando o capítulo.</p>';
}

exEstilo(`
.pv-carta{align-items:center;justify-content:center;text-align:center;cursor:pointer;gap:10px;min-height:300px;}
.pv-hanzi{font-size:72px;line-height:1.15;font-weight:500;}
.pv-dica{color:var(--soft);font-size:13px;}
.pv-resp{display:flex;gap:10px;margin-top:12px;position:sticky;bottom:12px;}
.pv-b{flex:1;border:0;border-radius:12px;padding:14px;font:inherit;font-weight:800;font-size:16px;cursor:pointer;box-shadow:var(--shadow);}
.pv-b.errei{background:var(--err-bg);color:var(--err);}
.pv-b.acertei{background:var(--ok-bg);color:var(--ok);}
.pv-nota span{font-size:14px;}
.pv-nota small{text-align:center;}
.pv-err{display:flex;flex-direction:column;gap:6px;margin-bottom:16px;}
.pv-err button{display:flex;align-items:center;gap:12px;text-align:left;padding:10px 12px;border:1px solid var(--line);
  border-radius:12px;background:var(--surface);color:var(--txt);font:inherit;cursor:pointer;}
.pv-err b{font-size:24px;font-weight:500;min-width:48px;}
.pv-err span{flex:1;display:flex;flex-direction:column;gap:2px;min-width:0;}
.pv-err i{font-style:normal;font-weight:700;font-size:14px;}
.pv-err small{font-size:13px;}
.pv-err em{font-style:normal;color:var(--soft);}
.pvt-cap{padding:4px 0 10px;border-bottom:1px solid var(--line);margin-bottom:10px;}
.pvt-cab{display:flex;flex-direction:column;gap:2px;margin-bottom:6px;}
.pvt-cab span{color:var(--mut);font-size:13px;}
.pvt-linha{display:flex;align-items:center;gap:12px;padding:6px 0;}
.pvt-linha.eu .pvt-nome b{color:var(--red);}
.pvt-nome{flex:1;display:flex;flex-direction:column;gap:1px;min-width:0;}
.pvt-nome small{color:var(--mut);font-size:12px;}
.pvt-barras{display:flex;align-items:flex-end;gap:2px;height:26px;width:60px;justify-content:flex-end;}
.pvt-barras i{display:block;width:4px;border-radius:1.5px;}
.pvt-nota{font-weight:800;font-size:20px;min-width:40px;text-align:right;}
`);
