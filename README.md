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

Depois disso, quem guarda esse estado é o **botão redondo do topo**, com a sua inicial: ele abre o **perfil**, onde se troca de nome e se escolhe **claro ou escuro**. São as duas coisas que se ajustam uma vez e esquecem, então dividem uma folha só em vez de ocupar dois botões fixos no cabeçalho.

As três telas — **Estudar**, **Cartas**, **Progresso** — ficam num **controle segmentado** logo abaixo do cabeçalho e acima dos chips, que é a ordem em que a escolha acontece: primeiro em que tela estou, depois o que ela filtra. Um controle só, e não três botões soltos: são três estados da mesma escolha e só um vale por vez. Só texto, sem ícone e sem duas linhas — assim a barra ocupa 40px em vez de 62 e a carta começa mais alto.

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

**🏷️ tema** (Números, Pronomes, Úteis…) ou **📅 aula** (a data em que a palavra entrou, de `data_aula`). Os dois ícones **abrem a própria linha dos chips** e ficam presos na esquerda quando ela rola: são eles que dizem de que lista os chips do lado saíram. São pílulas do mesmo tamanho dos chips, mas o "ligado" aqui é neutro (contorno escuro) e não vermelho — vermelho é a coisa **escolhida** na fila, estes dois só dizem **que fila é**. Uma fileira só, alternando: duas fileiras empilhadas comeriam a tela do celular. A escolha fica salva por usuário.

### 💬 Frases

Uma frase **é** uma carta: mesmos campos, mesmo SRS, mesma sincronização, e conta na mesma meta de 30. O que separa as duas é a **fila** — palavra e frase nunca se misturam numa sessão, porque frase chega em bloco (uma aula inteira de uma vez) e afogaria o vocabulário em cartas novas.

Por isso "Palavras / Frases" **não é um quarto ícone** ao lado de 🏷️📅❌. Aqueles três são *eixos de fatiar a mesma lista*; este escolhe **qual lista é**. Fica um nível acima deles, dentro do "O que estudar", e assim "as frases da aula de 06/08" e "as frases que eu mais erro" continuam existindo. Enquanto o deck não tiver frase nenhuma a linha inteira some — botão que abre sessão vazia é pior que botão nenhum.

**Três dos seis modos ficam de fora, e sozinhos.** Desenho e os dois quizzes de tom pedem palavra de um caractere: a grade 田字格 é uma só e o tom é de uma sílaba. Eles já se excluíam antes de existir frase, então não foi preciso ensinar nada a eles — só sumiram do seletor, em vez de abrir uma sessão vazia e explicar depois. Sobra o que a frase sabe responder: virar a carta, o teclado e o 🧩 ordenar.

**A carta passou a medir a própria altura.** As duas faces são absolutas — é o que permite empilhar frente e verso pra virada — então o cartão nunca cresceu com o conteúdo: cada modo declarava um número fixo. Com palavra isso nunca apareceu (好 cabe em qualquer altura); com frase, sim: nove caracteres com traçado quebram em três fileiras, o pinyin vira duas linhas e a nota é um parágrafo, e como a face é centralizada o que não cabia vazava pelos **dois** lados. Agora a altura sai da soma do conteúdo, medida nas duas faces ao mesmo tempo — virar não pode mudar o tamanho da carta no meio da animação, senão a página pula embaixo do dedo justo quando a pessoa foi ler a resposta. Frase curta continua no mínimo do modo; quem precisa, cresce.

**O áudio da frase é o TTS, e aqui isso é bom.** O defeito conhecido da voz sintética é o 3º tom **isolado** — só a descida, sem a subida. Numa frase inteira não existe sílaba isolada, então o problema que tirou o TTS das palavras não aparece.

### 🧩 Ordenar as palavras

A frase ensina uma coisa que a palavra não ensina: **ordem**. 不 antes do verbo, o tempo antes do lugar, o 是 que só liga substantivo a substantivo. Nenhum dos outros modos cobra isso — virar a carta cobra reconhecimento, o teclado cobra o ideograma.

Você vê o português, as palavras da frase aparecem embaralhadas em pílulas, e monta tocando nelas em ordem. Tocar de novo numa que já está na frase devolve ela pro monte — o desfazer não precisa de botão próprio. O "conferir" só libera com a frase inteira montada: meia frase não é resposta errada, é resposta pela metade.

