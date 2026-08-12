#!/usr/bin/env python3
"""Gera fonts/hanzi.woff2 — subset da LXGW WenKai (estilo kaiti/caligráfico)
com todos os caracteres CJK usados no app (seed, index.html, app.js).

Rodar sempre que entrar carta com caractere novo:
  python3 tools/build_font.py [caminho-da-LXGWWenKai-Regular.ttf]

A fonte completa (~19MB) NÃO vai pro repo — só o subset.
"""
import re
import subprocess
import sys
import os

here = os.path.dirname(os.path.abspath(__file__))
root = os.path.join(here, "..")
src_font = sys.argv[1] if len(sys.argv) > 1 else "/tmp/LXGWWenKai-Regular.ttf"

chars = set()
for path in ["seed/seed_cards.json", "index.html", "app.js"]:
    with open(os.path.join(root, path), encoding="utf-8") as f:
        text = f.read()
    # CJK unificado + extensões comuns + pontuação CJK
    chars.update(re.findall(r"[　-〿㐀-䶿一-鿿豈-﫿！-｠]", text))

if not chars:
    sys.exit("Nenhum caractere CJK encontrado.")

unicodes = ",".join(f"U+{ord(c):04X}" for c in sorted(chars))
out = os.path.join(root, "fonts", "hanzi.woff2")
os.makedirs(os.path.dirname(out), exist_ok=True)

subprocess.run([
    sys.executable, "-m", "fontTools.subset", src_font,
    f"--unicodes={unicodes}",
    "--flavor=woff2",
    f"--output-file={out}",
    "--layout-features=*",
    "--no-hinting",
], check=True)

size = os.path.getsize(out) / 1024
print(f"{out}: {len(chars)} caracteres, {size:.0f} KB")
