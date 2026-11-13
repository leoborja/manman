/* Mànmàn 慢慢 — flashcards de mandarim
   Sem build, sem dependências. Cartas: Supabase (leitura) → cache → seed.
   Progresso: localStorage por usuário + sync com Supabase (tabelas progress/review_log).

   O app é uma sequência de <script> clássicos (js/*.js, na ordem do index.html) que
   dividem o mesmo escopo global — não são módulos ES, de propósito: nada muda no
   comportamento, e o index.html continua sem build. Um arquivo só pode USAR, no
   carregamento, o que veio de um arquivo anterior; dentro de função vale tudo. */
'use strict';

// migração: o app se chamava Jìzhù — mesmo origin (github.io), então dá pra herdar o progresso
(function migrateFromJizhu() {
  const olds = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.indexOf('jizhu.') === 0) olds.push(k);
  }
  olds.forEach(k => {
    const nk = 'manman.' + k.slice(6);
    if (localStorage.getItem(nk) === null) localStorage.setItem(nk, localStorage.getItem(k));
    localStorage.removeItem(k);
  });
})();

// ── constantes ──────────────────────────────────────────────
const LEARNED_IVL = 21;          // intervalo (dias) p/ considerar "aprendida"
const FILTROS = ['tema', 'origem', 'erro'];
const ERRO_FAIXAS = [1, 3, 5, 8]; // faixas do filtro "as que eu mais erro"
const META_DIARIA = 30;          // revisões/dia pra fechar o dia — meta, não teto: pode fazer mais
// 20/08 é o primeiro dia em que o contador funciona: até 19/08 a prática livre só
// registrava os erros, então aqueles números estão subestimados e não dá pra julgá-los
// por meta nenhuma. Antes dessa data vale a regra antiga, "≥1 revisão no dia".
const META_DESDE = '2026-08-20';
const EASE_START = 2.5, EASE_MIN = 1.3, EASE_MAX = 2.8;
const USERS = { leo: 'Leo', henrique: 'Henrique', david: 'David', fraga: 'Fraga', convidado: 'Convidado' };
const K = {                      // chaves do localStorage (as por-usuário ganham sufixo .<user>)
  cards: 'manman.cards.v1',
  srs: 'manman.srs.v1',
  stats: 'manman.stats.v1',
  log: 'manman.log.v1',
  dirty: 'manman.dirty.v1',
  off: 'manman.off.v1',
  dirtyOff: 'manman.dirtyoff.v1',
  settings: 'manman.settings.v1',
  arranjo: 'manman.arranjo.v1',   // os montes que você arrastou na Grade — por usuário
  fav: 'manman.fav.v1',           // ⭐ as favoritas — por usuário, sobe numa linha só
  dirtyFav: 'manman.dirtyfav.v1',
  dayOffset: 'manman.dayoffset'
};
const DECK_LABELS = { saudacoes: 'Saudações', numeros: 'Números', pronomes: 'Pronomes',
  verbos: 'Verbos', uteis: 'Úteis', radicais: 'Radicais', estados: 'Como estou',
  nomes: 'Nomes', familia: 'Família', geral: 'Geral', comida: 'Comida',
  paises: 'Países', escola: 'Escola' };
// O eixo 📖 fatia pela ORIGEM da carta: de que capítulo do livro (New Practical Chinese
// Reader 1) ela saiu, ou se veio de fora dele. Mora na coluna `fonte`, que já existia —
// ninguém do time tem DDL pra criar coluna nova (ver o schema.sql). Capítulo novo não
// precisa de código: "fonte": "cap3" no JSON já vira o chip "Cap. 3", na ordem certa.
const ORIGEM_LABELS = { caractere: 'Caractere', 'extra-aula': 'Extras da aula',
  duolingo: 'Duolingo', treino: 'Treino', fora: 'Sem origem' };
