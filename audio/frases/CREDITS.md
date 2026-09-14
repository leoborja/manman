# Áudio das frases — voz sintética

Gerado pelo `tools/build_audio_frases.py`: as frases 1–65 em 2026-09-01, as 66–121 em 2026-09-13.
Em 13/09 cada áudio novo passou pelo Whisper (transcrição automática) e foi gerado de novo quando a
transcrição não batia com o texto — assim saiu, por exemplo, o 巴西 que a voz lia como "把戏".

**Quatro frases usam outro modelo, `eleven_v3`, com a mesma voz:** 我们都要汉堡, 林娜，你好吗, 我叫力波 e 力波，你好. No `eleven_multilingual_v2` (e também no turbo e no flash v2.5) o 汉堡 saía "一包" e o 林娜 saía "李诺" em todas as tentativas. Os arquivos existem, então o script não os refaz; um `--force` voltaria as quatro pro modelo do `voice.json`.

- **Provedor:** ElevenLabs, plano pago (uso comercial coberto pelo plano da conta)
- **Voz:** Sage - Soothing & Gentle (zh standard)
- **Modelo:** `eleven_multilingual_v2`  ·  **Formato:** mp3 44,1 kHz / 96 kbps

Só FRASE entra aqui. As palavras usam gravação de falante nativo do Wikimedia
Commons — ver `audio/nativo/CREDITS.md`. O motivo da divisão está no cabeçalho do
script: o Commons nomeia arquivo por palavra, e o defeito da voz sintética (3º tom
isolado) não aparece dentro de uma frase.

O texto enviado leva a pontuação final que o hanzi da carta não tem — sem ela a voz
lê tudo com entonação de meio de frase. Quem decide entre 。 e ？ é a tradução: o
campo `pt` termina em "?" exatamente quando a frase é pergunta.