No resultado, a ordem certa vem em cima e a **sua** embaixo, com cada peça verde ou vermelha conforme tenha caído na mesma posição. Como no desenho e no teclado, a nota **sugere** um botão e quem decide é você — é revisão normal, conta na meta e mexe no agendamento.

**A segmentação não é campo preenchido à mão.** O pinyin já vem separado por palavra (`Wǒ shì Bāxī rén`) e cada sílaba de pinyin é exatamente um caractere — então contar as sílabas de cada pedaço entrega `我 | 是 | 巴西 | 人` sozinho. É a mesma escolha da pronúncia aproximada: calcular em vez de digitar, pra que frase nova não precise de campo novo nem de migração no banco. Quando a conta não fecha (儿 de 哪儿 é caractere sem sílaba própria) a frase simplesmente não aparece neste modo — exercício ausente é melhor que exercício errado. A saída manual, pra frase que insista, é o campo `seg` da carta: `"我|是|巴西|人"`.

As peças são identificadas por chave e não pelo que está escrito nelas, porque frase repete palavra: 对不对 tem dois 对, e sem chave própria clicar num moveria o outro.

### Modos (botão MODO)

São **cinco modos**, e só um deles vira a carta. Nos outros quatro responder é uma **ação** — digitar, desenhar, marcar o tom. Mais o **🔀 Aleatório**, que não é um sexto exercício: é um sorteio entre quatro deles, carta a carta.

| Modo | Frente | Como se responde |
|---|---|---|
| 🔀 **Aleatório** | sorteia um dos quatro a cada carta | do jeito do modo sorteado |
| ⌨️ **tradução → escrever no teclado** | português | escreve o 汉字 (ou a frase) no teclado de mandarim do aparelho |
| 🧩 **tradução → ordenar as palavras** *(só frase)* | português | toca nas palavras embaralhadas na ordem certa |
| **汉字 → pinyin + tradução** | ideograma | toca na carta e ela vira, revelando tudo de uma vez |
| ✍️ **pinyin + tradução + áudio → desenhar 汉字** | o som (escrito e falado) e o significado | escreve o ideograma na grade |
| 🎯 **汉字 → tom** | ideograma, em silêncio | marca o tom (1º ˉ 2º ˊ 3º ˇ 4º ˋ neutro) |
| 🎧 **áudio → tom** | nada na tela, só o som | marca o tom |

Os dois quizzes de tom são a mesma pergunta por duas portas: o de áudio é ouvido puro, o de 汉字 é memória — a carta fica muda de propósito, e o 🔊 do canto some pra não virar botão de resposta.

### 🔀 Aleatório

Sorteia, **a cada carta**, entre ⌨️ teclado, 汉字 → pinyin + tradução, 🎯 汉字 → tom e 🎧 áudio → tom. A ideia é treinar as quatro habilidades na mesma sessão em vez de uma por dia: reconhecer, escrever o som, lembrar o tom de memória e ouvir o tom.

**O desenho fica de fora.** Leva dez vezes mais tempo que os outros e só serve pra 43 das 100 palavras — no meio de uma sessão rápida ele viraria pedágio. Quem quer desenhar escolhe desenhar.

**A pergunta se adapta à palavra.** Os dois tons só entram em palavra de um caractere, e o de áudio ainda exige tom não-neutro e voz no aparelho; o que sobra pra 你好 e 谢谢 é teclado ou virar a carta. Por isso o contador do alto mostra o deck **inteiro**: se um modo não dá conta de uma palavra, o sorteio pega outro que dê. O sorteio também não repete o modo da carta anterior quando há alternativa — sem isso o acaso entrega três iguais em sequência e a sessão parece travada.

**Aqui o tom é revisão, não placar.** Sozinhos, os quizzes de tom são rodada fechada: embaralham o deck, contam acertos e não mexem no agendamento. Dentro do aleatório eles viram carta normal — marcou o tom, a resposta **sugere** um botão (certo → *Acertei*, errado → *Errei*) e quem decide é você, igual ao desenho e ao teclado. É o que faz o tom contar na meta de 30 e entrar na repetição espaçada.

No seletor de modo também ficam duas chaves: **"Falar ao revelar"** (áudio automático) e o **"⚡ Relâmpago"**, abaixo.

### ⌨️ Escrever no teclado

