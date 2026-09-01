#!/usr/bin/env python3
"""Gera audio/frases/<id>.mp3 com voz sintética (ElevenLabs) — SÓ PRA FRASE.

Por que só frase, e por que voz sintética aqui é aceitável:
o Commons nomeia os arquivos por sílaba de PALAVRA, então frase inteira é consulta
garantidamente vazia lá — as 65 nunca vão ter gravação humana. E o defeito que tirou a
voz sintética das palavras em 14/08 (3º tom ISOLADO: só a descida, sem a subida) não
existe dentro de uma frase, porque ali nenhuma sílaba está isolada.

    source ~/.config/manman.env && python3 tools/build_audio_frases.py [--force]

PALAVRA ESTE SCRIPT NÃO TOCA. Nem no arquivo, nem no banco. São três travas
independentes, porque a versão anterior deste arquivo apagava o audio_url do deck
inteiro e ficou meses marcada no README com um "não rode":

  1. a lista de trabalho é filtrada por tipo == 'frase' e nada mais entra nela
  2. o PATCH confere o id contra essa lista ANTES de mandar, e aborta se escapar algum
  3. os arquivos vão pra audio/frases/, pasta separada de audio/nativo/ — não há nome
     que colida, então nem um bug de caminho sobrescreveria gravação humana

O build_audio_nativo.py é o espelho disto: ele corta as frases logo no começo do main()
e só mexe em palavra. Os dois rodam na mesma máquina sem se ver.
"""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sync_guard import exigir_atualizado  # noqa: E402
import json
import time
import urllib.parse
import urllib.request

exigir_atualizado()

here = os.path.dirname(os.path.abspath(__file__))
root = os.path.abspath(os.path.join(here, ".."))
dest = os.path.join(root, "audio", "frases")

with open(os.path.join(here, "voice.json")) as f:
    VOICE = json.load(f)

KEY = os.environ.get("ELEVEN_API_KEY", "")
if not KEY:
    sys.exit("ELEVEN_API_KEY ausente — está em ~/.config/manman.env")

# A frase já vem com a vírgula quando tem duas orações, mas quase nenhuma termina com
# pontuação. Sem ela a voz lê tudo com a mesma entonação de meio de frase e a pergunta
# não sobe no fim.
#
# Quem decide se é pergunta é a TRADUÇÃO, não o hanzi. A primeira versão disto olhava a
# última sílaba e marcava ？ só depois de 吗/呢 — e errou 4 das 65, porque em chinês a
# pergunta também se faz com palavra interrogativa no MEIO (你叫什么名字), com a forma
# afirma-nega (对不对) ou com 为什么. Enumerar essas formas é jogo perdido; o campo `pt`
# já termina em "?" exatamente quando a frase é pergunta, e é escrito à mão carta por
# carta. Usar o dado que já existe sai mais barato e não erra.
def pontuada(card):
    hanzi = card["hanzi"]
    if hanzi[-1] in "。？！":
        return hanzi
    return hanzi + ("？" if card["pt"].rstrip().endswith("?") else "。")


def tts(texto, out_path):
    body = json.dumps({
        "text": texto,
        "model_id": VOICE.get("model_id", "eleven_multilingual_v2"),
        "voice_settings": {"stability": 0.6, "similarity_boost": 0.8},
    }).encode()
    req = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE['voice_id']}"
        "?output_format=mp3_44100_96",
        data=body,
        headers={"xi-api-key": KEY, "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req) as r:
        audio = r.read()
    with open(out_path, "wb") as f:
        f.write(audio)


def main():
    force = "--force" in sys.argv
    with open(os.path.join(root, "seed", "seed_cards.json"), encoding="utf-8") as f:
        todas = json.load(f)

    # TRAVA 1: a lista de trabalho nasce filtrada, e é a única que o resto do script vê
    frases = [c for c in todas if c.get("tipo") == "frase"]
    ids_frase = {c["id"] for c in frases}
    if not frases:
        sys.exit("nenhuma frase no seed — nada a fazer")
    print(f"{len(frases)} frases ({len(todas) - len(frases)} palavras ficam de fora, "
          "com a voz humana delas intacta)")

    os.makedirs(dest, exist_ok=True)
    gerados, ja_tinha = [], 0
    for c in frases:
        out = os.path.join(dest, c["id"] + ".mp3")
        if os.path.exists(out) and not force:
            ja_tinha += 1
            continue
        texto = pontuada(c)
        tts(texto, out)
        gerados.append(c["id"])
        print(f"🗣️  {texto}  ({os.path.getsize(out) // 1024} KB)  {c['pt']}")
        time.sleep(0.4)

    print(f"\n{len(gerados)} geradas agora, {ja_tinha} já existiam")

    url_sb = os.environ.get("SUPABASE_URL", "").rstrip("/")
    skey = os.environ.get("SUPABASE_SERVICE_KEY", "")
    if not (url_sb and skey):
        print("SUPABASE_URL/SERVICE_KEY ausentes — banco não atualizado (só arquivos)")
        return

    ligadas = 0
    for c in frases:
        # TRAVA 2: confere o id contra a lista de frases na hora de escrever. Se um dia
        # alguém mexer no filtro lá em cima e uma palavra vazar até aqui, o script morre
        # antes de mandar o PATCH em vez de apagar a gravação humana dela.
        if c["id"] not in ids_frase:
            sys.exit(f"ABORTADO: {c['id']} não é frase e chegou no PATCH")
        tem = os.path.exists(os.path.join(dest, c["id"] + ".mp3"))
        valor = f"./audio/frases/{c['id']}.mp3" if tem else None
        req = urllib.request.Request(
            f"{url_sb}/rest/v1/cards?id=eq.{urllib.parse.quote(c['id'])}",
            data=json.dumps({"audio_url": valor}).encode(),
            headers={"apikey": skey, "Authorization": "Bearer " + skey,
                     "Content-Type": "application/json"},
            method="PATCH")
        urllib.request.urlopen(req).read()
        ligadas += 1 if tem else 0
    print(f"audio_url no Supabase: {ligadas} frases com voz, "
          f"{len(frases) - ligadas} ainda no TTS do aparelho")


if __name__ == "__main__":
    main()
