/* Mànmàn — tipos de folha do professor (ver o contrato em js/curso.js).

   Os que se respondem tocando ou montando, sem caligrafia: 🧩 ordenar, 🕳️ lacuna,
   📖 leitura (V ou F), 🔁 verter (a própria pessoa confere), 🔢 contar e ✂️ sílabas.
   Cada um é o par web da Ex*View.swift de mesmo nome: mesmo gesto, mesmo texto.

   Todos seguem o mesmo ritmo: o item se monta limpo, a primeira resposta vai pro
   api.responde e trava tudo, e o gabarito nasce ali mesmo, no lugar da pergunta. */
'use strict';

// O pinyin do JSON sem a muleta em português atrás: aqui ele é a leitura da frase do
// gabarito, e o "(rau)" no meio de uma frase inteira vira ruído.
function exPinyin(py) { return pinyinColored(py).replace(/<span class="pron">.*?<\/span>/g, ''); }

// Os botões de escolha (lacuna e leitura). Antes: todos iguais. Depois: a certa em
// verde, a tocada (se errada) em vermelho, as outras apagam. Sem `disabled` de
// propósito: o navegador esmaece botão desabilitado e o verde da certa sairia lavado
// justo quando é o que se quer ver — quem trava é o `escolhida`.
function exBotoes(el, opcoes, rotulo, aoEscolher) {
  const box = document.createElement('div');
  box.className = 'exe-ops';
  box.innerHTML = opcoes.map((o, i) => '<button class="exe-op" data-i="' + i + '">' + rotulo(o) + '</button>').join('');
  let escolhida = null;
  box.querySelectorAll('.exe-op').forEach(b => b.onclick = () => {
    if (escolhida !== null) return;
    escolhida = opcoes[+b.dataset.i];
    aoEscolher(escolhida);
  });
  el.appendChild(box);
  return {
    pinta(resposta) {
      box.querySelectorAll('.exe-op').forEach(b => {
        const o = opcoes[+b.dataset.i];
        b.classList.add(o === resposta ? 'ok' : o === escolhida ? 'erro' : 'apaga');
      });
    }
  };
}
// Glossário em pílulas: 妈妈 māma mãe.
function exGlossas(lista) {
  return '<div class="exe-gloss">' + lista.map(g =>
    '<span><b class="zh" lang="zh-Hans">' + esc(g.hanzi) + '</b><i>' + esc(g.pinyin) + '</i>' + esc(g.pt) + '</span>').join('') + '</div>';
}