É assim que se escreve chinês num celular de verdade: você digita o **som** em letras latinas e o teclado oferece os ideogramas que se leem daquele jeito — quem escolhe é você. A carta mostra o português e a pessoa refaz esse caminho inteiro: lembrar o som, escrever o som, reconhecer o ideograma no meio dos homófonos.

O pinyin se digita **sem tom** e sem espaço: `nihao`, `laoshi`. `ü` e `v` valem por `u` (nenhum teclado de celular tem trema), Enter escolhe o primeiro candidato. Os candidatos saem do **deck inteiro**, não do filtro da sessão — tirados do filtro, uma aula com uma palavra só em "hao" entregaria a resposta antes de a pessoa pensar.

**Na frase o resultado é outro.** Comparar 我是巴西人 com 我是巴细人 em dois blocos de 38px é caçar o caractere errado no olho — exatamente o que o resultado deveria poupar. Então o texto encolhe e o erro vem **marcado na posição em que aconteceu**: cada caractere seu ganha verde ou vermelho contra o gabarito, e o 细 fora do lugar salta da linha. Pontuação e espaço não entram na conta — quem escreveu 我是巴西人。com o ponto do teclado chinês acertou a frase, e reprovar por isso seria cobrar datilografia.

O resultado vem em **três linhas** — *era* 力波 / *não* 林娜 / **Lìbō** — e não numa frase só: comparar dois ideogramas parecidos com eles separados por vírgula é justamente o que não funciona. O ideograma é o que se veio ler ali, então é ele que é grande; o que você escolheu vem menor e em vermelho, sem risco em cima (riscar 一 ou 二 apaga o caractere, que é feito de traço horizontal).

Quem não lembra o som fica sem candidato nenhum, então existe o **"não lembro"**: mostra a resposta e sugere *Errei*. Acertar sugere *Acertei*, errar o candidato sugere *Errei* — mas, como no desenho, **quem decide é você**, e é uma revisão normal que conta na meta e mexe no agendamento.

### ✍️ Desenhar

Os outros modos perguntam se você **reconhece** a palavra. Este pergunta se você sabe **escrever** — que é outra coisa, e bem mais difícil.

A carta vira uma **grade 田字格**: um quadrado com uma cruz pontilhada no meio, dividindo em quatro quadrantes. É a grade em que se aprende a escrever chinês no papel, e ela está ali pra ensinar onde cada parte do caractere mora dentro do quadrado. Você escreve com o dedo, apaga o último traço no **↶** ou tudo no **✕**, e toca em **✓ Validar**.

A pergunta é a palavra inteira **menos o ideograma**: o pinyin, a tradução e o áudio, os três juntos na mesma linha. Já foram três modos separados, um por pista — mas escrever é difícil o bastante sem também ter que adivinhar de que palavra se está falando.

**A nota.** Validou, o app compara o seu traço com o traçado oficial e dá uma porcentagem de proximidade. **90% ou mais conta como certo.** O caractere certo aparece em cinza por baixo do seu desenho, então dá pra ver exatamente onde saiu do lugar ou o que faltou — e tocar na carta vira pro traçado animado, na ordem certa.

A nota já vem com um dos botões sugerido (≥90% → Acertei, 75–89% → Difícil, abaixo → Errei), mas **quem decide é você**: é uma revisão normal, conta na meta de 30 e mexe no agendamento como qualquer outra.

Como funciona por dentro: o app reamostra as **medianas** do caractere (o esqueleto, do makemeahanzi) e os seus traços em pontos igualmente espaçados, e mede os dois lados — quanto do caractere você cobriu **e** quanto do que você desenhou é caractere. Só o primeiro premiaria o rabisco que passa por tudo; só o segundo premiaria o traço caprichado que esquece metade. Antes de comparar, corrige **um pouco** de tamanho e de posição (até ±12% e ±7% do quadro), porque escrever com o dedo nunca cai no lugar exato — mas com trava, senão desenhar minúsculo num canto valeria 100%.

A tolerância não é chute: o `tools/test_nota.js` roda a nota contra os 57 caracteres do deck deformados de três jeitos (aluno caprichado, médio e desengonçado) e contra todos os pares de caracteres trocados. Com a tolerância atual nenhum caractere errado passa dos 90% — o mais perigoso é 吗 na carta de 喝, que dá 88 porque dividem o 口 e quase toda a estrutura. A primeira tolerância que testei era três vezes mais frouxa e aprovava **38%** dos caracteres errados.

