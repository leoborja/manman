#!/usr/bin/env python3
"""Gera strokes/strokes.json — traços (outline SVG) e medianas de cada caractere
do deck, extraídos do makemeahanzi (open source, arcticfox/GPL — dados de traçado).

Rodar quando entrar carta com caractere novo:
  python3 tools/build_strokes.py

Baixa graphics.txt (~14MB) pra /tmp na primeira vez.
"""
import json
import os
import re
import urllib.request

GRAPHICS = "/tmp/makemeahanzi-graphics.txt"
URL = "https://raw.githubusercontent.com/skishore/makemeahanzi/master/graphics.txt"

here = os.path.dirname(os.path.abspath(__file__))
root = os.path.join(here, "..")

if not os.path.exists(GRAPHICS):
    print("Baixando graphics.txt do makemeahanzi…")
    urllib.request.urlretrieve(URL, GRAPHICS)

# caracteres = todos os hanzi dos campos hanzi do seed
with open(os.path.join(root, "seed", "seed_cards.json"), encoding="utf-8") as f:
    cards = json.load(f)
wanted = set()
for c in cards:
    wanted.update(re.findall(r"[一-鿿㐀-䶿]", c["hanzi"]))

out = {}
with open(GRAPHICS, encoding="utf-8") as f:
    for line in f:
        d = json.loads(line)
        ch = d["character"]
        if ch in wanted:
            out[ch] = {"s": d["strokes"], "m": d["medians"]}

missing = wanted - set(out)
if missing:
    print("⚠️ sem dados de traçado:", " ".join(sorted(missing)))

dst = os.path.join(root, "strokes", "strokes.json")
os.makedirs(os.path.dirname(dst), exist_ok=True)
with open(dst, "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
print(f"{dst}: {len(out)} caracteres, {os.path.getsize(dst)/1024:.0f} KB")
