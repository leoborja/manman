# Mànmàn 慢慢 — Flashcards de Mandarim

App de flashcards pra turma de mandarim do Enrico — **Leo, Henrique e David**.

**慢慢 (mànmàn)** = "devagar, com calma" — como em 慢慢来 (mànmàn lái, "vai com calma").
Um pouquinho todo dia é assim que se aprende mandarim.

🔗 **App:** https://leoborja.github.io/manman/

## Instalar no celular

- **iPhone:** abrir o link no **Safari** → botão Compartilhar → **Adicionar à Tela de Início**
- **Android:** abrir no Chrome → menu ⋮ → **Instalar app**

Vira um app de verdade: ícone 慢, tela cheia, funciona offline. **Atualiza sozinho** — toda vez que abre com internet, busca a versão mais nova (se parecer teimoso, feche o app no multitarefa e abra de novo).

## Primeiro acesso

Escolha seu nome (Leo / Henrique / David). O progresso é individual e **sincroniza entre aparelhos** — estudou no ônibus, continua no computador.

## 学 Estudar — como funciona

A fila é **contínua**: primeiro as revisões vencidas, depois as palavras novas, e quando acaba o agendado o app **emenda direto na prática livre** (deck inteiro embaralhado, infinito). Você só abre e estuda.

Toque no cartão pra revelar, depois marque:

| Botão | Efeito |
|---|---|
| **Errei** | volta ainda nesta sessão (e sempre reagenda, até na prática) |
| **Difícil** | intervalo cresce pouco |
| **Acertei** | 1 dia → 3 dias → e vai multiplicando (repetição espaçada) |

Na fase de prática, "Difícil/Acertei" mostram **"prática"** e não mexem no cronograma — só o "Errei" vale, porque esquecer é informação real. Mas **toda** carta avaliada conta no contador do dia, nas duas fases: até 20/08 a prática só registrava os erros, o que fazia acertar valer zero pra meta e pro streak.

### Meta diária e streak

Meta de **30 revisões/dia** — é piso, não teto: passou de 30, o contador mostra o excedente (`+7`) e você segue o quanto quiser. O 🔥 no cabeçalho fica apagado até bater a meta e acende quando fecha o dia.

O streak conta dias fechados. A regra antiga era "≥1 revisão", barata demais (um dia de 2 revisões contava igual a um de 39). A meta vale a partir de **20/08**, que é o primeiro dia com o contador correto — até 19/08 a prática livre só registrava erros, então aqueles números estão subestimados e não podem ser julgados por meta nenhuma. Antes dessa data vale a regra antiga. Está no `META_DESDE` do `app.js`.

A meta começou em 20 e subiu pra 30 no mesmo dia da correção do contador: os 20 tinham sido calibrados em números que ignoravam a prática livre.

### Filtro (por tema / por aula)

O seletor acima dos chips troca o que a linha filtra: **por tema** (Números, Pronomes, Úteis…) ou **por aula** (a data em que a palavra entrou, de `data_aula`). Uma fileira só, alternando — duas fileiras de chips empilhadas comeriam a tela do celular. A escolha fica salva por usuário.

### Modos (botão MODO)

| Modo | Frente | Revela |
|---|---|---|
| 汉字 → pinyin + tradução | ideograma | tudo de uma vez |
| 汉字 → pinyin → tradução | ideograma | pinyin no 1º toque, tradução no 2º |
| tradução → 汉字 | português | ideograma + pinyin |
| pinyin → 汉字 | pinyin | ideograma + tradução |
| 🎧 **Só áudio** | nada na tela, só o som | ideograma + pinyin + tradução |
| 🔀 aleatório | mistura as direções | |
| 🎯 **Quiz de tons** | áudio + ideograma | você escolhe o tom (1º ˉ 2º ˊ 3º ˇ 4º ˋ neutro) |

No seletor de modo também ficam duas chaves: **"Falar ao revelar"** (áudio automático) e o **"⚡ Relâmpago"**, abaixo.

### ⚡ Relâmpago

Não é um modo, é uma **chave que liga por cima do modo escolhido** — 汉字 → pinyin, tradução → 汉字, só áudio, aleatório, qualquer um. Ligada, o MODO mostra o raio na frente do nome.

A carta aparece com uma **barra de tempo correndo**. Toque assim que reconhecer: conta **"⚡ na hora"**. Deixou a barra acabar: **"⏱ passou batido"** e a resposta fica na tela um pouco mais, porque é aí que você precisa aprender. Ninguém julga se você "acertou" — o app só mede se veio na hora ou não. A ideia é sair do pensar e entrar no reconhecer.

