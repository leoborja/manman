# Instruções pro Claude deste repositório

O Mànmàn é um app de flashcards de mandarim que já está no ar em
https://leoborja.github.io/manman/ — servido pelo GitHub Pages **direto do `main`**.
Não existe staging: o que entra no `main` está publicado no celular das quatro pessoas
da turma em segundos. É HTML/JS puro, sem build e sem dependências.

Antes de qualquer coisa, decida em qual dos dois trabalhos você está — as regras são
diferentes e misturá-los é o que quebra o app:

- **Conteúdo** (palavra ou frase nova) → mexe em `seed/seed_cards.json` e nos arquivos
  gerados a partir dele. Vai direto no `main`. É o fluxo descrito aqui embaixo.
- **Funcionalidade** (`app.js`, `index.html`) → branch + PR, nunca direto no `main`.
  Ver "Trabalhando junto" no `README.md`.

**Um trabalho de conteúdo não toca em `app.js` nem em `index.html`.** Se você se pegou
editando um dos dois pra fazer uma palavra aparecer, pare: ou o JSON está com o campo
errado, ou é outra tarefa. Deck que ainda não tem rótulo em `DECK_LABELS` aparece com o
nome capitalizado sozinho — funciona, não precisa de código.

## Primeiro clone (uma vez por máquina)

```bash
git clone https://github.com/leoborja/manman.git && cd manman
git config core.hooksPath hooks          # hook que barra commit com chave do Supabase
python3 -m pip install fonttools brotli  # só pra gerar a fonte
brew install ffmpeg                      # só pra baixar áudio nativo
```

O `git config` não é opcional: o git não instala hook sozinho, então **cada clone precisa
rodar essa linha uma vez** — sem ela a trava contra vazar chave não existe nessa máquina.

### A chave do Supabase

Dois scripts precisam dela — o `supabase/seed.py` e o passo final do
`build_audio_nativo.py`. Ela chega pelo Leo, por canal privado, e **mora fora da pasta do
projeto**, junto da `ELEVEN_API_KEY` que o áudio das frases usa:

```bash
mkdir -p ~/.config
cat > ~/.config/manman.env <<'EOF'
export SUPABASE_URL=https://xxxxxxxx.supabase.co
export SUPABASE_SERVICE_KEY=eyJ...
export ELEVEN_API_KEY=sk_...
EOF
chmod 600 ~/.config/manman.env
```

Depois disso, todo comando que fala com o banco começa com
`source ~/.config/manman.env &&`.

Por que fora da pasta: este repositório é **público** e a `SUPABASE_SERVICE_KEY` ignora o
RLS por completo — quem a tem apaga o deck e sobrescreve o progresso dos quatro. Segredo
publicado não se apaga: sai do arquivo mas fica no histórico, nos forks e em qualquer
clone que já exista, e a recuperação é rotacionar a chave (o que derruba todo mundo), não
editar o commit. O `.gitignore` cobre o que a gente previu, não o que ninguém imaginou —
por isso a regra é o arquivo nunca existir dentro de `manman/`, nem temporariamente, nem
"só pra testar um script".

Rodar local: `python3 -m http.server 8080` → http://localhost:8080/

## Adicionar palavras e frases — o passo a passo

### 0. Puxe antes de começar

```bash
git pull --rebase origin main
```

Sem isso o pipeline regenera a fonte e os traçados a partir de um seed velho e **apaga os
caracteres que a outra pessoa acabou de adicionar** — os dois arquivos são binário / JSON
de uma linha, que o git não sabe mesclar. Os scripts têm uma trava (`tools/sync_guard.py`)
que barra justamente isso; se ela reclamar, a resposta é o `git pull --rebase`, nunca
`MANMAN_SKIP_SYNC=1`.

### 1. Editar `seed/seed_cards.json`

É a **fonte de verdade** do deck. O banco é a cópia — editar pelo painel do Supabase é
perda de tempo, o próximo seed sobrescreve.

Palavra:

```json
{
  "id": "shu",
  "hanzi": "书",
  "pinyin": "shū",
  "pt": "livro",
  "deck": "escola",
  "fonte": "cap3",
  "data_aula": "2026-09-10",
  "nota": "O que a pessoa precisa lembrar — opcional"
}
```

Frase:

```json
{
  "id": "fr-sou-brasileiro",
  "tipo": "frase",
  "hanzi": "我是巴西人",
  "pinyin": "Wǒ shì Bāxī rén",
  "pt": "Eu sou brasileiro",
  "deck": "paises",
  "data_aula": "2026-09-10",
  "nota": "País + 人. O 是 liga substantivo a substantivo — com adjetivo seria 很"
}
```

Regras que importam:

