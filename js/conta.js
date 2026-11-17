/* Mànmàn — A conta: entrar com e-mail e senha, o @ e o nome, e o código de quem já usava
   o app. O mesmo login do app iOS, no mesmo Supabase Auth (ver docs/login-e-turma.md no
   repositório do iOS).

   Sem SDK, como o resto do app: são quatro chamadas REST ao /auth/v1 (criar conta,
   entrar, renovar, sair). A sessão fica no localStorage deste navegador; o token dela vai
   no Authorization de toda chamada ao banco (ver sbHeaders), e toda linha enviada leva o
   user_id da conta.

   A chave local e o user_name continuam sendo o nome antigo pra quem recuperou o
   progresso (`henrique`) — os dados deste navegador e as linhas do banco são as de
   sempre — e o uuid da conta pra quem é novo. Os nomes fixos sem senha acabaram:
   qualquer um podia dizer "eu sou o henrique". */
'use strict';

const K_AUTH = 'manman.auth.v1';
let sessaoAuth = load(K_AUTH, null);   // { access, refresh, expira (s), userId, email }
let cadastro = null;                   // a etapa do cadastro em andamento: 'perfil' | 'legado'

// ── a sessão ────────────────────────────────────────────────
function tokenDaSessao() { return sessaoAuth ? sessaoAuth.access : null; }
function guardaSessao(s) { sessaoAuth = s; if (s) save(K_AUTH, s); else localStorage.removeItem(K_AUTH); }
function sessaoDe(j) {
  if (!j || !j.access_token || !j.refresh_token || !j.user || !j.user.id) return null;
  return { access: j.access_token, refresh: j.refresh_token, userId: String(j.user.id).toLowerCase(), email: j.user.email || null,
    expira: j.expires_at || (Date.now() / 1000 + (j.expires_in || 3600)) };
}
async function authPost(caminho, corpo, token) {
  let r;
  try {
    r = await fetch(HW_CONFIG.SUPABASE_URL + '/auth/v1/' + caminho, {
      method: 'POST',
      headers: { apikey: HW_CONFIG.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + (token || HW_CONFIG.SUPABASE_ANON_KEY), 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo || {})
    });
  } catch (e) { throw new Error('Sem conexão. Confira a internet e tente de novo.'); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(erroDoAuth(j, r.status));
  return j;
}
// O GoTrue responde {error_code, msg} na maioria das rotas e {error, error_description}
// na de token. Os códigos são os da documentação do Supabase Auth.
function erroDoAuth(j, status) {
  const c = j.error_code || j.error || '';
  if (c === 'invalid_credentials' || c === 'invalid_grant') return 'E-mail ou senha errados.';
  if (c === 'user_already_exists' || c === 'email_exists') return 'Já existe uma conta com esse e-mail. Toque em Entrar.';
  if (c === 'weak_password') return 'A senha precisa ter pelo menos 6 caracteres.';
  if (c === 'email_address_invalid' || c === 'validation_failed') return 'Esse e-mail não parece válido.';
  if (status === 429 || /rate_limit/.test(c)) return 'Muitas tentativas seguidas. Espere um minuto e tente de novo.';
  return j.msg || j.error_description || j.message || 'Não deu certo (HTTP ' + status + ').';
}
// Renova quando falta menos de um minuto. Duas chamadas ao mesmo tempo esperam a mesma
// renovação: o GoTrue invalida o refresh token usado, e a segunda derrubaria a sessão.
let renovando = null;
async function garanteToken() {
  if (!sessaoAuth || sessaoAuth.expira - Date.now() / 1000 > 60) return;
  if (!renovando) renovando = (async () => {
    try {
      const s = sessaoDe(await authPost('token?grant_type=refresh_token', { refresh_token: sessaoAuth.refresh }));
      if (s) guardaSessao(s);
    } catch (e) {
      // sem rede a sessão fica: o refresh token continua bom e a próxima tentativa acerta
      if (!/Sem conexão/.test(e.message)) guardaSessao(null);
    } finally { renovando = null; }
  })();
  await renovando;
}
// a linha que sobe pro banco leva o dono — o que o RLS da fase 4 vai exigir
function comDono(linha) {
  if (sessaoAuth) linha.user_id = sessaoAuth.userId;
  return linha;
}

// ── o banco da conta ────────────────────────────────────────
async function meuPerfil(id) {
  const r = await fetch(HW_CONFIG.SUPABASE_URL + '/rest/v1/profiles?id=eq.' + id + '&select=id,handle,nome', { headers: sbHeaders() });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return (await r.json())[0] || null;
}
// O nome antigo de uma conta que já recuperou o progresso: a reivindicação pôs o user_id
// dela nas linhas do nome antigo, então uma linha com user_name diferente do uuid É ele.
async function chaveLegada(id) {
  const r = await fetch(HW_CONFIG.SUPABASE_URL + '/rest/v1/progress?user_id=eq.' + id + '&user_name=neq.' + id + '&select=user_name&limit=1', { headers: sbHeaders() });
  if (!r.ok) return null;
  const j = await r.json();
  return j[0] ? j[0].user_name : null;
}

// ── entrar ──────────────────────────────────────────────────
async function entrarComConta(criar) {
  const email = $('lg-email').value.trim(), senha = $('lg-senha').value;
  if (!email || !senha) { erroLogin('Preencha o e-mail e a senha.'); return; }
  carregandoLogin(true);
  try {
    const j = await authPost(criar ? 'signup' : 'token?grant_type=password', { email, password: senha });
    const s = sessaoDe(j);
    // com a confirmação de e-mail religada no painel, o signup devolve só o usuário
    if (!s) throw new Error('A conta foi criada, mas o servidor está pedindo confirmação por e-mail. Avise o Henrique.');
    guardaSessao(s);
    await continuarComConta();
  } catch (e) { erroLogin(e.message); }
  finally { carregandoLogin(false); }
}
// Com sessão: quem já tem perfil entra direto; quem não tem vai criar. Quem já recuperou o
// progresso volta pro nome antigo — e com ele pros dados de sempre deste navegador.
async function continuarComConta() {
  const p = await meuPerfil(sessaoAuth.userId);
  if (!p) { cadastro = 'perfil'; renderLogin(); return; }
  const legado = await chaveLegada(sessaoAuth.userId);
  entraComo(legado || sessaoAuth.userId, p);
}
function entraComo(chave, p) {
  cadastro = null;
  settings.conta = { userId: sessaoAuth.userId, email: sessaoAuth.email, nome: p.nome, handle: p.handle };
  selectUser(chave);
}
async function criarPerfil() {
  const handle = $('lg-handle').value.trim().replace(/^@/, '').toLowerCase(), nome = $('lg-nome').value.trim();
  if (!/^[a-z0-9_.]{3,20}$/.test(handle)) { erroLogin('O @ tem de 3 a 20 letras, números, _ ou ponto.'); return; }
  if (!nome) { erroLogin('Diga o nome que aparece no placar.'); return; }
  carregandoLogin(true);
  try {
    await garanteToken();
    const r = await fetch(HW_CONFIG.SUPABASE_URL + '/rest/v1/profiles', {
      method: 'POST', headers: sbHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify({ id: sessaoAuth.userId, handle, nome })
    });
    if (r.status === 409) { erroLogin('Esse @ já é de outra pessoa. Tente outro.'); return; }
    if (!r.ok) throw new Error('HTTP ' + r.status);
    perfilNovo = { handle, nome };
    cadastro = 'legado';
    renderLogin();
  } catch (e) { erroLogin('Não deu para salvar (' + e.message + '). Tente de novo.'); }
  finally { carregandoLogin(false); }
}
let perfilNovo = null;
// Troca o código pelo progresso antigo: reivindicar_legado põe o user_id da conta nas
// linhas do nome antigo e devolve o nome. Vale no cadastro e depois, pelo Perfil.
async function recuperarProgresso() {
  const codigo = $('lg-codigo').value.trim();
  if (!codigo) { erroLogin('Digite o código.'); return; }
  carregandoLogin(true);
  try {
    await garanteToken();
    const r = await fetch(HW_CONFIG.SUPABASE_URL + '/rest/v1/rpc/reivindicar_legado', {
      method: 'POST', headers: sbHeaders(), body: JSON.stringify({ p_codigo: codigo })
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const nome = await r.json();
    if (!nome) { erroLogin('Esse código não existe ou já foi usado.'); return; }
    // o que a conta nova já estudou com o uuid sobe antes de virar o nome antigo
    if (settings.user && settings.user !== nome) flushDirty();
    entraComo(nome, perfilNovo || settings.conta);
  } catch (e) { erroLogin('Não deu para conferir agora (' + e.message + '). Tente de novo.'); }
  finally { carregandoLogin(false); }
}
function pularRecuperacao() { entraComo(sessaoAuth.userId, perfilNovo); }
function entrarSemConta() { cadastro = null; settings.conta = null; selectUser('convidado'); }
// Sai mesmo sem rede: o token do servidor vence sozinho em uma hora, e o que importa é
// este navegador esquecer a sessão. O progresso local fica, separado pela chave, e volta
// quando a pessoa entrar de novo.
async function sairDaConta() {
  if (!confirm('Sair da conta? O que você estudou neste navegador fica guardado e volta quando entrar de novo.')) return;
  flushDirty();
  const t = tokenDaSessao();
  guardaSessao(null);
  if (t) authPost('logout', {}, t).catch(() => {});
  settings.user = null; settings.conta = null; save(K.settings, settings);
  $('perfilsheet').classList.remove('show');
  cadastro = null;
  mostraLogin();
}

// ── a tela ──────────────────────────────────────────────────
function mostraLogin(aviso) {
  avisoLogin = aviso || '';
  renderLogin();
  $('login').classList.add('show');
}
let avisoLogin = '';
function erroLogin(m) { const e = $('lg-erro'); if (e) { e.textContent = m; e.style.display = m ? '' : 'none'; } }
function carregandoLogin(s) { document.querySelectorAll('#login-box button').forEach(b => { b.disabled = s; }); }
function renderLogin() {
  const box = $('login-box');
  let h = '<div class="zh-big zh">慢慢</div>';
  if (cadastro === 'perfil') {
    h += '<h2>Como você quer aparecer?</h2><p>Seus amigos te acham pelo @ para competir na Turma.</p>' +
      '<label class="lg-campo"><span>@</span><input id="lg-handle" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="seu_nome"></label>' +
      '<input class="lg-input" id="lg-nome" autocomplete="name" placeholder="Nome no placar">' +
      '<p class="lg-nota">O @ tem de 3 a 20 letras, números, _ ou ponto. O nome é o que aparece no placar.</p>' +
      '<div class="lg-erro" id="lg-erro" style="display:none"></div>' +
      '<button class="userbtn lg-principal" id="lg-perfil">Continuar</button>';
  } else if (cadastro === 'legado') {
    h += '<h2>Você já usava o Mànmàn?</h2><p>Se você estudava como Leo, Henrique, David ou Fraga, digite o código que recebeu e o seu progresso volta.</p>' +
      '<input class="lg-input" id="lg-codigo" autocomplete="one-time-code" autocapitalize="none" spellcheck="false" placeholder="código">' +
      '<p class="lg-nota">O código vale uma vez só.</p>' +
      '<div class="lg-erro" id="lg-erro" style="display:none"></div>' +
      '<button class="userbtn lg-principal" id="lg-recupera">Recuperar progresso</button>' +
      (perfilNovo ? '<button class="guestbtn" id="lg-novo">Não, sou novo aqui</button><p class="lg-nota">Dá para recuperar depois, pelo Perfil.</p>'
                  : '<button class="guestbtn" id="lg-volta">Voltar</button>');
  } else {
    h += '<h2>Mànmàn</h2><p>Flashcards de mandarim</p>' +
      (avisoLogin ? '<p class="lg-aviso">' + esc(avisoLogin) + '</p>' : '') +
      '<input class="lg-input" id="lg-email" type="email" autocomplete="email" autocapitalize="none" placeholder="e-mail">' +
      '<input class="lg-input" id="lg-senha" type="password" autocomplete="current-password" placeholder="senha">' +
      '<div class="lg-erro" id="lg-erro" style="display:none"></div>' +
      '<button class="userbtn lg-principal" id="lg-entrar">Entrar</button>' +
      '<button class="userbtn" id="lg-criar">Criar conta</button>' +
      '<p class="lg-nota">A senha precisa ter pelo menos 6 caracteres.</p>' +
      '<button class="guestbtn" id="lg-convidado">Continuar sem conta</button>' +
      '<p class="lg-nota">Sem conta, o progresso fica só neste navegador e você não aparece na Turma.</p>';
  }
  box.innerHTML = h;
  const on = (id, f) => { if ($(id)) $(id).onclick = f; };
  on('lg-entrar', () => entrarComConta(false));
  on('lg-criar', () => entrarComConta(true));
  on('lg-convidado', entrarSemConta);
  on('lg-perfil', criarPerfil);
  on('lg-recupera', recuperarProgresso);
  on('lg-novo', pularRecuperacao);
  on('lg-volta', () => { cadastro = null; $('login').classList.remove('show'); });
  box.querySelectorAll('input').forEach(i => i.onkeydown = e => {
    if (e.key === 'Enter' && !e.isComposing) { const b = box.querySelector('.lg-principal'); if (b) b.click(); }
  });
  const primeiro = box.querySelector('input'); if (primeiro) primeiro.focus();
}
// O bloco da conta na folha de Perfil
function renderContaNoPerfil() {
  const c = settings.conta;
  let h;
  if (c && sessaoAuth) {
    h = '<div class="pf-conta"><span class="profileini">' + esc((c.nome || '?')[0].toUpperCase()) + '</span>' +
      '<span class="info"><b>' + esc(c.nome || '') + '</b><small>@' + esc(c.handle || '') + (c.email ? ' · ' + esc(c.email) : '') + '</small></span></div>';
    if (settings.user === c.userId) h += '<button class="modeopt" id="pf-legado"><span class="zhx">↺</span><span class="info"><b>Já usava o Mànmàn?</b><small>com o código que recebeu, o progresso de antes volta</small></span></button>';
    h += '<button class="modeopt" id="pf-sair"><span class="zhx">⎋</span><span class="info"><b>Sair da conta</b><small>o que você estudou aqui fica guardado neste navegador</small></span></button>';
  } else {
    h = '<button class="modeopt" id="pf-entrar"><span class="zhx">→</span><span class="info"><b>Entrar ou criar conta</b><small>sem conta, o progresso fica só neste navegador e você não aparece na Turma</small></span></button>';
  }
  $('pf-conta').innerHTML = h;
  if ($('pf-sair')) $('pf-sair').onclick = sairDaConta;
  if ($('pf-entrar')) $('pf-entrar').onclick = () => { $('perfilsheet').classList.remove('show'); mostraLogin(); };
  if ($('pf-legado')) $('pf-legado').onclick = () => { $('perfilsheet').classList.remove('show'); perfilNovo = null; cadastro = 'legado'; mostraLogin(); };
}
// Na Turma, o nome de quem aparece: os quatro de antes pelo nome de sempre; conta nova
// pelo nome do perfil (que só quem está logado consegue ler).
let nomesDaTurma = {};
async function carregaNomesDaTurma() {
  if (!sessaoAuth) return;
  try {
    const r = await fetch(HW_CONFIG.SUPABASE_URL + '/rest/v1/profiles?select=id,nome', { headers: sbHeaders() });
    if (r.ok) (await r.json()).forEach(p => { nomesDaTurma[p.id] = p.nome; });
  } catch (e) { /* sem nome, aparece o genérico */ }
}
function nomeDe(u) {
  if (USERS[u]) return USERS[u];
  if (nomesDaTurma[u]) return nomesDaTurma[u];
  if (settings.conta && u === settings.user) return settings.conta.nome;
  return /^[0-9a-f-]{36}$/.test(u || '') ? 'Alguém' : u;
}

exEstilo(`
.login-box .zh-big{color:var(--red);}
.lg-input,.lg-campo{display:flex;align-items:center;width:100%;box-sizing:border-box;margin:0 0 10px;border:1px solid var(--line);
  border-radius:14px;background:var(--surface);color:var(--txt);font:inherit;font-size:16px;padding:13px 14px;}
.lg-campo{padding:0 0 0 14px;gap:4px;}
.lg-campo span{color:var(--mut);font-weight:700;}
.lg-campo input{flex:1;border:0;background:none;color:var(--txt);font:inherit;font-size:16px;padding:13px 14px 13px 0;outline:none;min-width:0;}
.lg-input:focus,.lg-campo:focus-within{border-color:var(--red);outline:none;}
.login-box .lg-nota{font-size:12.5px;color:var(--soft);margin:-2px 0 14px;}
.login-box .lg-aviso{background:var(--warn-bg);color:var(--txt);border-radius:12px;padding:10px 12px;font-size:13.5px;text-align:left;}
.lg-erro{background:var(--err-bg);color:var(--err);border-radius:12px;padding:9px 12px;font-size:13.5px;font-weight:600;margin:0 0 10px;text-align:left;}
.lg-principal{background:var(--red);border-color:var(--red);color:#fff;}
.login-box button:disabled{opacity:.6;cursor:default;}
.pf-conta{display:flex;align-items:center;gap:12px;padding:6px 4px 12px;}
.pf-conta .info{display:flex;flex-direction:column;gap:2px;min-width:0;}
.pf-conta .info small{color:var(--mut);overflow:hidden;text-overflow:ellipsis;}
`);
