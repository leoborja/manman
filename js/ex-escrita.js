/* Mànmàn — tipos de folha do professor (ver o contrato em js/curso.js).

   As quatro folhas que se respondem fazendo, e não escolhendo:
   - 🔍 caca      — um quadro de parecidos; toca-se em cada alvo.
   - ⌨️ traducao  — a fala em português; escreve-se em chinês.
   - 🩹 corrigir  — a frase errada já no campo; corrige-se ali mesmo.
   - ✍️ tracos    — o ideograma na grade; escreve-se na ordem dos traços.
   Mesmo comportamento das telas do iOS (ExCacaView, ExEscreverView, ExTracosView). */
'use strict';

// ── 🔍 caça ─────────────────────────────────────────────────
// No papel se conta; aqui se TOCA em cada um, que é a mesma busca com a vantagem de
// mostrar, na conferência, qual passou e qual enganou. O total não aparece antes: na
// folha ele é a resposta.
//
// Do Cap. 3 em diante a folha pede DOIS (ou três) no mesmo quadro (那 e 哪), e o gabarito
// do professor pinta cada um de uma cor. Aqui também: escolhe-se em cima qual se está
// caçando, e cada toque marca a casa com a cor dele. Trocar um pelo outro é erro — é
// justamente a confusão que a folha treina. No quadro de COMPONENTES (趴 tem 八) o
// gabarito vem casa a casa em `marcas`, porque não sai do caractere por comparação.
// Vale como certo só o quadro limpo: todas achadas com a cor certa, nenhum parecido.
EX_TIPOS.caca = {
  icone: '🔍',
  montar(el, item, ex, api) {
    const alvos = item.alvos || [item.hanzi || ''];
    const dois = alvos.length > 1;
    const linhas = (item.quadro || []).map(l => [...l]);
    const marcas = item.marcas ? item.marcas.map(l => [...l]) : null;
    // o gabarito: casa ("l,c") → índice do alvo
    const certas = {};
    linhas.forEach((linha, l) => linha.forEach((ch, c) => {
      const i = marcas && marcas[l] && c < marcas[l].length ? 'abc'.indexOf(marcas[l][c]) : alvos.indexOf(ch);
      if (i >= 0) certas[l + ',' + c] = i;
    }));
    const marcadas = {};   // casa → alvo com que foi marcada
    let atual = 0, conferido = false;

    // a cor de cada alvo: o primeiro no acento, o segundo azul, o terceiro roxo — nenhum
    // verde, laranja ou vermelho de erro, que são as cores da conferência
    const cor = (i) => 'var(--exc-' + Math.min(i, 2) + ')';
    el.innerHTML = '<div class="exc-enun"><div class="exc-pede"><span>' +
      (item.componentes ? 'Ache os componentes' : dois ? 'Ache' : 'Toque em cada') + '</span>' +
      alvos.map((a, i) => (i ? '<span>e</span>' : '') + '<b class="zh" lang="zh-Hans"' +
        (dois ? ' style="color:' + cor(i) + '"' : '') + '>' + esc(a) + '</b>').join('') + '</div>' +
      (item.pinyin && item.pt ? '<small>' + esc(item.pinyin) + ' · ' + esc(item.pt) + '</small>' : '') + '</div>' +
      '<div class="exc-sel"></div>' +
      '<div class="exc-quadro" style="grid-template-columns:repeat(' + Math.max(1, ...linhas.map(l => l.length)) + ',minmax(0,1fr))">' +
      linhas.map((linha, l) => linha.map((ch, c) =>
        '<button class="exc-casa zh" lang="zh-Hans" data-k="' + l + ',' + c + '">' + esc(ch) + '</button>').join('')).join('') +
      '</div><div class="exc-pe"></div>';
    const sel = el.querySelector('.exc-sel'), pe = el.querySelector('.exc-pe');

    function pintaCasas() {
      el.querySelectorAll('.exc-casa').forEach(b => {
        const k = b.dataset.k, m = marcadas[k];
        b.className = 'exc-casa zh';
        b.style.removeProperty('--exc-m');
        if (!conferido) {
          if (m !== undefined) { b.classList.add('marc'); b.style.setProperty('--exc-m', cor(m)); }
          return;
        }
        // depois de conferir: certa em verde, a que passou com contorno laranja, o
        // engano (parecido, ou o alvo trocado) em vermelho
        const c = certas[k];
        b.disabled = true;
        b.classList.add(c !== undefined && m === c ? 'certa' : c !== undefined && m === undefined ? 'passou'
          : m !== undefined ? 'engano' : 'resto');
      });
    }
    function pintaSeletor() {
      if (!dois || conferido) { sel.innerHTML = ''; return; }
      sel.innerHTML = alvos.map((a, i) =>
        '<button class="exc-alvo' + (atual === i ? ' on' : '') + '" data-i="' + i + '" style="--exc-m:' + cor(i) + '">' +
        '<i></i>' + (alvos.length < 3 ? 'marcar ' : '') + '<b class="zh" lang="zh-Hans">' + esc(a) + '</b></button>').join('');
      sel.querySelectorAll('button').forEach(b => b.onclick = () => { atual = +b.dataset.i; pintaSeletor(); });
    }
    // devolve se o quadro saiu limpo (só faz sentido depois de conferir)
    function pintaPe() {
      if (!conferido) {
        const n = Object.keys(marcadas).length;
        pe.innerHTML = '<button class="exc-conf"' + (n ? '' : ' disabled') + '>conferir</button>';
        pe.querySelector('button').onclick = conferir;
        return false;
      }
      const total = Object.keys(certas).length;
      let achadas = 0, trocadas = 0, enganos = 0;
      Object.keys(certas).forEach(k => {
        if (marcadas[k] === certas[k]) achadas++;
        else if (marcadas[k] !== undefined) trocadas++;
      });
      Object.keys(marcadas).forEach(k => { if (certas[k] === undefined) enganos++; });
      const limpo = achadas === total && !trocadas && !enganos;
      const partes = [];
      const faltaram = total - achadas - trocadas;
      if (faltaram > 0) partes.push(faltaram + ' ' + (faltaram > 1 ? 'passaram' : 'passou') + ' (contorno laranja)');
      if (trocadas > 0) partes.push(trocadas + ' com o alvo trocado');
      if (enganos > 0) partes.push(enganos + ' parecido' + (enganos > 1 ? 's' : '') + ' marcado' + (enganos > 1 ? 's' : ''));
      pe.innerHTML = '<div class="exc-res ' + (limpo ? 'ok' : 'erro') + '"><b>' +
        (limpo ? '对! Todos os ' + total : 'Achou ' + achadas + ' de ' + total) + '</b>' +
        (limpo ? '' : '<small>' + esc(partes.join(' · ') + (trocadas + enganos > 0 ? ' (vermelho)' : '')) + '</small>') + '</div>';
      return limpo;
    }
    function conferir() {
      if (conferido || !Object.keys(marcadas).length) return;
      conferido = true;
      pintaCasas(); pintaSeletor();
      api.responde(pintaPe());
      api.fala(alvos.join('，'));
    }
    // tocar marca com o alvo atual; tocar de novo com o mesmo desmarca; com o outro, troca a cor
    el.querySelector('.exc-quadro').onclick = (e) => {
      const b = e.target.closest('.exc-casa');
      if (!b || conferido) return;
      const k = b.dataset.k;
      if (marcadas[k] === atual) delete marcadas[k]; else marcadas[k] = atual;
      pintaCasas(); pintaPe();
    };
    pintaSeletor(); pintaCasas(); pintaPe();
  }
};