// ── 🧩 ordenar ──────────────────────────────────────────────
// O gesto do modo Ordenar das cartas (tocar leva pra frase, tocar de novo devolve),
// com duas diferenças. Não há enunciado em português: a folha dá só as peças, e é a
// ordem do chinês que se treina sozinha — a tradução vem com o gabarito. E o gabarito
// aceita mais de uma ordem (林娜，你好 e 你好，林娜), comparadas sem a pontuação, que
// peça nenhuma carrega.
EX_TIPOS.ordenar = {
  icone: '🧩',
  montar(el, item, ex, api) {
    const respostas = item.respostas || [];
    const pecas = (item.pecas || []).map((p, k) => ({ p, k }));
    const bate = lista => {
      const minha = limpaHanzi(lista.map(o => o.p).join(''));
      return respostas.find(r => limpaHanzi(r) === minha) || null;
    };
    // Embaralhar pode devolver justo uma ordem certa (frase de 2–3 peças, toda hora):
    // aí a resposta vem pronta. Rembaralha, com teto, pra peça repetida não girar à toa.
    const monte = shuffle(pecas.slice());
    for (let i = 0; i < 8 && monte.length > 1 && bate(monte); i++) shuffle(monte);
    const montada = [];
    let conferido = false;

    el.innerHTML = '<div class="exe-tit">Organize a frase</div><div class="exe-area"></div>';
    const area = el.querySelector('.exe-area');
    const pill = (o, onde) => '<button class="ordpill zh" lang="zh-Hans" data-k="' + o.k + '" data-w="' + onde + '">' + esc(o.p) + '</button>';
    function desenha() {
      area.innerHTML =
        '<div class="ordline' + (montada.length ? '' : ' vazia') + '">' + (montada.length
          ? montada.map(o => pill(o, 'l')).join('') : '<span class="ordvazio">toque nas peças na ordem certa</span>') + '</div>' +
        '<div class="ordpool">' + monte.map(o => pill(o, 'p')).join('') + '</div>' +
        '<button class="exe-conf"' + (monte.length ? ' disabled' : '') + '>conferir</button>';
      area.querySelectorAll('.ordpill').forEach(b => b.onclick = () => {
        if (conferido) return;
        const de = b.dataset.w === 'p' ? monte : montada, pra = de === monte ? montada : monte;
        const i = de.findIndex(o => o.k === +b.dataset.k);
        if (i >= 0) pra.push(de.splice(i, 1)[0]);
        desenha();
      });
      // só confere com a frase inteira: metade da frase não é resposta errada, é
      // resposta pela metade
      area.querySelector('.exe-conf').onclick = confere;
    }
    function confere() {
      if (monte.length || conferido) return;
      conferido = true;
      const certa = bate(montada), mostra = certa || respostas[0] || '';
      api.responde(!!certa);
      // O pinyin do JSON é o da PRIMEIRA resposta: na outra ordem ele leria as sílabas
      // trocadas, então some.
      let h = api.gabarito(mostra, (!certa || certa === respostas[0]) ? item.pinyin : null, item.pt, !!certa);
      if (!certa) h += '<div class="exe-voce"><small>você</small><b class="zh" lang="zh-Hans">' + esc(montada.map(o => o.p).join('')) + '</b></div>';
      // a outra ordem que também vale — a folha do professor dá as duas
      const outras = respostas.filter(r => r !== mostra);
      if (outras.length) h += '<p class="exe-tambem">também vale: <span class="zh" lang="zh-Hans">' + outras.map(esc).join('  ') + '</span></p>';
      area.innerHTML = h;
      api.fala(mostra);
    }
    desenha();
  }
};

// ── 🕳️ lacuna ───────────────────────────────────────────────
// A frase com um buraco e poucos botões; um toque responde. O glossário da folha fica
// embaixo da frase, só com as palavras DELA — é o rodapé do papel, diz o que a frase
// quer dizer, não que partícula ela pede. Errou, aparece a regra da certa: é o "por quê"
// que a folha não tem e que é o que se leva pra próxima.
EX_TIPOS.lacuna = {
  icone: '🕳️',
  montar(el, item, ex, api) {
    const linhas = item.linhas || [], resposta = item.resposta || '';
    // Uma opção que não é ideograma ("sem 吗") é a de deixar vazio: a frase fecha sem
    // nada no buraco.
    const preench = /[一-鿿]/.test(resposta) && !resposta.includes(' ') ? resposta : '';
    const frase = (texto, escolhida) => {
      const p = texto.split('___');
      if (p.length !== 2) return esc(texto);
      let meio = '<span class="exe-buraco">＿</span>';
      if (escolhida !== null) {
        const cls = escolhida === resposta ? 'ok' : 'erro';
        meio = preench ? '<span class="exe-cheio ' + cls + '">' + esc(preench) + '</span>'
          : '<span class="exe-cheio vazio ' + cls + '">∅</span>';
      }
      return esc(p[0]) + meio + esc(p[1]);
    };
    // Uma frase só fica no meio; o diálogo A/B, à esquerda, como roteiro.
    const desenhaFrase = escolhida => '<div class="exe-frase' + (linhas.length === 1 ? ' uma' : '') + '">' +
      linhas.map(l => '<div class="exe-linha">' + (l.quem ? '<span class="exe-quem">' + esc(l.quem) + '</span>' : '') +
        '<div><div class="zh exe-zh" lang="zh-Hans">' + frase(l.texto, escolhida) + '</div>' +
        (escolhida !== null && l.pinyin ? '<div class="exe-py">' + esc(l.pinyin) + '</div>' : '') + '</div></div>').join('') + '</div>';
    const tudo = linhas.map(l => l.texto).join('');
    const glossas = (ex.glossario || []).filter(g => tudo.includes(g.hanzi));

    el.innerHTML = '<div class="exe-fr">' + desenhaFrase(null) + '</div>' + (glossas.length ? exGlossas(glossas) : '');
    // opção em texto ("sem 吗") não cabe no corpo do ideograma
    const bt = exBotoes(el, ex.opcoes || [], o => o.includes(' ') ? '<span class="exe-optx">' + esc(o) + '</span>'
      : '<span class="zh exe-ozh" lang="zh-Hans">' + esc(o) + '</span>', escolhida => {
      const acertou = escolhida === resposta;
      api.responde(acertou);
      bt.pinta(resposta);
      el.querySelector('.exe-fr').innerHTML = desenhaFrase(escolhida);
      const regra = !acertou && ex.regras && ex.regras[resposta];
      const d = document.createElement('div');
      d.className = 'exe-depois';
      d.innerHTML = (item.pt ? '<p class="exe-pt">' + esc(item.pt) + '</p>' : '') +
        (regra ? '<p class="exe-regra">' + esc(regra) + '</p>' : '');
      el.appendChild(d);
      api.fala(linhas.map(l => l.texto.replace('___', preench)).join(''));
    });
  }
};

