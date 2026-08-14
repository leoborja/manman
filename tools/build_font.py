#!/usr/bin/env python3
"""Gera fonts/hanzi.woff2 — subset da AR PL UKai CN (文鼎PL中楷), 楷书 clássico
de pincel, com todos os caracteres CJK usados no app (seed, index.html, app.js).

Fonte de origem (Arphic Public License, redistribuição livre):
  curl -sLO http://ftp.debian.org/debian/pool/main/f/fonts-arphic-ukai/fonts-arphic-ukai_0.2.20080216.2.orig.tar.bz2
  tar xjf fonts-arphic-ukai_0.2.20080216.2.orig.tar.bz2   # → .../ukai.ttc

Rodar sempre que entrar carta com caractere novo:
  python3 tools/build_font.py [caminho-do-ukai.ttc]

O ukai.ttc tem 4 faces (CN, HK, TW, TW MBE) — usamos a CN, de formas simplificadas.
A fonte completa (~20MB) NÃO vai pro repo — só o subset.
"""
import re
import subprocess
import sys
import os

here = os.path.dirname(os.path.abspath(__file__))
root = os.path.join(here, "..")
src_font = sys.argv[1] if len(sys.argv) > 1 else "/tmp/ukai.ttc"
FACE_CN = 0  # índice da face "AR PL UKai CN" dentro do .ttc

chars = set()
for path in ["seed/seed_cards.json", "index.html", "app.js"]:
    with open(os.path.join(root, path), encoding="utf-8") as f:
        text = f.read()
    # CJK unificado + extensões comuns + pontuação CJK
    chars.update(re.findall(r"[　-〿㐀-䶿一-鿿豈-﫿！-｠]", text))

if not chars:
    sys.exit("Nenhum caractere CJK encontrado.")

unicodes = ",".join(f"U+{ord(c):04X}" for c in sorted(chars))
out = os.path.join(root, "fonts", "hanzi.woff2")
os.makedirs(os.path.dirname(out), exist_ok=True)

cmd = [
    sys.executable, "-m", "fontTools.subset", src_font,
    f"--unicodes={unicodes}",
    "--flavor=woff2",
    f"--output-file={out}",
    "--layout-features=*",
    "--no-hinting",
]
if src_font.lower().endswith(".ttc"):
    cmd.append(f"--font-number={FACE_CN}")
subprocess.run(cmd, check=True)

# avisa se algum caractere do deck não existe na fonte (viraria tofu no app)
from fontTools.ttLib import TTFont  # noqa: E402  (só precisa aqui, no fim)
cmap = TTFont(out).getBestCmap()
faltando = [c for c in sorted(chars) if ord(c) not in cmap]
if faltando:
    print("⚠️  sem glifo na fonte: " + " ".join(faltando))

size = os.path.getsize(out) / 1024
print(f"{out}: {len(chars)} caracteres, {size:.0f} KB")