| # | frase | texto enviado | tradução |
|---|---|---|---|
| 1 | 我是巴西人 | 我是巴西人。 | Eu sou brasileiro |
| 2 | 我是学生 | 我是学生。 | Eu sou estudante |
| 3 | 他是日本人 | 他是日本人。 | Ele é japonês |
| 4 | 我不是老师 | 我不是老师。 | Eu não sou professor |
| 5 | 你是老师吗 | 你是老师吗？ | Você é professor? |
| 6 | 她是我姐姐 | 她是我姐姐。 | Ela é minha irmã mais velha |
| 7 | 我们都是大学生 | 我们都是大学生。 | Nós somos todos universitários |
| 8 | 我也是巴西人 | 我也是巴西人。 | Eu também sou brasileiro |
| 9 | 你是大学生，对不对 | 你是大学生，对不对？ | Você é universitário, não é? |
| 10 | 我很累 | 我很累。 | Estou muito cansado |
| 11 | 他也很忙 | 他也很忙。 | Ele também está ocupado |
| 12 | 我不渴 | 我不渴。 | Não estou com sede |
| 13 | 你饿吗 | 你饿吗？ | Você está com fome? |
| 14 | 我们都很忙 | 我们都很忙。 | Estamos todos ocupados |
| 15 | 他说他很忙 | 他说他很忙。 | Ele diz que está ocupado |
| 16 | 你叫什么名字 | 你叫什么名字？ | Como você se chama? |
| 17 | 我叫林娜 | 我叫林娜。 | Eu me chamo Lin Na |
| 18 | 我要喝水 | 我要喝水。 | Quero beber água |
| 19 | 你要喝什么 | 你要喝什么？ | O que você quer beber? |
| 20 | 我不喝啤酒 | 我不喝啤酒。 | Eu não bebo cerveja |
| 21 | 我要喝啤酒 | 我要喝啤酒。 | Quero beber cerveja |
| 22 | 你要喝啤酒吗 | 你要喝啤酒吗？ | Você quer beber cerveja? |
| 23 | 我很渴，我要喝啤酒 | 我很渴，我要喝啤酒。 | Estou com sede, quero beber cerveja |
| 24 | 我爸爸很喜欢喝啤酒 | 我爸爸很喜欢喝啤酒。 | Meu pai gosta muito de beber cerveja |
| 25 | 我们都喜欢喝啤酒 | 我们都喜欢喝啤酒。 | Todos nós gostamos de beber cerveja |
| 26 | 他不喝啤酒，他喝茶 | 他不喝啤酒，他喝茶。 | Ele não bebe cerveja, ele bebe chá |
| 27 | 老师也喝啤酒吗 | 老师也喝啤酒吗？ | O professor também bebe cerveja? |
| 28 | 我喜欢喝茶 | 我喜欢喝茶。 | Eu gosto de beber chá |
| 29 | 他喜欢音乐 | 他喜欢音乐。 | Ele gosta de música |
| 30 | 我爱我妈妈 | 我爱我妈妈。 | Eu amo minha mãe |
| 31 | 我不喜欢数学 | 我不喜欢数学。 | Não gosto de matemática |
| 32 | 我喜欢音乐课 | 我喜欢音乐课。 | Eu gosto da aula de música |
| 33 | 你好吗 | 你好吗？ | Você está bem? |
| 34 | 我很好，谢谢 | 我很好，谢谢。 | Estou bem, obrigado |
| 35 | 我很好，你呢 | 我很好，你呢？ | Estou bem, e você? |
| 36 | 我们是朋友 | 我们是朋友。 | Nós somos amigos |
| 37 | 他是我男朋友 | 他是我男朋友。 | Ele é meu namorado |
| 38 | 你也是巴西人吗 | 你也是巴西人吗？ | Você também é brasileiro? |
| 39 | 丁老师是中国人 | 丁老师是中国人。 | O professor Ding é chinês |
| 40 | 我妹妹是学生 | 我妹妹是学生。 | Minha irmã mais nova é estudante |
| 41 | 打开门，我很热 | 打开门，我很热。 | Abra a porta, estou com calor |
| 42 | 我很困，我要喝咖啡 | 我很困，我要喝咖啡。 | Estou com sono, quero beber café |
| 43 | 我很饿，我要米饭 | 我很饿，我要米饭。 | Estou com fome, quero arroz |
| 44 | 打开书 | 打开书。 | Abra o livro |
| 45 | 打开门 | 打开门。 | Abra a porta |
| 46 | 打开书，第二十页 | 打开书，第二十页。 | Abram o livro na página 20 |
| 47 | 打开书，第三十五页 | 打开书，第三十五页。 | Abram o livro na página 35 |
| 48 | 打开书，第一百页 | 打开书，第一百页。 | Abram o livro na página 100 |
| 49 | 老师说，打开书，第八页 | 老师说，打开书，第八页。 | O professor disse: abram o livro na página 8 |
| 50 | 生日快乐 | 生日快乐。 | Feliz aniversário |
| 51 | 新年快乐 | 新年快乐。 | Feliz ano novo |
| 52 | 我很高兴 | 我很高兴。 | Estou feliz |
| 53 | 为你 | 为你。 | Por você |
| 54 | 他是我丈夫 | 他是我丈夫。 | Ele é meu marido |
| 55 | 我先生是律师 | 我先生是律师。 | Meu esposo é advogado |
| 56 | 我儿子是大学生 | 我儿子是大学生。 | Meu filho é universitário |
| 57 | 我女儿很开心 | 我女儿很开心。 | Minha filha está feliz |
| 58 | 我非常累 | 我非常累。 | Estou extremamente cansado |
| 59 | 你为什么不喝啤酒 | 你为什么不喝啤酒？ | Por que você não bebe cerveja? |
| 60 | 我是医生 | 我是医生。 | Eu sou médico |
| 61 | 他是加拿大人 | 他是加拿大人。 | Ele é canadense |
| 62 | 我说中文 | 我说中文。 | Eu falo chinês |
| 63 | 你说英语吗 | 你说英语吗？ | Você fala inglês? |
| 64 | 我今天有英文课 | 我今天有英文课。 | Tenho aula de inglês hoje |
| 65 | 我今天上课 | 我今天上课。 | Hoje eu tenho aula |
| 66 | 我也很好 | 我也很好。 | Eu também estou bem |
| 67 | 你们好 | 你们好。 | Olá, pessoal |
| 68 | 他们都很好 | 他们都很好。 | Eles estão todos bem |
| 69 | 你忙吗 | 你忙吗？ | Você está ocupado? |
| 70 | 我不忙 | 我不忙。 | Não estou ocupado |
| 71 | 他很忙 | 他很忙。 | Ele está ocupado |
| 72 | 你男朋友呢 | 你男朋友呢？ | E o seu namorado? |
| 73 | 你爸爸妈妈好吗 | 你爸爸妈妈好吗？ | Seus pais estão bem? |
| 74 | 你爸爸妈妈都好吗 | 你爸爸妈妈都好吗？ | Seus pais estão bem, os dois? |
| 75 | 你要咖啡吗 | 你要咖啡吗？ | Você quer café? |
| 76 | 我要咖啡 | 我要咖啡。 | Eu quero café |
| 77 | 我也要咖啡 | 我也要咖啡。 | Eu também quero café |
| 78 | 我们都喝咖啡 | 我们都喝咖啡。 | Todos nós bebemos café |
| 79 | 我很好 | 我很好。 | Estou bem |
| 80 | 林娜，你好吗 | 林娜，你好吗？ | Lin Na, como vai? |
| 81 | 力波，你好 | 力波，你好。 | Oi, Libo |
| 82 | 我哥哥很忙 | 我哥哥很忙。 | Meu irmão mais velho está ocupado |
| 83 | 我弟弟不忙 | 我弟弟不忙。 | Meu irmão mais novo não está ocupado |
| 84 | 你妹妹好吗 | 你妹妹好吗？ | Sua irmã mais nova está bem? |
| 85 | 我爷爷很好 | 我爷爷很好。 | Meu avô está bem |
| 86 | 他们都不忙 | 他们都不忙。 | Nenhum deles está ocupado |
| 87 | 你们都好吗 | 你们都好吗？ | Vocês estão todos bem? |
| 88 | 我也不忙 | 我也不忙。 | Eu também não estou ocupado |
| 89 | 你要可乐吗 | 你要可乐吗？ | Você quer Coca-Cola? |
| 90 | 我不要咖啡 | 我不要咖啡。 | Não quero café |
| 91 | 我要苹果 | 我要苹果。 | Eu quero maçã |
| 92 | 我们都要汉堡 | 我们都要汉堡。 | Todos nós queremos hambúrguer |
| 93 | 你喝咖啡吗 | 你喝咖啡吗？ | Você bebe café? |
| 94 | 我不喝咖啡 | 我不喝咖啡。 | Eu não bebo café |
| 95 | 我男朋友很忙 | 我男朋友很忙。 | Meu namorado está ocupado |
| 96 | 你哥哥呢 | 你哥哥呢？ | E o seu irmão mais velho? |
| 97 | 我叫力波 | 我叫力波。 | Eu me chamo Libo |
| 98 | 她叫什么名字 | 她叫什么名字？ | Como ela se chama? |
| 99 | 你姐姐叫什么名字 | 你姐姐叫什么名字？ | Como se chama sua irmã mais velha? |
| 100 | 我很饿，你呢 | 我很饿，你呢？ | Estou com fome, e você? |
| 101 | 我不累 | 我不累。 | Não estou cansado |
| 102 | 你困吗 | 你困吗？ | Você está com sono? |
| 103 | 我很渴，我要喝果汁 | 我很渴，我要喝果汁。 | Estou com sede, quero beber suco |
| 104 | 你要喝牛奶吗 | 你要喝牛奶吗？ | Você quer beber leite? |
| 105 | 我妹妹不喝汽水 | 我妹妹不喝汽水。 | Minha irmã mais nova não bebe refrigerante |
| 106 | 打开书，第六页 | 打开书，第六页。 | Abram o livro na página 6 |
| 107 | 他们都很累 | 他们都很累。 | Eles estão todos cansados |
| 108 | 我弟弟很困 | 我弟弟很困。 | Meu irmão mais novo está com sono |
| 109 | 我是巴西人，你呢 | 我是巴西人，你呢？ | Sou brasileiro, e você? |
| 110 | 你有哥哥吗 | 你有哥哥吗？ | Você tem irmão mais velho? |
| 111 | 我有姐姐 | 我有姐姐。 | Eu tenho irmã mais velha |
| 112 | 我喜欢喝牛奶 | 我喜欢喝牛奶。 | Eu gosto de beber leite |
| 113 | 你喜欢喝什么 | 你喜欢喝什么？ | O que você gosta de beber? |
| 114 | 我今天很忙 | 我今天很忙。 | Hoje estou ocupado |
| 115 | 你今天忙吗 | 你今天忙吗？ | Você está ocupado hoje? |
| 116 | 谢谢老师 | 谢谢老师。 | Obrigado, professor |
| 117 | 老师好 | 老师好。 | Olá, professor |
| 118 | 我妈妈是医生 | 我妈妈是医生。 | Minha mãe é médica |
| 119 | 我哥哥是律师 | 我哥哥是律师。 | Meu irmão mais velho é advogado |
| 120 | 你爸爸是老师吗 | 你爸爸是老师吗？ | Seu pai é professor? |
| 121 | 今天有课吗 | 今天有课吗？ | Hoje tem aula? |