// ── 📖 leitura ──────────────────────────────────────────────
// A afirmação e o V/F ficam EM CIMA, e o texto embaixo, pra consultar. No papel o texto
// vem antes porque se lê uma vez e se responde tudo; aqui cada afirmação é um item, e o
// texto inteiro antes de cada uma empurraria a pergunta pra fora da tela. Respondido, o
// trecho que decide (`por`) aparece — é o "onde estava" da conferência.
EX_TIPOS.leitura = {
  icone: '📖',
  montar(el, item, ex, api) {
    const resposta = item.resposta || '';
    const lt = ex.leitura || {};
    let txt = '';
    if (lt.dialogo && lt.dialogo.length) {
      // "—" separa um diálogo do outro, como os 。。。 da folha
      txt += '<div class="exe-rot">Diálogo</div><div class="exe-dial">' + lt.dialogo.map((l, i) => l.texto === '—'
        ? '<hr>'
        : '<button class="exe-fala" data-i="' + i + '">' + (l.quem ? '<span class="exe-quem">' + esc(l.quem) + '</span>' : '') +
          '<span class="zh" lang="zh-Hans">' + esc(l.texto) + '</span></button>').join('') + '</div>';
    }
    if (lt.texto) txt += '<div class="exe-rot">Texto</div><button class="exe-fala exe-txt" data-t="1"><span class="zh" lang="zh-Hans">' + esc(lt.texto) + '</span></button>';
    if (ex.glossario && ex.glossario.length) txt += exGlossas(ex.glossario);

    el.innerHTML = '<div class="zh exe-afirma" lang="zh-Hans">' + esc(item.afirmacao || '') + '</div><div class="exe-trad"></div>';
    const caixa = document.createElement('div');
    const bt = exBotoes(el, ex.opcoes || ['V', 'F'], o => esc(o === 'V' ? 'Verdadeiro' : o === 'F' ? 'Falso' : o), escolhida => {
      const acertou = escolhida === resposta;
      api.responde(acertou);
      bt.pinta(resposta);
      el.querySelector('.exe-trad').innerHTML = (item.pinyin ? '<div class="exe-py">' + exPinyin(item.pinyin) + '</div>' : '') +
        (item.pt ? '<div class="exe-pt">' + esc(item.pt) + '</div>' : '');
      if (item.por) {
        const d = document.createElement('div');
        d.className = 'exe-por' + (acertou ? ' ok' : '');
        d.innerHTML = '<small>' + (acertou ? '对! está no texto:' : 'o texto diz:') + '</small><div class="zh" lang="zh-Hans">' + esc(item.por) + '</div>';
        el.insertBefore(d, caixa);
      }
      if (item.afirmacao) api.fala(item.afirmacao);
    });
    caixa.className = 'exe-leit';
    caixa.innerHTML = txt;
    el.appendChild(caixa);
    // tocar numa fala ou no texto ouve aquele trecho
    caixa.querySelectorAll('.exe-fala').forEach(b => b.onclick = () =>
      api.fala(b.dataset.t ? lt.texto : lt.dialogo[+b.dataset.i].texto));
  }
};