// 'caractere' é a sala de espera: o ideograma que entrou no deck por ter sido quebrado de
// uma palavra maior (啡 de 咖啡) e que a turma ainda não estudou. Quando o livro o ensinar,
// ele sai daqui e vai pro capítulo. Por isso fica logo depois dos capítulos, e não junto
// das outras três — elas dizem DE ONDE a carta veio, esta diz que ela ainda não tem lugar.
const ORIGEM_FIM = ['caractere', 'extra-aula', 'duolingo', 'treino']; // depois dos capítulos, nesta ordem
// Uma frase É uma carta: mesmos campos, mesmo SRS, mesma sincronização, mesma meta de
// 30. O que separa as duas é a FILA — o app nunca mistura, porque frase chega em bloco
// (uma aula inteira de uma vez) e afogaria a sessão de vocabulário em cartas novas.
// Carta sem `tipo` é palavra: é o que as 108 já gravadas são.
const TIPOS = ['palavra', 'frase'];
const TIPO_LABEL = { palavra: 'Palavras', frase: 'Frases' };
// Cinco modos, e só um deles vira a carta. Nos outros quatro a resposta é uma AÇÃO —
// digitar, desenhar, marcar o tom — e o campo que diz qual delas é:
//   type = digita o pinyin num teclado chinês de mentirinha e escolhe o ideograma
//   draw = escreve o ideograma na grade e pede a nota
//   quiz = marca o tom nos cinco botões
//   ordenar = monta a frase tocando nas palavras na ordem certa (só frase)
// front = o que a carta mostra enquanto a pergunta está de pé.
const MODES = {
  mix:     { mix: true },
  pt_type: { front: 'type',  type: true },
  zh_all:  { front: 'hanzi' },
  ordenar: { front: 'ord',   ordenar: true },
  draw:    { front: 'draw',  draw: true },
  zh_tom:  { front: 'hanzi', quiz: true },
  tons:    { front: 'audio', quiz: true },
  dialogo: { front: 'dial',  dialogo: true }
};
// O aleatório sorteia um destes A CADA CARTA. O desenho fica de fora de propósito: leva
// dez vezes mais tempo que os outros e só serve pra 43 das 100 palavras, então cairia
// como um pedágio no meio de uma sessão que é pra ser rápida. Quem quer desenhar escolhe
// desenhar.
const MIX_MODOS = ['pt_type', 'zh_all', 'zh_tom', 'tons'];
// Na frase o sorteio é outro baralho: os dois tons perguntam de uma sílaba e não sabem
// o que fazer com cinco, e entra o ordenar, que só existe aqui.
const MIX_MODOS_FRASE = ['pt_type', 'zh_all', 'ordenar'];
// Que modos cada tipo oferece. O desenho e os dois tons já se excluem sozinhos no
// podePerguntar (grade e tom são de um caractere só), mas deixá-los na lista da frase
// seria oferecer uma sessão que abre vazia — então somem do seletor em vez de abrir e
// avisar. Pelo mesmo motivo o ordenar não aparece na palavra: não há o que ordenar.
const MODOS_TIPO = {
  palavra: ['mix', 'pt_type', 'zh_all', 'draw', 'zh_tom', 'tons'],
  frase:   ['mix', 'pt_type', 'zh_all', 'ordenar', 'dialogo']
};
function modosDoTipo() { return MODOS_TIPO[settings.tipo] || MODOS_TIPO.palavra; }
// Modos que existiram e saíram da lista. Quem tinha um deles salvo não pode abrir o app
// num modo que não existe mais — cai no equivalente mais próximo. O 'mix' antigo (que
// sorteava só as direções de leitura) não está aqui porque o nome voltou a existir: quem
// o tinha salvo cai no aleatório novo, que é o mesmo espírito com mais coisa dentro.
const MODES_VELHOS = { zh_py_pt: 'zh_all', pt_zh: 'zh_all', py_zh: 'zh_all', audio: 'zh_all',
  draw_pt: 'draw', draw_py: 'draw', draw_audio: 'draw' };
