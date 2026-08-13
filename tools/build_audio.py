#!/usr/bin/env python3
"""Gera audio/<id>.mp3 pra cada carta do deck com voz nativa (ElevenLabs)
e atualiza audio_url no Supabase. Roda de novo quando entrarem cartas novas
(só gera o que falta; --force regenera tudo).

Chave: ELEVEN_API_KEY no ambiente, ou lida de codes/thailearner/audio_generator.py.
Supabase: SUPABASE_URL/SUPABASE_SERVICE_KEY no ambiente (manman_supabase.env).
"""
import json
import os
import re
import sys
import time
import urllib.request

here = os.path.dirname(os.path.abspath(__file__))
root = os.path.abspath(os.path.join(here, ".."))

# partícula não existe isolada — fala dentro de frase (mesma regra do app)
AUDIO_CTX = {"ma-pergunta": "你好吗？", "ne": "我很好，你呢？"}

# voz definida em tools/voice.json (gerado na escolha da voz)
with open(os.path.join(here, "voice.json")) as f:
    VOICE = json.load(f)


def eleven_key():
    if os.environ.get("ELEVEN_API_KEY"):
        return os.environ["ELEVEN_API_KEY"]
    src = os.path.expanduser("~/Documents/codes/thailearner/audio_generator.py")
    with open(src) as f:
        m = re.search(r'API_KEY\s*=\s*"([^"]+)"', f.read())
    return m.group(1)


def tts(text, out_path, key):
    body = json.dumps({
        "text": text,
        "model_id": VOICE.get("model_id", "eleven_multilingual_v2"),
        "voice_settings": {"stability": 0.6, "similarity_boost": 0.8},
    }).encode()
    req = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE['voice_id']}?output_format=mp3_44100_96",
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
    key = eleven_key()
    with open(os.path.join(root, "seed", "seed_cards.json"), encoding="utf-8") as f:
        cards = json.load(f)
    os.makedirs(os.path.join(root, "audio"), exist_ok=True)

    generated = []
    for c in cards:
        out = os.path.join(root, "audio", c["id"] + ".mp3")
        if os.path.exists(out) and not force:
            continue
        text = AUDIO_CTX.get(c["id"], c["hanzi"])
        tts(text, out, key)
        generated.append(c["id"])
        print(f"🔊 {c['id']}: {text} ({os.path.getsize(out)//1024} KB)")
        time.sleep(0.4)

    # atualiza audio_url no Supabase (todas, idempotente)
    url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    skey = os.environ.get("SUPABASE_SERVICE_KEY", "")
    if url and skey:
        for c in cards:
            patch = json.dumps({"audio_url": f"./audio/{c['id']}.mp3"}).encode()
            req = urllib.request.Request(
                f"{url}/rest/v1/cards?id=eq.{c['id']}",
                data=patch,
                headers={"apikey": skey, "Authorization": "Bearer " + skey,
                         "Content-Type": "application/json"},
                method="PATCH",
            )
            urllib.request.urlopen(req).read()
        print(f"audio_url atualizado no Supabase pra {len(cards)} cartas")
    else:
        print("SUPABASE_URL/SERVICE_KEY ausentes — pulei atualização do banco")
    print(f"gerados agora: {len(generated)}")


if __name__ == "__main__":
    main()
