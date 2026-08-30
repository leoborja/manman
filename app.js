/* Mànmàn 慢慢 — flashcards de mandarim
   Sem build, sem dependências. Cartas: Supabase (leitura) → cache → seed.
   Progresso: localStorage por usuário + sync com Supabase (tabelas progress/review_log). */
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
const FILTROS = ['tema', 'aula', 'erro'];
const ERRO_FAIXAS = [1, 3, 5, 8]; // faixas do filtro "as que eu mais erro"
const META_DIARIA = 30;          // revisões/dia pra fechar o dia — meta, não teto: pode fazer mais
// 20/08 é o primeiro dia em que o contador funciona: até 19/08 a prática livre só
// registrava os erros, então aqueles números estão subestimados e não dá pra julgá-los
// por meta nenhuma. Antes dessa data vale a regra antiga, "≥1 revisão no dia".
const META_DESDE = '2026-08-20';
const EASE_START = 2.5, EASE_MIN = 1.3, EASE_MAX = 2.8;
const USERS = { leo: 'Leo', henrique: 'Henrique', david: 'David', convidado: 'Convidado' };
const K = {                      // chaves do localStorage (as por-usuário ganham sufixo .<user>)
  cards: 'manman.cards.v1',
  srs: 'manman.srs.v1',
  stats: 'manman.stats.v1',
  log: 'manman.log.v1',
  dirty: 'manman.dirty.v1',
  off: 'manman.off.v1',
  dirtyOff: 'manman.dirtyoff.v1',
  settings: 'manman.settings.v1',
  dayOffset: 'manman.dayoffset'
};
const DECK_LABELS = { saudacoes: 'Saudações', numeros: 'Números', pronomes: 'Pronomes',
  verbos: 'Verbos', uteis: 'Úteis', radicais: 'Radicais', estados: 'Como estou',
  nomes: 'Nomes', familia: 'Família', geral: 'Geral', comida: 'Comida',
  paises: 'Países', escola: 'Escola' };
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
  tons:    { front: 'audio', quiz: true }
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
  frase:   ['mix', 'pt_type', 'zh_all', 'ordenar']
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
  tons: '🎧 áudio → tom'
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
const PRON_INICIAL = { b:'b', p:'p', m:'m', f:'f', d:'d', t:'t', n:'n', l:'l', g:'g', k:'k',
  h:'r',                          // o h chinês raspa a garganta: é o r de "rato", não o h mudo de "hoje"
  j:'dj', q:'tch', x:'x',         // j/q/x e zh/ch/sh caem no mesmo par pra ouvido brasileiro
  zh:'dj', ch:'tch', sh:'ch',
  r:'j',                          // 人 rén soa "jên", com o j de "já"
  z:'dz', c:'ts', s:'s' };
const PRON_FINAL = { a:'a', o:'ô', e:'ê', ai:'ai', ei:'ei', ao:'au', ou:'ou',
  an:'an', en:'ên', ang:'ang', eng:'eng', ong:'ong', er:'ar',
  i:'i', ia:'iá', ie:'ié', iao:'iau', iu:'iou', ian:'ién', in:'in',
  iang:'iang', ing:'ing', iong:'iong',
  u:'u', ua:'uá', uo:'uô', uai:'uai', ui:'uei', uan:'uan', un:'uên',
  uang:'uang', ueng:'ueng',
  'ü':'iu', 'üe':'iué', 'üan':'iuan', 'ün':'iun' };
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
  let cabeca = PRON_INICIAL[ini] || '';
  // "ge" em português é "je": o g duro antes de e/i pede o u mudo, como em "guerra"
  if (cabeca === 'g' && 'eêi'.indexOf((PRON_FINAL[fin] || '')[0]) >= 0) cabeca = 'gu';
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
    const n = silabas(t.replace(PONTU, '')).length;
    if (!n || i + n > hz.length) return null;
    out.push(hz.slice(i, i + n).join(''));
    i += n;
  }
  return i === hz.length ? out : null;
}

let cards = [];                  // deck completo (não deletadas)
let settings = load(K.settings, { mode: 'zh_all', tipo: 'palavra', deck: 'todos', filtro: 'tema',
  aula: 'todas', erro: ERRO_FAIXAS[2], user: null, theme: null, autoSpeak: true, flash: false,
  flashMs: FLASH_MS_PADRAO });
if (!TIPOS.includes(settings.tipo)) settings.tipo = 'palavra'; // quem já usava o app não tem o campo
if (!FILTROS.includes(settings.filtro)) settings.filtro = 'tema'; // quem já usava o app não tem o campo
if (!ERRO_FAIXAS.includes(settings.erro)) settings.erro = ERRO_FAIXAS[2];
settings.escopoOpen = !!settings.escopoOpen;
if (!settings.aula) settings.aula = 'todas';
if (MODES_VELHOS[settings.mode]) settings.mode = MODES_VELHOS[settings.mode];
if (MODES[settings.mode] === undefined) settings.mode = 'zh_all';
// modo salvo que não vale no tipo salvo (ficou no desenho e voltou nas frases)
if (!modosDoTipo().includes(settings.mode)) settings.mode = 'zh_all';
if (settings.autoSpeak === undefined) settings.autoSpeak = true;
if (settings.tag === undefined) settings.tag = true; // quem já usava o app não tem o campo
if (settings.pron === undefined) settings.pron = true;   // idem
if (!FLASH_MS.includes(settings.flashMs)) settings.flashMs = FLASH_MS_PADRAO;
settings.flash = !!settings.flash;
// No aleatório quem manda é o modo sorteado pra CARTA ATUAL; fora dele, o escolhido no
// seletor. Tudo que pergunta "que modo é este?" passa por aqui, então a carta se monta,
// se responde e se avalia como se aquele modo estivesse ligado sozinho.
function mixOn() { return settings.mode === 'mix'; }
function modoKey() { return (mixOn() && modoCarta) ? modoCarta : settings.mode; }
function modo() { return MODES[modoKey()] || MODES.zh_all; }
function drawOn() { return !!modo().draw; }
function typeOn() { return !!modo().type; }
function quizOn() { return !!modo().quiz; }
function ordenarOn() { return !!modo().ordenar; }
// O relâmpago só vale onde responder é virar a carta. Nos outros quatro modos responder
// já é outra coisa — digitar, desenhar, marcar o tom — e o raio não teria o que cronometrar.
// (o aleatório também fica de fora: três dos quatro modos que ele sorteia não têm virada
// pra cronometrar, e piscar só numa carta em cada quatro não é rodada de relâmpago)
function flashOn() { return settings.flash && !mixOn() && !quizOn() && !drawOn() && !typeOn() && !ordenarOn(); }
let srs = {};                    // id → {reps, ivl, ease, due, u}
// id → {g, h, a} — quantas vezes acertou, marcou difícil e errou, desde sempre.
// Fica FORA do srs de propósito: na prática livre você avalia carta que nunca foi
// agendada, e criar estado de srs pra ela a tiraria da fila de novas.
let stats = {};
let log = {};                    // 'YYYY-MM-DD' → {rev, new}
let dirty = [];                  // ids com sync pendente (SRS)
let off = {};                    // id → {off: bool, u: ms} — cartas desligadas pelo usuário
let dirtyOff = [];               // ids com sync de desligamento pendente
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
let ordPool = [];                // pílulas ainda não usadas, embaralhadas
let ordEscolhido = [];           // a frase que você está montando, em ordem
let ordResult = null;            // {ok} da carta atual; null = ainda não conferiu
let typeResult = null;
let typePinyin = ''; // o pinyin em composição no teclado do sistema, quando ele deixa ver           // {ok, escolhido} da carta atual no teclado; null = não respondeu
let modoCarta = null;            // no aleatório, o modo sorteado pra carta atual
let modoCartaAnterior = null;    // o da carta passada, pra não repetir duas seguidas
let dataSource = '';             // 'supabase' | 'cache' | 'cache-noconfig' | 'seed' | 'vazio'
let cartasDeck = 'todos';        // filtro da aba Cartas
let cartasFiltro = 'tema';       // 'tema' | 'aula' — mesma ideia do filtro de estudo

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
    new Audio(card.audio_url).play().catch(() => falaTTS(card, auto));
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
  u.rate = 0.8; // mais devagar pra aluno — 慢慢!
  speechSynthesis.speak(u);
}