- **`id`** é o pinyin sem tom e sem espaço (`shu`, `nihao`). Repetiu, desempate com
  sufixo em português: `ma-cavalo`, `ma-mae`, `ma-pergunta`. Frase começa com `fr-` e um
  resumo em português. **O id é a chave do upsert e do arquivo de áudio** — reaproveitar
  um id existente sobrescreve a carta do outro; trocar o id de uma carta antiga cria uma
  segunda carta e zera o histórico de quem já estudava a primeira.
- **`pinyin` com tom** (`shū`, `mǎ`) — é o que a carta mostra e o que procura a gravação.
- **Na frase, pinyin separado por palavra** (`Wǒ shì Bāxī rén`, não `Wǒshìbāxīrén`): é
  daí que sai a segmentação do modo 🧩 ordenar, contando as sílabas de cada pedaço. Colar
  tudo junto não dá erro — a frase simplesmente some desse exercício.
- **`deck`** é o tema, em minúscula e sem acento. Os que já existem:
  `saudacoes, numeros, pronomes, verbos, uteis, estados, nomes, familia, comida, paises,
  escola, identidade, gostos, animais, natureza`. Reaproveite um antes de inventar outro — cada
  deck novo é mais um chip na tela de filtro.
- **`fonte`** é a origem da palavra, e vira o filtro 📖 do app. A turma estuda pelo
  *New Practical Chinese Reader 1* (o `book-1.pdf` da pasta), então é o capítulo:
  `"cap1"`, `"cap2"`, `"cap3"`… — vale o que está no 生词 da lição, na seção de 汉字 e
  nas palavras dos exercícios dela. Fora do livro: `"extra-aula"` (o professor trouxe
  na aula) ou `"duolingo"`. Capítulo novo não precisa de código, o chip "Cap. 3" aparece
  sozinho. Na dúvida sobre de onde veio, pergunte ao Leo em vez de chutar.
- **`data_aula`** é o dia da aula em que a palavra entrou (`"2026-09-10"`). Fica como
  registro — não é mais filtro. Palavra que não veio de aula não leva.
- **`nota`** é opcional e aparece no verso.
- **Não apague cartas do JSON.** O seed é upsert: insere e atualiza, nunca remove. A carta
  fica viva no banco e no app, e some do JSON — que é o pior dos dois mundos. Pra tirar
  de verdade (com o ok do Leo), marque `"deleted": true` na carta: o seed manda, e ela
  sai do app de todo mundo sem sumir do registro.

Antes de seguir, confira que o JSON continua válido e sem id repetido:

```bash
python3 -c "
import json,collections
d=json.load(open('seed/seed_cards.json'))
r=[i for i,n in collections.Counter(c['id'] for c in d).items() if n>1]
print('total:',len(d),'| ids repetidos:', r or 'nenhum')
faltando=[c['id'] for c in d if not all(c.get(k) for k in ('id','hanzi','pinyin','pt','deck'))]
print('cartas com campo obrigatório vazio:', faltando or 'nenhuma')"
```

### 2. Mandar pro banco

```bash
source ~/.config/manman.env && python3 supabase/seed.py
```

Sobe as cartas novas e atualiza as que mudaram (upsert por `id`). O caminho do `.env` é
o de cada máquina: `~/.config/manman.env` é a convenção deste repositório (é o que os
scripts citam quando a chave falta), mas quem já tem as variáveis em outro arquivo usa o
seu — o que não pode é o arquivo morar dentro de `manman/`.

### 3. Caractere novo? Fonte e traçados

Só é preciso quando entrou um 汉字 que o deck ainda não tinha. Pra saber:

```bash
python3 -c "
import json,re
cards=json.load(open('seed/seed_cards.json'))
have=set(k for k in json.load(open('strokes/strokes.json')) if k!='_')
want=set()
for c in cards: want.update(re.findall(r'[一-鿿]',c['hanzi']))
print('caracteres novos:', ''.join(sorted(want-have)) or 'nenhum')"
```

Deu "nenhum"? Pule este passo — rodar à toa só gera diff binário. Se veio alguma coisa:

```bash
python3 tools/build_strokes.py       # baixa ~14MB pro /tmp na primeira vez
python3 tools/build_radicals.py      # traço→radical, pro azul da Grade (baixa ~2MB)
python3 tools/build_font.py          # precisa do ukai.ttc em /tmp, ver abaixo
```

O `build_font.py` faz um subset da AR PL UKai CN e procura a fonte de origem em
`/tmp/ukai.ttc`. A completa tem ~20MB e **não vai pro repositório** — se não estiver lá,
baixe de novo (some a cada reboot, e tudo bem):

```bash
cd /tmp && curl -sLO http://ftp.debian.org/debian/pool/main/f/fonts-arphic-ukai/fonts-arphic-ukai_0.2.20080216.2.orig.tar.bz2 \
  && tar xjf fonts-arphic-ukai_0.2.20080216.2.orig.tar.bz2 \
  && cp $(find . -name ukai.ttc | head -1) /tmp/ukai.ttc
```