// ── ⌨️ tradução e 🩹 corrigir ───────────────────────────────
// As duas folhas que se respondem ESCREVENDO. Na tradução, a fala em português com quem
// fala (A/B); no corrigir, a frase errada já vem no campo e a correção é editá-la — assim
// se mexe só no erro, como no papel, em vez de reescrever tudo.
//
// O campo aceita o teclado de mandarim do aparelho, como o ⌨️ das cartas. Mas a frase da
// folha é longa e o computador costuma não ter IME chinês — sem ele não haveria como
// responder. Então há também o teclado do app, atrás de um toque: digita-se o som e
// escolhe-se o ideograma. Os candidatos vêm do deck inteiro e de todas as folhas, não
// desta frase: com centenas de ideogramas na fonte a fileira não entrega a resposta, que
// era o problema da fileira antiga do ⌨️ (que escolhia entre as cartas do deck pra UMA
// palavra).
//
// A conferência ignora pontuação e espaço (limpaHanzi): cobrar o ponto do teclado chinês
// seria cobrar datilografia. A exceção é o corrigir devolvido sem mudança nenhuma —
// 你好？ igual não vale, mesmo que 你好 sem o ponto seja uma das respostas.
const K_EX_IME = 'manman.ex.imeApp';   // do aparelho: o teclado do app fica aberto ou não
let exwIndice = null;                  // pinyin plano → [{h, n}], montado na 1ª vez que se usa

