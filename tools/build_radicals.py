#!/usr/bin/env python3
"""Gera strokes/radicals.json — a que componente cada TRAÇO de cada caractere do
deck pertence, pra Grade poder pintar um radical de azul dentro do pictograma.

Rodar quando entrar carta com caractere novo (junto do build_strokes.py):
  python3 tools/build_radicals.py

Baixa dictionary.txt (~2MB) pra /tmp na primeira vez.

O dado que importa é o `matches` do makemeahanzi: uma lista com um item por traço,
dizendo a que COMPONENTE de 1º nível da decomposição aquele traço pertence. Com
ele, "pintar o radical 氵" vira "pintar os traços cujo componente é 氵" — que é
uma consulta que roda no navegador, sem cálculo de geometria nenhum.

Só componentes de 1º nível: é onde moram os radicais que ensinam (氵 água, 女
mulher, 口 boca, 木 árvore…). Radical enfiado fundo na árvore de decomposição fica
de fora, e tudo bem — ninguém marca "o 亅 lá dentro do 可".

O QUE ESTE SCRIPT NÃO FAZ: decidir o que é radical "de verdade" nem traduzir nada.
Ele só mapeia traço→componente, mecanicamente. Quais componentes viram opção no
seletor, e o que cada um quer dizer em português, é o RADICAIS do app.js — porque
isso é conhecimento (o significado do radical), não um recorte do deck, e mistura
decisão de conteúdo num script que devia ser burro.
"""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sync_guard import exigir_atualizado  # noqa: E402
import datetime
import json
import re
import urllib.request

exigir_atualizado()

DICT = "/tmp/makemeahanzi-dictionary.txt"
URL = "https://raw.githubusercontent.com/skishore/makemeahanzi/master/dictionary.txt"

here = os.path.dirname(os.path.abspath(__file__))
root = os.path.join(here, "..")

if not os.path.exists(DICT):
    print("Baixando dictionary.txt do makemeahanzi…")
    urllib.request.urlretrieve(URL, DICT)

# os caracteres do deck são os mesmos do strokes.json — a numeração de traço deste
# arquivo tem que casar com a de lá, então parte-se da mesma fonte de caracteres
with open(os.path.join(root, "seed", "seed_cards.json"), encoding="utf-8") as f:
    cards = json.load(f)
wanted = set()
for c in cards:
    wanted.update(re.findall(r"[一-鿿㐀-䶿]", c["hanzi"]))

IDS = "⿰⿱⿲⿳⿴⿵⿶⿷⿸⿹⿺⿻"


def arity(ch):
    return 3 if ch in "⿲⿳" else 2


def toplevel(dec):
    """Componentes de 1º nível da decomposição, na ordem em que o `matches` os indexa."""
    if not dec or dec[0] not in IDS:
        return [dec]
    out = []

    def parse(i):
        ch = dec[i]
        if ch in IDS:
            i += 1
            for _ in range(arity(ch)):
                i = parse(i)
            return i
        return i + 1

    i = 1
    for _ in range(arity(dec[0])):
        j = parse(i)
        out.append(dec[i:j])
        i = j
    return out


db = {}
for line in open(DICT, encoding="utf-8"):
    d = json.loads(line)
    if d["character"] in wanted:
        db[d["character"]] = d

# saída: char → { componente : [índices de traço] }. Só componente ATÔMICO (um único
# hanzi, sem IDC dentro): é o que se marca como radical. Componente composto (⿱…) não
# é radical, é galho da árvore.
out = {}
faltando = []
for ch in sorted(wanted):
    d = db.get(ch)
    if not d:
        faltando.append(ch)
        continue
    dec = d.get("decomposition", "")
    m = d.get("matches")
    # caractere que é ele mesmo (sem IDC): o próprio caractere é o componente, e todos
    # os traços são dele. É o que faz o card do 女 acender inteiro quando se marca 女.
    if not dec or dec[0] not in IDS or not m:
        n = len(m) if m else len((d.get("strokes") or []))
        if n:
            out[ch] = {ch: list(range(n))}
        continue
    tl = toplevel(dec)
    comp = {}
    for i, mm in enumerate(m):
        if not mm:
            continue
        ci = mm[0]
        if ci is None or ci >= len(tl):
            continue
        c = tl[ci]
        if len(c) != 1 or c in IDS:
            continue  # componente composto não é radical
        comp.setdefault(c, []).append(i)
    if comp:
        out[ch] = comp

if faltando:
    print("⚠️ sem dados de decomposição:", " ".join(faltando))

# de quebra: quantos caracteres cada componente pega, pra saber o que vale a pena
# rotular no app.js (componente que só aparece uma vez não ensina relação nenhuma)
freq = {}
for ch, comp in out.items():
    for c in comp:
        freq[c] = freq.get(c, 0) + 1
compart = sorted((c for c, n in freq.items() if n >= 2), key=lambda c: -freq[c])

out["_"] = {
    "aviso": (f"Gerado em {datetime.date.today().isoformat()} para o app Manman: "
              f"traco->componente dos {len(out)} caracteres do deck, do campo "
              "'matches' do dictionary.txt do makemeahanzi."),
    "origem": "https://github.com/skishore/makemeahanzi",
    "licenca": "dados de decomposicao do makemeahanzi (CC-BY 4.0)",
}

dst = os.path.join(root, "strokes", "radicals.json")
with open(dst, "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, separators=(",", ":"))

print(f"{dst}: {len(out) - 1} caracteres, {os.path.getsize(dst)/1024:.0f} KB")
print("componentes em >=2 caracteres (candidatos a rótulo no app.js):")
print("  " + " ".join(f"{c}·{freq[c]}" for c in compart))