### 4. Áudio nativo

```bash
source ~/.config/manman.env && python3 tools/build_audio_nativo.py
```

Baixa a gravação de falante nativo do Wikimedia Commons pras cartas novas e liga o
`audio_url` no banco. **Frases ele pula de propósito** — o Commons nomeia arquivo por
sílaba de palavra, então frase inteira é consulta garantidamente vazia lá; elas são o
passo seguinte. Palavra sem gravação disponível cai no TTS do aparelho sozinha, sem
precisar de nada.

### 5. Frase nova? Voz sintética

```bash
source ~/.config/manman.env && python3 tools/build_audio_frases.py
```

Gera `audio/frases/<id>.mp3` na ElevenLabs **só das frases que ainda não têm arquivo** —
rodar duas vezes não refaz nada nem gasta crédito à toa. Voz sintética numa frase é
aceitável (o defeito dela é o 3º tom *isolado*, e frase não tem sílaba isolada), e o TTS
do celular perde no ritmo e na entonação, que é o que a frase precisa.

Se não entrou frase nova, pule — é chamada paga.

**Esse script não toca em palavra**, nem no arquivo nem no banco: lista filtrada por
tipo, conferência do id antes do PATCH e pasta própria. A versão antiga dele
(`tools/build_audio.py`, apagada em 01/09) apagava o `audio_url` do deck inteiro e
desligava as gravações humanas de uma vez — se você encontrar esse nome em algum texto
velho, é a versão que não existe mais.

### 5b. Diálogo novo? Só o roteiro

O modo 💬 diálogo lê `seed/dialogos.json`, que **não tem conteúdo**: é a lista dos ids de
frases que já existem, na ordem em que são ditas.

```json
{ "id": "dl-no-cafe", "titulo": "No café", "deck": "comida",
  "cena": "Você senta com um amigo e o garçom já vem vindo.",
  "falas": [ { "quem": "outro", "card": "fr-beber-oque" },
             { "quem": "voce",  "card": "fr-quero-cafe", "dica": "peça um café" } ] }
```

Regras que importam:

- **Todo `card` tem que existir no `seed_cards.json` e ser frase.** Roteiro com um id que
  não existe (ou que a pessoa desligou) simplesmente não aparece no app — some inteiro,
  sem erro na tela. Se o diálogo que você acabou de escrever não aparece, é isto.
- **Escreva a conversa, não a lista.** A pergunta e a resposta precisam fechar de verdade:
  你饿吗 → 我很饿，我要米饭. Pareamento por tema ("as duas são de comida") produz diálogo
  que ensina errado, e foi justamente por isso que o roteiro é à mão.
- **`dica` é o que DIZER em português**, não a tradução da frase (essa o app já mostra
  embaixo, menor). "diga que está bem e devolva a pergunta" ensina; "Estou bem, e você?"
  só entrega.
- **`deck`** é o tema do roteiro, e é o único filtro que vale no modo — uma conversa no
  café atravessa comida e estados, então escolha o tema da CONVERSA.
- Conferir antes de commitar:

```bash
python3 -c "
import json
cards={c['id']:c for c in json.load(open('seed/seed_cards.json'))}
for d in json.load(open('seed/dialogos.json')):
  for f in d['falas']:
    c=cards.get(f['card'])
    if not c or c.get('tipo')!='frase': print('!!!', d['id'], f['card'])
print('conferido')"
```

Não precisa de banco, de áudio nem de fonte: as frases do roteiro já passaram por tudo
isso quando entraram. Um diálogo novo é conteúdo — vai direto no `main`, com o JSON.

### 6. Commitar e publicar

```bash
git add seed/seed_cards.json seed/dialogos.json audio/nativo/ audio/frases/ fonts/ strokes/
git commit -m "..."
git push origin main
```

Num trabalho de conteúdo os arquivos gerados **vão junto no commit** — os MP3s precisam
estar publicados no Pages, senão o `audio_url` que o passo 4 gravou no banco aponta pra
404 no celular de todo mundo. (Ao contrário do trabalho de funcionalidade, onde arquivo
gerado nunca entra no commit.)

## Nunca

- **Não escreva `audio_url` no seed nem no painel do Supabase.** Quem manda nessa coluna
  são os dois scripts de áudio, e é por isso que rodar o `seed.py` não desliga as
  gravações — ele mandaria a coluna vazia junto.
- **Não commite PDF.** O livro do professor fica na pasta e o repositório é público — o
  `.gitignore` barra `*.pdf` por isso.
- **Não passe `--no-verify`** pra escapar do hook de pre-commit sem entender o que ele
  achou. Ele existe pra uma coisa só: chave do Supabase indo pro público.
- **Não force push no `main`.** É o que está no ar.