// Cada fonte que tem ideograma e pinyin alinhados vira candidato: a palavra inteira pelo
// som colado ("nihao" → 你好) e cada ideograma pela sua sílaba ("ni" → 你). Quando a
// conta de sílabas não fecha com a de ideogramas, entra só a palavra inteira.
function exwMontaIndice() {
  const conta = {};   // plano → { hanzi → vezes }
  const poe = (py, h) => {
    if (!py || !h) return;
    (conta[py] = conta[py] || {})[h] = (conta[py][h] || 0) + 1;
  };
  // palavra: entra também inteira. Só carta de palavra e nota de rodapé — pedaço de
  // frase ("你好林娜") como candidato seria entregar a resposta da folha.
  const junta = (hanzi, pinyin, palavra) => {
    const hz = [...limpaHanzi(hanzi)];
    if (!hz.length || !pinyin) return;
    const sils = [];
    String(pinyin).replace(PONTU, ' ').split(/[\s'’]+/).filter(Boolean)
      .forEach(t => silabas(t).forEach(s => sils.push(pyPlano(s))));
    if (palavra && hz.length > 1) poe(sils.join(''), hz.join(''));
    if (sils.length === hz.length) hz.forEach((h, i) => poe(sils[i], h));
  };
  cards.forEach(c => junta(c.hanzi, c.pinyin, !ehFrase(c)));
  exerciciosDB.forEach(e => {
    (e.glossario || []).forEach(g => junta(g.hanzi, g.pinyin, true));
    // o pinyin do item é o da PRIMEIRA resposta; daqui sai só ideograma solto. Só das
    // folhas de escrever: no 🧩 a ordem das peças pode não ser a do pinyin, e o par
    // sílaba ↔ ideograma sairia trocado ("dou" → 天)
    if (e.tipo !== 'traducao' && e.tipo !== 'corrigir') return;
    (e.itens || []).forEach(it => { if (it.respostas && it.pinyin) junta(it.respostas[0], it.pinyin, false); });
  });
  exwIndice = {};
  Object.keys(conta).forEach(py => {
    exwIndice[py] = Object.keys(conta[py]).map(h => ({ h, n: conta[py][h] }));
  });
}
// O som exato primeiro (o ideograma solto antes da palavra, o mais usado antes), depois as
// palavras que começam com o que já se digitou — é o que o IME do celular faz.
function exwCandidatos(digitado) {
  const p = pyPlano(digitado);
  if (!p) return [];
  if (!exwIndice) exwMontaIndice();
  const vistos = new Set(), out = [];
  const add = (lista) => lista.forEach(x => { if (!vistos.has(x.h)) { vistos.add(x.h); out.push(x.h); } });
  if (exwIndice[p]) add(exwIndice[p].slice().sort((a, b) => [...a.h].length - [...b.h].length || b.n - a.n));
  Object.keys(exwIndice).filter(k => k !== p && k.startsWith(p)).sort((a, b) => a.length - b.length)
    .forEach(k => add(exwIndice[k].filter(x => [...x.h].length > 1).sort((a, b) => b.n - a.n)));
  return out.slice(0, 18);
}

function exwMontar(el, item, ex, api, corrigir) {
  const respostas = item.respostas || [];
  // a resposta aceita que bate com o que se escreveu, se alguma bate
  const bate = (escrito) => {
    const meu = limpaHanzi(escrito);
    if (!meu) return null;
    if (corrigir && item.errada && limpaHanzi(item.errada) === meu && escrito.trim() === item.errada) return null;
    return respostas.find(r => limpaHanzi(r) === meu) || null;
  };
  let enviado = null;   // o que se mandou; null enquanto não conferiu ("" = não sei)
  let imeApp = !!load(K_EX_IME, false);
  let cursor = null;    // onde o teclado do app insere: a última posição do cursor no campo

  function enunciado() {
    let h = corrigir
      ? '<div class="exw-enun"><small>Corrija a frase</small><b class="zh exw-errada' + (enviado !== null ? ' riscada' : '') +
        '" lang="zh-Hans">' + esc(item.errada || '') + '</b></div>'
      : '<div class="exw-fala">' + (item.quem ? '<span class="exw-quem">' + esc(item.quem) + '</span>' : '') +
        '<b>' + esc(item.pt || '') + '</b></div>';
    if (enviado === null && ex.glossario && ex.glossario.length) {
      h += '<div class="exw-glos">' + ex.glossario.map(g =>
        '<span><b class="zh" lang="zh-Hans">' + esc(g.hanzi) + '</b><i>' + esc(g.pinyin) + '</i>' + esc(g.pt) + '</span>').join('') + '</div>';
    }
    return h;
  }

  function desenha() {
    if (enviado !== null) { el.innerHTML = enunciado() + resultado(enviado); return; }
    el.innerHTML = enunciado() +
      '<div class="exw-campo">' +
      // sem inputmode no modo normal: com "latin" o iOS abre o teclado ocidental e
      // atrapalha quem vai escrever no de mandarim. Com o teclado do app aberto, "none":
      // o toque no campo só mexe o cursor, e quem digita é o campo do som.
      '<input class="exw-in zh" lang="zh-Hans" type="text" enterkeyhint="done" autocomplete="off" autocorrect="off" ' +
      'autocapitalize="off" spellcheck="false" placeholder="escreva em chinês"' + (imeApp ? ' inputmode="none"' : '') + '>' +
      '<div class="exw-ime"></div>' +
      '</div>' +
      '<div class="exw-botoes"><button class="typeskip exw-naosei">não sei</button>' +
      '<button class="typeskip exw-conf">conferir</button></div>';
    const inp = el.querySelector('.exw-in');
    inp.value = corrigir ? (item.errada || '') : '';
    const guarda = () => { cursor = inp.selectionStart; };
    ['keyup', 'click', 'select', 'blur'].forEach(ev => inp.addEventListener(ev, guarda));
    inp.addEventListener('input', () => { guarda(); podeConferir(); });
    // isComposing: o Enter que fecha a composição do IME não é o Enter que confere
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) conferir(); });
    el.querySelector('.exw-naosei').onclick = () => envia('');
    el.querySelector('.exw-conf').onclick = conferir;
    desenhaIme();
    podeConferir();
  }
  function podeConferir() {
    const b = el.querySelector('.exw-conf'), inp = el.querySelector('.exw-in');
    if (b && inp) b.disabled = !limpaHanzi(inp.value);
  }

  // O teclado do app: o campo do som e a fileira de candidatos. Fechado, sobra só o
  // convite — quem tem o teclado de mandarim no aparelho nem precisa ver isto.
  function desenhaIme() {
    const box = el.querySelector('.exw-ime'), inp = el.querySelector('.exw-in');
    if (!imeApp) {
      box.innerHTML = '<button class="exw-abre">⌨️ sem teclado chinês? digite o som</button>';
      box.querySelector('button').onclick = () => {
        imeApp = true; save(K_EX_IME, true);
        inp.setAttribute('inputmode', 'none');
        desenhaIme();
        box.querySelector('.exw-py').focus({ preventScroll: true });
      };
      return;
    }
    box.innerHTML = '<div class="exw-pyrow"><input class="exw-py" type="text" enterkeyhint="go" autocomplete="off" ' +
      'autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="o som, sem tom: nihao">' +
      '<button class="exw-apaga" title="Apagar o ideograma antes do cursor">⌫</button></div>' +
      '<div class="exw-cands"></div>' +
      '<button class="exw-abre">fechar o teclado do app</button>';
    const py = box.querySelector('.exw-py'), cands = box.querySelector('.exw-cands');
    const onde = () => { const v = inp.value; return cursor === null || cursor > v.length ? v.length : cursor; };
    const mostra = () => {
      const lista = exwCandidatos(py.value);
      cands.innerHTML = lista.length
        ? lista.map(h => '<button class="zh" lang="zh-Hans">' + esc(h) + '</button>').join('')
        : '<span>' + (py.value.trim() ? 'nenhum ideograma do curso com esse som' : 'escreva o som e toque no ideograma') + '</span>';
      cands.querySelectorAll('button').forEach(b => b.onclick = () => escolhe(b.textContent));
    };
    const escolhe = (h) => {
      const v = inp.value, i = onde();
      inp.value = v.slice(0, i) + h + v.slice(i);
      cursor = i + h.length;
      py.value = '';
      mostra(); podeConferir();
      py.focus({ preventScroll: true });
    };
    py.addEventListener('input', mostra);
    // Enter e espaço pegam o primeiro candidato, como no IME de verdade; Enter com o
    // campo do som vazio confere a frase
    py.addEventListener('keydown', (e) => {
      if (e.isComposing || (e.key !== 'Enter' && e.key !== ' ')) return;
      e.preventDefault();
      const primeiro = cands.querySelector('button');
      if (py.value.trim() && primeiro) escolhe(primeiro.textContent);
      else if (e.key === 'Enter' && !py.value.trim()) conferir();
    });
    box.querySelector('.exw-apaga').onclick = () => {
      const v = inp.value, i = onde();
      if (!i) return;
      const antes = [...v.slice(0, i)];   // por code point: ideograma raro ocupa dois
      antes.pop();
      inp.value = antes.join('') + v.slice(i);
      cursor = antes.join('').length;
      podeConferir();
    };
    box.querySelector('.exw-abre').onclick = () => {
      imeApp = false; save(K_EX_IME, false);
      inp.removeAttribute('inputmode');
      desenhaIme();
    };
    mostra();
  }

  function conferir() {
    const inp = el.querySelector('.exw-in');
    if (!inp || enviado !== null || !limpaHanzi(inp.value)) return;
    envia(inp.value.trim());
  }
  function envia(escrito) {
    if (enviado !== null) return;
    enviado = escrito;
    const certa = bate(escrito);
    desenha();
    api.responde(!!certa);
    api.fala(certa || respostas[0] || '');
  }

  // A frase não cabe no "era X" grande: o que importa é ver ONDE ela saiu do lugar, então
  // cada caractere vem marcado contra o gabarito (o charDiff do ⌨️ das cartas).
  function resultado(escrito) {
    const certa = bate(escrito);
    const gab = certa || respostas[0] || '';
    const alvo = limpaHanzi(gab), dado = limpaHanzi(escrito);
    let h = '<div class="exgab exw-gab ' + (certa ? 'ok' : 'erro') + '"><small>' + (certa ? '对!' : 'era') + '</small>' +
      charDiff(alvo, dado || alvo);
    if (!certa && dado) h += '<small class="exw-voce">você</small>' + charDiff(dado, alvo);
    // o pinyin do JSON é o da primeira resposta
    if (gab === respostas[0] && item.pinyin) h += '<span class="pinyin">' + pinyinColored(item.pinyin).replace(/<span class="pron">.*?<\/span>/, '') + '</span>';
    if (corrigir && item.pt) h += '<span class="pt">' + esc(item.pt) + '</span>';
    const outras = respostas.filter(r => r !== gab);
    if (outras.length) h += '<span class="exw-tb">também vale: <span class="zh" lang="zh-Hans">' + esc(outras.join('  ')) + '</span></span>';
    h += '</div>';
    if (item.nota) h += '<div class="exw-nota">' + esc(item.nota) + '</div>';
    return h;
  }

  desenha();
}
EX_TIPOS.traducao = { icone: '⌨️', montar(el, item, ex, api) { exwMontar(el, item, ex, api, false); } };
EX_TIPOS.corrigir = { icone: '🩹', montar(el, item, ex, api) { exwMontar(el, item, ex, api, true); } };