// ── 🔁 verter ───────────────────────────────────────────────
// Esta não se confere sozinha. O gabarito do professor é escrito "Aquele(a) é seu(sua)
// médico(a)?" — o português aceita seu ou sua, com ou sem artigo; comparar texto
// reprovaria acerto. Então é o gesto da carta virada: escreve-se (ou só pensa-se), toca
// em ver, e a versão do professor aparece embaixo da sua. Quem diz se acertou é a
// pessoa. Escrever é opcional, mas escrito a comparação fica lado a lado, e é ela que
// ensina.
EX_TIPOS.verter = {
  icone: '🔁',
  montar(el, item, ex, api) {
    const ouvir = () => { if (item.texto) api.fala(item.texto); };
    // O pinyin só aparece depois: antes, ele seria metade da leitura feita.
    el.innerHTML = '<button class="exe-verfrase" title="Toque para ouvir"><span class="zh" lang="zh-Hans">' + esc(item.texto || '') +
      '</span><span class="exe-py"></span></button><div class="exe-ver">' +
      '<textarea class="exe-campo" rows="2" placeholder="escreva em português" autocomplete="off" autocapitalize="sentences"></textarea>' +
      '<button class="exe-conf cheio">ver a do professor</button></div>';
    el.querySelector('.exe-verfrase').onclick = ouvir;
    const box = el.querySelector('.exe-ver'), campo = box.querySelector('textarea');
    let revelado = false;
    function ver() {
      if (revelado) return;
      revelado = true;
      const meu = campo.value.trim();
      campo.blur();
      if (item.pinyin) el.querySelector('.exe-verfrase .exe-py').innerHTML = exPinyin(item.pinyin);
      box.innerHTML = '<div class="exe-comp">' +
        (meu ? '<div><small>você</small><p>' + esc(meu) + '</p></div>' : '') +
        '<div><small>o professor</small><p>' + esc(item.pt || '') + '</p></div></div>' +
        '<div class="exe-nota"><button class="exe-auto erro">Errei</button><button class="exe-auto ok">Acertei</button></div>';
      box.querySelectorAll('.exe-auto').forEach(b => b.onclick = () => {
        if (api.respondido()) return;
        const ok = b.classList.contains('ok');
        api.responde(ok);
        box.querySelector('.exe-nota').outerHTML = '<p class="exe-marcado ' + (ok ? 'ok' : 'erro') + '">' +
          (ok ? 'Marcado como certo' : 'Marcado como errado') + '</p>';
      });
      ouvir();
    }
    box.querySelector('.exe-conf').onclick = ver;
    // Enter manda, como o "concluído" do teclado do iPhone; Shift+Enter quebra a linha
    campo.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); ver(); } };
    // preventScroll: o foco não pode rolar a página pra longe do cabeçalho da folha
    setTimeout(() => { try { campo.focus({ preventScroll: true }); } catch (e) { /* aba já trocada */ } }, 0);
  }
};