**Só palavras de um caractere — e só as que têm traçado.** A grade é uma só, então 你好 e 谢谢 ficam de fora. E a nota compara o seu traço com o traçado oficial: carta cujo caractere ainda não está no `strokes.json` (palavra nova antes de o `build_strokes.py` rodar, ou caractere que o makemeahanzi não tem) sai da sessão em vez de entrar nela com o "✓ Validar" mudo. Os dois quizzes de tom têm a mesma restrição, por outro motivo — o tom é de uma sílaba — e o de áudio ainda tira o tom neutro, que o TTS fala com tom cheio quando isolado. O contador no alto já mostra só o que a sessão vai perguntar, e quando o filtro não sobra nada o app diz qual é a restrição em vez de mostrar uma sessão vazia.

### ⚡ Relâmpago

Não é um modo, é uma **chave que liga por cima do modo escolhido** — mas ela só tem onde valer em **um**, o 汉字 → pinyin + tradução. Nos outros responder já é uma ação (digitar, desenhar, marcar o tom) e não há virada pra cronometrar; no aleatório, piscar só numa carta em cada quatro não seria rodada de relâmpago nenhuma. Nesses casos a chave aparece visivelmente apagada. Ligada, o MODO mostra o raio na frente do nome.

São **duas etapas por carta**, cada uma com o seu relógio na barra:

| Etapa | O quê | Tempo |
|---|---|---|
| 1 · exposição | a carta aparece e some — só olhar, nada a fazer | 1s (ou 2s / 3s) |
| 2 · pergunta | a explicação entra e você diz **Errei** ou **Acertei** | 3s |

Quem pontua é a etapa 2. A etapa 1 é só o flash: tempo curto demais pra raciocinar, que é o ponto — a ideia é sair do *pensar* e entrar no *reconhecer*. Se já reconheceu antes de acabar, toque na carta pra adiantar a explicação; isso não dá nem tira ponto.

Deixar os 3s da pergunta acabarem sem responder **conta como erro** e o app registra quantas foram assim, pra você saber se é dificuldade ou se está só devagar no botão.

No fim da rodada: *"Você acertou 41 de 57 — 72%"*. A nota é sobre o **deck inteiro** da rodada, não só sobre o que você respondeu — deixar o tempo acabar é resultado, não carta que não existiu.

- **Tempo da exposição**: 1s / 2s / 3s, escolhido ali mesmo. Padrão 1s.
- **⏸ Pausa** ao lado da barra, vale nas **duas** etapas — pausar só a exposição deixaria a pergunta expirando sozinha bem quando você parou pra ler a explicação com calma.
- **Não mexe em nada.** Não grava agendamento, não conta pra meta de 30, não sobe pro Supabase. É auto-avaliação rápida pra saber se está indo bem ou mal, não pra remexer no cronograma. Sair da aba ou bloquear o celular congela o relógio — senão a rodada passava sozinha no bolso; ao voltar, a carta recomeça da exposição, que é mais justo do que cobrar a resposta de uma explicação que você não viu.
- É uma **rodada fechada** do deck filtrado, embaralhada, com a nota no fim. Não emenda na prática livre.
- **Fora do quiz de tons**: lá responder já é escolher um botão de tom, então a chave aparece apagada.
- Nessa chave o ideograma do verso vem **em texto, sem o traçado animado** — o traçado leva ~1s pra desenhar e apareceria pela metade.

### Recursos nas cartas

