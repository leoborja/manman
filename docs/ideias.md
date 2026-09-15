# Ideias de melhoria — pesquisa de 14/09/2026

Levantamento feito pra decidir os próximos passos do Mànmàn depois do capítulo 3, do modo
offline e da reorganização por capítulo. Nada aqui está decidido: é a pauta pra conversar.

- **Fonte da pesquisa:** o [dailyhanzi.app](https://dailyhanzi.app) a fundo, e mais uns 14 apps
  de mandarim (Skritter, Hack Chinese, Du Chinese, HelloChinese, Pleco, Anki, Duolingo, Mandarin
  Blueprint, Outlier, Chairman's Bao, LingoDeer, ChineseSkill, Hanly, Dong Chinese). URLs no fim.
- **Filtro aplicado:** saiu tudo o que o Mànmàn já tem, e o que não serve pra uma turma de 4
  adultos iniciantes que estuda por um livro, num PWA sem servidor próprio.

## O que o Mànmàn já tem (pra não sugerir de novo)

Repetição espaçada, meta diária e 🔥 · cartas de palavra e de frase · modos: virar a carta,
digitar pinyin, desenhar com correção de traços, tom pelo 汉字, tom pelo áudio, ordenar a frase,
aleatório, ⚡ relâmpago · traçado animado · pinyin colorido por tom · pronúncia aproximada em
português · gravação nativa (Shtooka + Lingua Libre) e voz da ElevenLabs nas frases · 🐢 falar
devagar · filtros por tema, capítulo do livro e erro · erro por habilidade e matriz de confusão
de tons · gráfico da turma · funciona sem internet.

## Benchmark

### Daily Hanzi (dailyhanzi.app)

- **O que é:** app nativo (iOS e Android) de um dev solo, lançado em fevereiro de 2026. Mostra
  caractere, pinyin e significado num **widget da tela de bloqueio**; desde 03/09, também uma
  frase de exemplo. A ideia é aprender um pouco cada vez que se olha o celular.
- **Por dentro:** flashcards com revisão espaçada simples ("Smart Review"), níveis HSK,
  simplificado ou tradicional, parágrafo diário, streak, temas e sincronização por conta.
- **Modelo:** o essencial é pago (US$ 4,99/mês ou US$ 20–40/ano). Muita reclamação de paywall
  escondido, e de que a revisão traz palavra nova em vez de repetir as erradas.
- **Não tem:** radicais ou decomposição, ordem dos traços, escrita, treino de tom, fala, versão
  web.
- **O diferencial é onde ele fica, não a didática.** O Mànmàn já é mais completo no método. O que
  vale copiar é a **exposição passiva** — mas PWA não tem widget de tela de bloqueio.

### Diferenciais dos outros apps

| App | Diferencial | Problema que resolve |
|---|---|---|
| Skritter | Correção da escrita traço a traço; desenhar a marca do tom; ditado (ouve e escreve); listas por livro didático com habilidade liga/desliga por palavra | Reconhecer o caractere e não conseguir escrever; estudo alinhado ao curso |
| Hack Chinese | Sessão por tempo, não por quantidade; memória forte × fraca; painel de constância | Correr pra "zerar a fila"; saber o que está frágil |
| Du Chinese | Histórias graduadas com áudio nativo sincronizado; pinyin liga/desliga ou só nas difíceis; tocar na palavra abre o significado | Passar de cartas soltas pra leitura de verdade |
| HelloChinese | Reconhecimento de fala que avalia o tom; vídeos com nativos | Falar, não só reconhecer |
| Pleco | Busca desenhando e pela câmera (OCR); cria carta do dicionário com um toque; tudo offline | Achar e guardar palavra encontrada fora do curso |
| Anki (add-ons) | Chinese Support pinta o tom; HanziWeb mostra outras cartas com o mesmo caractere; FSRS; lacuna pra gramática | Ligar caracteres entre si; fixar o tom pela visão |
| Duolingo | Pares de palavras; seção de pinyin; streak compartilhado com amigos e missão semanal em dupla | Constância pela pressão social amigável |
| Mandarin Blueprint | "Hanzi Movie": cada caractere vira uma cena com pessoas, lugares e cômodos que codificam som e tom | Decorar forma sem lógica |
| Outlier Linguistics | Classifica cada componente como som, significado ou vazio | Entender por que o caractere é assim |
| Chairman's Bao | Notícias graduadas com dicionário ao toque, áudio com velocidade e quiz de compreensão | Leitura e audição de texto real |
| LingoDeer | Cartões de gramática dentro da lição; grava a própria voz e compara com o nativo | Falar com referência, sem reconhecimento de fala |
| ChineseSkill | Minijogos de pinyin, tom e caractere com tempo; curso só de pinyin e tons | Treino rápido e divertido de base |
| Hanly · Dong Chinese | Ensinam pela composição e origem do caractere, dos componentes simples aos complexos | Mesma do Outlier, com mnemônico visual |

## Ideias priorizadas

### Primeira leva — rápidas e de alto impacto

Sugestão: as três primeiras num PR só. São pequenas, usam o que o app já tem e cobrem fala,
leitura e escrita.

| Ideia | De onde vem | Por que serve pra turma | Esforço | Nota técnica |
|---|---|---|---|---|
| 🎙️ **Gravar e comparar com o nativo** | LingoDeer | Grava a própria voz e ouve lado a lado com a gravação nativa. Ataca o 3º tom que o professor apontou | baixo a médio | `MediaRecorder` no próprio aparelho, sem servidor. Funciona no Safari de PWA instalado (iOS 14.3+). Não precisa guardar a gravação |
| 🕸️ **Teia do caractere** | Anki HanziWeb | No verso, as outras cartas com o mesmo caractere (你 → 你们, 你好吗, 你叫什么名字). O deck vem de um livro, então as ligações são reais | baixo | Tudo sai de `cards` no próprio app. Palavra e frase juntas |
| 🎧 **Ditado** | Skritter | Toca só o áudio e a pessoa desenha o caractere, sem ver pinyin nem tradução | baixo | Variante do modo ✍️ desenhar (hoje ele mostra pinyin + tradução + áudio) |
| ⏱️ **Sessão de 5 minutos** | Hack Chinese | Botão "só 5 minutos" em vez de encarar a fila inteira | baixo | Cronômetro por cima da fila; conta na meta como revisão normal |

### Segunda leva

| Ideia | De onde vem | Observação | Esforço |
|---|---|---|---|
| 🧱 **Radical e componentes na carta** | Outlier, Hanly, Dong | Já estava no roadmap. Mostra que 妈 = 女 (significado) + 马 (som). Também resolve a dúvida dos "caracteres soltos" do capítulo 3 (中, 日, 生, 贝, 玉, 矢, 匕, 者), que ficaram de fora como carta | médio — os dados de decomposição saem do Make Me a Hanzi, a mesma base dos traçados (`dictionary.txt`); conferir a licença desse arquivo |
| 🤝 **Missão semanal da turma** | Duolingo | Meta coletiva ("400 revisões entre os quatro") em vez de ranking | médio — os dados já existem em `review_log`, não precisa de coluna nova |
| 🎯 **Pares de tom sob medida** | Duolingo, ChineseSkill | Ouve e escolhe entre mā e mǎ, com os pares que cada um mais confunde segundo a matriz de tons | médio |
| 🔔 **Palavra do dia por notificação** | Daily Hanzi | A versão possível do widget. No iPhone só funciona com o app na Tela de Início (iOS 16.4+) | médio a alto — precisa de disparo agendado (Edge Function do Supabase + chaves VAPID) |
| 📊 **Aba Progresso turbinada** | Hack Chinese | Já estava no roadmap: mapa de dias estudados, taxa de acerto, memória forte × fraca, previsão | médio |

### Mais adiante

- **Mnemônicos da turma** (Mandarin Blueprint): cada um escreve uma história pro caractere,
  visível pros quatro. Ótima pra quem se conhece, mas precisa de **tabela nova no Supabase** —
  ninguém do time tem DDL hoje; exige alguém logado no painel.
- **Minidiálogos por capítulo** (Du Chinese): textos curtos só com as palavras do capítulo, com
  toque na palavra abrindo a carta e pinyin opcional. O custo é escrever: **o repositório é
  público**, então os textos têm que ser próprios, não copiados do livro.
- **Cartões de gramática por capítulo** (LingoDeer): nota curta ligada ao capítulo (是 × 很, 吗,
  都不 × 不都). Parte disso já mora nas `nota` das frases.

### Descartadas por enquanto

- **Reconhecimento de fala e leitura pela câmera:** dependem de API paga ou servidor.
- **Ligas e ranking competitivo:** turma pequena demais; a missão coletiva faz mais sentido.
- **Widget de tela de bloqueio:** exige app nativo.

## Pendências abertas (15/09)

- **30 palavras tocam na voz do celular** — não há gravação no Shtooka nem na Lingua Libre (ou a
  única foi recusada pelo Whisper):
  妈 · 森 · 力波 · 林娜 · 陆雨平 · 打开 · 女朋友 · 男朋友 · 未婚妻 · 妻子 · 老婆 · 韩国 · 韩国人 ·
  大学生 · 对不对 · 二十 · 三十 · 四十 · 一百 · 老公 · 丈夫 · 女儿 · 加拿大人 · 韩文 · 汉堡 ·
  汉堡肉 · 公公 · 奶奶 · 外婆 · 外公.
  Opções: o professor grava no celular (é um minuto, e fica a voz da aula) ou gerar na ElevenLabs
  com checagem do Whisper, como nas frases.
- **Teste do modo offline num iPhone de verdade:** abrir com internet, esperar ~10 s, modo avião,
  abrir de novo; conferir aviso 📴, áudio de palavra e frase nunca ouvidas, e o progresso subindo
  quando a internet volta. O Chromium passou; o Safari não dá pra simular.
- **Capítulo 3, opcionais que ficaram de fora a pedido:** países (英国 · 法国 · 德国), profissões
  (工人 · 商人 · 农民) e 吃饭 · 知道 · 常常 · 银行; as expressões de sala 懂不懂 · 跟我念 (precisam
  de 懂, 念, 跟).

## Fontes

- Daily Hanzi: https://dailyhanzi.app/ · https://apps.apple.com/us/app/daily-hanzi/id6756919959 ·
  https://mwm.ai/apps/daily-hanzi/6756919959 (agregador)
- https://skritter.com/features
- https://ltl-school.com/hack-chinese/ · https://www.thatsmandarin.com/guest-blogs-media/hackchinese-review/
- https://mandarincompanion.com/6-best-apps-for-reading-chinese/
- https://apps.apple.com/us/app/du-chinese-read-learn-chinese/id1052961520
- https://www.hellochinese.cc/
- https://www.pleco.com/
- https://github.com/jdlorimer/chinese-support-redux · https://github.com/elizagamedev/anki-hanziweb
- https://allenwarren.me/2025/04/22/duolingo-chinese-course-review/ · https://blog.duolingo.com/friend-streak/
- https://intercom.help/mandarin-blueprint/en/articles/9030399-hanzi-movie-method
- https://www.outlier-linguistics.com/blogs/chinese/what-is-the-outlier-dictionary-of-chinese-characters
- https://www.alllanguageresources.com/chairmans-bao-review/
- https://flexiclasses.com/mandarin/lingodeer-review/
- https://ltl-school.com/chineseskill/
- https://www.hanlyapp.com/ · https://languavibe.com/dong-chinese-review/
- https://hanziwriter.org/docs.html
- https://migaku.com/blog/chinese/best-chinese-learning-apps