// ── 🔢 contar ───────────────────────────────────────────────
// Um quadro de parecidos (禾 天 大 夫 犬 太 夭 未 末 木 丈) e a pergunta de quantos
// ideogramas DIFERENTES há nele. Responde-se no − e +. Conferido, aparecem os diferentes
// lado a lado com pinyin e sentido — o "aprenda-os" da folha — e tocar num acende no
// quadro onde ele está, que é o que separa 未 de 末 e 天 de 夭.
EX_TIPOS.contar = {
  icone: '🔢',
  montar(el, item, ex, api) {
    const linhas = (item.quadro || []).map(l => [...l]);
    const todos = linhas.flat();
    const certo = parseInt(item.resposta, 10) || new Set(todos).size;
    // os diferentes na ordem do glossário; o que faltar nele entra na ordem do quadro
    const vistos = new Set(), diferentes = [];
    (ex.glossario || []).forEach(g => { if (!vistos.has(g.hanzi)) { vistos.add(g.hanzi); diferentes.push(g); } });
    todos.forEach(ch => { if (!vistos.has(ch)) { vistos.add(ch); diferentes.push({ hanzi: ch, pinyin: '', pt: '' }); } });
    const cols = Math.max(1, ...linhas.map(l => l.length));
    let palpite = 1, aceso = null;

    // linha mais curta que as outras ganha um enchimento, pra a seguinte não subir nela
    el.innerHTML = '<div class="exe-tit">Quantos ideogramas diferentes há no quadro?</div>' +
      '<div class="exe-quadro" style="grid-template-columns:repeat(' + cols + ',1fr)">' +
      linhas.map(l => l.map(ch => '<span class="zh" lang="zh-Hans" data-ch="' + esc(ch) + '">' + esc(ch) + '</span>').join('') +
        (l.length < cols ? '<i style="grid-column:span ' + (cols - l.length) + '"></i>' : '')).join('') + '</div>' +
      '<div class="exe-cont"><div class="exe-passo"><button data-d="-1" aria-label="menos um">−</button><b>1</b>' +
      '<button data-d="1" aria-label="mais um">+</button></div><button class="exe-conf">conferir</button></div>';
    const cont = el.querySelector('.exe-cont'), num = cont.querySelector('b'), quadro = el.querySelector('.exe-quadro');
    cont.querySelectorAll('[data-d]').forEach(b => b.onclick = () => {
      palpite = Math.max(1, Math.min(50, palpite + +b.dataset.d));
      num.textContent = palpite;
    });
    function acende() {
      quadro.classList.toggle('aceso', !!aceso);
      quadro.querySelectorAll('[data-ch]').forEach(s => s.classList.toggle('on', s.dataset.ch === aceso));
      cont.querySelectorAll('.exe-dif').forEach(b => b.classList.toggle('on', b.dataset.ch === aceso));
    }
    cont.querySelector('.exe-conf').onclick = () => {
      if (api.respondido()) return;
      const ok = palpite === certo;
      api.responde(ok);
      cont.innerHTML = '<p class="exe-res ' + (ok ? 'ok' : 'warn') + '">' + (ok ? '对! São ' + certo : 'Eram ' + certo + ' — você disse ' + palpite) + '</p>' +
        '<p class="exe-dica">Toque num para ver onde ele está</p><div class="exe-difs">' +
        diferentes.map(g => '<button class="exe-dif" data-ch="' + esc(g.hanzi) + '"><b class="zh" lang="zh-Hans">' + esc(g.hanzi) + '</b>' +
          (g.pinyin ? '<i>' + esc(g.pinyin) + '</i>' : '') + (g.pt ? '<small>' + esc(g.pt) + '</small>' : '') + '</button>').join('') + '</div>';
      cont.querySelectorAll('.exe-dif').forEach(b => b.onclick = () => {
        aceso = aceso === b.dataset.ch ? null : b.dataset.ch;
        acende();
        if (aceso) api.fala(aceso);
      });
    };
  }
};

