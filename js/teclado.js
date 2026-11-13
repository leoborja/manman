/* Mànmàn — O IME de mentirinha, o modo ordenar e o conversor ni3 → nǐ. */
'use strict';

// ── teclado: um IME chinês de mentirinha ────────────────────
// É assim que se escreve chinês num celular: você digita o SOM em letras latinas, sem
// tom, e o teclado oferece os ideogramas que se leem daquele jeito — quem escolhe é você.
// Aqui a carta mostra o português e a pessoa refaz esse caminho inteiro: lembrar o som,
// escrever o som, reconhecer o ideograma no meio dos homófonos. Quem oferece os
// candidatos é o teclado de mandarim DO APARELHO, não o app: a fileira própria escolhia
// entre as cem cartas do deck e entregava a resposta; a do sistema, entre milhares.
// pinyin → só as letras do som: sem marca de tom, sem espaço, sem apóstrofo. O ü vira u
// e o v também, então "lu", "lv" e "lǜ" caem todos no mesmo lugar — nenhum teclado de
// celular tem ü, e cobrar o trema de quem tem duas semanas de mandarim seria maldade.
function pyPlano(py) {
  return String(py || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // marcas de tom são acentos combinantes
    .replace(/v/g, 'u')
    .replace(/[^a-z]/g, '');
}
function montaTeclado(card) {
  typeResult = null;
  typePinyin = '';
  $('typeask').textContent = card.pt;
  const inp = $('typein');
  inp.placeholder = ehFrase(card) ? 'escreva a frase' : 'escreva o 汉字';
  inp.value = '';
  inp.disabled = false;
  $('typefb').className = 'typefb';
  $('typefb').innerHTML = '';
  $('type-skip').disabled = false;
  renderTypeCheck();
}
// sem a fileira de candidatos não existe mais o clique que respondia a carta: quem
// responde agora é o "conferir" (ou o Enter), e só com alguma coisa escrita
function renderTypeCheck() {
  $('type-check').disabled = !!typeResult || !$('typein').value.trim();
}
// hanzi = o que você escreveu; null = tocou em "não lembro"
function confereTeclado() {
  const v = $('typein').value.trim();
  if (v) respondeTeclado(v);
}
// Uma linha de caracteres com cada um marcado contra um gabarito: verde onde bate na
// MESMA posição, vermelho onde não. Numa palavra de dois caracteres dava pra comparar
// no olho; numa frase de cinco, ver "era 我是巴西人 / você 我是巴细人" é caçar o erro a
// olho nu — que é justamente o que o resultado deveria poupar.
function charDiff(str, gabarito) {
  const g = [...String(gabarito || '')];
  return '<div class="chardiff zh" lang="zh-Hans">' + [...String(str)].map((ch, i) =>
    '<span class="' + (g[i] === ch ? 'hit' : 'miss') + '">' + esc(ch) + '</span>').join('') + '</div>';
}
function respondeTeclado(hanzi) {
  if (!current || typeResult) return;
  // pontuação e espaço não são a pergunta: quem escreve 我是巴西人。com o ponto do
  // teclado chinês acertou a frase, e reprovar por isso seria cobrar datilografia
  const alvo = limpaHanzi(current.hanzi);
  const dado = limpaHanzi(hanzi);
  const ok = dado === alvo;
  typeResult = { ok: ok, escolhido: hanzi };
  // As duas metades da pergunta, medidas em separado. O ideograma só é medido quando o
  // som estava certo: errar o pinyin e cair num candidato qualquer não diz nada sobre
  // confundir homófonos. E digitar o pinyin certo e mesmo assim tocar em "não lembro"
  // é justamente o caso que isto quer pegar — som ok, ideograma não.
  // Com o teclado do sistema o campo recebe só o ideograma pronto — o pinyin fica
  // dentro do IME. Alguns teclados o entregam no evento de composição; quando entregam,
  // dá pra separar "não lembrei o som" de "errei o ideograma". Quando não entregam é
  // melhor não gravar nada do que gravar as duas coisas erradas.
  // Na frase o buffer de composição do IME guarda só a última palavra digitada, nunca a
  // frase inteira — compará-lo com o pinyin todo marcaria erro de "som" em toda carta,
  // inclusive nas certas. Aqui a habilidade medida é outra e é uma só: acertar a frase.
  if (ehFrase(current)) {
    bumpHab(current.id, 'frase', !ok);
  } else {
    const digitado = pyPlano(typePinyin);
    if (digitado) {
      const somOk = digitado === pyPlano(current.pinyin);
      bumpHab(current.id, 'som', !somOk);
      if (somOk) bumpHab(current.id, 'ideo', !ok);
    }
  }
  $('typein').disabled = true;
  $('type-skip').disabled = true;
  $('type-check').disabled = true;
  // uma linha por informação: a resposta certa, o que você escolheu, e o som
  const linha = (cls, lbl, h) => '<div class="l ' + cls + '"><span class="lbl">' + lbl +
    '</span><b class="zh" lang="zh-Hans">' + esc(h) + '</b></div>';
  const fb = $('typefb');
  if (ehFrase(current)) {
    // na frase o ideograma grande não cabe na linha, e comparar duas frases quase iguais
    // no olho é o exercício errado: aqui o resultado é o erro MARCADO onde ele aconteceu
    fb.className = 'typefb frase ' + (ok ? 'ok' : 'ruim');
    fb.innerHTML = '<div class="l"><span class="lbl">' + (ok ? '对!' : 'era') + '</span></div>' +
      charDiff(alvo, ok ? alvo : dado) +
      (!ok && dado ? '<div class="l no"><span class="lbl">você</span></div>' + charDiff(dado, alvo) : '') +
      '<div class="py">' + pinyinColored(current.pinyin) + '</div>';
  } else {
    fb.className = 'typefb ' + (ok ? 'ok' : 'ruim');
    fb.innerHTML = linha('', ok ? '对!' : 'era', current.hanzi) +
      (!ok && hanzi ? linha('no', 'você', hanzi) : '') +
      '<div class="py">' + pinyinColored(current.pinyin) + '</div>';
  }
  $('hint-f').textContent = 'toque na carta pra ver tudo';
  ajustaAltura(); // o resultado entrou na frente e pode ser mais alto que a pergunta
  // sugestão da nota; quem decide ainda é você, igual ao desenho
  $('grades').classList.add('show');
  $('g-' + (ok ? 'good' : 'again')).classList.add('sugerido');
  if (settings.autoSpeak) speak(current, true);
}

// ── ordenar as palavras ─────────────────────────────────────
// A frase ensina uma coisa que a palavra não ensina: ORDEM. 不 antes do verbo, o tempo
// antes do lugar, o 是 que só liga substantivo a substantivo. Nenhum dos outros modos
// cobra isso — virar a carta cobra reconhecimento, o teclado cobra o ideograma.
// Aqui a resposta é um toque, não digitação: no celular montar cinco pílulas é rápido,
// e escrever cinco 汉字 no IME é lento o bastante pra virar pedágio. As peças são
// identificadas por chave, e não pelo que está escrito nelas, porque frase repete
// palavra — 对不对 tem dois 对, e sem chave própria clicar num moveria o outro.
function montaOrdenar(card) {
  ordResult = null;
  const seg = segmenta(card) || [];
  ordEscolhido = [];
  ordPool = shuffle(seg.map((p, k) => ({ p, k })));
  // frase de duas palavras sai embaralhada na ordem certa uma vez em duas: entrega a
  // resposta sem a pessoa pensar. Rembaralha enquanto estiver igual, com teto pra não
  // girar pra sempre quando todas as peças forem iguais.
  for (let i = 0; i < 8 && ordPool.every((o, j) => o.p === seg[j]); i++) shuffle(ordPool);
  $('ordask').textContent = card.pt;
  $('ordfb').className = 'typefb frase';
  $('ordfb').innerHTML = '';
  $('ord-skip').disabled = false;
  renderOrdenar();
}
function renderOrdenar() {
  const pill = (o, onde) => '<button class="ordpill zh" lang="zh-Hans" data-k="' + o.k +
    '" data-w="' + onde + '">' + esc(o.p) + '</button>';
  $('ordline').innerHTML = ordEscolhido.length
    ? ordEscolhido.map(o => pill(o, 'l')).join('')
    : '<span class="ordvazio">toque nas palavras na ordem certa</span>';
  $('ordline').classList.toggle('vazia', !ordEscolhido.length);
  $('ordpool').innerHTML = ordPool.map(o => pill(o, 'p')).join('');
  document.querySelectorAll('#ordline .ordpill, #ordpool .ordpill').forEach(b => b.onclick = (e) => {
    e.stopPropagation();
    if (ordResult) return;
    const k = +b.dataset.k;
    // clicar na de baixo põe no fim da frase; clicar na frase devolve pro monte —
    // é o desfazer, e não precisa de botão próprio
    const de = b.dataset.w === 'p' ? ordPool : ordEscolhido;
    const pra = b.dataset.w === 'p' ? ordEscolhido : ordPool;
    const i = de.findIndex(o => o.k === k);
    if (i >= 0) pra.push(de.splice(i, 1)[0]);
    renderOrdenar();
  });
  // só confere com a frase inteira montada: metade da frase não é resposta errada,
  // é resposta pela metade — e reprovar por ela ensinaria a coisa errada
  $('ord-check').disabled = !!ordResult || !!ordPool.length;
  ajustaAltura(); // mover pílula entre o monte e a frase muda quantas linhas cada um ocupa
}
// A carta não cresce com o conteúdo: as faces são `position:absolute; inset:0`, que é o
// que permite empilhar frente e verso no mesmo lugar pra poder virar. Enquanto o deck era
// só palavra isso nunca apareceu — 好, o pinyin e "bom / bem" cabem em qualquer altura.
// A frase estourou: sete caracteres com traçado quebram em duas fileiras, o pinyin longo
// vira três linhas e a nota é um parágrafo. E como a face é centralizada, o que não cabe
// não vaza só pra baixo: vaza pelos DOIS lados, por cima da moldura.
//
// Então a altura passa a ser medida — e das DUAS faces, não só da que está virada pra
// frente. A carta é uma só: se ela mudasse de tamanho no meio da virada, a página inteira
// pularia embaixo do dedo justo quando a pessoa foi ler a resposta.
function alturaDaFace(face) {
  if (!face) return 0;
  const cs = getComputedStyle(face);
  const gap = parseFloat(cs.rowGap) || 0;
  let h = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
  let n = 0;
  for (const el of face.children) {
    const s = getComputedStyle(el);
    // o que é absoluto não empurra nada: a etiqueta do tema, o 🔊 e a dica do rodapé
    if (s.display === 'none' || s.position === 'absolute') continue;
    const alt = el.offsetHeight; // offsetHeight e não getBoundingClientRect: a carta pode
    if (!alt) continue;          // estar no meio da rotação, e o rect vem deformado
    h += alt + (n++ ? gap : 0);
  }
  return h + 22; // a faixa da dica, que mora absoluta no rodapé e ninguém mediu acima
}
function ajustaAltura() {
  const f = $('fcard');
  if (!f.offsetParent) return; // aba escondida: sem largura, toda medida sai errada
  f.style.minHeight = '';      // limpa antes de ler, pra enxergar o mínimo da classe do modo
  const base = parseFloat(getComputedStyle(f).minHeight) || 0;
  const alvo = Math.max(alturaDaFace(f.querySelector('.face.front')),
                        alturaDaFace(f.querySelector('.face.back')));
  f.style.minHeight = Math.max(base, Math.ceil(alvo)) + 'px';
}
// gabarito = a ordem certa; verde na peça que caiu na MESMA posição, vermelho no resto
function ordPills(pecas, gabarito) {
  return '<div class="ordfbline">' + pecas.map((p, i) =>
    '<span class="ordfbpill zh' + (gabarito ? (gabarito[i] === p ? ' hit' : ' miss') : '') +
    '" lang="zh-Hans">' + esc(p) + '</span>').join('') + '</div>';
}
function respondeOrdenar(desistiu) {
  if (!current || ordResult) return;
  const certo = segmenta(current) || [];
  const seu = ordEscolhido.map(o => o.p);
  const ok = !desistiu && seu.length === certo.length && seu.every((p, i) => p === certo[i]);
  ordResult = { ok: ok };
  bumpHab(current.id, 'ordem', !ok);
  $('ord-check').disabled = true;
  $('ord-skip').disabled = true;
  document.querySelectorAll('#ordline .ordpill, #ordpool .ordpill')
    .forEach(b => b.classList.add('travada'));
  const fb = $('ordfb');
  fb.className = 'typefb frase ' + (ok ? 'ok' : 'ruim');
  fb.innerHTML = '<div class="l"><span class="lbl">' + (ok ? '对!' : 'era') + '</span></div>' +
    ordPills(certo, null) +
    // errou: a sua ordem embaixo, marcada. Certo, ela é a mesma linha de cima — repetir
    // seria só ocupar a tela dizendo duas vezes a mesma coisa.
    (!ok && seu.length ? '<div class="l no"><span class="lbl">você</span></div>' +
      ordPills(seu, certo) : '') +
    '<div class="py">' + pinyinColored(current.pinyin) + '</div>';
  $('hint-f').textContent = 'toque na carta pra ver tudo';
  ajustaAltura(); // o resultado acabou de entrar na frente: a carta cresce pra caber
  // a nota sugere um botão; quem decide é você, igual ao desenho e ao teclado
  $('grades').classList.add('show');
  $('g-' + (ok ? 'good' : 'again')).classList.add('sugerido');
  if (settings.autoSpeak) speak(current, true);
}

// ── conversor de tons: ni3 hao3 → nǐ hǎo ────────────────────
const TONE_MARKS = {
  a: ['ā', 'á', 'ǎ', 'à', 'a'], e: ['ē', 'é', 'ě', 'è', 'e'], i: ['ī', 'í', 'ǐ', 'ì', 'i'],
  o: ['ō', 'ó', 'ǒ', 'ò', 'o'], u: ['ū', 'ú', 'ǔ', 'ù', 'u'], 'ü': ['ǖ', 'ǘ', 'ǚ', 'ǜ', 'ü'],
  A: ['Ā', 'Á', 'Ǎ', 'À', 'A'], E: ['Ē', 'É', 'Ě', 'È', 'E'], O: ['Ō', 'Ó', 'Ǒ', 'Ò', 'O']
};
function pinyinTones(input) {
  return String(input || '').replace(/([a-zA-ZüÜ:]+)([1-5])/g, function (m, syl, tone) {
    syl = syl.replace(/v/g, 'ü').replace(/V/g, 'Ü').replace(/u:/g, 'ü').replace(/U:/g, 'Ü');
    const t = parseInt(tone, 10) - 1;
    if (t === 4) return syl; // tom neutro
    let idx = -1;
    const lower = syl.toLowerCase();
    if (lower.includes('a')) idx = lower.indexOf('a');
    else if (lower.includes('e')) idx = lower.indexOf('e');
    else if (lower.includes('ou')) idx = lower.indexOf('o');
    else { // última vogal
      for (let i = syl.length - 1; i >= 0; i--) {
        if ('iouü'.includes(lower[i])) { idx = i; break; }
      }
    }
    if (idx === -1) return syl + tone;
    const ch = syl[idx];
    const marks = TONE_MARKS[ch] || TONE_MARKS[ch.toLowerCase()];
    if (!marks) return syl + tone;
    return syl.slice(0, idx) + marks[t] + syl.slice(idx + 1);
  });
}
