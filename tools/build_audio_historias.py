#!/usr/bin/env python3
"""Gera audio/historias/<id>-NN.mp3 — uma faixa por linha de história (PAGO: ElevenLabs).

    source ~/.config/manman.env && python3 tools/build_audio_historias.py [--force]

Mesma voz e mesmo modelo das frases (tools/voice.json), pelo mesmo motivo: frase
inteira nunca terá gravação humana no Commons, e o defeito da voz sintética — o
3º tom isolado — não aparece dentro de uma frase.

Uma faixa por LINHA, e não a história inteira num arquivo: o app toca a linha
que se toca e acende a que está tocando no "ouvir tudo". Com um arquivo só não
haveria onde cortar.

Só gera o que falta. O número é a posição da linha (01, 02…), então ACRESCENTAR
linha no fim é barato, mas inserir no meio desalinha todas as de baixo — nesse
caso apague as faixas daquela história e rode de novo.

Não roda com história fora do escopo: o check_historias.py vem antes, e o que
ele recusa não vira áudio pago.
"""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sync_guard import exigir_atualizado  # noqa: E402
from check_historias import problemas  # noqa: E402
import json
import time
import urllib.request

exigir_atualizado()

here = os.path.dirname(os.path.abspath(__file__))
root = os.path.abspath(os.path.join(here, ".."))
dest = os.path.join(root, "audio", "historias")

with open(os.path.join(here, "voice.json")) as f:
    VOICE = json.load(f)


def tts(key, texto, out_path):
    body = json.dumps({
        "text": texto,
        "model_id": VOICE.get("model_id", "eleven_multilingual_v2"),
        "voice_settings": {"stability": 0.6, "similarity_boost": 0.8},
    }).encode()
    req = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE['voice_id']}"
        "?output_format=mp3_44100_96",
        data=body,
        headers={"xi-api-key": key, "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req) as r:
        audio = r.read()
    with open(out_path, "wb") as f:
        f.write(audio)


def main():
    force = "--force" in sys.argv
    historias, erros = problemas()
    if erros:
        for e in erros:
            print("✗", e)
        sys.exit("história com problema — nada foi gerado (ver tools/check_historias.py)")

    faltam = []
    for h in historias:
        for i, l in enumerate(h["linhas"], 1):
            out = os.path.join(dest, f"{h['id']}-{i:02d}.mp3")
            if force or not os.path.exists(out):
                faltam.append((out, l))
    if not faltam:
        print("todas as linhas já têm áudio")
        return

    key = os.environ.get("ELEVEN_API_KEY", "")
    if not key:
        sys.exit("ELEVEN_API_KEY ausente — está em ~/.config/manman.env")

    os.makedirs(dest, exist_ok=True)
    for out, l in faltam:
        # A linha já vem pontuada (。？！), ao contrário da carta — é texto
        # corrido, escrito com a pontuação no lugar.
        tts(key, l["hanzi"], out)
        print(f"🗣️  {l['hanzi']}  ({os.path.getsize(out) // 1024} KB)  {l['pt']}")
        time.sleep(0.4)
    print(f"\n{len(faltam)} faixas geradas")


if __name__ == "__main__":
    main()
