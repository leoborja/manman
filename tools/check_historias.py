#!/usr/bin/env python3
"""Confere o seed/historias.json contra o deck — sem rede, sem custo.

    python3 tools/check_historias.py

A promessa do modo 📖 é "uma história que você consegue ler": o `escopo` de cada
uma diz de que origens ela tira o vocabulário, e o app só a oferece a quem
escolheu essas origens. Isso só vale se o texto cumprir o que o escopo diz. Aqui
se confere caractere por caractere — na história E nas perguntas, que também se
leem — contra os 汉字 das cartas cuja `fonte` está no escopo.

Caractere, e não palavra: segmentar chinês pede dicionário, e o furo que isto
deixa (dois caracteres conhecidos formando uma palavra que não está no deck) é
pequeno e se vê lendo. O que isto pega é o furo grande — o 超市 que entrou no
texto antes de entrar no deck.

Também confere a forma: campos obrigatórios, `certa` dentro das opções, id
único, e origem que existe.
"""
import json
import os
import sys

here = os.path.dirname(os.path.abspath(__file__))
root = os.path.abspath(os.path.join(here, ".."))


def han(t):
    return {c for c in t if "一" <= c <= "鿿"}


def problemas():
    with open(os.path.join(root, "seed", "seed_cards.json"), encoding="utf-8") as f:
        cards = json.load(f)
    with open(os.path.join(root, "seed", "historias.json"), encoding="utf-8") as f:
        historias = json.load(f)

    origens = {c.get("fonte") for c in cards if c.get("fonte")}
    erros, ids = [], set()
    for h in historias:
        hid = h.get("id", "?")
        if not hid.startswith("h-"):
            erros.append(f"{hid}: id de história começa com h- (o áudio vira {hid}-01.mp3 "
                         "num bundle achatado, junto com os ids das cartas)")
        if hid in ids:
            erros.append(f"{hid}: id repetido")
        ids.add(hid)
        for campo in ("titulo", "pinyin", "pt", "escopo", "linhas", "perguntas"):
            if not h.get(campo):
                erros.append(f"{hid}: falta `{campo}`")
        fora_do_deck = set(h.get("escopo", [])) - origens
        if fora_do_deck:
            erros.append(f"{hid}: origem que não existe no deck: {sorted(fora_do_deck)}")

        texto = h.get("titulo", "")
        for i, l in enumerate(h.get("linhas", []), 1):
            for campo in ("hanzi", "pinyin", "pt"):
                if not l.get(campo):
                    erros.append(f"{hid} linha {i}: falta `{campo}`")
            texto += l.get("hanzi", "") + (l.get("quem") or "")
        for i, q in enumerate(h.get("perguntas", []), 1):
            opcoes = q.get("opcoes", [])
            if len(opcoes) < 2:
                erros.append(f"{hid} pergunta {i}: menos de duas opções")
            if not 0 <= q.get("certa", -1) < len(opcoes):
                erros.append(f"{hid} pergunta {i}: `certa` fora das opções")
            texto += q.get("hanzi", "") + "".join(o.get("hanzi", "") for o in opcoes)

        conhecidos = set().union(*(han(c["hanzi"]) for c in cards
                                   if c.get("fonte") in h.get("escopo", [])))
        faltam = sorted(han(texto) - conhecidos)
        if faltam:
            erros.append(f"{hid}: 汉字 fora do escopo {h.get('escopo')}: {' '.join(faltam)}")
    return historias, erros


if __name__ == "__main__":
    historias, erros = problemas()
    for e in erros:
        print("✗", e)
    if erros:
        sys.exit(1)
    linhas = sum(len(h["linhas"]) for h in historias)
    print(f"✓ {len(historias)} histórias, {linhas} linhas — tudo dentro do escopo")