- **Traçado animado**: o ideograma se desenha traço a traço na ordem oficial; toque nele pra repetir
- **🔊 Pronúncia**: voz chinesa do próprio aparelho, na frente e no verso
- **Pinyin colorido por tom**: 1º vermelho · 2º laranja · 3º verde · 4º azul · neutro cinza
- **Pronúncia aproximada** atrás do pinyin — *hǎo (rau)*, *xièxie (xié-xié)* —, ligada por padrão e com interruptor no MODO. São as letras do **português** que chegam mais perto do som: quem lê "hao" com olho de brasileiro fala "áo", e o h chinês é o r de "rato". É muleta pra primeira leitura, não transcrição fonética — a referência continua sendo a gravação do 🔊
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
| `supabase/schema.sql` | tabelas `cards` (read-only via anon; `tipo` = `palavra`/`frase`), `progress`, `review_log` |
| `supabase/seed.py` | upsert do seed no banco (service key) |
| `fonts/hanzi.woff2` | fonte caligráfica 楷书 (AR PL UKai CN, subset ~24KB; licença em `fonts/ARPHICPL.txt`) |
| `strokes/strokes.json` | traçados dos caracteres (makemeahanzi) |
| `audio/nativo/*.mp3` | **em uso** — gravações de falantes nativos (Wikimedia/Shtooka); créditos em `audio/nativo/CREDITS.md` |
| `audio/nativo/CREDITS.md` | atribuição por arquivo — autor, licença e qual caractere foi gravado |
| `tools/` | `build_font.py`, `build_strokes.py`, `build_audio_nativo.py`, `build_audio.py`, `test_nota.js` (calibração da nota do desenho) |
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
- **Nem toda coluna é do JSON.** O `seed.py` manda 11 campos (`id, hanzi, pinyin, pt, deck, tags, nota, data_aula, fonte, tipo, created_by`). O `audio_url` fica **de fora** de propósito — é por isso que rodar o seed não desliga as gravações nativas. Quem escreve nele é só o `build_audio_nativo.py`.
- **Apagar não propaga.** O upsert insere e atualiza, nunca remove. Tirar uma palavra do JSON deixa ela viva no banco e no app. A coluna `deleted` existe no schema e o app já filtra por ela, mas o `seed.py` ainda não a marca — hoje some só editando o banco à mão.

### Adicionar palavras novas (fluxo do Leo)

1. Editar `seed/seed_cards.json` — preencher `data_aula` (`"2026-08-13"`) com o dia da aula; deixar de fora se a palavra veio por fora da aula. **Frase** leva `"tipo":"frase"` e o pinyin **separado por palavra** (`"Wǒ shì Bāxī rén"`), que é de onde sai a segmentação do 🧩 ordenar — colar tudo junto tira a frase desse modo
2. `source ~/Documents/codes/cloud_local/manman_supabase.env && python3 supabase/seed.py`
3. Caractere novo? `python3 tools/build_font.py` e `python3 tools/build_strokes.py`
4. `python3 tools/build_audio_nativo.py` — baixa a gravação nativa das cartas novas e liga o `audio_url` (precisa das mesmas variáveis do passo 2 e do `ffmpeg`). **Frases ele pula**: o Commons nomeia os arquivos por sílaba de palavra, então procurar a frase inteira é consulta garantidamente vazia — elas vão de TTS, que numa frase é bom
5. Commit + push — **os MP3s precisam estar publicados**, senão o `audio_url` aponta pra 404

Rodou o `schema.sql` antes da V2.3? Ele é idempotente — rodar de novo só adiciona a coluna `data_aula`, não apaga nada.

Rodar local: `python3 -m http.server 8080` → http://localhost:8080/ (debug de datas: `?debug=1`).

## Trabalhando junto — leia antes do primeiro commit

Rodar local não exige nada: é HTML/JS puro, sem build e sem dependências.

```bash
git clone https://github.com/leoborja/manman.git && cd manman
python3 -m http.server 8080     # → http://localhost:8080/  (datas: ?debug=1)
```

Quem usa o Claude Code não precisa nem disso: o `.claude/launch.json` já sobe o mesmo
servidor na 8777 (porta diferente da 8080 de propósito, pra não brigar com um servidor
que você já tenha aberto à mão). O resto do `.claude/` é local de cada máquina e está no
`.gitignore`.

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

### A chave do Supabase

A `SUPABASE_SERVICE_KEY` fica **fora do repositório** — por exemplo `~/.config/manman.env` — e entra por `source` antes dos scripts. Nunca dentro da pasta do projeto: o `.gitignore` cobre o que a gente previu, não o que ninguém imaginou.

Um **hook de pre-commit** barra commit que carregue chave do Supabase (JWT `service_role`, `sb_secret_…`, ou a anon key fora do `config.js`). Ele vem no repositório, mas o git não instala hook sozinho — **cada clone precisa rodar uma vez**:

```bash
git config core.hooksPath hooks
```

Falso positivo legítimo passa com `git commit --no-verify`.