// ── ✂️ sílabas ──────────────────────────────────────────────
// "jīnglǐ → jīng lǐ → j īng l ǐ". No papel são dois passos; aqui é um gesto só: tocar
// no vão entre duas letras corta ali. O resultado alterna inicial e final, então o
// conjunto de cortes já diz tudo — j|īng|l|ǐ. Tocar de novo desfaz. Na conferência cada
// letra ganha a cor do que ela é, o corte errado fica vermelho e o que faltou aparece em
// laranja. O professor trata y e w como iniciais (y|ou, w|èi), e o gabarito segue.
EX_TIPOS.silabas = {
  icone: '✂️',
  montar(el, item, ex, api) {
    // NFC: o ī tem de ser UMA letra, senão o acento vira um vão pra cortar
    const letras = [...String(item.texto || '').normalize('NFC')];
    const silabasG = String(item.corte || '').normalize('NFC').split('/').map(s => s.split('|'));
    // o gabarito em vãos (o vão i fica antes da letra i) e o papel de cada letra
    const gCortes = new Set(), inicial = [];
    let pos = 0;
    silabasG.forEach((partes, s) => {
      if (s > 0) gCortes.add(pos);
      partes.forEach((parte, k) => {
        if (k > 0) gCortes.add(pos);
        // com dois pedaços, o primeiro é a inicial; com um só, é final (sílaba sem inicial)
        const n = [...parte].length;
        for (let j = 0; j < n; j++) inicial.push(partes.length === 2 && k === 0);
        pos += n;
      });
    });
    const cortes = new Set();
    let conferido = false;

    el.innerHTML = '<div class="exe-tit mut">Corte em sílabas, e cada sílaba em inicial e final</div>' +
      '<div class="exe-palavra"></div><div class="exe-sres"><button class="exe-conf" disabled>conferir</button></div>';
    const pal = el.querySelector('.exe-palavra'), conf = el.querySelector('.exe-conf');
    function desenha() {
      pal.innerHTML = letras.map((l, i) => {
        let h = '';
        if (i > 0) {
          const cortado = cortes.has(i), certo = gCortes.has(i);
          let cls = cortado ? ' cortado' : '';
          if (conferido) cls += cortado ? (certo ? ' ok' : ' erro') : certo ? ' falta' : '';
          h += '<button class="exe-vao' + cls + '" data-i="' + i + '" aria-label="corte entre ' + esc(letras[i - 1]) + ' e ' + esc(l) +
            '" aria-pressed="' + cortado + '"><i></i></button>';
        }
        const cor = conferido && i < inicial.length ? (inicial[i] ? ' ini' : ' fin') : '';
        return h + '<span class="exe-letra' + cor + '">' + esc(l) + '</span>';
      }).join('');
      pal.querySelectorAll('.exe-vao').forEach(b => b.onclick = () => {
        if (conferido) return;
        const i = +b.dataset.i;
        if (cortes.has(i)) cortes.delete(i); else cortes.add(i);
        conf.disabled = !cortes.size;
        desenha();
      });
    }
    conf.onclick = () => {
      if (conferido || !cortes.size) return;
      conferido = true;
      const sobrando = [...cortes].filter(i => !gCortes.has(i)).length;
      const faltando = [...gCortes].filter(i => !cortes.has(i)).length;
      const acertou = !sobrando && !faltando;
      api.responde(acertou);
      desenha();
      const msg = acertou ? '对!' : [faltando ? faltando + ' corte' + (faltando > 1 ? 's' : '') + ' faltando (laranja)' : '',
        sobrando ? sobrando + ' no lugar errado (vermelho)' : ''].filter(Boolean).join(' · ');
      // O gabarito por extenso, sílaba a sílaba. Tocar na sílaba toca a gravação dela
      // (a tabela de sons); a de tom neutro não tem gravação e fica quieta.
      el.querySelector('.exe-sres').innerHTML = '<p class="exe-res ' + (acertou ? 'ok' : 'warn') + '">' + esc(msg) + '</p>' +
        '<div class="exe-sils">' + silabasG.map((partes, s) => '<button class="exe-sil" data-s="' + s + '"><b>' + esc(partes.join('')) + '</b><span>' +
          partes.map((p, k) => {
            const ini = partes.length === 2 && k === 0;
            return '<span class="' + (ini ? 'ini' : 'fin') + '">' + esc(p) + '<small>' + (ini ? 'inicial' : 'final') + '</small></span>';
          }).join('') + '</span></button>').join('') + '</div>';
      el.querySelectorAll('.exe-sil').forEach(b => b.onclick = () => api.silaba(silabasG[+b.dataset.s].join('')));
    };
    desenha();
  }
};

