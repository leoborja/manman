/* Mànmàn — O estado da conta: o que não é progresso de carta mas tem que seguir a pessoa
   de um aparelho pro outro. Tabela `estado` do Supabase, uma linha por conta e por chave,
   com o mapa inteiro num jsonb. O formato de cada chave é o do app iOS — está em
   Apps/Manman/docs/estado-da-conta.md, e os dois lados têm que concordar com ele.

   Esta web cuida de quatro chaves:
     teoria_lida    { nota: ms }                      — mescla: o maior
     exercicios     { folha: { u, feito, parado } }   — mescla: por folha, o u maior
     licoes         { id: Lembrete do iOS + u }        — mescla: por lição, o u maior
     licoes_feitas  { id: 'YYYY-MM-DD' }              — mescla: a data maior
     dias_de_licao  { dia: {feitas, total, parcial} }  — mescla: o placar que andou mais
     evolucao       { dia: {cap, deck, hab, u} }      — mescla: por dia, o u maior
                    (só a web grava; o iOS ainda não lê — ver js/progresso.js)
   As outras (sons_ouvidos, trocas) são de telas que a web ainda não tem: ela nunca as
   grava, então não tem como estragar.

   Gravar é ler, mesclar e subir a união — o upsert troca o `valor` inteiro, e o que o
   outro aparelho gravou e este ainda não puxou sumiria. Sem conta, nada sobe. */
'use strict';

const K_ESTADO_SUJO = 'manman.estado.sujo.v1'; // por usuário: as chaves que ainda não subiram
const ESTADO_LOCAL = {
  teoria_lida: () => K_TEORIA_LIDA,
  exercicios: () => K_EX,
  licoes: () => K_LICOES,
  licoes_feitas: () => K_LICOES_FEITAS,
  dias_de_licao: () => K_DIAS_LICAO,
  evolucao: () => K_EVOLUCAO
};
const PEGA_MAIOR = (a, b) => (a >= b ? a : b);
function mesclaEstado(chave, a, b) {
  a = a || {}; b = b || {};
  const out = Object.assign({}, a);
  for (const k of Object.keys(b)) {
    const x = a[k], y = b[k];
    if (x === undefined || x === null) { out[k] = y; continue; }
    if (y === undefined || y === null) continue;
    if (chave === 'teoria_lida' || chave === 'licoes_feitas') out[k] = PEGA_MAIOR(x, y);
    else if (chave === 'dias_de_licao') out[k] = melhorDia(x, y);
    else out[k] = ((y.u || 0) > (x.u || 0)) ? y : x; // por item: a mudança mais nova vence
  }
  return out;
}
// O placar de um dia só cresce durante o dia: vale o que andou mais (feitas + o que
// ficou pela metade); empatou, o de mais lições; empatou de novo, o de lá.
function melhorDia(a, b) {
  const nota = d => (d && typeof d === 'object') ? (d.feitas || 0) + Object.values(d.parcial || {}).reduce((s, v) => s + v, 0) : -1;
  if (nota(a) !== nota(b)) return nota(a) > nota(b) ? a : b;
  return ((a && a.total) || 0) > ((b && b.total) || 0) ? a : b;
}
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function estadoLocal(chave) { return load(uk(ESTADO_LOCAL[chave]()), {}); }
function sujos() { return load(uk(K_ESTADO_SUJO), []); }

// Puxa todas as chaves de uma vez e junta com o que este navegador tem. Se o daqui tinha
// alguma coisa que o banco não tinha, a chave fica suja e sobe — é assim que o que foi
// feito antes da sincronização existir chega ao iPhone. Devolve se mudou algo na tela.
async function pullEstado() {
  if (!syncEnabled()) return false;
  let linhas;
  try { linhas = await sbTodas('estado?select=chave,valor&order=chave.asc'); }
  catch (e) { return false; } // sem rede ou sem a tabela: segue com o local
  const remoto = {};
  linhas.forEach(l => { remoto[l.chave] = l.valor; });
  let mudou = false;
  const s = new Set(sujos());
  for (const chave of Object.keys(ESTADO_LOCAL)) {
    const local = estadoLocal(chave), r = remoto[chave] || {};
    const junto = mesclaEstado(chave, local, r);
    if (!igual(junto, local)) { save(uk(ESTADO_LOCAL[chave]()), junto); mudou = true; }
    if (!igual(junto, r)) s.add(chave);
  }
  save(uk(K_ESTADO_SUJO), [...s]);
  flushEstado();
  return mudou;
}
async function pushEstado(chave) {
  if (!syncEnabled()) return;
  const base = HW_CONFIG.SUPABASE_URL + '/rest/v1/estado';
  try {
    const r0 = await fetch(base + '?chave=eq.' + chave + '&select=valor', { headers: sbHeaders() });
    if (!r0.ok) throw new Error('HTTP ' + r0.status);
    const [linha] = await r0.json();
    const junto = mesclaEstado(chave, estadoLocal(chave), linha && linha.valor);
    save(uk(ESTADO_LOCAL[chave]()), junto);
    // user_id vem do default auth.uid() da tabela; mandá-lo também deixa claro de quem é
    const r = await fetch(base + '?on_conflict=user_id,chave', {
      method: 'POST',
      headers: sbHeaders({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify(comDono({ chave, valor: junto }))
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    save(uk(K_ESTADO_SUJO), sujos().filter(c => c !== chave));
  } catch (e) { /* fica suja e tenta de novo na próxima vez */ }
}
let estadoTimer = null;
// Marca a chave e sobe logo depois: uma rodada de teoria marca várias notas seguidas, e
// um push por nota seria uma ida ao banco por toque.
function marcaEstado(chave) {
  const s = sujos();
  if (!s.includes(chave)) { s.push(chave); save(uk(K_ESTADO_SUJO), s); }
  clearTimeout(estadoTimer);
  estadoTimer = setTimeout(flushEstado, 1500);
}
function flushEstado() {
  if (!syncEnabled()) return;
  sujos().forEach(pushEstado);
}
// Depois de puxar: a tela que está aberta mostra o que chegou do iPhone.
function redesenhaEstado() {
  const v = document.querySelector('.view.active');
  if (!v) return;
  if (v.id === 'view-curso') renderCurso();
  if (v.id === 'view-hoje') renderHoje();
}
