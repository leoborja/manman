# Áudio das histórias — voz sintética

Uma faixa por linha de história (`<id>-NN.mp3`, NN = posição da linha), para o
modo 📖 Histórias. O texto está em `seed/historias.json`.

**`h-conhecer` e `h-lina-ocupada`** vieram prontas, com texto e áudio, do
artefato "Histórias do Mànmàn" que um amigo da turma fez no Claude (2026-09-24).
O áudio veio junto com o texto e foi usado como está; o formato (mp3 44,1 kHz /
96 kbps, mono) é o mesmo das frases, mas a voz usada não está documentada.

As próximas saem do `tools/build_audio_historias.py`, com a mesma voz e o mesmo
modelo das frases (`tools/voice.json`): ElevenLabs, plano pago, mp3 44,1 kHz /
96 kbps. Ver `audio/frases/CREDITS.md`.
