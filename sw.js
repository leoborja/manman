// Mànmàn — service worker. Faz o app abrir e tocar áudio sem internet.
//
// Três regras, uma pra cada tipo de arquivo:
//
//   casca (página, app.js, fonte, traçados, ícones)
//     rede com prazo de 3s, cópia se a rede não vier. Com internet boa você sempre vê a
//     versão nova; com sinal ruim (metrô, elevador) o app abre da cópia em vez de ficar em
//     branco esperando — internet ruim era pior que internet nenhuma, que falha na hora.
//
//   áudio (audio/nativo, audio/frases)
//     cópia primeiro, e atualiza por trás quando há rede. Atualizar importa: os MP3s
//     trocam de conteúdo sem trocar de nome (14 homófonos viraram gravação exata em 13/09),
//     e sem isso o celular ficaria preso na gravação velha pra sempre.
//     O app manda a lista de áudios a cada abertura (mensagem 'baixar-audios') e o SW baixa
//     o que falta — ~4 MB na primeira vez, depois só o que entrar de novo.
//
//   Supabase e qualquer outro domínio
//     não passa por aqui. O app.js tem o próprio plano B (cartas salvas no aparelho e o
//     aviso 📴), e cache de resposta do banco serviria progresso velho.
//
// O Safari do iPhone pede áudio em pedaços (cabeçalho Range) e não toca uma resposta
// inteira no lugar de um pedaço — daí o parcial() montando o 206 a partir da cópia.
//
// Se um dia este arquivo quebrar o app: trocar a versão da CASCA força todo celular a
// baixar tudo de novo na próxima abertura com internet (o activate apaga a cópia antiga).
const CASCA = 'manman-casca-v2';
const AUDIO = 'manman-audio';   // sem versão: trocar a casca não rebaixa os 4 MB de áudio
const PRAZO_MS = 3000;
const ARQUIVOS_CASCA = ['./', './index.html', './app.js', './config.js', './manifest.webmanifest',
  './fonts/hanzi.woff2', './strokes/strokes.json', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', e => {
  // um arquivo que falhe não pode derrubar a instalação inteira — o resto já serve offline
  e.waitUntil(caches.open(CASCA).then(c => Promise.all(
    ARQUIVOS_CASCA.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {}))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => e.waitUntil(
  caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CASCA && k !== AUDIO).map(k => caches.delete(k))))
    .then(() => self.clients.claim())
));

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes('/audio/')) { e.respondWith(audio(req, e)); return; }
  e.respondWith(casca(req));
});

self.addEventListener('message', e => {
  const d = e.data || {};
  if (d.tipo === 'baixar-audios' && Array.isArray(d.urls)) {
    const p = baixarAudios(d.urls);
    if (e.waitUntil) e.waitUntil(p);
  }
});

function comPrazo(promessa, ms) {
  return Promise.race([promessa, new Promise((_, rej) => setTimeout(() => rej(new Error('prazo')), ms))]);
}

async function casca(req) {
  const cache = await caches.open(CASCA);
  try {
    const resp = await comPrazo(fetch(req), PRAZO_MS);
    if (resp.ok) cache.put(req, resp.clone());
    return resp;
  } catch (err) {
    const salvo = await cache.match(req, { ignoreSearch: true }) ||
      (req.mode === 'navigate' ? (await cache.match('./')) || (await cache.match('./index.html')) : null);
    return salvo || Response.error();
  }
}

async function audio(req, e) {
  const cache = await caches.open(AUDIO);
  const chave = req.url.split('#')[0];
  // sempre o arquivo INTEIRO, sem Range: é o que dá pra guardar (o cache não aceita 206)
  const daRede = fetch(chave, { cache: 'no-cache' }).then(r => {
    if (r.ok && r.status === 200) cache.put(chave, r.clone());
    return r;
  });
  const salvo = await cache.match(chave, { ignoreSearch: true });
  if (salvo) {
    e.waitUntil(daRede.catch(() => {}));   // toca a cópia agora, atualiza pra próxima vez
    return parcial(req, salvo);
  }
  try {
    const r = await daRede;
    return r.ok ? parcial(req, r.clone()) : r;
  } catch (err) {
    return Response.error();   // sem cópia e sem rede: o speak() do app cai pro TTS
  }
}

async function parcial(req, resp) {
  const range = req.headers.get('range');
  if (!range) return resp;
  const buf = await resp.arrayBuffer();
  const total = buf.byteLength;
  const m = /bytes=(\d*)-(\d*)/.exec(range);
  const tipo = resp.headers.get('Content-Type') || 'audio/mpeg';
  if (!m || (m[1] === '' && m[2] === '')) {
    return new Response(buf, { status: 200, headers: { 'Content-Type': tipo, 'Accept-Ranges': 'bytes' } });
  }
  let ini, fim;
  if (m[1] === '') { ini = Math.max(0, total - Number(m[2])); fim = total - 1; }
  else { ini = Number(m[1]); fim = m[2] === '' ? total - 1 : Math.min(Number(m[2]), total - 1); }
  if (ini >= total) return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + total } });
  return new Response(buf.slice(ini, fim + 1), { status: 206, headers: {
    'Content-Type': tipo, 'Content-Range': 'bytes ' + ini + '-' + fim + '/' + total,
    'Content-Length': String(fim - ini + 1), 'Accept-Ranges': 'bytes' } });
}

async function baixarAudios(urls) {
  const cache = await caches.open(AUDIO);
  const nossos = urls.filter(u => { try { return new URL(u).origin === self.location.origin; } catch (e) { return false; } });
  const faltam = [];
  for (const u of nossos) if (!(await cache.match(u, { ignoreSearch: true }))) faltam.push(u);
  // quatro de cada vez: baixa rápido sem disputar a banda com o resto do app
  let i = 0;
  async function trabalhador() {
    while (i < faltam.length) {
      const u = faltam[i++];
      try {
        const r = await fetch(u, { cache: 'no-cache' });
        if (r.ok && r.status === 200) await cache.put(u, r);
      } catch (err) { return; }   // caiu a rede: para aqui, a próxima abertura continua
    }
  }
  await Promise.all([trabalhador(), trabalhador(), trabalhador(), trabalhador()]);
  // áudio de carta que saiu do deck não precisa ocupar o celular
  const vivos = new Set(nossos.map(u => u.split('?')[0]));
  for (const k of await cache.keys()) if (!vivos.has(k.url.split('?')[0])) await cache.delete(k);
}