// ── traçado animado (dados do makemeahanzi) ─────────────────
let strokesDB = {};
let svgUid = 0;
async function loadStrokes() {
  try { strokesDB = await (await fetch('./strokes/strokes.json')).json(); }
  catch (e) { strokesDB = {}; }
}
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
  // depois de validar, o caractere certo aparece por baixo: dá pra ver onde saiu do lugar
  if (drawScore && current && strokesDB[current.hanzi]) {
    c.save();
    // cinza translúcido, não --pill: o fantasma tem que aparecer POR BAIXO da tinta,
    // senão a parte que você acertou o esconde e some justamente a comparação
    c.globalAlpha = 0.22;
    c.fillStyle = corVar('--txt', '#1b1d21');
    c.scale(k, k); c.translate(0, 900); c.scale(1, -1); // o Y do makemeahanzi é invertido
    strokesDB[current.hanzi].s.forEach(p => c.fill(new Path2D(p)));
    c.restore();
  }
  // a tinta do dedo
  c.save();
  c.lineWidth = Math.max(7, L * 0.05);
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.strokeStyle = c.fillStyle = !drawScore ? corVar('--txt', '#1b1d21')
    : drawScore.nota >= DRAW_OK ? corVar('--ok', '#2e9e5b')
    : drawScore.nota >= DRAW_QUASE ? corVar('--warn', '#d98a00')
    : corVar('--err', '#c8102e');
  drawInk.forEach(t => {
    if (t.length === 1) { // toque seco: um ponto (o 、 é isso mesmo)
      c.beginPath();
      c.arc(t[0][0] * k, t[0][1] * k, c.lineWidth / 2, 0, Math.PI * 2);
      c.fill();
      return;
    }
    c.beginPath();
    t.forEach((p, i) => i ? c.lineTo(p[0] * k, p[1] * k) : c.moveTo(p[0] * k, p[1] * k));
    c.stroke();
  });
  c.restore();
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
  const ask = $('drawask');
  ask.className = 'drawask';
  ask.innerHTML = '<span class="py">' + pinyinColored(card.pinyin) + '</span>' +
    '<span class="pt">' + esc(card.pt) + '</span>' +
    '<button class="spkbig" id="drawspk" title="Ouvir de novo">🔊</button>';
  $('drawspk').onclick = (e) => { e.stopPropagation(); speak(card); };
  $('drawfb').className = 'drawfb';
  $('drawfb').innerHTML = '';
  montaPad();
  renderDrawTools();
}
function renderDrawTools() {
  const vale = drawOn() && !!current && !drawScore;
  $('drawtools').classList.toggle('show', vale);
  const vazio = !drawInk.length;
  $('draw-undo').disabled = vazio;
  $('draw-clear').disabled = vazio;
  $('draw-check').disabled = vazio;
}
function validaDesenho() {
  if (!current || drawScore || !drawInk.length) return;
  const r = notaDesenho(current.hanzi, drawInk);
  if (!r) return;
  drawScore = r;
  bumpHab(current.id, 'esc', r.nota < DRAW_OK); // a nota, não o botão que você aperta depois
  repintaPad();
  const g = r.nota >= DRAW_OK ? 'good' : r.nota >= DRAW_QUASE ? 'hard' : 'again';
  const fb = $('drawfb');
  fb.className = 'drawfb ' + (g === 'good' ? 'ok' : g === 'hard' ? 'quase' : 'ruim');
  fb.innerHTML = (g === 'good' ? '对! ' : g === 'hard' ? 'Quase — ' : '') + r.nota + '% de proximidade' +
    '<small>' + esc(current.hanzi) + ' · ' + r.tracos + ' traço' + (r.tracos > 1 ? 's' : '') +
    ' seus, ' + r.oficial + ' no ideograma</small>';
  $('hint-f').textContent = 'toque na carta pra ver o traçado certo';
  $('grades').classList.add('show');
  $('g-' + g).classList.add('sugerido'); // sugestão da nota; quem decide ainda é você
  renderDrawTools();
  if (settings.autoSpeak) speak(current, true);
}
function desfazTraco() {
  if (drawScore || !drawInk.length) return;
  drawInk.pop();
  repintaPad(); renderDrawTools();
}
function limpaDesenho() {
  if (drawScore) return;
  drawInk = []; drawTrecho = null;
  repintaPad(); renderDrawTools();
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
  const largou = () => { drawTrecho = null; };
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
  pad.addEventListener('click', (e) => { if (!drawScore) e.stopPropagation(); });
}

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
  ajustaAlturaOrd(); // mover pílula entre o monte e a frase muda quantas linhas cada um ocupa
}
// A carta não cresce com o conteúdo: as faces são absolutas, que é o que faz a virada.
// Cada modo declara a sua altura — e o ordenar é o único em que ela não é previsível.
// 打开书 tem duas pílulas e 老师说，打开书，第八页 tem sete, que quebram em três linhas;
// uma altura fixa ou sobra meia tela na frase curta ou corta o resultado da longa.
// Então aqui ela é medida: o conteúdo diz de quanto precisa, a cada render.
function ajustaAlturaOrd() {
  const w = $('ordwrap');
  if (!w.classList.contains('show')) return;
  const front = $('fcard').querySelector('.face.front');
  const cs = getComputedStyle(front);
  const moldura = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + 18; // +18 = a faixa da dica
  $('fcard').style.minHeight = Math.max(400, Math.ceil(w.scrollHeight + moldura)) + 'px';
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
  ajustaAlturaOrd(); // o resultado acabou de entrar na frente: a carta cresce pra caber
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

// ── SRS (SM-2 simplificado) ─────────────────────────────────
function srsPreview(state, grade) { // rótulo do próximo intervalo
  const s = state || { reps: 0, ivl: 0, ease: EASE_START };
  if (grade === 'again') return '<10 min';
  if (grade === 'hard') return Math.max(1, Math.round((s.ivl || 1) * 1.2)) + 'd';
  if (s.reps === 0) return '1d';
  if (s.reps === 1) return '3d';
  return Math.round(s.ivl * s.ease) + 'd';
}
function srsApply(id, grade) {
  const s = srs[id] || { reps: 0, ivl: 0, ease: EASE_START, due: todayStr() };
  if (grade === 'again') {
    s.ease = Math.max(EASE_MIN, s.ease - 0.2);
    s.reps = 0; s.ivl = 0; s.due = todayStr();
  } else if (grade === 'hard') {
    s.ease = Math.max(EASE_MIN, s.ease - 0.15);
    s.ivl = Math.max(1, Math.round((s.ivl || 1) * 1.2));
    s.due = todayStr(s.ivl);
  } else { // good
    s.ease = Math.min(EASE_MAX, s.ease);
    if (s.reps === 0) s.ivl = 1;
    else if (s.reps === 1) s.ivl = 3;
    else s.ivl = Math.round(s.ivl * s.ease);
    s.reps += 1;
    s.due = todayStr(s.ivl);
  }
  s.u = Date.now();
  srs[id] = s;
  save(uk(K.srs), srs);
  return s;
}
function diaLabel(d) { return d.slice(8) + '/' + d.slice(5, 7); }
function rotuloRev(v) {
  if (!v) return 'não estudou';
  return v + (v === 1 ? ' revisão' : ' revisões') + (v >= META_DIARIA ? ' ✅' : '');
}
function revsDoDia(dia, registro) { return ((registro || log)[dia] || {}).rev || 0; }
function diaFechado(dia, registro) {
  const n = revsDoDia(dia, registro);
  return dia >= META_DESDE ? n >= META_DIARIA : n >= 1;
}
// sequência de dias fechados; hoje só entra depois de fechado, senão o número
// cairia sozinho à meia-noite e pareceria que a pessoa perdeu o streak
function calcStreak(registro) {
  let streak = 0;
  let d = diaFechado(todayStr(), registro) ? 0 : 1;
  while (diaFechado(todayStr(-(d + streak)), registro)) streak++;
  return streak;
}
// conta no grade() e não no srsApply(): na prática livre o srsApply só roda no
// "Errei", e contar por lá daria um retrato só dos erros — o mesmo defeito que
// o contador do dia tinha até 20/08.
const GRADE_KEY = { good: 'g', hard: 'h', again: 'a' };
// V2.7 — erro por HABILIDADE, não por modo. "Errei no teclado" é ambíguo: pode ser não
// lembrar o som ou trocar o ideograma entre dois homófonos, e são fraquezas diferentes,
// com treinos diferentes. O app já sabe qual das duas metades falhou — só não guardava.
const HABS = [
  { k: 'rec',  nome: 'reconhecer o 汉字',   dica: 'vê o ideograma e lembra o que é' },
  { k: 'som',  nome: 'lembrar o som',       dica: 'no teclado, digitar o pinyin certo' },
  { k: 'ideo', nome: 'achar o ideograma',   dica: 'com o pinyin certo, escolher entre os homófonos' },
  { k: 'esc',  nome: 'escrever de memória', dica: 'desenho com menos de ' + DRAW_OK + '% de proximidade' },
  { k: 'ordem', nome: 'a ordem da frase',   dica: 'montar a frase com as palavras na ordem certa' },
  { k: 'frase', nome: 'escrever a frase',   dica: 'digitar a frase inteira no teclado' },
  { k: 'tomM', nome: 'tom de memória',      dica: 'marcar o tom vendo o ideograma' },
  { k: 'tomO', nome: 'tom de ouvido',       dica: 'marcar o tom só ouvindo' }
];
const TOM_CURTO = { 1: '1º', 2: '2º', 3: '3º', 4: '4º', 5: 'neutro' };
function bumpStat(id, grade) {
  const k = GRADE_KEY[grade];
  if (!k) return;
  const s = stats[id] || { g: 0, h: 0, a: 0 };
  s[k] = (s[k] || 0) + 1;
  stats[id] = s;
  save(uk(K.stats), stats);
}
function statOf(id) { return stats[id] || { g: 0, h: 0, a: 0 }; }
// Grava um resultado OBJETIVO. Objetivo é a palavra que importa: no desenho e no teclado
// quem aperta "Errei" é você e o app só sugere, então misturar o botão com o que a
// máquina mediu estragaria o número. Aqui entra só o que a máquina viu.
// Não sincroniza sozinho: quem responde uma carta passa pelo grade(), que já dá o push.
// A exceção é o quiz puro de tom, que não passa por lá e empurra por conta própria.
function bumpHab(id, k, errou) {
  const s = stats[id] || { g: 0, h: 0, a: 0 };
  if (!s.hab) s.hab = {};
  const c = s.hab[k] || (s.hab[k] = { n: 0, e: 0 });
  c.n++;
  if (errou) c.e++;
  stats[id] = s;
  save(uk(K.stats), stats);
}
// O par (tom certo → tom marcado). A contagem crua de erros de tom não distingue trocar
// 2º por 3º — que é um problema de ouvido específico — de chutar qualquer coisa.
function bumpTomX(id, certo, marcado) {
  const s = stats[id] || { g: 0, h: 0, a: 0 };
  if (!s.tomX) s.tomX = {};
  const par = certo + '>' + marcado;
  s.tomX[par] = (s.tomX[par] || 0) + 1;
  stats[id] = s;
  save(uk(K.stats), stats);
}
function logToday(field) {
  const t = todayStr();
  if (!log[t]) log[t] = { rev: 0, new: 0 };
  log[t][field] = (log[t][field] || 0) + 1;
  save(uk(K.log), log);
}
function gcSrs() { // remove estados de cartas que não existem mais
  const ids = new Set(cards.map(c => c.id));
  let changed = false, changedOff = false;
  let changedStats = false;
  for (const id of Object.keys(srs)) if (!ids.has(id)) { delete srs[id]; changed = true; }
  for (const id of Object.keys(off)) if (!ids.has(id)) { delete off[id]; changedOff = true; }
  for (const id of Object.keys(stats)) if (!ids.has(id)) { delete stats[id]; changedStats = true; }
  if (changed) save(uk(K.srs), srs);
  if (changedOff) save(uk(K.off), off);
  if (changedStats) save(uk(K.stats), stats);
}

// ── cartas desligadas ───────────────────────────────────────
function isOff(id) { return !!(off[id] && off[id].off); }
function offCount() { return cards.filter(c => isOff(c.id)).length; }
function setOff(id, val) {
  off[id] = { off: val, u: Date.now() };
  save(uk(K.off), off);
  pushOff(id);
}

// ── usuário / login ─────────────────────────────────────────
function loadUserState() {
  srs = load(uk(K.srs), {});
  stats = load(uk(K.stats), {});
  log = load(uk(K.log), {});
  dirty = load(uk(K.dirty), []);
  off = load(uk(K.off), {});
  dirtyOff = load(uk(K.dirtyOff), []);
  // migração: progresso antigo sem usuário vira do primeiro que logar
  if (!Object.keys(srs).length && localStorage.getItem(K.srs)) {
    srs = load(K.srs, {}); log = load(K.log, {});
    save(uk(K.srs), srs); save(uk(K.log), log);
    localStorage.removeItem(K.srs); localStorage.removeItem(K.log);
  }
}
function renderUserPill() {
  const nome = settings.user ? (USERS[settings.user] || settings.user) : '';
  const b = $('profilebtn');
  b.textContent = nome ? nome[0].toUpperCase() : '👤'; // o nome inteiro não cabe no topo
  b.title = nome ? 'Perfil · ' + nome : 'Perfil';
}
// a folha de perfil guarda os dois estados que o botão redondo esconde: quem está
// estudando e o tema
function renderPerfilSheet() {
  document.querySelectorAll('#perfilsheet [data-pu]').forEach(b =>
    b.classList.toggle('active', b.dataset.pu === settings.user));
  applyTheme();
}
async function selectUser(u) {
  settings.user = u; save(K.settings, settings);
  $('login').classList.remove('show');
  $('perfilsheet').classList.remove('show');
  renderUserPill(); renderPerfilSheet();
  loadUserState();
  gcSrs();
  await syncPull();
  flushDirty();
  renderChips(); renderCartasChips(); renderList(); renderProgress();
  startSession();
}

// ── dados: Supabase → cache → seed ──────────────────────────
function sbConfigured() { return HW_CONFIG.SUPABASE_URL && HW_CONFIG.SUPABASE_ANON_KEY; }
function sbHeaders(extra) {
  return Object.assign({
    apikey: HW_CONFIG.SUPABASE_ANON_KEY,
    Authorization: 'Bearer ' + HW_CONFIG.SUPABASE_ANON_KEY,
    'Content-Type': 'application/json'
  }, extra || {});
}
async function loadCards() {
  const cached = load(K.cards, null);
  if (sbConfigured()) {
    try {
      const r = await fetch(HW_CONFIG.SUPABASE_URL + '/rest/v1/cards?select=*&deleted=eq.false&order=created_at.asc',
        { headers: sbHeaders() });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      cards = await r.json();
      save(K.cards, cards);
      dataSource = 'supabase';
      return;
    } catch (e) {
      if (cached && cached.length) { cards = cached; dataSource = 'cache'; return; }
    }
  } else if (cached && cached.length) {
    cards = cached; dataSource = 'cache-noconfig'; return;
  }
  try {
    const r = await fetch('./seed/seed_cards.json');
    cards = await r.json();
    dataSource = 'seed';
  } catch (e) {
    cards = []; dataSource = 'vazio';
  }
}

// ── sync de progresso (Supabase) ────────────────────────────
function syncEnabled() { return sbConfigured() && settings.user && settings.user !== 'convidado'; }
// Vira false quando o banco responde que ainda não tem as colunas da V2.7. Só nesta
// sessão: na próxima o ALTER TABLE já pode ter rodado, e ela tenta de novo.
let habColunaOk = true;
// log de TODO mundo, pro gráfico da turma. Só leitura e sem dado sensível —
// a policy de review_log já é aberta. Falhou? o gráfico some, o resto do app segue.
let logTurma = null;
async function loadLogTurma() {
  if (!sbConfigured()) return;
  try {
    const desde = todayStr(-13);
    const r = await fetch(HW_CONFIG.SUPABASE_URL +
      '/rest/v1/review_log?select=user_name,day,rev&day=gte.' + desde + '&order=day.asc',
      { headers: sbHeaders() });
    if (r.ok) logTurma = await r.json();
  } catch (e) { logTurma = null; }
}
async function syncPull() {
  if (!syncEnabled()) return false;
  let changed = false;
  try {
    const u = encodeURIComponent(settings.user);
    const [pr, lr] = await Promise.all([
      fetch(HW_CONFIG.SUPABASE_URL + '/rest/v1/progress?user_name=eq.' + u + '&select=*', { headers: sbHeaders() }),
      fetch(HW_CONFIG.SUPABASE_URL + '/rest/v1/review_log?user_name=eq.' + u + '&select=*', { headers: sbHeaders() })
    ]);
    if (pr.ok) {
      for (const row of await pr.json()) {
        const local = srs[row.card_id];
        if (row.due !== null && (!local || (row.updated_ms || 0) > (local.u || 0))) {
          srs[row.card_id] = { reps: row.reps, ivl: row.ivl, ease: row.ease, due: row.due, u: row.updated_ms || 0 };
          changed = true;
        }
        const lo = off[row.card_id];
        if ((row.off_ms || 0) > 0 && (!lo || row.off_ms > lo.u)) {
          off[row.card_id] = { off: !!row.suspended, u: row.off_ms };
          changed = true;
        }
        // contagens só crescem, então o maior lado vence — sem timestamp e sem
        // risco de um aparelho desatualizado zerar o que o outro somou
        const rem = { g: row.n_good || 0, h: row.n_hard || 0, a: row.n_again || 0 };
        if (rem.g || rem.h || rem.a) {
          const loc = stats[row.card_id] || { g: 0, h: 0, a: 0 };
          stats[row.card_id] = Object.assign(loc, {
            g: Math.max(loc.g || 0, rem.g), h: Math.max(loc.h || 0, rem.h), a: Math.max(loc.a || 0, rem.a)
          });
        }
        // habilidade e confusão de tons seguem a mesma regra dos contadores: só crescem,
        // o maior lado vence. Quem não tem a coluna (aparelho antes da V2.7) manda nada
        // e não apaga o que o outro somou.
        if (row.hab && typeof row.hab === 'object') {
          const loc = stats[row.card_id] || (stats[row.card_id] = { g: 0, h: 0, a: 0 });
          const h = loc.hab || (loc.hab = {});
          for (const k of Object.keys(row.hab)) {
            const r = row.hab[k] || {}, l = h[k] || { n: 0, e: 0 };
            h[k] = { n: Math.max(l.n || 0, r.n || 0), e: Math.max(l.e || 0, r.e || 0) };
          }
        }
        if (row.tom_x && typeof row.tom_x === 'object') {
          const loc = stats[row.card_id] || (stats[row.card_id] = { g: 0, h: 0, a: 0 });
          const x = loc.tomX || (loc.tomX = {});
          for (const par of Object.keys(row.tom_x)) x[par] = Math.max(x[par] || 0, row.tom_x[par] || 0);
        }
      }
      save(uk(K.srs), srs);
      save(uk(K.off), off);
      save(uk(K.stats), stats);
    }
    if (lr.ok) {
      for (const row of await lr.json()) {
        const local = log[row.day] || { rev: 0, new: 0 };
        log[row.day] = { rev: Math.max(local.rev, row.rev || 0), new: Math.max(local.new, row.new_cnt || 0) };
      }
      save(uk(K.log), log);
    }
  } catch (e) { /* offline — segue local */ }
  return changed;
}
async function syncPush(id) {
  if (!syncEnabled()) return;
  const s = srs[id];
  const t = todayStr();
  const l = log[t] || { rev: 0, new: 0 };
  // a linha pode ter só contagem e nenhum agendamento (carta avaliada na prática
  // livre sem nunca ter entrado na fila) — por isso os campos de srs são opcionais
  const linha = { user_name: settings.user, card_id: id };
  if (s) Object.assign(linha, { reps: s.reps, ivl: s.ivl, ease: s.ease, due: s.due, updated_ms: s.u });
  if (stats[id]) {
    Object.assign(linha, { n_good: stats[id].g, n_hard: stats[id].h, n_again: stats[id].a });
    if (habColunaOk && stats[id].hab) linha.hab = stats[id].hab;
    if (habColunaOk && stats[id].tomX) linha.tom_x = stats[id].tomX;
  }
  // o total do dia vai ANTES e por conta própria: são dados independentes, e uma
  // falha no progress (schema desatualizado, por exemplo) não pode levar junto
  // o contador que alimenta a meta e o gráfico da turma
  fetch(HW_CONFIG.SUPABASE_URL + '/rest/v1/review_log?on_conflict=user_name,day', {
    method: 'POST',
    headers: sbHeaders({ Prefer: 'resolution=merge-duplicates' }),
    body: JSON.stringify({ user_name: settings.user, day: t, rev: l.rev, new_cnt: l.new })
  }).catch(() => {});
  const post = (corpo) => fetch(HW_CONFIG.SUPABASE_URL + '/rest/v1/progress?on_conflict=user_name,card_id', {
    method: 'POST',
    headers: sbHeaders({ Prefer: 'resolution=merge-duplicates' }),
    body: JSON.stringify(corpo)
  });
  try {
    let r = await post(linha);
    // Banco ainda sem as colunas da V2.7 — o PostgREST devolve 400 e recusa a linha
    // INTEIRA. Sem esta saída, publicar o app antes de rodar o ALTER TABLE derrubaria a
    // sincronia toda (agendamento e contagens junto), não só a medição nova. Reenvia sem
    // elas e para de mandá-las até a próxima sessão.
    if (r.status === 400 && (linha.hab || linha.tom_x)) {
      habColunaOk = false;
      delete linha.hab;
      delete linha.tom_x;
      r = await post(linha);
    }
    if (!r.ok) throw new Error('HTTP ' + r.status);
    dirty = dirty.filter(x => x !== id);
    save(uk(K.dirty), dirty);
  } catch (e) {
    if (!dirty.includes(id)) { dirty.push(id); save(uk(K.dirty), dirty); }
  }
}
async function pushOff(id) {
  if (!syncEnabled()) return;
  const o = off[id];
  if (!o) return;
  try {
    const r = await fetch(HW_CONFIG.SUPABASE_URL + '/rest/v1/progress?on_conflict=user_name,card_id', {
      method: 'POST',
      headers: sbHeaders({ Prefer: 'resolution=merge-duplicates' }),
      body: JSON.stringify({ user_name: settings.user, card_id: id, suspended: o.off, off_ms: o.u })
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    dirtyOff = dirtyOff.filter(x => x !== id);
    save(uk(K.dirtyOff), dirtyOff);
  } catch (e) {
    if (!dirtyOff.includes(id)) { dirtyOff.push(id); save(uk(K.dirtyOff), dirtyOff); }
  }
}
function flushDirty() {
  if (!syncEnabled()) return;
  [...dirty].forEach(id => { if (srs[id] || stats[id]) syncPush(id); });
  [...dirtyOff].forEach(id => { if (off[id]) pushOff(id); });
}
async function syncReset() { // apaga progresso remoto do usuário
  if (!syncEnabled()) return;
  const u = encodeURIComponent(settings.user);
  try {
    await Promise.all([
      fetch(HW_CONFIG.SUPABASE_URL + '/rest/v1/progress?user_name=eq.' + u, { method: 'DELETE', headers: sbHeaders() }),
      fetch(HW_CONFIG.SUPABASE_URL + '/rest/v1/review_log?user_name=eq.' + u, { method: 'DELETE', headers: sbHeaders() })
    ]);
  } catch (e) { /* melhor esforço */ }
}

function showBanner(kind, msg) {
  const b = $('banner');
  b.className = 'banner show ' + kind;
  b.textContent = msg;
}
function hideBanner() { $('banner').className = 'banner'; }

// ── fila de estudo ──────────────────────────────────────────
// "errei" aqui é Errei + Difícil — a mesma conta que a aba Progresso usa em "mais erro",
// pra que as duas telas nunca discordem sobre qual é a palavra pior.
function erroCount(id) { const s = statOf(id); return s.a + s.h; }
// As já aprendidas ficam de fora: o contador é histórico e não esquece, então sem isto
// 说 (15 erros) moraria no topo da lista muito depois de você ter aprendido a palavra.
function aprendida(id) { return !!(srs[id] && srs[id].ivl >= LEARNED_IVL); }
function ehFrase(c) { return (c.tipo || 'palavra') === 'frase'; }
function temFrases() { return cards.some(ehFrase); }
// O deck do TIPO escolhido — é ele que todos os filtros fatiam. Palavra e frase não se
// encontram em fila nenhuma: são dois decks que moram na mesma tabela.
function deckAtual() { return cards.filter(c => (c.tipo || 'palavra') === settings.tipo); }
function cardsComErro(min) {
  return deckAtual().filter(c => !aprendida(c.id) && erroCount(c.id) >= min);
}
// só as faixas que têm palavra — chip vazio é convite a cair numa sessão de zero cartas.
// A contagem já desconta as desligadas, senão o número do chip mentiria sobre a sessão.
function faixasErro() {
  return ERRO_FAIXAS
    .map(n => ({ n, qtd: cardsComErro(n).filter(c => !isOff(c.id)).length }))
    .filter(f => f.qtd);
}
function filteredCards() {
  const base = deckAtual();
  if (settings.filtro === 'erro') return cardsComErro(settings.erro);
  if (settings.filtro === 'aula') {
    if (settings.aula === 'todas') return base;
    // fonte:x = veio de fora da aula (Duolingo, etc); 'fora' = sem procedência nenhuma
    if (settings.aula.indexOf('fonte:') === 0) {
      const f = settings.aula.slice(6);
      return base.filter(c => c.fonte === f);
    }
    if (settings.aula === 'fora') return base.filter(c => !c.data_aula && !c.fonte);
    return base.filter(c => c.data_aula === settings.aula);
  }
  return settings.deck === 'todos' ? base : base.filter(c => c.deck === settings.deck);
}
// Datas de aula presentes, da mais antiga pra mais recente. A base é parâmetro porque
// a tela de Estudar só quer as do tipo escolhido (aula que só teve palavra não pode
// aparecer como opção de frase, e vice-versa), enquanto a aba Cartas é o navegador do
// deck inteiro — ali palavra e frase convivem, porque consultar não é estudar.
function aulas(base) { return [...new Set((base || deckAtual()).map(c => c.data_aula).filter(Boolean))].sort(); }
function fontes(base) { return [...new Set((base || deckAtual()).map(c => c.fonte).filter(Boolean))].sort(); }
// opções do filtro "por aula": as datas em ordem, depois as fontes de fora da aula
function opcoesAula(base) {
  base = base || deckAtual();
  const fora = base.some(c => !c.data_aula && !c.fonte);
  return ['todas'].concat(aulas(base), fontes(base).map(f => 'fonte:' + f), fora ? ['fora'] : []);
}
function aulaLabel(a) {
  if (a === 'todas') return 'Todas';
  if (a === 'fora') return 'Sem origem';
  if (a.indexOf('fonte:') === 0) {
    const f = a.slice(6);
    return f.charAt(0).toUpperCase() + f.slice(1);
  }
  const [, m, dia] = a.split('-');
  return dia + '/' + m;
}
function activePool() { return filteredCards().filter(c => !isOff(c.id)); }
// Nem todo modo consegue perguntar de toda palavra:
//   desenho — a grade é uma só, então 你好 e 谢谢 ficam de fora
//   tom     — o tom é de uma sílaba, mesma restrição de um caractere
//   áudio → tom — e ainda tira o tom neutro: isolado, o TTS o fala com tom cheio, então
//                 a pergunta não teria resposta pelo ouvido. No 汉字 → tom o neutro entra:
//                 ali a resposta é o que a palavra É, não o que o alto-falante disse.
// Sorteia o modo desta carta entre os que conseguem perguntar dela: tom só de palavra
// de um caractere, e o de áudio nem de tom neutro nem de palavra que o aparelho não sabe
// falar. Evita repetir o modo da carta anterior quando há alternativa — sem isso o acaso
// entrega sequências de três iguais e a sessão parece travada num modo só.
function sorteiaModo(c) {
  const umSo = [...c.hanzi].length === 1;
  let ok = (ehFrase(c) ? MIX_MODOS_FRASE : MIX_MODOS).filter(k => {
    if ((k === 'zh_tom' || k === 'tons') && !umSo) return false;
    if (k === 'tons' && (toneOf(c.pinyin) === 5 || !canSpeak(c))) return false;
    if (k === 'ordenar' && !segmenta(c)) return false;
    return true;
  });
  const semRepetir = ok.filter(k => k !== modoCartaAnterior);
  if (semRepetir.length) ok = semRepetir;
  return ok[Math.floor(Math.random() * ok.length)] || 'zh_all';
}
function podePerguntar(c) {
  // no aleatório o pool é o inteiro: se um modo não dá conta desta palavra, o sorteio
  // escolhe outro que dê. Sem esta linha o contador do alto encolheria pro tamanho do
  // modo da carta que está na tela — 43 palavras enquanto a pergunta fosse de tom.
  if (mixOn()) return true;
  if ((drawOn() || quizOn()) && [...c.hanzi].length !== 1) return false;
  // Desenhar exige o traçado oficial: sem ele o "✓ Validar" não tem com o que comparar
  // e devolve null — o botão fica mudo e a carta vira beco sem saída. Acontece com toda
  // palavra nova enquanto o build_strokes.py não roda, e com a que o makemeahanzi não
  // tiver. Some da sessão em vez de quebrar dentro dela.
  if (drawOn() && !strokesDB[c.hanzi]) return false;
  if (settings.mode === 'tons' && toneOf(c.pinyin) === 5) return false;
  // Ordenar é exercício de FRASE, e a checagem é aqui e não só no seletor: palavra de
  // pinyin composto também segmenta — 林娜 vira 林|娜, 对不对 vira 对|不|对 — e sem esta
  // linha um modo escolhido pra frase continuaria perguntando a ordem do nome do colega,
  // que não tem ordem pra treinar. Segmentação é o segundo requisito: sem ela não há
  // pílula pra embaralhar.
  if (ordenarOn() && (!ehFrase(c) || !segmenta(c))) return false;
  return true;
}
// O que a SESSÃO pode mostrar — é isso que o contador do alto conta, não o pool inteiro
function poolSessao() { return activePool().filter(podePerguntar); }
function buildQueue() {
  const t = todayStr();
  const pool = poolSessao();
  const due = pool.filter(c => srs[c.id] && srs[c.id].due <= t)
    .sort((a, b) => srs[a.id].due < srs[b.id].due ? -1 : 1);
  // O filtro por erro ignora o agendamento de propósito: você pediu "as 7 que eu mais
  // erro" pra treinar as 7. Palavra muito errada já tem data marcada, então o SRS
  // sozinho te entregaria uma só. As atrasadas vêm na frente; o resto, embaralhado.
  // As respostas continuam reagendando normalmente — só a ordem de hoje muda.
  if (settings.filtro === 'erro') {
    const resto = shuffle(pool.filter(c => !due.includes(c)));
    queue = due.concat(resto).map(c => c.id);
    phase = 'sched';
    return;
  }
  const news = shuffle(pool.filter(c => !srs[c.id])); // sem limite diário: o deck só tem o que a turma já viu
  queue = due.concat(news).map(c => c.id);
  phase = 'sched';
}
function enterPractice() { // prática livre: deck inteiro embaralhado, sem parar
  queue = shuffle(poolSessao().map(c => c.id));
  phase = 'practice';
}
// sem pool = o deck todo (é o que a aba Progresso quer); com pool = o da sessão
function dueCount(pool) {
  const t = todayStr();
  pool = pool || activePool();
  const due = pool.filter(c => srs[c.id] && srs[c.id].due <= t).length;
  const news = pool.filter(c => !srs[c.id]).length;
  return { due, news };
}

// ── UI: estudar ─────────────────────────────────────────────
function renderChips() {
  // sem frase no deck a linha inteira some: um botão "Frases" que abre sessão vazia é
  // pior que botão nenhum. Enquanto o Leo não publicar as frases, nada muda de lugar.
  const tem = temFrases();
  $('tipotype').style.display = tem ? '' : 'none';
  if (!tem && settings.tipo !== 'palavra') { settings.tipo = 'palavra'; save(K.settings, settings); }
  $('tipotype').querySelectorAll('button').forEach(b =>
    b.classList.toggle('active', b.dataset.tp === settings.tipo));
  const eixo = settings.filtro;
  $('filtertype').querySelectorAll('button').forEach(b =>
    b.classList.toggle('active', b.dataset.f === eixo));

  let html;
  if (eixo === 'erro') {
    const faixas = faixasErro();
    // a faixa escolhida pode ter esvaziado desde a última sessão (você aprendeu as palavras):
    // cai na mais próxima que ainda tem gente, em vez de abrir uma sessão vazia
    if (faixas.length && !faixas.some(f => f.n === settings.erro)) {
      const menor = faixas.filter(f => f.n <= settings.erro).pop();
      settings.erro = (menor || faixas[0]).n;
    }
    html = faixas.length
      ? faixas.map(f =>
          '<button class="chip' + (settings.erro === f.n ? ' active' : '') + '" data-e="' + f.n + '">' +
          '≥' + f.n + ' erro' + (f.n > 1 ? 's' : '') + ' (' + f.qtd + ')</button>').join('')
      : '<button class="chip" disabled>Nada errado ainda por aqui 🎉</button>';
  } else if (eixo === 'aula') {
    const opcoes = opcoesAula();
    if (!opcoes.includes(settings.aula)) settings.aula = 'todas'; // aula sumiu do deck
    html = opcoes.map(a =>
      '<button class="chip' + (settings.aula === a ? ' active' : '') + '" data-a="' + esc(a) + '">' +
      esc(aulaLabel(a)) + '</button>').join('');
  } else {
    const decks = ['todos'].concat([...new Set(deckAtual().map(c => c.deck))]);
    html = decks.map(d =>
      '<button class="chip' + (settings.deck === d ? ' active' : '') + '" data-d="' + esc(d) + '">' +
      (d === 'todos' ? 'Todos' : esc(deckLabel(d))) + '</button>').join('');
  }
  $('deckchips').innerHTML = html;
  $('deckchips').querySelectorAll('.chip:not([disabled])').forEach(ch => ch.onclick = () => {
    if (eixo === 'erro') settings.erro = +ch.dataset.e;
    else if (eixo === 'aula') settings.aula = ch.dataset.a;
    else settings.deck = ch.dataset.d;
    save(K.settings, settings);
    renderChips();
    $('modesheet').classList.remove('show');
    startSession();
  });
  renderModeUI(); // a pílula do botão é o resumo desta escolha
}
function renderCounter() {
  renderStreak();
  const { due, news } = dueCount(poolSessao()); // o contador conta o que a sessão vai mostrar
  if (phase === 'quiz') {
    $('counter').innerHTML = '<b>quiz de tons · ' + (settings.mode === 'tons' ? 'áudio' : '汉字') +
      '</b> · ' + quizScore.ok + '/' + quizScore.n + ' certas · ' + queue.length + ' restantes';
  } else if (phase === 'flash') {
    $('counter').innerHTML = '<b>relâmpago ' + (settings.flashMs / 1000) + 's</b> · ' +
      flashScore.ok + '/' + flashScore.n + ' certas · ' + queue.length + ' restantes';
  } else if (phase === 'practice') {
    $('counter').innerHTML = 'revisões do dia ✅ · <b>prática livre</b> · "Errei" ainda reagenda';
  } else if (settings.filtro === 'erro') {
    // aqui "para hoje" mentiria: a fila é a faixa inteira, não a agenda do dia
    $('counter').innerHTML = '<b>≥' + settings.erro + ' erro' + (settings.erro > 1 ? 's' : '') +
      '</b> · ' + queue.length + ' restantes';
  } else {
    $('counter').innerHTML = '<b>' + due + '</b> para hoje · <b>' + news + '</b> nova' +
      (news === 1 ? '' : 's') + (settings.tipo === 'frase' ? ' · 💬 frases' : '');
  }
}
function showCard(card) {
  clearFlash(); // carta nova: mata relógio e resposta pendentes da anterior
  current = card;
  quizAnswered = false;
  // o sorteio vem ANTES do modo() — é ele que decide o que este modo() vai responder
  if (mixOn()) { modoCarta = sorteiaModo(card); modoCartaAnterior = modoCarta; }
  else modoCarta = null;
  const m = modo();
  const relampago = flashOn();
  const desenho = !!m.draw;
  const teclado = !!m.type;
  const ordena = !!m.ordenar;
  const f = $('fcard');
  f.classList.remove('flipped');
  f.classList.toggle('draw', desenho);
  f.classList.toggle('type', teclado || ordena); // os dois pedem a frente alta e alinhada
  f.classList.toggle('ord', ordena);
  f.style.minHeight = ''; // a altura do ordenar é medida; os outros modos usam a da classe
  $('drawwrap').classList.toggle('show', desenho);
  $('typewrap').classList.toggle('show', teclado);
  $('ordwrap').classList.toggle('show', ordena);
  // carta nova zera tinta, nota e resposta do teclado SEMPRE, mesmo saindo do modo: sem
  // isto os botões ↶ ✕ ✓ continuavam na tela depois de trocar pra um modo que não desenha
  drawInk = []; drawTrecho = null; drawScore = null;
  typeResult = null;
  ordResult = null; ordEscolhido = []; ordPool = [];
  renderDrawTools();
  const front = $('front-content');
  // no desenho e no teclado a pergunta mora dentro do próprio exercício, não aqui
  front.style.display = (desenho || teclado || ordena) ? 'none' : '';
  if (desenho || teclado || ordena) front.innerHTML = '';
  else if (m.front === 'hanzi') front.innerHTML = '<div class="hanzi-lg zh" lang="zh-Hans">' + esc(card.hanzi) + '</div>';
  else { // áudio → tom: a carta não mostra nada, o som é a pergunta inteira
    front.innerHTML = '<button class="bigspk" id="bigspk" title="Ouvir de novo">🔊</button>' +
      '<div class="audiolbl">' + (canSpeak(card) ? 'ouça e escolha o tom' : 'sem voz chinesa neste aparelho') + '</div>';
    $('bigspk').onclick = (e) => { e.stopPropagation(); speak(card); };
  }
  // O 🔊 do canto some em três modos, por dois motivos diferentes. No teclado e no
  // 汉字 → tom ele seria um botão de resposta — dita o que digitar, canta o tom; quem não
  // lembra sai pelo "não lembro", que conta como erro. No desenho ele é só repetido: a
  // pergunta já tem o seu, e os dois ficavam colados na mesma quina.
  // no ordenar o 🔊 entrega a frase inteira falada, que é literalmente a resposta
  $('spk-front').style.display = (m.quiz || m.type || m.draw || m.ordenar) ? 'none' : '';
  $('quizfb').style.display = 'none';
  $('quizfb').innerHTML = '';
  $('tones').classList.toggle('show', !!m.quiz);
  $('tones').querySelectorAll('button').forEach(bt => bt.classList.remove('hit', 'miss'));
  $('hint-f').textContent = desenho ? 'escreva o ideograma na grade e toque em Validar'
    : ordena ? 'monte a frase e toque em conferir'
    : teclado ? (ehFrase(card) ? 'escreva a frase no teclado de mandarim'
                               : 'digite o som e escolha o ideograma')
    : m.quiz ? (m.front === 'audio' ? 'ouça e escolha o tom · toque na carta pra repetir'
                                    : 'olhe o ideograma e escolha o tom')
    : relampago ? 'toque assim que reconhecer'
    : 'toque para virar';
  if (desenho) montaDesenho(card);
  if (teclado) montaTeclado(card);
  if (ordena) montaOrdenar(card);
  // o áudio só toca sozinho onde ele É a pergunta (áudio → tom) ou parte dela (desenho).
  // No 汉字 → tom ouvir entregaria a resposta, então ali fica quieto até responder.
  if (m.front === 'audio' || desenho) speak(card, true);
  $('deckpill-f').textContent = deckLabel(card.deck);
  $('deckpill-b').textContent = deckLabel(card.deck);
  // "Números" na carta de 三 é meio caminho da resposta — dá pra desligar no MODO
  $('fcard').classList.toggle('semtag', !settings.tag);
  $('back-hanzi').textContent = card.hanzi;
  renderBackHanzi(card, relampago);
  $('back-pinyin').innerHTML = pinyinColored(card.pinyin);
  $('back-pt').textContent = card.pt;
  $('back-nota').textContent = card.nota || '';
  const s = srs[card.id];
  $('iv-again').textContent = srsPreview(s, 'again');
  $('iv-hard').textContent = phase === 'practice' ? 'prática' : srsPreview(s, 'hard');
  $('iv-good').textContent = phase === 'practice' ? 'prática' : srsPreview(s, 'good');
  $('grades').classList.remove('show');
  $('grades').querySelectorAll('button').forEach(bt => bt.classList.remove('sugerido'));
  $('nextbtn').classList.remove('show');
  $('stage').style.display = '';
  $('offbtn').style.display = '';
  $('done').classList.remove('show');
  renderCounter();
  if (relampago) { runFlashClock(); renderPausa(); } // por último: relógio com a carta já montada
}
function nextCard() {
  if (!queue.length) {
    // quiz e relâmpago são rodadas fechadas: acabou o baralho, mostra o placar
    if (phase === 'quiz' || phase === 'flash' || !poolSessao().length) { finishSession(); return; }
    if (phase === 'sched') { // acabaram as revisões → emenda na prática, sem parar
      showBanner('info', '🎉 Revisões do dia feitas! Emendando na prática livre — só "Errei" mexe no agendamento.');
      setTimeout(hideBanner, 4500);
    }
    enterPractice(); // na prática, fila vazia = embaralha de novo (infinito)
    if (!queue.length) { finishSession(); return; }
  }
  const id = queue[0];
  const card = cards.find(c => c.id === id);
  if (!card || isOff(id)) { queue.shift(); nextCard(); return; }
  showCard(card);
}
function finishSession() {
  clearFlash();
  current = null;
  modoCarta = null; // o placar do fim é do modo escolhido, não do sorteado na última carta
  $('stage').style.display = 'none';
  $('grades').classList.remove('show');
  $('tones').classList.remove('show');
  $('drawtools').classList.remove('show');
  $('drawwrap').classList.remove('show');
  $('typewrap').classList.remove('show');
  $('ordwrap').classList.remove('show');
  $('nextbtn').classList.remove('show');
  $('offbtn').style.display = 'none';
  $('done').classList.add('show');
  if (flashOn() && flashScore.n) {
    // a nota é sobre o deck INTEIRO da rodada, não só sobre o que foi respondido:
    // deixar o tempo acabar sem dizer nada é resultado, não carta que não existiu
    const total = flashScore.total || flashScore.n;
    const pct = Math.round(flashScore.ok / total * 100);
    const semResposta = flashScore.semResposta
      ? ' (' + flashScore.semResposta + ' você não respondeu a tempo)' : '';
    $('done-title').textContent = 'Fim do relâmpago!';
    $('done-sub').textContent = 'Você acertou ' + flashScore.ok + ' de ' + total + ' — ' + pct + '%' +
      semResposta + ', com ' + (settings.flashMs / 1000) + 's por carta. ' +
      (pct >= 80 ? '厉害 (lìhai — mandou bem)! Tenta com menos tempo.'
       : pct >= 50 ? '加油 (jiāyóu — tá vindo)!'
       : '慢慢来 (mànmàn lái — com calma, tenta com mais tempo).');
    $('freebtn').textContent = '⚡ Jogar de novo';
    $('freebtn').style.display = '';
  } else if (!poolSessao().length && activePool().length) {
    // tem carta no filtro, mas nenhuma que ESTE modo consiga perguntar
    $('done-title').textContent = 'Nada pra perguntar aqui';
    $('done-sub').textContent = (ordenarOn()
      ? 'O ordenar precisa saber onde cada palavra da frase começa, e isso vem do pinyin separado por palavra. Nenhuma frase deste filtro fecha a conta.'
      : drawOn()
      ? 'O modo desenho usa uma grade por caractere, então só entram palavras de um caractere.'
      : 'O tom é de uma sílaba só, então só entram palavras de um caractere' +
        (settings.mode === 'tons' ? ', e sem tom neutro, que o alto-falante não consegue perguntar.' : '.')) +
      ' Não sobrou nenhuma neste filtro — escolha outra faixa/tema/aula ou troque de modo.';
    $('freebtn').style.display = 'none';
  } else if (quizOn()) { // no aleatório o modoCarta já foi zerado, então não cai aqui
    const pct = quizScore.n ? Math.round(quizScore.ok / quizScore.n * 100) : 0;
    $('done-title').textContent = 'Fim do quiz!';
    $('done-sub').textContent = MODE_TITLES[settings.mode] + ': ' + quizScore.ok + '/' + quizScore.n +
      ' (' + pct + '%). ' + (pct >= 80 ? '厉害 (lìhai — mandou bem)!'
        : '加油 (jiāyóu — continua treinando ' + (settings.mode === 'tons' ? 'o ouvido' : 'a memória') + ')!');
    $('freebtn').textContent = '🎯 Jogar de novo';
    $('freebtn').style.display = '';
  } else { // só acontece sem nenhuma carta ativa no filtro
    $('done-title').textContent = 'Nada por aqui';
    $('done-sub').textContent = settings.filtro === 'erro'
      ? 'Nenhuma palavra nesta faixa de erro — escolha outra faixa, ou 🏷️/📅 pra voltar ao deck.'
      : 'Nenhuma carta ativa neste deck — religue cartas na aba Cartas ou escolha outro filtro.';
    $('freebtn').style.display = 'none';
  }
  renderCounter();
}
function startSession() {
  clearFlash();
  modoCarta = null; // senão a última carta do aleatório decidiria que sessão começa agora
  if (quizOn()) { startToneQuiz(); return; }
  if (flashOn()) { startFlash(); return; }
  buildQueue();
  nextCard(); // fila vazia → nextCard emenda na prática sozinho
}
function startToneQuiz() {
  quizScore = { ok: 0, n: 0 };
  // rodada fechada, como o relâmpago: o placar é o resultado e nada disso mexe no SRS.
  // Quem escolhe o que dá pra perguntar é o podePerguntar, dentro do poolSessao.
  queue = shuffle(poolSessao().map(c => c.id));
  phase = 'quiz';
  if (queue.length) nextCard(); else finishSession();
}
function answerTone(t) {
  if (!current || quizAnswered) return;
  quizAnswered = true;
  const correct = toneOf(current.pinyin);
  // de memória e de ouvido são habilidades diferentes e erram em lugares diferentes,
  // então cada uma tem seu contador — e o par (certo → marcado) vai junto
  bumpHab(current.id, modoKey() === 'tons' ? 'tomO' : 'tomM', t !== correct);
  if (t !== correct) bumpTomX(current.id, correct, t);
  // no quiz puro não vem um grade() depois pra sincronizar esta carta
  if (!mixOn()) syncPush(current.id);
  if (!mixOn()) { quizScore.n++; if (t === correct) quizScore.ok++; }
  $('tones').querySelectorAll('button').forEach(bt => {
    const bt_t = parseInt(bt.dataset.t, 10);
    if (bt_t === correct) bt.classList.add('hit');
    else if (bt_t === t) bt.classList.add('miss');
  });
  $('quizfb').innerHTML = pinyinColored(current.pinyin) + ' · ' + esc(current.pt) +
    '<small>' + esc(TONE_NAMES[correct]) + '</small>';
  $('quizfb').style.display = '';
  speak(current, true); // ouve de novo já sabendo a resposta
  // No quiz puro a rodada é fechada e o botão só avança. No aleatório a carta é uma
  // revisão como as outras: a resposta sugere um botão, mas quem decide é você — igual
  // ao desenho e ao teclado, e é assim que o tom entra na meta e no agendamento.
  if (mixOn()) {
    $('grades').classList.add('show');
    $('g-' + (t === correct ? 'good' : 'again')).classList.add('sugerido');
  } else {
    $('nextbtn').classList.add('show');
  }
  renderCounter();
}
// ── relâmpago ───────────────────────────────────────────────
// Duas etapas por carta, cada uma com seu relógio:
//   1. exposição — a carta aparece pelo tempo escolhido e some
//   2. pergunta  — a explicação entra e você diz se acertou ou não, dentro do tempo
// Quem pontua é a etapa 2. Não grava SRS nem conta pra meta: é auto-avaliação rápida,
// serve pra saber se está indo bem ou mal, não pra remexer no agendamento.
function clearFlash() {
  clearTimeout(flashTimer);
  flashTimer = null;
  flashState = 'off';
  flashRestante = 0;
  $('flashrow').classList.remove('show');
  $('flashbar').className = 'flashbar';
  $('flashask').classList.remove('show');
  $('flashtag').style.display = 'none';
}
function startFlash() {
  flashScore = { ok: 0, n: 0, semResposta: 0, total: activePool().length };
  clearFlash();
  flashPausa = false;
  queue = shuffle(activePool().map(c => c.id));
  phase = 'flash';
  if (queue.length) nextCard(); else finishSession();
}
function escalaAtual() { // quanto da barra ainda está cheio, no meio da animação
  const m = new DOMMatrixReadOnly(getComputedStyle($('flashfill')).transform);
  return Math.max(0, Math.min(1, m.a));
}
function correBarra(ms, de) { // anima a barra de `de` (0–1) até vazia, em ms
  const fill = $('flashfill');
  fill.style.transition = 'none';
  fill.style.transform = 'scaleX(' + de + ')';
  void fill.getBoundingClientRect(); // reflow: sem isso o navegador junta as duas mudanças
  fill.style.transition = 'transform ' + ms + 'ms linear';
  fill.style.transform = 'scaleX(0)';
}
function runFlashClock() { // etapa 1: exposição
  $('flashrow').classList.add('show');
  $('flashbar').className = 'flashbar';
  $('flashask').classList.remove('show');
  flashState = 'correndo';
  flashRestante = settings.flashMs;
  if (flashPausa) { congelaBarra(1); return; } // entrou pausado: barra cheia, esperando
  flashInicio = performance.now();
  correBarra(settings.flashMs, 1);
  flashTimer = setTimeout(revealFlash, settings.flashMs);
}
function congelaBarra(escala) {
  const fill = $('flashfill');
  fill.style.transition = 'none';
  fill.style.transform = 'scaleX(' + escala + ')';
}
function revealFlash() { // etapa 2: a explicação entra e pergunta
  if (flashState !== 'correndo') return;
  clearTimeout(flashTimer); flashTimer = null;
  flashState = 'perguntando';
  flashRestante = FLASH_RESP_MS;

  $('fcard').classList.add('flipped');
  const tag = $('flashtag');
  tag.className = 'flashtag ask';
  tag.textContent = 'você acertou?';
  tag.style.display = '';
  $('flashask').classList.add('show');
  $('flashbar').className = 'flashbar asking'; // outra cor: agora o relógio é o da resposta
  if (settings.autoSpeak) speak(current, true);
  renderCounter();

  if (flashPausa) { congelaBarra(1); return; }
  flashInicio = performance.now();
  correBarra(FLASH_RESP_MS, 1);
  flashTimer = setTimeout(() => responder(null), FLASH_RESP_MS);
}
// acertou = true | false | null (deixou o tempo acabar sem dizer)
function responder(acertou) {
  if (flashState !== 'perguntando') return;
  clearTimeout(flashTimer); flashTimer = null;
  flashScore.n++;
  if (acertou === true) flashScore.ok++;
  else if (acertou === null) flashScore.semResposta++; // não respondeu conta como errou
  clearFlash();
  queue.shift();
  nextCard();
}

// ── pausa ───────────────────────────────────────────────────
// Vale nas duas etapas: pausar só a exposição deixaria a pergunta expirando sozinha
// bem quando você quis parar pra ler a explicação com calma.
function togglePausa() {
  if (phase !== 'flash' || flashState === 'off') return;
  flashPausa ? despausar() : pausar();
  renderPausa();
}
function duracaoEtapa() { return flashState === 'perguntando' ? FLASH_RESP_MS : settings.flashMs; }
function pausar() {
  flashPausa = true;
  flashRestante = Math.max(0, duracaoEtapa() - (performance.now() - flashInicio));
  congelaBarra(escalaAtual());
  clearTimeout(flashTimer); flashTimer = null;
}
function despausar() {
  flashPausa = false;
  flashInicio = performance.now() - (duracaoEtapa() - flashRestante);
  correBarra(flashRestante, escalaAtual());
  flashTimer = setTimeout(flashState === 'perguntando' ? () => responder(null) : revealFlash, flashRestante);
}
function renderPausa() {
  const b = $('flashpause');
  b.textContent = flashPausa ? '▶' : '⏸';
  b.title = flashPausa ? 'Continuar' : 'Pausar';
  b.classList.toggle('paused', flashPausa);
}

// Sair da aba ou bloquear o celular não pode deixar o relógio correndo: a rodada inteira
// passaria sozinha no bolso. Congela ao sair e retoma a mesma carta ao voltar.
let flashSuspenso = null;
function pauseFlash() {
  if (phase !== 'flash' || flashState === 'off') return;
  flashSuspenso = flashState;
  clearFlash();
}
function resumeFlash() {
  if (!flashSuspenso || !$('view-estudar').classList.contains('active')) return;
  flashSuspenso = null;
  // desligou a carta enquanto estava fora → pula; senão a carta recomeça da exposição,
  // que é mais justo do que cobrar a resposta de uma explicação que ele não viu
  if (!current || isOff(current.id)) { queue.shift(); nextCard(); }
  else showCard(current);
}
function grade(g) {
  if (!current) return;
  queue.shift();
  gradedThisSession++;
  // TODA carta avaliada conta no dia, inclusive na prática livre. Antes só o "Errei"
  // da prática registrava, o que fazia acertar valer zero e só o erro contar — inofensivo
  // enquanto era estatística, perverso depois que o streak passou a depender da meta.
  logToday('rev');
  bumpStat(current.id, g);
  // "reconhecer" só é medível no modo que revela tudo de uma vez. Nos outros, responder
  // já é outra coisa — digitar, desenhar, marcar o tom — e a nota mediria aquilo. Aqui o
  // botão É a medida, porque não existe resultado objetivo: "Difícil" é acerto, você
  // lembrou. Sem isso a taxa de "rec" não seria comparável com a dos outros cinco.
  if (modoKey() === 'zh_all' && !flashOn()) bumpHab(current.id, 'rec', g === 'again');
  if (phase === 'sched') {
    const isNew = !srs[current.id];
    srsApply(current.id, g);
    if (isNew) logToday('new');
    syncPush(current.id);
    if (g === 'again') queue.splice(Math.min(3, queue.length), 0, current.id);
  } else if (phase === 'practice' && g === 'again') {
    // na prática, "Errei" ainda vale: esqueceu de verdade, o agendamento precisa saber
    srsApply(current.id, 'again');
    syncPush(current.id);
    queue.splice(Math.min(3, queue.length), 0, current.id);
  } else {
    // acerto na prática: o agendamento não muda, mas a contagem da palavra e o
    // total do dia mudam — o syncPush já lida com linha sem estado de srs
    syncPush(current.id);
  }
  nextCard();
}
function tapCard() {
  if (!current) return;
  const m = modo();
  const f = $('fcard');
  if (flashOn()) {
    // já reconheceu antes do tempo? o toque adianta a explicação — quem pontua são os
    // botões da etapa 2, então adiantar não dá nem tira ponto de ninguém
    if (!flashPausa && flashState === 'correndo') revealFlash();
    return;
  }
  // Desenho e teclado: antes de responder, tocar não faz nada — virar a carta entregaria
  // justamente o que se está tentando lembrar. Depois de responder, vira normalmente.
  if (m.draw || m.type) {
    if (m.draw ? !drawScore : !typeResult) return;
    if (f.classList.contains('flipped')) { f.classList.remove('flipped'); renderBackHanzi(current); }
    else { f.classList.add('flipped'); setTimeout(animateBackStrokes, 300); }
    return;
  }
  if (f.classList.contains('flipped')) { // desvirar
    f.classList.remove('flipped');
    $('grades').classList.remove('show');
    $('nextbtn').classList.remove('show');
    renderBackHanzi(current); // reseta o traçado pro próximo flip
    return;
  }
  // no quiz de ouvido tocar repete o som; no de ideograma o som é a resposta, então cala
  if (m.quiz) { if (m.front === 'audio') speak(current, true); return; }
  f.classList.add('flipped');
  setTimeout(animateBackStrokes, 300); // começa a desenhar quando a virada tá terminando
  if (settings.autoSpeak) speak(current, true);
  $('grades').classList.add('show');
}

// ── UI: cartas (consulta) ───────────────────────────────────
function renderCartasChips() {
  const porAula = cartasFiltro === 'aula';
  $('cartas-filtertype').querySelectorAll('button').forEach(b =>
    b.classList.toggle('active', (b.dataset.f === 'aula') === porAula));

  const nOff = offCount();
  const opcoes = porAula ? opcoesAula(cards) : ['todos'].concat([...new Set(cards.map(c => c.deck))]);
  if (!opcoes.includes(cartasDeck) && cartasDeck !== '__off__') cartasDeck = opcoes[0];
  let html = opcoes.map(o =>
    '<button class="chip' + (cartasDeck === o ? ' active' : '') + '" data-d="' + esc(o) + '">' +
    (porAula ? esc(aulaLabel(o)) : o === 'todos' ? 'Todas' : esc(deckLabel(o))) + '</button>').join('');
  if (nOff > 0 || cartasDeck === '__off__') {
    html += '<button class="chip' + (cartasDeck === '__off__' ? ' active' : '') + '" data-d="__off__">🚫 Desligadas (' + nOff + ')</button>';
  }
  $('cartas-chips').innerHTML = html;
  $('cartas-chips').querySelectorAll('.chip').forEach(ch => ch.onclick = () => {
    cartasDeck = ch.dataset.d;
    renderCartasChips(); renderList();
  });
}
// as cartas que o filtro da aba Cartas está mostrando, ignorando a busca por texto
function cartasFiltradas() {
  if (cartasDeck === '__off__') return cards.filter(c => isOff(c.id));
  if (cartasFiltro === 'aula') {
    if (cartasDeck === 'todas') return cards;
    if (cartasDeck.indexOf('fonte:') === 0) {
      const f = cartasDeck.slice(6);
      return cards.filter(c => c.fonte === f);
    }
    if (cartasDeck === 'fora') return cards.filter(c => !c.data_aula && !c.fonte);
    return cards.filter(c => c.data_aula === cartasDeck);
  }
  return cartasDeck === 'todos' ? cards : cards.filter(c => c.deck === cartasDeck);
}
// botão de ligar/desligar em bloco — só aparece com um filtro específico escolhido,
// porque "desligar todas" com o filtro em Todas é um tiro no pé sem querer
function renderBulk() {
  const grupo = cartasFiltradas();
  const generico = cartasDeck === 'todos' || cartasDeck === 'todas' || cartasDeck === '__off__';
  if (generico || !grupo.length) { $('bulkbar').innerHTML = ''; return; }
  const ligadas = grupo.filter(c => !isOff(c.id)).length;
  const desligar = ligadas > 0;
  const rotulo = cartasFiltro === 'aula' ? aulaLabel(cartasDeck) : deckLabel(cartasDeck);
  $('bulkbar').innerHTML = '<button class="bulkbtn' + (desligar ? '' : ' on') + '" id="bulkbtn">' +
    (desligar ? '🚫 Desligar as ' + ligadas + ' de ' + esc(rotulo)
      : '↩︎ Religar as ' + grupo.length + ' de ' + esc(rotulo)) + '</button>';
  $('bulkbtn').onclick = () => {
    if (desligar && !confirm('Tirar da rotação as ' + ligadas + ' cartas de ' + rotulo +
      '? Elas somem do estudo até você religar. O progresso delas fica guardado.')) return;
    grupo.forEach(c => { if (isOff(c.id) === desligar) setOff(c.id, desligar); });
    renderCartasChips(); renderList(); startSession();
  };
}
function renderList() {
  const q = $('search').value.trim().toLowerCase();
  const list = cartasFiltradas().filter(c =>
    (!q ||
      (c.hanzi || '').toLowerCase().includes(q) ||
      (c.pinyin || '').toLowerCase().includes(q) ||
      (c.pt || '').toLowerCase().includes(q)));
  // conta o que está na tela; quando há filtro ou busca, mostra também o total do deck
  renderBulk();
  const nome = temFrases() ? 'cartas' : 'palavras'; // com frase no deck "palavras" mente
  const filtrado = list.length !== cards.length;
  $('cartas-count').innerHTML = filtrado
    ? '<b>' + list.length + '</b> de ' + cards.length + ' ' + nome
    : '<b>' + cards.length + '</b> ' + nome + ' no deck';
  $('cardlist').innerHTML = list.map(c =>
    '<div class="card' + (isOff(c.id) ? ' offrow' : '') + '"><div class="rowline">' +
    '<div class="h zh" lang="zh-Hans">' + esc(c.hanzi) + '</div>' +
    '<div class="mid"><div class="p">' + pinyinColored(c.pinyin) + '</div><div class="t">' + esc(c.pt) + '</div>' +
    (c.nota ? '<div class="n">' + esc(c.nota) + '</div>' : '') + '</div>' +
    '<span class="pill">' + esc(deckLabel(c.deck)) + '</span>' +
    '<button class="spk-row" data-id="' + esc(c.id) + '" title="Ouvir">🔊</button>' +
    '<label class="switch" title="ativa / desligada"><input type="checkbox" class="offtgl" data-id="' + esc(c.id) + '"' +
    (isOff(c.id) ? '' : ' checked') + '><span class="knob"></span></label>' +
    '</div></div>').join('') || '<p style="color:var(--mut);text-align:center">Nenhuma carta encontrada.</p>';
  $('cardlist').querySelectorAll('.spk-row').forEach(bt => bt.onclick = () => {
    const c = cards.find(x => x.id === bt.dataset.id);
    if (c) speak(c);
  });
  $('cardlist').querySelectorAll('.offtgl').forEach(t => t.onchange = () => {
    setOff(t.dataset.id, !t.checked);
    renderCartasChips(); renderList();
    if (phase !== 'quiz') { // realinha a fila de estudo mantendo a carta atual na frente
      if (phase === 'sched') buildQueue(); else enterPractice();
      if (current && !isOff(current.id)) {
        queue = queue.filter(x => x !== current.id);
        queue.unshift(current.id);
        renderCounter();
      } else {
        nextCard();
      }
    }
  });
}

// ── tooltip dos gráficos ────────────────────────────────────
// O title= do navegador demora ~1s pra aparecer e não existe em toque, que é
// justamente onde o app é usado. Este responde a hover no desktop e a toque no celular.
let tipAtual = null;
function hideTip() {
  if (tipAtual) tipAtual.classList.remove('tipped');
  tipAtual = null;
  $('tip').classList.remove('show');
}
function showTip(el) {
  const tip = $('tip');
  if (tipAtual) tipAtual.classList.remove('tipped');
  tipAtual = el;
  el.classList.add('tipped');
  tip.textContent = el.dataset.tip;
  tip.classList.add('show');
  const r = el.getBoundingClientRect();
  const t = tip.getBoundingClientRect();
  const margem = 8;
  let x = r.left + r.width / 2 - t.width / 2;
  x = Math.max(margem, Math.min(x, window.innerWidth - t.width - margem));
  let y = r.top - t.height - 8;
  if (y < margem) y = r.bottom + 8; // barra muito no topo? joga o balão pra baixo
  tip.style.left = Math.round(x) + 'px';
  tip.style.top = Math.round(y) + 'px';
}
function bindTips() {
  const alvo = e => e.target.closest('[data-tip]');
  document.addEventListener('mouseover', e => { const el = alvo(e); if (el) showTip(el); });
  document.addEventListener('mouseout', e => { if (alvo(e)) hideTip(); });
  // no toque: abre no elemento tocado, fecha ao tocar em qualquer outro lugar
  document.addEventListener('click', e => {
    const el = alvo(e);
    if (el) { el === tipAtual ? hideTip() : showTip(el); } else hideTip();
  });
  window.addEventListener('scroll', hideTip, { passive: true });
  window.addEventListener('resize', hideTip);
}

function renderStreak() {
  const hoje = revsDoDia(todayStr());
  const bateu = hoje >= META_DIARIA;
  $('streakpill').classList.toggle('hit', bateu);
  $('streak-n').textContent = calcStreak();
  // passou da meta? mostra o excedente em vez de travar em 20/20 — a meta é piso, não teto
  $('streak-meta').textContent = bateu ? '+' + (hoje - META_DIARIA) : hoje + '/' + META_DIARIA;
  $('streakpill').title = bateu
    ? 'Meta do dia batida: ' + hoje + ' revisões. Pode seguir o quanto quiser.'
    : 'Faltam ' + (META_DIARIA - hoje) + ' revisões pra fechar o dia';
}
let statOrder = 'erros'; // 'erros' | 'acertos' | 'total' | 'deck'
function renderWordStats() {
  const pool = cards.filter(c => !isOff(c.id));
  const linhas = pool.map(c => {
    const s = statOf(c.id);
    return { c, ...s, total: s.g + s.h + s.a };
  });
  const semDado = linhas.every(l => !l.total);

  $('statsort').innerHTML = [['erros', 'mais erro'], ['acertos', 'mais acerto'],
    ['total', 'mais vistas'], ['deck', 'por tema']]
    .map(([k, t]) => '<button class="chip' + (statOrder === k ? ' active' : '') +
      '" data-s="' + k + '">' + t + '</button>').join('');
  $('statsort').querySelectorAll('.chip').forEach(ch => ch.onclick = () => {
    statOrder = ch.dataset.s;
    renderWordStats();
    $('wordstats').scrollTop = 0; // reordenou: volta pro topo, senão a nova ordem começa no meio
  });

  if (semDado) {
    $('wordstats').innerHTML = '<p class="wempty">Ainda sem contagem. Ela começou a ser gravada em ' +
      '20/08 — as revisões anteriores a essa data não foram registradas por carta.</p>';
    return;
  }
  const ordem = {
    erros: (a, b) => (b.a + b.h) - (a.a + a.h) || b.total - a.total,
    acertos: (a, b) => b.g - a.g || b.total - a.total,
    total: (a, b) => b.total - a.total,
    deck: (a, b) => a.c.deck.localeCompare(b.c.deck) || b.total - a.total
  }[statOrder];
  linhas.sort(ordem);

  const vistas = linhas.filter(l => l.total).length;
  // legenda uma vez no topo: os três números são coloridos mas não rotulados, e
  // explicar via tooltip obrigaria a tocar em cada linha pra entender a tela
  $('wordstats').innerHTML = '<p class="wcount">' + linhas.length + ' palavras · ' +
    vistas + ' já com contagem &nbsp;·&nbsp; <span class="tally">' +
    '<span class="g">acertos</span><span class="h">difícil</span><span class="a">erros</span>' +
    '</span></p>' + linhas.map(l => {
    const pill = (n, cls) => '<span class="' + (n ? cls : 'zero') + '">' + n + '</span>';
    return '<div class="wrow"><span class="hz zh" lang="zh-Hans">' + esc(l.c.hanzi) + '</span>' +
      '<span class="info"><b>' + esc(l.c.pt) + '</b><small>' + pinyinColored(l.c.pinyin) +
      ' · ' + esc(deckLabel(l.c.deck)) + '</small></span>' +
      '<span class="tally" data-tip="' + esc(l.c.hanzi + ': ' + l.g + ' acertos, ' + l.h +
        ' difícil, ' + l.a + ' erros') + '">' +
      pill(l.g, 'g') + pill(l.h, 'h') + pill(l.a, 'a') + '</span></div>';
  }).join('');
}
// Taxa, não contagem. O aleatório sorteia os modos de forma desigual, e tom e desenho só
// valem pra palavra de um caractere: "14 erros de tom" sozinho não diz nada, "38% de erro
// em 21 tentativas" diz. Por isso a tentativa aparece do lado de toda porcentagem.
function renderHabStats() {
  const tot = {};
  HABS.forEach(h => tot[h.k] = { n: 0, e: 0 });
  const conf = {};
  let nConf = 0;
  cards.forEach(c => {
    const s = stats[c.id];
    if (!s) return;
    if (s.hab) HABS.forEach(h => {
      const v = s.hab[h.k];
      if (v) { tot[h.k].n += v.n || 0; tot[h.k].e += v.e || 0; }
    });
    if (s.tomX) for (const par of Object.keys(s.tomX)) {
      conf[par] = (conf[par] || 0) + s.tomX[par];
      nConf += s.tomX[par];
    }
  });
  if (!HABS.some(h => tot[h.k].n)) {
    $('habstats').innerHTML = '<p class="wempty">Ainda sem medição, e ela só enxerga daqui ' +
      'pra frente: as revisões antigas não sabem de que modo vieram. O 🔀 Aleatório é o que ' +
      'enche isto mais rápido, porque te expõe aos quatro modos na mesma sessão.</p>';
    return;
  }
  const linhas = HABS.map(h => {
    const v = tot[h.k];
    if (!v.n) return '<div class="habrow vazio"><span class="hnome">' + esc(h.nome) +
      '<small>' + esc(h.dica) + '</small></span><span class="hnum">sem dados</span></div>';
    const pct = Math.round(v.e / v.n * 100);
    return '<div class="habrow"><span class="hnome">' + esc(h.nome) +
      '<small>' + esc(h.dica) + '</small></span>' +
      '<span class="hnum"><b>' + pct + '%</b><small>de erro · ' + v.e + ' de ' + v.n + '</small></span>' +
      '<span class="hbar"><i style="width:' + Math.max(2, pct) + '%"></i></span></div>';
  }).join('');
  // A lista de pares é a resposta à pergunta que a contagem de erros não responde.
  // Duas ou três confusões concentram quase tudo — por isso só as cinco maiores.
  const pares = Object.keys(conf).map(p => [p, conf[p]]).sort((a, b) => b[1] - a[1]);
  let cx = '';
  if (pares.length) {
    const [certo, marcado] = pares[0][0].split('>');
    cx = '<div class="tomx"><b>Quais tons você confunde</b>' +
      '<p>O mais comum: era <b>' + TOM_CURTO[certo] + '</b> e você marcou <b>' + TOM_CURTO[marcado] +
      '</b>, em ' + pares[0][1] + ' dos ' + nConf + ' erro' + (nConf > 1 ? 's' : '') + ' de tom.</p>' +
      pares.slice(0, 5).map(function (par) {
        const t = par[0].split('>');
        return '<div class="tomxrow"><span>' + TOM_CURTO[t[0]] + ' → ' + TOM_CURTO[t[1]] +
          '</span><b>' + par[1] + '×</b></div>';
      }).join('') + '</div>';
  }
  $('habstats').innerHTML = linhas + cx;
}
function renderTurma() {
  if (!logTurma || !logTurma.length) {
    $('turma').innerHTML = '<p style="color:var(--mut);font-size:13px;margin:0;text-align:center">' +
      'Sem dados da turma agora (precisa de internet).</p>';
    return;
  }
  // 7 dias e não 14: com 14 colunas o número não cabe, e sem número só sobra
  // a barra — que num celular é fina demais pra ler ou tocar
  const days = [];
  for (let i = 6; i >= 0; i--) days.push(todayStr(-i));
  const porUser = {};
  logTurma.forEach(r => {
    if (!porUser[r.user_name]) porUser[r.user_name] = {};
    porUser[r.user_name][r.day] = r.rev || 0;
  });
  const nomes = Object.keys(porUser).sort((a, b) =>
    days.reduce((s, d) => s + (porUser[b][d] || 0), 0) -
    days.reduce((s, d) => s + (porUser[a][d] || 0), 0));

  const cabecalho = '<div class="turmalabels">' +
    days.map(d => '<span>' + diaLabel(d) + '</span>').join('') + '</div>';

  $('turma').innerHTML = cabecalho + nomes.map(u => {
    const tot = days.reduce((s, d) => s + (porUser[u][d] || 0), 0);
    const celulas = days.map(d => {
      const v = porUser[u][d] || 0;
      const cls = v >= META_DIARIA ? 'bateu' : v > 0 ? 'fez' : '';
      return '<b class="' + cls + '">' + (v || '–') + '</b>';
    }).join('');
    return '<div class="userrow"><span class="nome' + (u === settings.user ? ' eu' : '') + '">' +
      esc(USERS[u] || u) + '</span><span class="dias">' + celulas + '</span>' +
      '<span class="tot">' + tot + '</span></div>';
  }).join('') +
    '<p class="turmaleg">últimos 7 dias · <i></i> meta de ' + META_DIARIA + ' batida</p>';
}

// ── UI: progresso ───────────────────────────────────────────
function renderProgress() {
  renderTurma();
  renderHabStats();
  renderWordStats();
  const t = todayStr();
  const { due, news } = dueCount();
  const nOff = offCount();
  // o Progresso é do deck inteiro, não do tipo escolhido em Estudar: aqui a pergunta é
  // "como eu vou", e ir bem em frases também é ir bem
  const nFr = cards.filter(ehFrase).length;
  $('s-total').textContent = cards.length;
  $('s-total-lbl').textContent = (nFr ? (cards.length - nFr) + ' palavras + ' + nFr + ' frase' + (nFr > 1 ? 's' : '')
    : 'palavras no deck') + (nOff ? ' · ' + nOff + ' desligada' + (nOff > 1 ? 's' : '') : '');
  $('s-hoje').textContent = due;
  $('s-novas').textContent = news;
  $('s-aprendidas').textContent = cards.filter(c => srs[c.id] && srs[c.id].ivl >= LEARNED_IVL).length;
  $('s-streak').textContent = calcStreak();
  const days = [];
  for (let i = 13; i >= 0; i--) days.push(todayStr(-i));
  const vals = days.map(k => (log[k] && log[k].rev) || 0);
  const max = Math.max(1, ...vals);
  $('bars').innerHTML = vals.map((v, i) =>
    '<div class="bar' + (v === 0 ? ' zero' : '') + '" style="height:' + Math.max(3, Math.round(v / max * 100)) + '%"' +
    ' data-tip="' + esc(diaLabel(days[i]) + ' · ' + rotuloRev(v)) + '"></div>').join('');
  $('barlabels').innerHTML = days.map(k => '<span>' + k.slice(8) + '</span>').join('');
  const decks = [...new Set(cards.map(c => c.deck))];
  $('deckstats').innerHTML = decks.map(dk => {
    const pool = cards.filter(c => c.deck === dk);
    const learned = pool.filter(c => srs[c.id] && srs[c.id].ivl >= LEARNED_IVL).length;
    const seen = pool.filter(c => srs[c.id]).length;
    const nOff = pool.filter(c => isOff(c.id)).length;
    return '<div class="deckrow"><b>' + esc(deckLabel(dk)) + '</b><span>' + seen + '/' + pool.length +
      ' vistas · ' + learned + ' aprendidas' + (nOff ? ' · ' + nOff + ' 🚫' : '') + '</span></div>';
  }).join('');
}

// ── navegação e eventos ─────────────────────────────────────
function switchView(v) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.v === v));
  document.querySelectorAll('.view').forEach(s => s.classList.toggle('active', s.id === 'view-' + v));
  if (v === 'progresso') {
    renderProgress();
    loadLogTurma().then(renderTurma); // busca a cada visita: o colega pode ter estudado agora
  }
  if (v === 'cartas') renderList();
  if (v === 'estudar') resumeFlash(); else pauseFlash();
  // desligar uma carta na aba Cartas pode trocar a carta atual com a aba Estudar
  // escondida — e aí a grade nasceu sem largura pra medir. Volta, remede.
  if (v === 'estudar' && drawOn() && current) montaPad();
}
// O que está na fila, em três palavras — serve tanto pra pílula do botão quanto pra
// linha fechada dentro da folha, pra que as duas nunca digam coisas diferentes.
function escopoResumo() {
  const r = escopoEixo();
  // o tipo vem na frente porque é a escolha de cima: primeiro que deck, depois que fatia
  if (settings.tipo === 'frase') r.txt = 'Frases · ' + r.txt;
  return r;
}
function escopoEixo() {
  if (settings.filtro === 'erro') {
    const f = faixasErro().find(x => x.n === settings.erro);
    return { ico: '❌', txt: f ? '≥' + f.n + ' erro' + (f.n > 1 ? 's' : '') : 'sem erros ainda' };
  }
  if (settings.filtro === 'aula') {
    return { ico: '📅', txt: settings.aula === 'todas' ? 'Todas as aulas' : aulaLabel(settings.aula) };
  }
  return { ico: '🏷️', txt: settings.deck === 'todos' ? 'Todos os temas' : deckLabel(settings.deck) };
}
function renderModeUI() {
  $('modecur').textContent = (flashOn() ? '⚡ ' : '') + (MODE_TITLES[settings.mode] || MODE_TITLES.zh_all);
  const e = escopoResumo();
  $('modescope').textContent = e.ico + ' ' + e.txt;
  $('escopo-ico').textContent = e.ico;
  $('escopo-atual').textContent = e.txt;
}
function renderEscopo() {
  const open = !!settings.escopoOpen;
  $('escopo-body').classList.toggle('open', open);
  $('escopo-toggle').classList.toggle('open', open);
  $('escopo-toggle').setAttribute('aria-expanded', open ? 'true' : 'false');
}
// Que tipo de fila a combinação pede: cada uma monta a sessão de um jeito diferente.
// Os dois quizzes de tom viram tipos distintos porque o pool não é o mesmo — o de áudio
// tira os neutros. O teclado é fila normal: mesmo pool, só a pergunta muda.
function queueKind() {
  if (mixOn()) return 'normal'; // fila normal: quem varia é a pergunta, carta a carta
  // o ordenar tem pool próprio (só frase que a segmentação fecha), então é família à
  // parte: trocar pra ele ou sair dele remonta a fila em vez de reaproveitar a atual
  return quizOn() ? 'quiz:' + settings.mode : drawOn() ? 'draw'
    : ordenarOn() ? 'ordenar' : flashOn() ? 'flash' : 'normal';
}
function renderModeSheet() {
  renderChips(); // as faixas de erro mudam sozinhas conforme você estuda
  renderEscopo();
  const validos = modosDoTipo();
  document.querySelectorAll('.modeopt[data-m]').forEach(b => {
    b.style.display = validos.includes(b.dataset.m) ? '' : 'none';
    b.classList.toggle('active', b.dataset.m === settings.mode);
  });
  $('autospeak-opt').classList.toggle('active', !!settings.autoSpeak);
  $('tag-opt').classList.toggle('active', !!settings.tag);
  $('pron-opt').classList.toggle('active', !!settings.pron);
  $('flash-opt').classList.toggle('active', !!settings.flash);
  $('flashtime').querySelectorAll('button').forEach(b =>
    b.classList.toggle('active', parseInt(b.dataset.ms, 10) === settings.flashMs));
  // só um modo vira a carta; nos outros responder já é outra coisa (digitar, desenhar,
  // marcar o tom) e a chave do relâmpago fica visivelmente sem efeito
  const semEfeito = mixOn() || quizOn() || drawOn() || typeOn() || ordenarOn();
  $('flash-opt').classList.toggle('disabled', semEfeito);
  // só apaga o tempo quando o modo não aceita relâmpago; com a chave desligada ele
  // continua clicável, e tocar num tempo liga a chave
  $('flashtime').classList.toggle('disabled', semEfeito);
}
// a aproximação sai do HTML sempre; quem decide se aparece é esta classe no <html>.
// Assim o interruptor vale na hora pra carta na tela, pra lista de Cartas e pro que já
// está montado — nada precisa ser redesenhado.
function applyPron() {
  document.documentElement.classList.toggle('sempron', !settings.pron);
}