- **Tempo**: 1s / 2s / 3s, escolhido ali mesmo. Padrão 2s — 1s é bem duro com duas semanas de mandarim, e 3s já dá pra *pensar*, que é justamente o que a chave quer evitar.
- **⏸ Pausa** ao lado da barra. Segura o relógio da pergunta **e** o tempo da resposta na tela — pausar só a pergunta deixaria a resposta fugindo bem quando você quis parar. Pausado, tocar na carta não vale como resposta: é pra poder olhar à vontade.
- **Não mexe em nada.** Não grava agendamento, não conta pra meta de 30, não sobe pro Supabase. É treino de reflexo, e "não deu tempo" não é a mesma coisa que não saber a palavra. Sair da aba ou bloquear o celular congela o relógio — senão a rodada passava sozinha no bolso.
- É uma **rodada fechada** do deck filtrado, embaralhada, com placar no fim. Não emenda na prática livre.
- **Fora do quiz de tons**: lá responder já é escolher um botão de tom, então a chave aparece apagada.
- Nessa chave o ideograma do verso vem **em texto, sem o traçado animado** — o traçado leva ~1s pra desenhar e apareceria pela metade.

### Recursos nas cartas

- **Traçado animado**: o ideograma se desenha traço a traço na ordem oficial; toque nele pra repetir
- **🔊 Pronúncia**: voz chinesa do próprio aparelho, na frente e no verso
- **Pinyin colorido por tom**: 1º vermelho · 2º laranja · 3º verde · 4º azul · neutro cinza
- **🚫 desligar esta carta**: tira da rotação (religa na aba Cartas) — individual por usuário

## 卡 Cartas

Consulta: busca, filtro por categoria, 🔊 por linha e o switch liga/desliga de cada carta.

Palavras novas entram pelo `seed/seed_cards.json` e são publicadas pelo `seed.py` — aparecem pra todo mundo sem ninguém atualizar nada.

## 🔥 Progresso

Total de palavras no deck, revisões de hoje, novas disponíveis, aprendidas (agendadas pra 21+ dias), sequência de dias 🔥, gráfico das suas últimas 2 semanas e o **gráfico da turma** (uma linha por pessoa, ordenado por total — barra cheia = dia em que bateu a meta). Toque ou passe o mouse nas barras pra ver o número. "Zerar meu progresso" apaga local + nuvem (só o seu).

## Estrutura técnica

| Arquivo | O quê |
|---|---|
| `index.html` + `app.js` | app inteiro — HTML/CSS/JS puro, sem build, sem dependências |
| `config.js` | URL + anon key do Supabase (pública por design; RLS protege) |
| `seed/seed_cards.json` | **a fonte de verdade do deck** — editado à mão; o banco é a cópia (ver o fluxo abaixo) |
| `supabase/schema.sql` | tabelas `cards` (read-only via anon), `progress`, `review_log` |
| `supabase/seed.py` | upsert do seed no banco (service key) |
| `fonts/hanzi.woff2` | fonte caligráfica 楷书 (AR PL UKai CN, subset ~24KB; licença em `fonts/ARPHICPL.txt`) |
| `strokes/strokes.json` | traçados dos caracteres (makemeahanzi) |
| `audio/nativo/*.mp3` | **em uso** — gravações de falantes nativos (Wikimedia/Shtooka); créditos em `audio/nativo/CREDITS.md` |
| `audio/nativo/CREDITS.md` | atribuição por arquivo — autor, licença e qual caractere foi gravado |
| `tools/` | `build_font.py`, `build_strokes.py`, `build_audio_nativo.py`, `build_audio.py` |
| `sw.js` + `manifest.webmanifest` | PWA network-first (sempre fresco online, funciona offline) |

### Por onde o conteúdo anda

O sentido é único, e o nome do arquivo engana: apesar de se chamar "seed", o JSON **não é cópia do banco** — é o original.

```
seed/seed_cards.json  ──(supabase/seed.py)──▶  Supabase  ──(fetch)──▶  app
        ↑                                                                 │
   editado à mão                        cai de volta no JSON só se o banco falhar
```

Três consequências:

- **Editar pelo painel do Supabase é perda de tempo.** O próximo `seed.py` sobrescreve com o que está no JSON.
- **Nem toda coluna é do JSON.** O `seed.py` manda 9 campos (`id, hanzi, pinyin, pt, deck, tags, nota, data_aula, created_by`). O `audio_url` fica **de fora** de propósito — é por isso que rodar o seed não desliga as gravações nativas. Quem escreve nele é só o `build_audio_nativo.py`.
- **Apagar não propaga.** O upsert insere e atualiza, nunca remove. Tirar uma palavra do JSON deixa ela viva no banco e no app. A coluna `deleted` existe no schema e o app já filtra por ela, mas o `seed.py` ainda não a marca — hoje some só editando o banco à mão.

### Adicionar palavras novas (fluxo do Leo)

1. Editar `seed/seed_cards.json` — preencher `data_aula` (`"2026-08-13"`) com o dia da aula; deixar de fora se a palavra veio por fora da aula
2. `source ~/Documents/codes/cloud_local/manman_supabase.env && python3 supabase/seed.py`
3. Caractere novo? `python3 tools/build_font.py` e `python3 tools/build_strokes.py`
4. `python3 tools/build_audio_nativo.py` — baixa a gravação nativa das cartas novas e liga o `audio_url` (precisa das mesmas variáveis do passo 2 e do `ffmpeg`)
5. Commit + push — **os MP3s precisam estar publicados**, senão o `audio_url` aponta pra 404

Rodou o `schema.sql` antes da V2.3? Ele é idempotente — rodar de novo só adiciona a coluna `data_aula`, não apaga nada.

Rodar local: `python3 -m http.server 8080` → http://localhost:8080/ (debug de datas: `?debug=1`).

## Trabalhando junto — leia antes do primeiro commit

Rodar local não exige nada: é HTML/JS puro, sem build e sem dependências.

```bash
git clone https://github.com/leoborja/manman.git && cd manman
python3 -m http.server 8080     # → http://localhost:8080/  (datas: ?debug=1)
```

### Funcionalidade (`app.js`, `index.html`) → branch + PR

```bash
git checkout -b henrique/nome-da-melhoria
# edita, commita
git push -u origin henrique/nome-da-melhoria
gh pr create --base main
```

Merge no PR e o GitHub Pages publica sozinho — **`main` é o que está no ar**, então ele nunca pode ficar quebrado.

- **Branches curtas.** O `app.js` muda quase todo dia; branch parada duas semanas vira merge desagradável. Entregue de pouco em pouco e rode `git pull --rebase origin main` com frequência.
- **Não commite arquivo gerado**: `fonts/hanzi.woff2`, `strokes/strokes.json`, `audio/nativo/*.mp3`. Quem mexe em funcionalidade não precisa gerar nenhum deles — se aparecerem no seu `git status`, você rodou um script à toa. São binário (ou JSON de linha única), que o git não sabe fazer merge: dois PRs que os regerem conflitam de um jeito que ninguém resolve à mão.

### Conteúdo (palavras novas) → direto no `main`

Vai direto porque editar o JSON é só metade: em seguida tem que rodar o pipeline (seed, fonte, traçado, áudio) e publicar junto, senão o `audio_url` aponta pra 404. O passo a passo está em "Adicionar palavras novas" acima.

Se for mandar palavra por PR, mande **só o `seed_cards.json`** — o resto é reconstruído no `main` depois do merge.

### Três avisos

- **A `SUPABASE_SERVICE_KEY` ignora o RLS por completo** — quem a tem pode apagar o deck e sobrescrever o progresso de todo mundo, e não dá pra revogar de uma pessoa só. Ela não é necessária pra mexer no app: só o `seed.py` e o passo final do `build_audio_nativo.py` usam. A anon key do `config.js` é outra coisa, pública por design.
- **Não rode `tools/build_audio.py`.** É o da ElevenLabs, desativado — ele sobrescreve o `audio_url` de **todas** as cartas e desliga as 51 gravações nativas de uma vez.
- **Nada de PDF no git.** O `.gitignore` barra `*.pdf` porque o livro do professor fica na pasta do projeto e o repositório é público.

## Licenças dos ativos de terceiros

Todas permitem **uso comercial**. O que elas exigem está cumprido assim:

| Ativo | Licença | O que a licença exige | Onde está cumprido |
|---|---|---|---|
| `fonts/hanzi.woff2` | Arphic PL | manter a licença junto (§1); avisar como e quando foi modificado (§2a); manter a modificação disponível (§2b) | `fonts/ARPHICPL.txt`; aviso na tabela `name` da fonte; repo público + link na tela Créditos |
| `strokes/strokes.json` | Arphic PL (via makemeahanzi, derivado da AR PL KaitiM GB) | idem | `strokes/ARPHICPL.txt`; aviso na chave `_` do JSON |
| `audio/nativo/*.mp3` (45) | CC BY 2.0 FR | atribuição | tela Créditos + `audio/nativo/CREDITS.md` |
| `audio/nativo/*.mp3` (7) | CC BY-SA 3.0 US | atribuição; share-alike **só em obra derivada** | idem — a conversão ogg→mp3 é mudança de formato, permitida pela §3 sem virar derivada |

A Arphic PL **não contamina o app**: a §2 exclui explicitamente as partes que não derivam da fonte
("mere aggregation ... does not bring the other work under the scope of this License").
O `index.html` e o `app.js` podem ser fechados.

Os MP3s da ElevenLabs foram apagados em 14/08: não estavam em uso e o direito comercial
sobre eles depende do plano da conta.

## Decisões de produto (histórico)

- Deck contém **só o que a turma já aprendeu** — sem limite de novas/dia
- Partículas (吗/呢) faladas **sozinhas** e fora do quiz de tons (isoladas, o TTS falaria tom cheio contradizendo o gabarito neutro)
- Voz: **gravação de falante nativo** (Wikimedia/Shtooka) nas cartas que têm; TTS do aparelho no resto. O professor apontou que o TTS não faz o 3º tom completo — só a descida, sem a subida. Teste cego com 好 confirmou: a gravação humana ganhou de todas as opções de TTS (voz, velocidade, pontuação) e da ElevenLabs
- Gravação de homófono é aceita: os arquivos do Commons são nomeados por pinyin, então 九 jiǔ recebe a gravação de 久 jiǔ. Som idêntico, que é o que importa pra tom e pronúncia — o `CREDITS.md` registra quais são
- Light mode padrão; fonte caligráfica porque a de imprensa não batia com a escrita à mão do professor
- Fonte trocada de LXGW WenKai (traço macio, base japonesa) para **AR PL UKai CN** — 楷书 de pincel, mais clássico
- Modo "só áudio" fora do 🔀 aleatório: sem voz chinesa no aparelho a carta viraria beco sem saída
- Aula gravada como **data** (`data_aula`), não número — a data já existe, não precisa de controle manual de numeração. Coluna e não tag: ordena certo e vira filtro sem parsing

## Roadmap

- [x] ~~Ranking da turma~~ — gráfico "A turma · últimos 14 dias" no Progresso, ordenado por total (18/08)
- [ ] Aba Progresso turbinada (heatmap, taxa de acerto, previsão)
- [x] ~~Reativar voz gravada~~ — resolvido com gravação nativa do Wikimedia (14/08)
- [ ] Áudio das 6 sem gravação (妈, 森, 丁 e os 3 nomes) — caem no TTS. Provavelmente **fechar sem fazer nada**: o problema do TTS é 3º tom isolado, e nenhuma das seis é esse caso
- [x] ~~Filtro por aula na tela de estudo~~ — feito em 17/08
- [x] ~~Treino de reconhecimento rápido~~ — chave **⚡ Relâmpago** por cima de qualquer modo, com pausa (21/08)
- [ ] Radical/decomposição nas cartas
- [ ] **Domínio próprio** — `manman.com.br` já registrado (Cloud Arbitration). Ordem: DNS primeiro (4 registros `A` da raiz pra `185.199.108.153`, `.109.153`, `.110.153`, `.111.153` e `CNAME` do `www` pra `leoborja.github.io`), depois o domínio em Settings → Pages, depois **Enforce HTTPS** (sem isso o PWA não instala). Três detalhes:
  - Se o DNS for pela Cloudflare, mantenha a **nuvem cinza** até o GitHub emitir o certificado — com o proxy ligado ele não valida o domínio. Só depois, se quiser proxy, use SSL **Full (strict)**: no Flexible dá loop de redirecionamento.
  - Com proxy ligado, exclua `app.js`, `index.html` e `config.js` do cache. O service worker é network-first e conta com o servidor devolver a versão nova.
  - `localStorage` é por origem: no domínio novo o app abre com progresso zerado, mas **recupera** ao escolher o nome — o `syncPull` aceita o que vem do Supabase quando não há estado local. Só as preferências de tela (modo, tema, filtro) voltam ao padrão. Avisar os três pra reinstalar o atalho na tela de início.