exEstilo(`
.exe-tit{text-align:center;font-size:20px;font-weight:700;line-height:1.3;}
.exe-tit.mut{font-size:15px;color:var(--mut);}
.exe-area{display:flex;flex-direction:column;gap:12px;}
.exe-conf{align-self:center;border:0;border-radius:999px;background:var(--red);color:#fff;font:inherit;font-weight:700;
  font-size:15px;padding:0 20px;min-height:42px;cursor:pointer;}
.exe-conf:disabled{background:var(--pill);color:var(--soft);cursor:default;}
.exe-conf.cheio{align-self:stretch;min-height:46px;}
.exe-voce{display:flex;flex-direction:column;align-items:center;gap:2px;}
.exe-voce small{font-size:12px;font-weight:700;color:var(--mut);}
.exe-voce b{font-size:26px;font-weight:500;color:var(--err);line-height:1.25;text-align:center;}
.exe-tambem{margin:0;text-align:center;color:var(--mut);font-size:14px;}
.exe-tambem .zh{font-size:17px;}
.exe-ops{display:flex;gap:12px;}
.exe-op{flex:1 1 0;min-width:0;min-height:58px;border:1px solid var(--line);border-radius:14px;background:var(--surface2);
  color:var(--txt);font:inherit;font-weight:700;font-size:17px;padding:6px 8px;cursor:pointer;transition:background .2s,color .2s;}
.exe-op.ok{background:var(--ok-bg);color:var(--ok);border-color:var(--ok);}
.exe-op.erro{background:var(--err-bg);color:var(--err);border-color:var(--err);}
.exe-op.apaga{color:var(--soft);opacity:.55;}
.exe-ozh{font-size:36px;font-weight:500;line-height:1.3;}
.exe-optx{font-size:19px;}
.exe-frase{display:flex;flex-direction:column;gap:10px;}
.exe-frase.uma{align-items:center;text-align:center;}
.exe-linha{display:flex;gap:10px;align-items:baseline;}
.exe-quem{flex:0 0 auto;min-width:16px;font-size:13px;font-weight:800;color:var(--mut);}
.exe-zh{font-size:30px;line-height:1.35;word-break:break-all;}
.exe-buraco{color:var(--red);}
.exe-cheio.ok{color:var(--ok);} .exe-cheio.erro{color:var(--err);}
.exe-cheio.vazio{opacity:.6;}
.exe-py{font-size:15px;color:var(--mut);}
.exe-gloss{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;}
.exe-gloss span{display:inline-flex;align-items:baseline;gap:5px;padding:4px 10px;border-radius:999px;background:var(--pill);
  color:var(--mut);font-size:13px;}
.exe-gloss b{font-size:17px;font-weight:500;color:var(--txt);}
.exe-gloss i{font-style:normal;font-weight:700;}
.exe-depois{display:flex;flex-direction:column;gap:10px;}
.exe-pt{margin:0;text-align:center;font-size:15px;}
.exe-regra{margin:0;text-align:center;font-size:14px;padding:10px 14px;border-radius:12px;background:var(--warn-bg);}
.exe-afirma{text-align:center;font-size:30px;line-height:1.35;}
.exe-trad{display:flex;flex-direction:column;align-items:center;gap:2px;text-align:center;}
.exe-trad:empty{display:none;}
.exe-por{display:flex;flex-direction:column;align-items:center;gap:4px;text-align:center;padding:10px 14px;border-radius:12px;
  background:var(--warn-bg);}
.exe-por.ok{background:var(--ok-bg);}
.exe-por small{font-size:12px;font-weight:700;color:var(--mut);}
.exe-por.ok small{color:var(--ok);}
.exe-por div{font-size:22px;line-height:1.4;}
.exe-leit{display:flex;flex-direction:column;gap:8px;padding:14px;border-radius:14px;background:var(--surface2);border:1px solid var(--line);}
.exe-rot{font-size:12px;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:.4px;}
.exe-dial{display:flex;flex-direction:column;gap:2px;}
.exe-dial hr{border:0;border-top:1px solid var(--line);margin:6px 0;width:100%;}
.exe-fala{display:flex;gap:8px;align-items:baseline;text-align:left;border:0;background:none;color:var(--txt);
  font:inherit;padding:3px 0;cursor:pointer;}
.exe-fala .zh{font-size:20px;line-height:1.5;}
.exe-leit .exe-gloss{justify-content:flex-start;margin-top:4px;}
.exe-leit .exe-gloss span{background:var(--surface);}
.exe-verfrase{display:flex;flex-direction:column;align-items:center;gap:6px;border:0;background:none;color:var(--txt);
  font:inherit;cursor:pointer;text-align:center;padding:4px;}
.exe-verfrase .zh{font-size:30px;line-height:1.35;}
.exe-verfrase .exe-py:empty{display:none;}
.exe-ver{display:flex;flex-direction:column;gap:10px;}
.exe-campo{width:100%;border:1px solid var(--line);background:var(--surface2);color:var(--txt);border-radius:12px;
  padding:12px;font:inherit;font-size:18px;text-align:center;resize:none;}
.exe-campo::placeholder{color:var(--soft);font-size:15px;}
.exe-comp{display:flex;flex-direction:column;gap:10px;padding:14px;border-radius:12px;background:var(--surface2);text-align:center;}
.exe-comp small{font-size:12px;font-weight:700;color:var(--mut);}
.exe-comp p{margin:2px 0 0;font-size:17px;overflow-wrap:anywhere;}
.exe-nota{display:flex;gap:10px;}
.exe-auto{flex:1 1 0;min-height:48px;border:0;border-radius:12px;font:inherit;font-weight:700;font-size:15px;cursor:pointer;}
.exe-auto.ok{background:var(--ok-bg);color:var(--ok);}
.exe-auto.erro{background:var(--err-bg);color:var(--err);}
.exe-marcado{margin:0;text-align:center;font-size:14px;font-weight:700;}
.exe-marcado.ok{color:var(--ok);} .exe-marcado.erro{color:var(--err);}
.exe-quadro{display:grid;gap:4px;}
.exe-quadro span{display:flex;align-items:center;justify-content:center;aspect-ratio:1;border-radius:6px;background:var(--pill);
  font-size:clamp(16px,5.6vw,26px);line-height:1;transition:background .15s,color .15s;}
.exe-quadro.aceso span{color:var(--soft);}
.exe-quadro span.on{background:var(--red);color:#fff;}
.exe-cont{display:flex;flex-direction:column;align-items:center;gap:12px;}
.exe-passo{display:flex;align-items:center;gap:24px;}
.exe-passo button{width:48px;height:48px;border-radius:50%;border:0;background:var(--pill);color:var(--txt);font-size:24px;
  font-weight:700;cursor:pointer;line-height:1;}
.exe-passo b{min-width:70px;text-align:center;font-size:44px;font-variant-numeric:tabular-nums;}
.exe-res{margin:0;text-align:center;font-size:17px;font-weight:700;}
.exe-res.ok{color:var(--ok);} .exe-res.warn{color:var(--warn);}
.exe-dica{margin:-6px 0 0;font-size:12px;color:var(--mut);}
.exe-difs{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px;width:100%;}
.exe-dif{display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 4px;border:0;border-radius:10px;
  background:var(--pill);color:var(--txt);font:inherit;cursor:pointer;}
.exe-dif b{font-size:28px;font-weight:500;line-height:1.2;}
.exe-dif i{font-style:normal;font-size:12px;font-weight:700;}
.exe-dif small{font-size:11px;line-height:1.25;text-align:center;}
.exe-dif.on{background:var(--red);color:#fff;}
.exe-palavra{display:flex;justify-content:center;align-items:center;padding:14px 6px;border-radius:14px;background:var(--surface2);
  border:1px solid var(--line);}
.exe-letra{min-width:14px;text-align:center;font-size:clamp(26px,8vw,34px);font-weight:500;line-height:1;}
.exe-letra.ini{color:var(--red);} .exe-letra.fin{color:var(--rad);}
.exe-vao{flex:0 0 auto;width:16px;height:52px;border:0;padding:0;background:none;cursor:pointer;display:flex;
  align-items:center;justify-content:center;}
.exe-vao i{display:block;width:1.5px;height:14px;border-radius:2px;background:var(--soft);opacity:.5;}
.exe-vao.cortado i{width:3px;height:40px;background:var(--red);opacity:1;}
.exe-vao.ok i{background:var(--ok);}
.exe-vao.erro i{background:var(--err);}
.exe-vao.falta i{width:3px;height:40px;background:var(--warn);opacity:.6;}
.exe-vao.ok,.exe-vao.erro,.exe-vao.falta{cursor:default;}
.exe-sres{display:flex;flex-direction:column;align-items:center;gap:12px;}
.exe-sils{display:flex;flex-wrap:wrap;justify-content:center;gap:10px 18px;}
.exe-sil{display:flex;flex-direction:column;align-items:center;gap:4px;border:0;background:none;color:var(--txt);font:inherit;
  cursor:pointer;padding:4px 6px;border-radius:10px;}
.exe-sil:active{background:var(--pill);}
.exe-sil>b{font-size:20px;}
.exe-sil>span{display:flex;gap:8px;}
.exe-sil>span>span{display:flex;flex-direction:column;align-items:center;font-size:17px;line-height:1.2;}
.exe-sil .ini{color:var(--red);} .exe-sil .fin{color:var(--rad);}
.exe-sil small{font-size:10px;font-weight:700;color:var(--mut);}
`);