function applyTheme() {
  const pref = settings.theme || 'light'; // light é o padrão; dark só se a pessoa escolher
  document.documentElement.dataset.theme = pref;
  document.querySelectorAll('#perfilsheet [data-t]').forEach(b =>
    b.classList.toggle('active', b.dataset.t === pref));
}

function bindEvents() {
  document.querySelectorAll('.tab').forEach(t => t.onclick = () => switchView(t.dataset.v));
  $('profilebtn').onclick = () => { renderPerfilSheet(); $('perfilsheet').classList.add('show'); };
  $('perfilsheet-bg').onclick = () => $('perfilsheet').classList.remove('show');
  document.querySelectorAll('#perfilsheet [data-t]').forEach(b => b.onclick = () => {
    settings.theme = b.dataset.t; save(K.settings, settings); applyTheme();
  });
  // trocar de usuário recarrega progresso e sessão; tocar em quem já está só fecha
  document.querySelectorAll('#perfilsheet [data-pu]').forEach(b => b.onclick = () => {
    if (b.dataset.pu === settings.user) { $('perfilsheet').classList.remove('show'); return; }
    selectUser(b.dataset.pu);
  });
  $('modebtn').onclick = () => { renderModeSheet(); $('modesheet').classList.add('show'); };
  $('modesheet-bg').onclick = () => $('modesheet').classList.remove('show');
  $('escopo-toggle').onclick = () => {
    settings.escopoOpen = !settings.escopoOpen; save(K.settings, settings);
    renderEscopo();
  };
  // Palavras ↔ Frases é a escolha de cima: troca o deck inteiro, então zera a fatia
  // (a aula de 06/08 tem palavra e frase, mas 12/08 pode ter só palavra) e, se o modo
  // atual não souber perguntar do tipo novo, cai no de virar a carta.
  $('tipotype').querySelectorAll('button').forEach(b => b.onclick = () => {
    if (b.dataset.tp === settings.tipo) return;
    settings.tipo = b.dataset.tp;
    settings.deck = 'todos'; settings.aula = 'todas';
    if (!modosDoTipo().includes(settings.mode)) settings.mode = 'zh_all';
    save(K.settings, settings);
    renderModeSheet(); renderModeUI(); startSession();
  });
  $('ordwrap').onclick = (e) => { if (!ordResult) e.stopPropagation(); };
  $('ord-check').onclick = (e) => { e.stopPropagation(); respondeOrdenar(false); };
  $('ord-skip').onclick = (e) => { e.stopPropagation(); respondeOrdenar(true); };
  // trocar de eixo não fecha a folha: depois do ❌ ainda falta escolher a faixa
  $('filtertype').querySelectorAll('button').forEach(b => b.onclick = () => {
    settings.filtro = b.dataset.f; save(K.settings, settings);
    renderChips(); startSession();
  });
  $('cartas-filtertype').querySelectorAll('button').forEach(b => b.onclick = () => {
    cartasFiltro = b.dataset.f;
    cartasDeck = cartasFiltro === 'aula' ? 'todas' : 'todos';
    renderCartasChips(); renderList();
  });
  $('credbtn').onclick = () => $('credsheet').classList.add('show');
  $('credsheet-bg').onclick = () => $('credsheet').classList.remove('show');
  $('credclose').onclick = () => $('credsheet').classList.remove('show');
  document.querySelectorAll('.modeopt[data-m]').forEach(b => b.onclick = () => {
    const antes = queueKind();
    settings.mode = b.dataset.m; save(K.settings, settings);
    renderModeUI();
    $('modesheet').classList.remove('show');
    // quiz e relâmpago montam a fila do seu jeito — trocar de família reconstrói a sessão
    if (antes !== queueKind()) startSession();
    else if (current) showCard(current);
  });
  $('flash-opt').onclick = () => { // a chave do relâmpago: liga por cima do modo atual
    if (quizOn() || drawOn() || typeOn() || ordenarOn()) return;
    settings.flash = !settings.flash; save(K.settings, settings);
    renderModeSheet(); renderModeUI();
    startSession(); // ligar ou desligar troca o tipo de fila
  };
  $('flashtime').querySelectorAll('button').forEach(b => b.onclick = () => {
    settings.flashMs = parseInt(b.dataset.ms, 10);
    settings.flash = true; // escolher o tempo é dizer que quer relâmpago — antes o
    save(K.settings, settings); // seletor ficava morto com a chave desligada e parecia quebrado
    renderModeSheet(); renderModeUI();
    startSession(); // tempo novo, rodada nova: o placar velho não vale mais
  });
  $('autospeak-opt').onclick = () => {
    settings.autoSpeak = !settings.autoSpeak; save(K.settings, settings);
    renderModeSheet();
  };
  $('pron-opt').onclick = () => {
    settings.pron = !settings.pron; save(K.settings, settings);
    renderModeSheet(); applyPron();
  };
  $('tag-opt').onclick = () => {
    settings.tag = !settings.tag; save(K.settings, settings);
    renderModeSheet();
    // a carta na tela é a de agora: sem isto a mudança só apareceria na próxima
    $('fcard').classList.toggle('semtag', !settings.tag);
  };
  $('spk-back').onclick = (e) => { e.stopPropagation(); if (current) speak(current); };
  $('spk-front').onclick = (e) => { e.stopPropagation(); if (current) speak(current); };
  bindPad();
  // Enquanto não respondeu, o toque no teclado não pode virar a carta — o campo e os
  // candidatos ocupam quase toda a frente, e virar entregaria a resposta. Depois de
  // responder o clique passa: a dica manda tocar na carta pra ver tudo.
  $('typewrap').onclick = (e) => { if (!typeResult) e.stopPropagation(); };
  $('typein').oninput = renderTypeCheck;
  // o pinyin cru só existe aqui dentro: no `input` o campo já traz o ideograma escolhido
  $('typein').addEventListener('compositionupdate', (e) => { if (e.data) typePinyin = e.data; });
  $('typein').onkeydown = (e) => {
    if (e.key !== 'Enter' || e.isComposing) return; // Enter dentro do IME é dele, não nosso
    e.preventDefault();
    confereTeclado();
  };
  $('type-check').onclick = (e) => { e.stopPropagation(); confereTeclado(); };
  // sem esta saída, quem não lembra o som fica preso
  $('type-skip').onclick = (e) => { e.stopPropagation(); respondeTeclado(null); };
  $('draw-undo').onclick = (e) => { e.stopPropagation(); desfazTraco(); };
  $('draw-clear').onclick = (e) => { e.stopPropagation(); limpaDesenho(); };
  $('draw-check').onclick = (e) => { e.stopPropagation(); validaDesenho(); };
  // a grade é medida em px: mudou o tamanho da tela, redesenha (a tinta vive em 0–1024)
  window.addEventListener('resize', () => { if (drawOn() && current) montaPad(); });
  $('back-strokes').onclick = (e) => { // repetir o traçado sem desvirar a carta
    e.stopPropagation();
    if (!current) return;
    renderBackHanzi(current);
    animateBackStrokes();
  };
  $('fcard').onclick = tapCard;
  $('g-again').onclick = () => grade('again');
  $('g-hard').onclick = () => grade('hard');
  $('g-good').onclick = () => grade('good');
  $('nextbtn').onclick = () => { queue.shift(); nextCard(); };
  $('freebtn').onclick = () => {
    if (quizOn()) startToneQuiz();
    else if (flashOn()) startFlash();
  };
  $('flashpause').onclick = togglePausa;
  $('fa-hit').onclick = () => responder(true);
  $('fa-miss').onclick = () => responder(false);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseFlash(); else resumeFlash();
  });
  $('tones').querySelectorAll('button').forEach(bt => bt.onclick = () => answerTone(parseInt(bt.dataset.t, 10)));
  $('offbtn').onclick = () => {
    if (!current) return;
    setOff(current.id, true);
    queue.shift();
    showBanner('info', '🚫 "' + current.hanzi + '" desligada — religue na aba Cartas.');
    setTimeout(hideBanner, 3000);
    renderCartasChips();
    nextCard();
  };
  $('search').oninput = renderList;
  // login
  document.querySelectorAll('#login [data-u]').forEach(b => b.onclick = () => selectUser(b.dataset.u));
  // progresso
  $('resetbtn').onclick = () => {
    if (!confirm('Zerar TODO o seu progresso de estudo (' + (USERS[settings.user] || '') + ')? As cartas não são apagadas.')) return;
    srs = {}; log = {}; dirty = []; stats = {};
    localStorage.removeItem(uk(K.srs)); localStorage.removeItem(uk(K.log));
    localStorage.removeItem(uk(K.dirty)); localStorage.removeItem(uk(K.stats));
    syncReset();
    renderProgress(); startSession();
  };
  // debug (?debug=1)
  if (new URLSearchParams(location.search).get('debug')) {
    $('debugbar').classList.add('show');
    const upd = () => $('debug-date').textContent = 'hoje=' + todayStr() + ' offset=' + dayOffset();
    upd();
    $('debug-tomorrow').onclick = () => { localStorage.setItem(K.dayOffset, String(dayOffset() + 1)); upd(); startSession(); renderProgress(); };
    $('debug-reset').onclick = () => { localStorage.removeItem(K.dayOffset); upd(); startSession(); renderProgress(); };
  }
}