// ── ✍️ ordem dos traços ─────────────────────────────────────
// A folha MOSTRA o ideograma e pede a ordem: então o de memória não cabe aqui, só os dois
// níveis com o fantasma. O 👣 guiado é o papel (desenha-se inteiro e valida no fim); o
// 🚦 ao vivo corrige traço a traço. A escolha fica no aparelho e vale para a folha toda.
// As peças são componentes (艮, 尸, 击…), e a linha de baixo diz em que ideograma da lição
// cada uma mora — é para isso que a folha existe.
//
// As notas são as do ✍️ das cartas (notaOrdem, pareceTraco, mesmaDirecao em desenho.js);
// a grade é outra, desta folha, porque a do estudo vive presa à carta e ao estado dela.
const K_EX_TRACOS = 'manman.ex.tracos.nivel';   // do aparelho, como no iOS
EX_TIPOS.tracos = {
  icone: '✍️',
  montar(el, item, ex, api) {
    const ch = [...(item.hanzi || '')][0] || '';
    const d = strokesDB[ch];
    const temTraco = !!(d && d.m && d.m.length && d.s);
    const semPron = (py) => pinyinColored(py).replace(/<span class="pron">.*?<\/span>/, '');
    const pergunta = '<div class="ext-perg">' +
      '<div>' + (item.pinyin ? '<b class="ext-py">' + semPron(item.pinyin) + '</b>' : '') +
      (item.pt ? '<span>' + esc(item.pt) + '</span>' : '') + '</div>' +
      (item.em ? '<small>aparece em <span class="zh" lang="zh-Hans">' + esc(item.em) + '</span></small>' : '') + '</div>';

    // Sem o traçado no app não há o que corrigir: mostra a peça e deixa seguir, valendo
    // como errada — o placar não pode inventar um acerto.
    if (!temTraco) {
      el.innerHTML = pergunta + '<div class="ext-sem"><b class="zh" lang="zh-Hans">' + esc(ch) + '</b>' +
        '<small>Este ideograma ainda não tem o traçado no app — não dá pra conferir a ordem.</small>' +
        '<button class="typeskip">Pular</button></div>';
      const b = el.querySelector('.ext-sem button');
      b.onclick = () => {
        if (api.respondido()) return;
        b.disabled = true;
        b.textContent = 'pulado · conta como não feito';
        api.responde(false);
        api.fala(ch);
      };
      return;
    }

    let nivel = load(K_EX_TRACOS, 'guiado') === 'aovivo' ? 'aovivo' : 'guiado';
    let ink = [], trecho = null, score = null;
    let feitos = 0, primeira = 0, tentativas = 0, erros = 0, recusado = null;

    el.innerHTML = '<div class="ext-barra"><div class="ext-niveis"></div><span></span>' +
      '<button class="ext-ico ext-desf" title="Desfazer o último traço">↶</button>' +
      '<button class="ext-ico ext-limpa" title="Limpar">✕</button></div>' +
      pergunta +
      '<div class="ext-padbox"><canvas class="ext-pad"></canvas></div>' +
      '<div class="ext-pe"><span class="ext-conta"></span><button class="ext-val">✓ Validar</button></div>' +
      '<div class="ext-res"></div>';
    const cv = el.querySelector('.ext-pad'), resBox = el.querySelector('.ext-res');
    let ctx = null, L = 0;

    function zera() {
      ink = []; trecho = null; score = null;
      feitos = 0; primeira = 0; tentativas = 0; erros = 0; recusado = null;
    }
    function monta() {
      // o lado é o que a carta deixar, com teto: grade grande demais empurra o Validar
      // pra fora da tela no celular
      const larg = el.clientWidth || 300;
      const alt = window.innerHeight ? window.innerHeight - 330 : 320;
      lado(Math.round(Math.max(180, Math.min(larg, 320, Math.max(220, alt)))));
    }
    function lado(n) {
      L = n;
      const dpr = window.devicePixelRatio || 1;
      cv.width = Math.round(L * dpr); cv.height = Math.round(L * dpr);
      cv.style.width = L + 'px'; cv.style.height = L + 'px';
      ctx = cv.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      pinta();
    }
    function pinta() {
      if (!ctx) return;
      const c = ctx, k = L / DRAW_BOX, vivo = nivel === 'aovivo';
      c.clearRect(0, 0, L, L);
      // 田字格: a moldura e a cruz pontilhada que ensina onde cada parte mora
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
      // o fantasma: por baixo da tinta, senão a parte acertada o esconde
      c.save();
      c.scale(k, k); c.translate(0, 900); c.scale(1, -1); // o Y do makemeahanzi é invertido
      c.fillStyle = corVar('--txt', '#1b1d21');
      c.globalAlpha = score ? 0.22 : 0.14;
      d.s.forEach((pd, i) => { if (!(vivo && i < feitos)) c.fill(new Path2D(pd)); });
      if (vivo) {
        c.globalAlpha = 1;
        c.fillStyle = corVar('--ok', '#2e9e5b');
        for (let i = 0; i < feitos; i++) c.fill(new Path2D(d.s[i]));
        // errou duas vezes no mesmo traço: ele acende, e a bolinha diz por onde começa
        if (tentativas >= 2 && feitos < d.s.length) {
          c.globalAlpha = 0.45;
          c.fillStyle = corVar('--red', '#c8102e');
          c.fill(new Path2D(d.s[feitos]));
        }
      }
      c.restore();
      if (vivo && tentativas >= 2 && feitos < d.m.length) {
        const p0 = d.m[feitos][0];
        c.save();
        c.fillStyle = corVar('--red', '#c8102e');
        c.beginPath();
        c.arc(p0[0] * k, (900 - p0[1]) * k, Math.max(5, L * 0.026), 0, Math.PI * 2);
        c.fill();
        c.restore();
      }
      // a tinta: no guiado validado, cada traço verde ou vermelho conforme entrou na ordem
      c.save();
      c.lineWidth = Math.max(7, L * 0.05);
      c.lineCap = 'round'; c.lineJoin = 'round';
      const passos = score && score.passos;
      const risca = (t) => {
        if (t.length === 1) { // toque seco: um ponto (o 、 é isso mesmo)
          c.beginPath(); c.arc(t[0][0] * k, t[0][1] * k, c.lineWidth / 2, 0, Math.PI * 2); c.fill();
          return;
        }
        c.beginPath();
        t.forEach((p, i) => i ? c.lineTo(p[0] * k, p[1] * k) : c.moveTo(p[0] * k, p[1] * k));
        c.stroke();
      };
      ink.forEach((t, i) => {
        const pas = passos && passos[i];
        c.strokeStyle = c.fillStyle = pas ? (pas.ok ? corVar('--ok', '#2e9e5b') : corVar('--err', '#c8102e')) : corVar('--txt', '#1b1d21');
        risca(t);
      });
      if (recusado) { // o traço que o ao vivo acabou de recusar: pisca em vermelho e some
        c.strokeStyle = c.fillStyle = corVar('--err', '#c8102e');
        c.globalAlpha = 0.55;
        risca(recusado);
      }
      c.restore();
      // o número em cima do traço errado: "esse que você fez em terceiro é o quinto"
      if (passos) {
        c.save();
        c.font = '700 ' + Math.max(10, Math.round(L * 0.055)) + 'px system-ui, sans-serif';
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillStyle = corVar('--err', '#c8102e');
        passos.forEach((pas, i) => {
          if (pas.ok || !ink[i] || !ink[i].length) return;
          const p0 = ink[i][0];
          c.fillText(pas.achou >= 0 ? String(pas.achou + 1) : '?', p0[0] * k, p0[1] * k - L * 0.045);
        });
        c.restore();
      }
    }
    function ferramentas() {
      const vivo = nivel === 'aovivo', aberto = !score;
      // com a nota na tela os níveis apagam: trocar a régua embaixo de uma nota já dada
      // deixaria um número que não quer dizer mais nada
      const nv = el.querySelector('.ext-niveis');
      nv.innerHTML = ['guiado', 'aovivo'].map(n =>
        '<button data-n="' + n + '"' + (n === nivel ? ' class="on"' : '') + (aberto ? '' : ' disabled') +
        ' title="' + esc(ESCRITA_DICA[n]) + '">' + ESCRITA_LABEL[n] + '</button>').join('');
      nv.querySelectorAll('button').forEach(b => b.onclick = () => {
        if (score || b.dataset.n === nivel) return;
        nivel = b.dataset.n; save(K_EX_TRACOS, nivel);
        zera(); ferramentas(); pinta();   // régua nova, desenho novo
      });
      const desf = el.querySelector('.ext-desf'), limpa = el.querySelector('.ext-limpa');
      // no ao vivo cada traço já foi conferido quando saiu do dedo: desfazer seria
      // desfazer a correção. Sobra o ✕, que ali quer dizer recomeçar.
      desf.style.display = vivo || !aberto ? 'none' : '';
      limpa.style.display = aberto ? '' : 'none';
      desf.disabled = !ink.length;
      limpa.disabled = vivo ? !feitos && !tentativas : !ink.length;
      el.querySelector('.ext-pe').style.display = aberto ? '' : 'none';
      el.querySelector('.ext-conta').textContent = vivo
        ? 'traço ' + Math.min(feitos + 1, d.m.length) + ' de ' + d.m.length
        : ink.length ? ink.length + ' de ' + d.m.length + ' traços' : '';
      const val = el.querySelector('.ext-val');
      val.style.display = vivo ? 'none' : '';
      val.disabled = !ink.length;
    }
    el.querySelector('.ext-desf').onclick = () => {
      if (score || nivel === 'aovivo' || !ink.length) return;
      ink.pop(); pinta(); ferramentas();
    };
    el.querySelector('.ext-limpa').onclick = () => { if (score) return; zera(); pinta(); ferramentas(); };
    el.querySelector('.ext-val').onclick = () => {
      if (score || !ink.length || nivel === 'aovivo') return;
      const r = notaOrdem(ch, ink);
      if (r) fecha(r);
    };

    function fecha(r) {
      score = r;
      // no ao vivo o caractere sempre sai inteiro e na ordem: o limpo é sem tropeço nenhum
      const limpo = r.vivo ? r.nota >= 100 : r.nota >= ORD_OK;
      // a grade encolhe quando a nota entra, como no iOS: senão o resultado cai embaixo
      // do rodapé com o Próxima, e a pessoa não vê o quanto acertou
      lado(Math.min(L, 210));
      ferramentas();
      let titulo, detalhe;
      if (r.vivo) {
        titulo = 'acertou ' + r.nota + '% da ordem';
        detalhe = ch + ' · ' + r.certos + ' de ' + r.total + ' traços de primeira' +
          (r.erros ? ' · ' + r.erros + ' recusa' + (r.erros > 1 ? 's' : '') + ' no caminho' : '');
      } else {
        titulo = r.nota + '% da ordem';
        detalhe = ch + ' · ' + r.certos + ' de ' + r.total + ' traços na ordem certa' +
          (r.tracos !== r.oficial ? ' · você fez ' + r.tracos + ', o ideograma tem ' + r.oficial : '');
      }
      resBox.innerHTML = '<div class="ext-nota ' + (limpo ? 'ok' : 'quase') + '"><b>' + (limpo ? '对! ' : '') + esc(titulo) + '</b>' +
        '<small>' + esc(detalhe) + '</small></div>' +
        '<div class="ext-anim"><small>a ordem certa</small></div>';
      // o traçado animado é o gabarito da folha: traço por traço, na ordem
      const anim = buildStrokeSvg(ch, 80, 200);
      resBox.querySelector('.ext-anim').appendChild(anim.svg);
      anim.svg.querySelectorAll('path[clip-path]').forEach(l => { void l.getBoundingClientRect(); l.style.strokeDashoffset = '0'; });
      api.responde(limpo);
      api.fala(item.hanzi || ch);
    }

    // Fim do traço. No ao vivo é aqui que se confere: este é o PRÓXIMO traço da ordem, no
    // sentido certo? Se não for, ele não cola — a recusa na hora é que ensina a ordem.
    function fechaTraco() {
      const t = trecho;
      trecho = null;
      if (!t || score) return;
      if (nivel !== 'aovivo') { ferramentas(); return; }
      if (feitos >= d.m.length) return;
      const alvo = medianaTela(d, feitos);
      // a régua afrouxa da 3ª tentativa em diante (ver ORD_SOS); o sentido vale sempre
      const limite = tentativas >= 2 ? ORD_SOS : ORD_MIN;
      const passou = pareceTraco(t, alvo) >= limite && mesmaDirecao(t, alvo);
      ink.pop(); // a tinta solta nunca fica: ou vira traço aceito, ou some
      if (passou) {
        if (!tentativas) primeira++; // acertar depois de ver a dica não conta como de primeira
        feitos++; tentativas = 0;
        pinta(); ferramentas();
        if (feitos >= d.m.length) {
          fecha({ vivo: true, nota: Math.round(primeira / d.m.length * 100), certos: primeira,
            total: d.m.length, erros });
        }
        return;
      }
      tentativas++; erros++;
      recusado = t;
      pinta(); ferramentas();
      setTimeout(() => { if (recusado === t) { recusado = null; pinta(); } }, 450);
    }

    // px da tela → o quadro 0–1024, preso na borda: o que aparece é o que se mede
    const xy = (e) => {
      const r = cv.getBoundingClientRect(), k = DRAW_BOX / (r.width || 1);
      const preso = v => Math.max(0, Math.min(DRAW_BOX, v));
      return [preso((e.clientX - r.left) * k), preso((e.clientY - r.top) * k)];
    };
    const pode = () => !score && !api.respondido();
    const comeca = (p) => { trecho = [p]; ink.push(trecho); pinta(); };
    const segue = (p) => {
      const u = trecho[trecho.length - 1];
      if (Math.hypot(p[0] - u[0], p[1] - u[1]) < 6) return; // colado no anterior não acrescenta
      trecho.push(p); pinta();
    };
    // No DEDO, eventos de toque e não Pointer Events: no iOS só o preventDefault no
    // touchstart segura a rolagem antes de ela nascer (a história inteira está no bindPad
    // de desenho.js). Os de toque precisam de passive:false, senão o preventDefault é
    // ignorado em silêncio. Mouse e caneta seguem nos Pointer Events, com captura no
    // próprio canvas — assim nada fica pendurado no document de um item para o outro.
    cv.addEventListener('touchstart', (e) => {
      if (!pode()) return;
      e.preventDefault();
      if (trecho) return; // segundo dedo no meio do traço: ignora, não recomeça
      comeca(xy(e.changedTouches[0]));
    }, { passive: false });
    cv.addEventListener('touchmove', (e) => {
      if (!trecho) return;
      e.preventDefault();
      segue(xy(e.changedTouches[0]));
    }, { passive: false });
    cv.addEventListener('touchend', fechaTraco);
    cv.addEventListener('touchcancel', fechaTraco);
    cv.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch' || !pode()) return;
      e.preventDefault();
      try { cv.setPointerCapture(e.pointerId); } catch (x) { /* sem captura, segue só dentro do canvas */ }
      comeca(xy(e));
    });
    cv.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch' || !trecho) return;
      segue(xy(e));
    });
    cv.addEventListener('pointerup', (e) => { if (e.pointerType !== 'touch') fechaTraco(); });
    cv.addEventListener('pointercancel', (e) => { if (e.pointerType !== 'touch') fechaTraco(); });

    ferramentas();
    // o runner monta com o el já na página, então a largura já se lê aqui (o clientWidth
    // força o layout); sem rAF, que não roda em aba de fundo
    monta();
  }
};