Por que a trava: este repositório é **público**. Segredo publicado não se apaga — sai do arquivo mas fica no histórico e em qualquer fork ou clone que já exista. A recuperação é rotacionar a chave no Supabase, não editar o commit.

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
- Lista de modos cortada de 10 pra **5** (22/08): as quatro direções de leitura (汉字→pinyin→tradução, tradução→汉字, pinyin→汉字, só áudio) e o 🔀 aleatório eram variações do mesmo gesto — virar a carta — e as três portas do desenho eram o mesmo exercício com pista a menos. Sobrou um modo por *tipo de resposta*: virar, digitar, desenhar, marcar o tom. Quem tinha um modo antigo salvo cai no equivalente (as leituras → 汉字 → pinyin + tradução; os três desenhos → o desenho único)
- Perfil e navegação arrumados (23/08): a pílula com o nome e o ícone de tema viraram **um botão de perfil** (a inicial, redondo) com folha própria, e o "por tema / por aula" virou a **cabeça da fila de chips** (sticky) em vez de uma linha só dele, que gastava uma faixa inteira de altura pra dizer duas palavras
- 🔀 Aleatório (23/08) sorteando quatro modos por carta, e **o tom deixando de ser placar** quando está dentro dele: a rodada fechada do quiz não cabe numa fila de revisão, e manter as duas lógicas separadas dentro da mesma sessão significaria uma sessão que ora conta pra meta ora não. Virou carta avaliada como qualquer outra — o que também resolve o incômodo de o treino de tom ser o único que não entrava na repetição espaçada
- Cromo de navegação encolhido (23/08): as abas viraram **um controle segmentado só de texto** (62 → 40px) e o "por tema / por aula" virou **dois ícones** do tamanho dos chips (🏷️ e 📅), liberando dois terços da largura que as duas palavras ocupavam. Tudo isso é moldura: quanto menos altura ela come, mais alto a carta começa — que é a única coisa na tela que a pessoa veio ver
- Abas no rodapé, **tentadas e desfeitas** no mesmo dia (23/08): a ideia era o polegar, que no celular grande não alcança o topo. Mas o app roda tanto no celular quanto no navegador, e no navegador — janela larga, sem polegar — uma barra flutuando embaixo fica claramente deslocada. Voltaram pra fileira acima dos chips, que serve às duas telas. Se um dia valer a pena, o caminho é a barra de baixo **só no celular** (media query), não nos dois
- Pronúncia aproximada **calculada, não preenchida** (25/08): a tentação era uma coluna nova no `seed_cards.json` pra escrever o som palavra por palavra. Mas o pinyin já é um alfabeto fechado — pouco mais de 400 sílabas, todas montadas de inicial + final — então uma tabela de ~50 linhas no `app.js` cobre o deck inteiro e toda palavra futura sem ninguém preencher campo nenhum, sem migração no banco e sem rodar o `seed.py`. Sílaba que saia torta se conserta no `PRON_EXCECAO`, num lugar só, e não carta por carta. O mesmo trabalho encontrou um bug antigo do divisor de sílabas: 韩国 `Hánguó` virava `háng-uó` (o g virando coda), o que também pintava o tom na sílaba errada
- Frase entra como **carta com `tipo`**, não como tabela nova (30/08): frase e palavra têm os mesmos campos, então uma tabela separada duplicaria SRS, sincronização, meta, streak e a aba Cartas pra ganhar o quê. O que precisava separar era a **fila**, e uma coluna resolve. O `tipo` tem default `'palavra'`, então as 108 cartas antigas não precisaram de migração nenhuma
- "Palavras / Frases" **acima** dos eixos 🏷️📅❌, e não como um quarto ícone ao lado deles (30/08): os três são maneiras de fatiar uma lista, e frase é outra lista. Lado a lado, escolher "frases" custaria poder escolher a aula — e "as frases da aula de ontem" é justamente o filtro que a gente vai querer. Coube sem gastar altura porque o "O que estudar" já mora dentro da folha do MODO, que rola
- Segmentação da frase **calculada do pinyin**, não digitada (30/08): mesma decisão da pronúncia aproximada de 25/08. `Wǒ shì Bāxī rén` já tem a separação escrita nele, e sílaba de pinyin é caractere — então `我|是|巴西|人` sai de graça, sem coluna nova e sem ninguém preencher campo por frase. O `seg` existe como escape, não como rotina
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
