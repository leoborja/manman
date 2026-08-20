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

No seletor de modo também fica o **"Falar ao revelar"** (áudio automático, liga/desliga).

### Recursos nas cartas

- **Traçado animado**: o ideograma se desenha traço a traço na ordem oficial; toque nele pra repetir
- **🔊 Pronúncia**: voz chinesa do próprio aparelho, na frente e no verso
- **Pinyin colorido por tom**: 1º vermelho · 2º laranja · 3º verde · 4º azul · neutro cinza
- **🚫 desligar esta carta**: tira da rotação (religa na aba Cartas) — individual por usuário

## 卡 Cartas

Consulta: busca, filtro por categoria, 🔊 por linha e o switch liga/desliga de cada carta.

**Quem adiciona palavras é o Leo** (direto no banco, após cada aula) — aparecem pra todo mundo sem atualizar nada.

## 🔥 Progresso

Revisões de hoje, novas disponíveis, aprendidas (agendadas pra 21+ dias), sequência de dias 🔥 e gráfico das últimas 2 semanas. "Zerar meu progresso" apaga local + nuvem (só o seu).

## Estrutura técnica

| Arquivo | O quê |
|---|---|
| `index.html` + `app.js` | app inteiro — HTML/CSS/JS puro, sem build, sem dependências |
| `config.js` | URL + anon key do Supabase (pública por design; RLS protege) |
| `seed/seed_cards.json` | espelho do deck (fallback offline e fonte dos scripts) |
| `supabase/schema.sql` | tabelas `cards` (read-only via anon), `progress`, `review_log` |
| `supabase/seed.py` | upsert do seed no banco (service key) |
| `fonts/hanzi.woff2` | fonte caligráfica 楷书 (AR PL UKai CN, subset ~10KB; licença em `fonts/ARPHICPL.txt`) |
| `strokes/strokes.json` | traçados dos caracteres (makemeahanzi) |
| `audio/nativo/*.mp3` | **em uso** — gravações de falantes nativos (Wikimedia/Shtooka); créditos em `audio/nativo/CREDITS.md` |
| `audio/nativo/CREDITS.md` | atribuição por arquivo — autor, licença e qual caractere foi gravado |
| `tools/` | `build_font.py`, `build_strokes.py`, `build_audio_nativo.py`, `build_audio.py` |
| `sw.js` + `manifest.webmanifest` | PWA network-first (sempre fresco online, funciona offline) |

### Adicionar palavras novas (fluxo do Leo)

1. Editar `seed/seed_cards.json` — preencher `data_aula` (`"2026-08-13"`) com o dia da aula; deixar de fora se a palavra veio por fora da aula
2. `source ~/Documents/codes/cloud_local/manman_supabase.env && python3 supabase/seed.py`
3. Caractere novo? `python3 tools/build_font.py` e `python3 tools/build_strokes.py`
4. `python3 tools/build_audio_nativo.py` — baixa a gravação nativa das cartas novas e liga o `audio_url` (precisa das mesmas variáveis do passo 2 e do `ffmpeg`)
5. Commit + push — **os MP3s precisam estar publicados**, senão o `audio_url` aponta pra 404

Rodou o `schema.sql` antes da V2.3? Ele é idempotente — rodar de novo só adiciona a coluna `data_aula`, não apaga nada.

Rodar local: `python3 -m http.server 8080` → http://localhost:8080/ (debug de datas: `?debug=1`).

## Licenças dos ativos de terceiros

Todas permitem **uso comercial**. O que elas exigem está cumprido assim:

| Ativo | Licença | O que a licença exige | Onde está cumprido |
|---|---|---|---|
| `fonts/hanzi.woff2` | Arphic PL | manter a licença junto (§1); avisar como e quando foi modificado (§2a); manter a modificação disponível (§2b) | `fonts/ARPHICPL.txt`; aviso na tabela `name` da fonte; repo público + link na tela Créditos |
| `strokes/strokes.json` | Arphic PL (via makemeahanzi, derivado da AR PL KaitiM GB) | idem | `strokes/ARPHICPL.txt`; aviso na chave `_` do JSON |
| `audio/nativo/*.mp3` (26) | CC BY 2.0 FR | atribuição | tela Créditos + `audio/nativo/CREDITS.md` |
| `audio/nativo/*.mp3` (3: 木, 林, 困) | CC BY-SA 3.0 US | atribuição; share-alike **só em obra derivada** | idem — a conversão ogg→mp3 é mudança de formato, permitida pela §3 sem virar derivada |

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
- [ ] Áudio das 5 sem gravação (妈, 森 e os 3 nomes) — hoje caem no TTS
- [x] ~~Filtro por aula na tela de estudo~~ — feito em 17/08
- [ ] Radical/decomposição nas cartas · domínio próprio