exEstilo(`
:root{--exc-0:var(--red);--exc-1:#2f6fd6;--exc-2:#8a4fd0;}
html[data-theme="dark"]{--exc-1:#6b9cf0;--exc-2:#b58cf0;}
.exc-enun{display:flex;flex-direction:column;align-items:center;gap:4px;text-align:center;}
.exc-pede{display:flex;align-items:baseline;justify-content:center;flex-wrap:wrap;gap:8px;font-size:19px;font-weight:700;}
.exc-pede b{font-size:34px;font-weight:500;}
.exc-enun small{color:var(--mut);font-size:15px;}
.exc-sel{display:flex;gap:8px;}
.exc-sel:empty{display:none;}
.exc-alvo{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;min-height:44px;border-radius:99px;
  border:0;background:var(--pill);color:var(--txt);font:inherit;font-weight:700;font-size:14px;cursor:pointer;}
.exc-alvo i{width:10px;height:10px;border-radius:50%;background:var(--exc-m);}
.exc-alvo b{font-size:22px;font-weight:500;}
.exc-alvo.on{background:var(--exc-m);color:#fff;}
.exc-alvo.on i{background:#fff;}
.exc-quadro{display:grid;gap:3px;}
.exc-casa{aspect-ratio:1;min-width:0;padding:0;border:2px solid transparent;border-radius:6px;background:var(--pill);
  color:var(--txt);font-size:clamp(14px,5.4vw,24px);line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;}
.exc-casa.marc{background:var(--exc-m);color:#fff;}
.exc-casa.certa{background:var(--ok);color:#fff;}
.exc-casa.passou{background:var(--warn-bg);color:var(--warn);border-color:var(--warn);}
.exc-casa.engano{background:var(--err);color:#fff;}
.exc-casa.resto{color:var(--soft);}
.exc-casa:disabled{cursor:default;}
.exc-pe{display:flex;justify-content:center;}
.exc-conf{border:0;border-radius:99px;background:var(--red);color:#fff;font:inherit;font-weight:800;font-size:15px;
  padding:0 22px;min-height:42px;cursor:pointer;}
.exc-conf:disabled{background:var(--pill);color:var(--soft);cursor:default;}
.exc-res{display:flex;flex-direction:column;align-items:center;gap:4px;text-align:center;}
.exc-res b{font-size:17px;}
.exc-res.ok b{color:var(--ok);} .exc-res.erro b{color:var(--warn);}
.exc-res small{color:var(--mut);font-size:13px;line-height:1.4;}

.exw-enun{display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;}
.exw-enun small{color:var(--mut);font-weight:700;font-size:13px;}
.exw-errada{font-size:30px;font-weight:500;}
.exw-errada.riscada{color:var(--mut);text-decoration:line-through;text-decoration-color:var(--err);}
.exw-fala{display:flex;align-items:baseline;justify-content:center;gap:10px;text-align:left;}
.exw-fala b{font-size:21px;line-height:1.3;}
.exw-quem{flex:0 0 24px;height:24px;border-radius:50%;background:var(--pill);color:var(--mut);font-size:13px;font-weight:800;
  display:inline-flex;align-items:center;justify-content:center;}
.exw-glos{display:flex;flex-wrap:wrap;justify-content:center;gap:6px;}
.exw-glos span{display:inline-flex;align-items:baseline;gap:4px;padding:4px 9px;border-radius:99px;background:var(--pill);
  color:var(--mut);font-size:12px;}
.exw-glos b{font-size:15px;font-weight:500;color:var(--txt);}
.exw-glos i{font-style:normal;font-weight:700;}
.exw-campo{display:flex;flex-direction:column;gap:8px;}
.exw-in{width:100%;box-sizing:border-box;border:1px solid var(--line);background:var(--surface2);border-radius:14px;
  padding:12px 14px;font:inherit;font-size:24px;color:var(--txt);text-align:center;}
.exw-in::placeholder{color:var(--soft);font-size:15px;font-weight:700;}
.exw-ime{display:flex;flex-direction:column;gap:8px;}
.exw-abre{align-self:center;border:0;background:none;color:var(--mut);font:inherit;font-size:13px;font-weight:700;
  padding:8px;min-height:36px;cursor:pointer;text-decoration:underline;text-underline-offset:3px;}
.exw-pyrow{display:flex;gap:8px;}
.exw-py{flex:1;min-width:0;border:1px solid var(--line);background:var(--surface);border-radius:12px;padding:10px 12px;
  font:inherit;font-size:16px;color:var(--txt);}
.exw-apaga{flex:0 0 48px;border:1px solid var(--line);background:var(--surface);border-radius:12px;color:var(--txt);
  font-size:18px;cursor:pointer;}
.exw-cands{display:flex;flex-wrap:wrap;gap:6px;min-height:44px;align-items:center;}
.exw-cands button{min-width:44px;min-height:44px;padding:0 10px;border:1px solid var(--line);border-radius:10px;
  background:var(--surface2);color:var(--txt);font-size:22px;cursor:pointer;}
.exw-cands span{color:var(--soft);font-size:13px;}
.exw-botoes{display:flex;gap:8px;}
.exw-botoes .typeskip{flex:1 1 0;}
.exw-gab .chardiff{font-size:26px;}
.exgab small.exw-voce{color:var(--err);margin-top:4px;}
.exw-tb{color:var(--mut);font-size:14px;}
.exw-nota{background:var(--warn-bg);border-radius:12px;padding:10px 14px;font-size:14px;line-height:1.45;text-align:center;}

.ext-barra{display:flex;align-items:center;gap:6px;}
.ext-barra > span{flex:1;}
.ext-niveis{display:flex;gap:6px;}
.ext-niveis button{border:1px solid var(--line);background:var(--surface2);color:var(--mut);border-radius:99px;
  font:inherit;font-size:12px;font-weight:700;padding:0 10px;min-height:34px;cursor:pointer;}
.ext-niveis button.on{background:var(--pill);border-color:var(--red);color:var(--txt);}
.ext-niveis button:disabled{opacity:.45;cursor:default;}
.ext-ico{width:36px;height:36px;border-radius:50%;border:1px solid var(--line);background:var(--surface);color:var(--txt);
  font-size:15px;cursor:pointer;}
.ext-ico:disabled{opacity:.35;cursor:default;}
.ext-perg{display:flex;flex-direction:column;align-items:center;gap:3px;text-align:center;}
.ext-perg > div{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;justify-content:center;}
.ext-py{font-size:20px;}
.ext-perg span{color:var(--mut);font-size:15px;}
.ext-perg small{color:var(--mut);font-size:15px;}
.ext-perg small .zh{color:var(--txt);font-size:18px;}
.ext-padbox{display:flex;justify-content:center;}
.ext-pad{touch-action:none;border-radius:8px;background:var(--surface2);}
.ext-pe{display:flex;align-items:center;justify-content:flex-end;gap:10px;}
.ext-conta{color:var(--mut);font-size:13px;font-variant-numeric:tabular-nums;}
.ext-val{border:0;border-radius:99px;background:var(--red);color:#fff;font:inherit;font-weight:800;font-size:15px;
  padding:0 18px;min-height:38px;cursor:pointer;}
.ext-val:disabled{background:var(--pill);color:var(--soft);cursor:default;}
.ext-res{display:flex;align-items:center;gap:10px;}
.ext-res:empty{display:none;}
.ext-nota{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px;border-radius:12px;text-align:center;}
.ext-nota.ok{background:var(--ok-bg);} .ext-nota.ok b{color:var(--ok);}
.ext-nota.quase{background:var(--warn-bg);} .ext-nota.quase b{color:var(--warn);}
.ext-nota small{color:var(--mut);font-size:12px;}
.ext-anim{flex:0 0 auto;display:flex;flex-direction:column;align-items:center;gap:2px;color:var(--txt);}
.ext-anim small{color:var(--mut);font-size:12px;font-weight:700;}
.ext-sem{display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center;}
.ext-sem b{font-size:110px;font-weight:500;line-height:1.1;}
.ext-sem small{color:var(--mut);font-size:13px;}
`);