// O relâmpago NÃO é um modo: é uma chave que liga por cima do modo escolhido. Só vale
// no 汉字 → pinyin + tradução, que é o único em que responder é virar a carta.
// Tempo que a carta fica na tela: 1s é duro pra quem tem duas semanas de mandarim,
// 3s já dá pra "pensar" — que é justamente o que o relâmpago quer evitar.
const FLASH_MS = [1000, 2000, 3000];
const FLASH_MS_PADRAO = 1000; // a exposição é só exposição: quem responde é a etapa 2
const FLASH_RESP_MS = 3000;   // tempo pra dizer se acertou, com a explicação na tela
const MODE_TITLES = {
  mix: '🔀 Aleatório — os quatro juntos',
  pt_type: '⌨️ tradução → escrever no teclado',
  zh_all: '汉字 → pinyin + tradução',
  ordenar: '🧩 tradução → ordenar as palavras',
  draw: '✍️ pinyin + tradução + áudio → desenhar 汉字',
  zh_tom: '🎯 汉字 → tom',
  tons: '🎧 áudio → tom',
  dialogo: '💬 diálogo — a conversa inteira'
};
// ── os três níveis do desenho ───────────────────────────────
// Escrever de memória é o exercício certo pra quem já conhece o caractere e o exercício
// errado pra quem viu o 汉字 pela primeira vez ontem: a grade fica em branco, e grade em
// branco não ensina. Os dois níveis fáceis põem o ideograma apagado por baixo e cobram
// OUTRA COISA — a ordem e o sentido dos traços, que é o que a nota de memória não
// consegue ver (ela compara nuvens de pontos, e nuvem de pontos não tem ordem).
//   memoria = grade vazia, nota de proximidade — o modo de sempre
//   guiado  = fantasma na grade; você escreve inteiro e o ✓ diz quanto da ordem acertou
//   aovivo  = fantasma na grade; cada traço é conferido ao sair do dedo e o errado não cola
// É nível, não modo: fica no seletor do próprio desenho e não multiplica a lista de
// modos (que o aleatório sorteia e o tipo filtra) por três.
const ESCRITAS = ['memoria', 'guiado', 'aovivo'];
const ESCRITA_LABEL = { memoria: '✍️ memória', guiado: '👣 guiado', aovivo: '🚦 ao vivo' };
const ESCRITA_DICA = {
  memoria: 'a grade vazia — escreva de cabeça',
  guiado: 'cubra o ideograma apagado; o ✓ dá a nota da ordem',
  aovivo: 'cubra na ordem certa; traço fora de ordem não cola'
};

// ── tons: detecção e cores ──────────────────────────────────
// Convenção de cores (estilo MDBG/Pleco): 1º vermelho, 2º laranja, 3º verde, 4º azul, neutro cinza
const TONE_COLORS = { 1: '#d64541', 2: '#dd8500', 3: '#2e9e5b', 4: '#3b6fd4', 5: '#8b9098' };
const TONE_NAMES = { 1: '1º tom — alto e constante', 2: '2º tom — subindo', 3: '3º tom — desce e sobe', 4: '4º tom — caindo', 5: 'tom neutro — curto e leve' };
const TONE_MARK_OF = { 'ā':1,'ē':1,'ī':1,'ō':1,'ū':1,'ǖ':1,'Ā':1,'Ē':1,'Ō':1,
  'á':2,'é':2,'í':2,'ó':2,'ú':2,'ǘ':2,'Á':2,'É':2,'Ó':2,
  'ǎ':3,'ě':3,'ǐ':3,'ǒ':3,'ǔ':3,'ǚ':3,'Ǎ':3,'Ě':3,'Ǒ':3,
  'à':4,'è':4,'ì':4,'ò':4,'ù':4,'ǜ':4,'À':4,'È':4,'Ò':4 };