// ── init ────────────────────────────────────────────────────
async function init() {
  applyTheme();
  applyPron();
  bindEvents();
  bindTips();
  renderModeUI();
  await Promise.all([loadCards(), loadStrokes()]);
  if (dataSource === 'seed' || dataSource === 'cache-noconfig') showBanner('info', 'Rodando com o deck local — Supabase ainda não configurado.');
  else if (dataSource === 'cache') showBanner('info', '📴 Sem conexão — usando as cartas salvas neste aparelho.');
  else if (dataSource === 'vazio') showBanner('error', 'Não consegui carregar nenhuma carta. Verifique a conexão e recarregue.');
  else hideBanner();
  if (settings.user) { // estado do usuário ANTES de qualquer render (off/srs afetam chips e fila)
    renderUserPill();
    loadUserState();
    gcSrs();
  }
  renderChips();
  renderCartasChips();
  renderList();
  renderProgress();
  renderStreak();
  if (settings.user) {
    startSession();
    const changed = await syncPull();
    flushDirty();
    if (changed && gradedThisSession === 0) startSession();
    renderCartasChips();
    renderList();
    renderProgress();
    renderStreak(); // o syncPull pode ter trazido revisões feitas em outro aparelho
    loadLogTurma().then(renderTurma);
  } else {
    $('login').classList.add('show');
    startSession();
  }
}
init();