function toneOf(syllable) { // 5 = neutro (sem marca)
  for (const ch of syllable) if (TONE_MARK_OF[ch]) return TONE_MARK_OF[ch];
  return 5;
}
// Palavra de 2+ sílabas ("Lìbō") vem colada, mas cada sílaba tem o SEU tom —
// então quebra em sílabas antes de pintar. Sílaba = inicial? + vogais + (ng|n|r)?
const PY_VOGAIS = 'aeiouüāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ';
const PY_SILABA = new RegExp('(?:zh|ch|sh|[bpmfdtnlgkhjqxrzcsyw])?[' + PY_VOGAIS + ']+(?:ng|n|r)?', 'g');
function silabas(tok) {
  const low = tok.toLowerCase();
  const out = [];
  let pos = 0, m;
  PY_SILABA.lastIndex = 0;
  while ((m = PY_SILABA.exec(low)) !== null) {
    if (m.index !== pos) return [tok]; // sobrou letra entre sílabas → não é pinyin limpo, não arrisca
    let fim = pos + m[0].length;
    // A consoante do fim nem sempre é coda: em Hánguó o g abre a sílaba seguinte (hán-guó,
    // não háng-uó) e em nǚrén o r faz o mesmo. Vogal logo depois dela entrega o caso —
    // e quando a divisão é ambígua de verdade o pinyin usa apóstrofo (fān'àn), então
    // devolver a consoante é o palpite certo. Sem isto o 韩国 saía pintado e falado errado.
    if (fim < low.length && PY_VOGAIS.indexOf(low[fim]) >= 0
        && 'ngr'.indexOf(low[fim - 1]) >= 0 && fim - 1 > pos) fim--;
    out.push(tok.slice(pos, fim));
    pos = fim;
    PY_SILABA.lastIndex = pos;
  }
  return (pos === tok.length && out.length) ? out : [tok];
}
function pinyinColored(py) { // cada sílaba pintada com a cor do seu tom, e o som em português atrás
  const cor = String(py || '').split(/([\s'’]+)/).map(tok => // ’ curvo também: teclado do iPhone gera
    /[a-zA-ZüÜāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/.test(tok)
      ? silabas(tok).map(s =>
        '<span style="color:' + TONE_COLORS[toneOf(s)] + '">' + esc(s) + '</span>').join('')
      : esc(tok)
  ).join('');
  const pron = pronuncia(py);
  return pron ? cor + '<span class="pron">(' + esc(pron) + ')</span>' : cor;
}

// ── pronúncia aproximada ────────────────────────────────────
// hǎo (rau). São as letras do PORTUGUÊS que chegam mais perto do som chinês — quem lê
// "hao" com olho de brasileiro fala "áo", e o h chinês é o r de "rato". Não é transcrição
// fonética e não substitui a gravação: é muleta pra primeira leitura.
//
// Isto NÃO é coluna do banco. O pinyin já é um alfabeto fechado — pouco mais de 400
// sílabas, todas montadas de inicial + final — então a aproximação se calcula da própria
// sílaba e vale pra toda palavra nova sem ninguém preencher campo nenhum. Palavra que
// saísse torta se conserta aqui, no PRON_EXCECAO, e não carta por carta.
// b/d/g são p/t/k SECOS, e p/t/k os mesmos com sopro — o ʰ é a marca do sopro, a mesma
// que o professor usa no quadro. Por isso 爸爸 sai "pa-pa" e 怕 sai "pʰa": a diferença
// entre os dois é o ar, não a voz.
const PRON_INICIAL = { b:'p', p:'pʰ', m:'m', f:'f', d:'t', t:'tʰ', n:'n', l:'l', g:'k', k:'kʰ',
  h:'r',                          // o h chinês raspa a garganta: é o r de "rato", não o h mudo de "hoje"
  j:'dj', q:'tchʰ', x:'x',        // j/q/x e zh/ch/sh caem no mesmo par pra ouvido brasileiro
  zh:'dj', ch:'tchʰ', sh:'ch',
  r:'j',                          // 人 rén soa "jên", com o j de "já"
  z:'dz', c:'ts', s:'s' };
// o e sozinho e antes de n/ng é o "ã" paulista; em ei, ie, üe é o nosso ê
const PRON_FINAL = { a:'a', o:'ô', e:'ã', ai:'ai', ei:'ei', ao:'au', ou:'ou',
  an:'an', en:'ãn', ang:'ang', eng:'ãng', ong:'ong', er:'ar',
  i:'i', ia:'iá', ie:'iê', iao:'iau', iu:'iou', ian:'ién', in:'in',
  iang:'iang', ing:'ing', iong:'iong',
  u:'u', ua:'uá', uo:'uô', uai:'uai', ui:'uei', uan:'uan', un:'uên',
  uang:'uang', ueng:'ueng',
  'ü':'ü', 'üe':'üê', 'üan':'üén', 'ün':'ün' };  // ü fica ü: "iu" se lia como dois sons
// y e w não são consoante nenhuma: são a mesma vogal escrita de outro jeito quando abre a
// sílaba (yī = i, wǒ = uo, yǔ = ü). Normalizados aqui, a tabela de finais resolve o resto.
const PRON_YW = { yi:'i', ya:'ia', ye:'ie', yao:'iao', you:'iu', yan:'ian', yin:'in',
  yang:'iang', ying:'ing', yong:'iong', yu:'ü', yue:'üe', yuan:'üan', yun:'ün',
  wu:'u', wa:'ua', wo:'uo', wai:'uai', wei:'ui', wan:'uan', wen:'un', wang:'uang', weng:'ueng' };
const PRON_EXCECAO = {};          // sílaba plana → aproximação escrita à mão, quando a tabela erra
// tira o tom mas guarda o trema: o ü de 女 nǚ é outra vogal, não enfeite (o pyPlano do
// teclado achata os dois no mesmo u de propósito, que é o contrário do que se quer aqui)
const PRON_SEM_TOM = { 'ā':'a','á':'a','ǎ':'a','à':'a', 'ē':'e','é':'e','ě':'e','è':'e',
  'ī':'i','í':'i','ǐ':'i','ì':'i', 'ō':'o','ó':'o','ǒ':'o','ò':'o',
  'ū':'u','ú':'u','ǔ':'u','ù':'u', 'ǖ':'ü','ǘ':'ü','ǚ':'ü','ǜ':'ü', v:'ü' };
function pronSilaba(sil) {
  const s = String(sil).toLowerCase().split('').map(c => PRON_SEM_TOM[c] || c).join('');
  if (!/^[a-zü]+$/.test(s)) return s;
  if (PRON_EXCECAO[s]) return PRON_EXCECAO[s];
  if (PRON_YW[s] !== undefined) return PRON_FINAL[PRON_YW[s]] || s;
  const ini = /^(zh|ch|sh)/.test(s) ? s.slice(0, 2) : (PRON_INICIAL[s[0]] ? s[0] : '');
  let fin = s.slice(ini.length);
  // depois de j/q/x o u escrito é sempre ü (xué = xüé); depois de n/l os dois existem
  if ('jqx'.indexOf(ini) >= 0 && fin[0] === 'u') fin = 'ü' + fin.slice(1);
  // o i de shì, rì, zhī não é i nenhum: é a língua parada no lugar da consoante, zumbindo
  if (fin === 'i' && ['zh', 'ch', 'sh', 'r'].indexOf(ini) >= 0) return PRON_INICIAL[ini] + 'r';
  const cabeca = PRON_INICIAL[ini] || '';
  const cauda = PRON_FINAL[fin];
  if (cauda === undefined) return s; // sílaba que a tabela não conhece sai como veio
  return cabeca + cauda;
}
function pronuncia(py) {
  const out = String(py || '').split(/([\s'’]+)/).map(tok =>
    /[a-zA-ZüÜāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/.test(tok)
      ? silabas(tok).map(pronSilaba).join('-')
      : tok
  ).join('').trim();
  return out;
}

// ── estado ──────────────────────────────────────────────────
// ── frases: onde uma palavra acaba e a outra começa ─────────
// A segmentação NÃO é campo preenchido à mão. O pinyin já vem separado por palavra
// ("Wǒ shì Bāxī rén") e cada sílaba de pinyin é exatamente um caractere — então contar
// as sílabas de cada pedaço entrega 我 | 是 | 巴西 | 人 sozinho. É a mesma escolha da
// pronúncia aproximada: calcular em vez de digitar, pra que frase nova não precise de
// campo novo, nem de migração no banco.
// Quando a conta não fecha — 儿 de 哪儿 é caractere sem sílaba própria, e caractere
// repetido em pinyin colado também engana — devolve null, e quem chamou desiste do
// exercício. Exercício ausente é melhor que exercício errado. A saída manual, pra
// frase que insista em não fechar, é o campo `seg` na carta: "我|是|巴西|人".
const PONTU = /[，。？！、：；「」『』（）〈〉《》…—·,.?!:;"'“”‘’]/g;
function limpaHanzi(str) { return String(str || '').replace(PONTU, '').replace(/\s+/g, ''); }
const segCache = {};
function segmenta(card) {
  if (!(card.id in segCache)) segCache[card.id] = calcSeg(card);
  return segCache[card.id];
}
function calcSeg(card) {
  if (card.seg) return String(card.seg).split('|').filter(Boolean);
  const hz = [...limpaHanzi(card.hanzi)];
  const toks = String(card.pinyin || '').trim().split(/\s+/).filter(Boolean);
  if (toks.length < 2 || !hz.length) return null; // uma palavra só não tem ordem pra treinar
  const out = [];
  let i = 0;
  for (const t of toks) {
    // O apóstrofo separa DUAS SÍLABAS DA MESMA PALAVRA (nǚ'ér): conta as duas, mas não
    // parte a peça — 女儿 continua sendo um pedaço só do 🧩. Sem isto o PONTU o apagava,
    // "nǚér" virava uma sílaba e a conta não fechava: a frase saía do ordenar calada.
    const n = t.split(/['’]/).filter(Boolean)
      .reduce((s, p) => s + silabas(p.replace(PONTU, '')).length, 0);
    if (!n || i + n > hz.length) return null;
    out.push(hz.slice(i, i + n).join(''));
    i += n;
  }
  return i === hz.length ? out : null;
}

let cards = [];                  // deck completo (não deletadas)
let settings = load(K.settings, { mode: 'zh_all', tipo: 'palavra', deck: 'todos', filtro: 'tema',
  erro: ERRO_FAIXAS[2], user: null, theme: null, autoSpeak: true, flash: false,
  flashMs: FLASH_MS_PADRAO });
if (!TIPOS.includes(settings.tipo)) settings.tipo = 'palavra'; // quem já usava o app não tem o campo
// 13/09: o eixo 📅 aula virou 📖 origem — quem estava olhando as aulas continua na mesma fila
if (settings.filtro === 'aula') settings.filtro = 'origem';
if (!FILTROS.includes(settings.filtro)) settings.filtro = 'tema'; // quem já usava o app não tem o campo
// Os três eixos SOMAM em vez de se excluírem: dá pra pedir "Família E as que eu mais
// erro" numa sessão só. Cada um guarda um conjunto — vazio quer dizer "não filtra por
// isto" —, e o resultado é a interseção dos que estiverem ligados. Dentro do mesmo eixo
// os chips se somam (Família OU Comida), que é a leitura natural de marcar dois temas.
// O settings.filtro deixou de ser "qual filtro vale" e virou só "qual fila de chips
// está na tela": navegação, não exclusão.
// Migração do formato antigo, em que os três eixos se EXCLUÍAM: os três campos ficavam
// preenchidos, mas só o que o `filtro` apontava estava valendo. Trazer os três ligados
// entregaria a interseção deles — que na prática é sessão vazia — pra quem só abriu o
// app depois da atualização. Então migra só o eixo que estava em uso, e a tela continua
// mostrando exatamente o que mostrava antes.
if (!Array.isArray(settings.decks)) {
  const eixoVelho = settings.filtro;
  settings.decks = (eixoVelho === 'tema' && settings.deck && settings.deck !== 'todos') ? [settings.deck] : [];
  settings.erro = (eixoVelho === 'erro' && ERRO_FAIXAS.includes(settings.erro)) ? settings.erro : null;
  delete settings.deck; delete settings.aula;
  save(K.settings, settings);
}
// As datas marcadas no 📅 não têm par no 📖: descartar é o que evita abrir, pra quem só
// atualizou o app, uma sessão cortada por um filtro que nenhum chip na tela mostra.
delete settings.aulas;
if (!Array.isArray(settings.origens)) settings.origens = [];
// erro: número = piso de erros; null = eixo desligado
if (settings.erro !== null && !ERRO_FAIXAS.includes(settings.erro)) settings.erro = null;
settings.escopoOpen = !!settings.escopoOpen;
if (MODES_VELHOS[settings.mode]) settings.mode = MODES_VELHOS[settings.mode];
if (MODES[settings.mode] === undefined) settings.mode = 'zh_all';
// modo salvo que não vale no tipo salvo (ficou no desenho e voltou nas frases)
if (!modosDoTipo().includes(settings.mode)) settings.mode = 'zh_all';
if (settings.autoSpeak === undefined) settings.autoSpeak = true;
if (settings.tag === undefined) settings.tag = true; // quem já usava o app não tem o campo
if (settings.pron === undefined) settings.pron = true;   // idem
if (settings.lento === undefined) settings.lento = false; // idem
if (!FLASH_MS.includes(settings.flashMs)) settings.flashMs = FLASH_MS_PADRAO;
// ⭐ uma favorita a cada quantas cartas — quem já usava não tem o campo
if (![1, 2, 3, 5, 10].includes(settings.favACada)) settings.favACada = 3;
settings.flash = !!settings.flash;
// quem já usava o app não tem o campo, e quem não tem escreve de memória, como antes
if (!ESCRITAS.includes(settings.escrita)) settings.escrita = 'memoria';
// No aleatório quem manda é o modo sorteado pra CARTA ATUAL; fora dele, o escolhido no
// seletor. Tudo que pergunta "que modo é este?" passa por aqui, então a carta se monta,
// se responde e se avalia como se aquele modo estivesse ligado sozinho.
function mixOn() { return settings.mode === 'mix'; }
function modoKey() { return (mixOn() && modoCarta) ? modoCarta : settings.mode; }
function modo() { return MODES[modoKey()] || MODES.zh_all; }
function drawOn() { return !!modo().draw; }
// O nível só existe dentro do desenho: fora dele não há grade pra ter fantasma.
function escritaFacil() { return drawOn() && settings.escrita !== 'memoria'; }
function aoVivoOn() { return drawOn() && settings.escrita === 'aovivo'; }
function typeOn() { return !!modo().type; }
function quizOn() { return !!modo().quiz; }
function ordenarOn() { return !!modo().ordenar; }
function dialogoOn() { return !!modo().dialogo; }
// O relâmpago só vale onde responder é virar a carta. Nos outros quatro modos responder
// já é outra coisa — digitar, desenhar, marcar o tom — e o raio não teria o que cronometrar.
// (o aleatório também fica de fora: três dos quatro modos que ele sorteia não têm virada
// pra cronometrar, e piscar só numa carta em cada quatro não é rodada de relâmpago)
function flashOn() { return settings.flash && !mixOn() && !quizOn() && !drawOn() && !typeOn() && !ordenarOn() && !dialogoOn(); }
let srs = {};                    // id → {reps, ivl, ease, due, u}
// id → {g, h, a} — quantas vezes acertou, marcou difícil e errou, desde sempre.
// Fica FORA do srs de propósito: na prática livre você avalia carta que nunca foi
// agendada, e criar estado de srs pra ela a tiraria da fila de novas.
let stats = {};
let log = {};                    // 'YYYY-MM-DD' → {rev, new}
let dirty = [];                  // ids com sync pendente (SRS)
// Os montes que o usuário arrastou na Grade: [{id, nome, ids:[...]}]. Mora só aqui, no
// localStorage de cada aparelho, e não sobe pro banco: uma coluna nova exige DDL, que
// ninguém do time tem (o mesmo motivo que fez a frase morar em `tags`). Então o arranjo
// é seu e do seu celular — não segue pro computador nem aparece pros outros.
let arranjo = { grupos: [] };
let off = {};                    // id → {off: bool, u: ms} — cartas desligadas pelo usuário
let dirtyOff = [];               // ids com sync de desligamento pendente
let fav = {};                    // id → {fav: bool, u: ms} — ⭐ as favoritas
let dirtyFav = false;            // o mapa das favoritas ainda não subiu
let favAdiantadas = new Set();   // favoritas que a fila puxou antes do dia delas
let queue = [];                  // fila da sessão (ids)
let current = null;              // carta atual
let phase = 'sched';             // 'sched' (revisões+novas) | 'practice' (infinita) | 'quiz' (tons) | 'flash' (relâmpago)
let gradedThisSession = 0;       // p/ não resetar a fila embaixo do usuário após sync
let quizScore = { ok: 0, n: 0 }; // placar da sessão do quiz de tons
let quizAnswered = false;
let flashScore = { ok: 0, n: 0 };// placar da rodada de relâmpago
let flashState = 'off';          // 'off' | 'correndo' (exposição) | 'perguntando' (explicação na tela)
let flashTimer = null;           // o relógio da etapa atual
let flashPausa = false;          // pausa pedida pelo usuário (o ⏸)
let flashInicio = 0;             // quando o relógio da carta começou (performance.now)
let flashRestante = 0;           // o que sobrava do relógio quando pausou
let drawInk = [];                // traços do dedo, em coordenadas 0–1024 (as do makemeahanzi)
let drawTrecho = null;           // traço em andamento (o dedo ainda na tela)
let drawScore = null;            // nota da carta atual; null = ainda não validou
let drawCtx = null;              // contexto 2d da grade
let drawPx = 0;                  // lado da grade em px de CSS
// ── só nos níveis fáceis ──
let drawFeitos = 0;              // traços oficiais que o ao vivo já aceitou
let drawPrimeira = 0;            // ...destes, quantos colaram na primeira tentativa
let drawTentativas = 0;          // recusas seguidas no traço da vez (2 acende a dica)
let drawRecusado = null;         // traço recusado agora há pouco, pra piscar em vermelho
let drawErros = 0;               // recusas somadas na carta inteira, pro resultado do ao vivo
let drawFimEm = 0;               // instante em que o ao vivo fechou a carta sozinho
let dialogos = [];               // os roteiros do seed/dialogos.json
let dialAtual = null;            // o roteiro em andamento
let dialFala = 0;                // índice da fala que está na vez
let dialResult = null;           // {ok, escrito} da SUA fala; null = ainda não respondeu
let dialRevelado = false;        // você pediu a tradução da fala do outro
let dialFeito = [];              // o que já foi dito: [{fala, ok}] — ok null na fala do outro
let dialScore = { ok: 0, n: 0 }; // placar da rodada inteira, somando os diálogos
let ordPool = [];                // pílulas ainda não usadas, embaralhadas
let ordEscolhido = [];           // a frase que você está montando, em ordem
let ordResult = null;            // {ok} da carta atual; null = ainda não conferiu
let typeResult = null;
let typePinyin = ''; // o pinyin em composição no teclado do sistema, quando ele deixa ver           // {ok, escolhido} da carta atual no teclado; null = não respondeu
let modoCarta = null;            // no aleatório, o modo sorteado pra carta atual
let modoCartaAnterior = null;    // o da carta passada, pra não repetir duas seguidas
let cartasEm = 0;                // quando as cartas vieram do banco pela última vez (0 = nunca, nesta abertura)
let dataSource = '';             // 'supabase' | 'cache' | 'cache-noconfig' | 'seed' | 'vazio'
let cartasDeck = 'todos';        // filtro da aba Cartas
let cartasFiltro = 'tema';       // 'tema' | 'origem' — mesma ideia do filtro de estudo
let cartasTipo = 'palavra';      // 'palavra' | 'frase' — a aba lista UM tipo por vez
let cartasGrupo = 'nada';        // 'nada' | 'tema' | 'origem' — agrupa a lista em seções

// ── helpers ─────────────────────────────────────────────────
function load(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v === null || v === undefined ? fallback : v; }
  catch (e) { return fallback; }
}
function save(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
function uk(base) { return base + '.' + (settings.user || 'anon'); }
function $(id) { return document.getElementById(id); }
// escapa aspas também: o retorno vai tanto em texto quanto dentro de atributos
// (data-tip, data-id, title). Em texto, &quot; renderiza como " — não muda nada.
function esc(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML.replace(/"/g, '&quot;');
}
function dayOffset() { return parseInt(localStorage.getItem(K.dayOffset) || '0', 10); }
function todayStr(plusDays) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset() + (plusDays || 0));
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}
function deckLabel(d) { return DECK_LABELS[d] || (d.charAt(0).toUpperCase() + d.slice(1)); }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// ── áudio de pronúncia ──────────────────────────────────────
// Voz chinesa do próprio aparelho (Web Speech API). Se a carta tiver
// audio_url (V2, vozes gravadas), o MP3 tem prioridade.
let zhVoice = null;
function pickZhVoice() {
  const voices = speechSynthesis.getVoices().filter(v => v.lang && v.lang.replace('_', '-').toLowerCase().startsWith('zh'));
  zhVoice = voices.find(v => /tingting|ting-ting/i.test(v.name)) ||
    voices.find(v => v.lang.replace('_', '-').toLowerCase().startsWith('zh-cn')) ||
    voices[0] || null;
}
if ('speechSynthesis' in window) {
  pickZhVoice();
  speechSynthesis.onvoiceschanged = pickZhVoice; // iOS/Chrome carregam vozes async
}
// Decisão do Leo (12/08): partículas faladas SOZINHAS, mais fácil de identificar.
// (Por isso cartas de tom neutro ficam fora do quiz de tons — isolado, o TTS
// fala 吗 com tom cheio, o que contradiria o gabarito "neutro".)
let warnedNoVoice = false;
const VEL_LENTA = 0.75;          // o 🐢: fração da velocidade normal, gravação e TTS
function canSpeak(card) {
  if (card.audio_url) return true;
  if (!('speechSynthesis' in window)) return false;
  if (!zhVoice) pickZhVoice();
  return !!zhVoice;
}
function speak(card, auto) {
  // MP3 gravado tem prioridade, mas se ele falhar (404, offline, formato) cai pro TTS —
  // ficar mudo é o pior desfecho num app que ensina tom.
  if (card.audio_url) {
    const a = new Audio(card.audio_url);
    if (settings.lento) {
      // estica o tempo SEM baixar a altura da voz. Num idioma de tom isso não é
      // conforto, é correção: 0,75× sem isto desafinaria o 2º e o 3º tom pra baixo e o
      // aluno decoraria uma altura que ninguém fala. `preservesPitch` já é o padrão dos
      // navegadores de hoje; o webkit- fica pro Safari velho, que ignora o outro.
      a.preservesPitch = a.webkitPreservesPitch = true;
      a.playbackRate = VEL_LENTA;
    }
    a.play().catch(() => falaTTS(card, auto));
    return;
  }
  falaTTS(card, auto);
}
function falaTTS(card, auto) {
  if (!('speechSynthesis' in window)) return;
  if (!zhVoice) pickZhVoice();
  if (!zhVoice) {
    // no modo automático falha em silêncio; alerta só quando a pessoa toca no 🔊
    if (!auto && !warnedNoVoice) { warnedNoVoice = true; alert('Seu aparelho não tem voz chinesa instalada (Ajustes → Acessibilidade → Conteúdo Falado → Vozes → Chinês).'); }
    return;
  }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(card.hanzi);
  u.voice = zhVoice;
  u.lang = zhVoice.lang;
  // 0.8 já era a velocidade de sempre do TTS — mais devagar pra aluno, 慢慢. O 🐢 não
  // troca esse número por 1: ele multiplica o que já havia, senão "devagar" sairia mais
  // rápido do que o app falava antes de existir a opção.
  u.rate = 0.8 * (settings.lento ? VEL_LENTA : 1);
  speechSynthesis.speak(u);
}
