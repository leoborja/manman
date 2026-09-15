#!/usr/bin/env python3
"""Baixa audio/nativo/<id>.mp3 — gravações de falantes nativos do Wikimedia Commons
(projetos Shtooka e Lingua Libre), convertidas pra .mp3 porque o Safari do iPhone não toca ogg.

Decisão (14/08): o TTS não faz o 3º tom completo (só a descida, sem a subida) — o
professor apontou. Gravação humana resolve; ver audio/nativo/CREDITS.md.

Rodar quando entrar carta nova:
  python3 tools/build_audio_nativo.py [--force]

Os arquivos do Commons são nomeados por PINYIN, não por caractere — então uma carta
pode receber a gravação de um homófono (九 jiǔ recebe a gravação de 久 jiǔ). O som é
idêntico; o script registra o caractere real de cada arquivo no CREDITS pra ficar honesto.

Lingua Libre (13/09): nomeia por CARACTERE (LL-Q9192 (cmn)-<falante>-中国.wav) e costuma
ter várias vozes, então resolve o homófono e a palavra que o Shtooka não tem. Com mais de
uma voz por palavra a escolha não é automática: mora em tools/audio_lingualibre.json
(id da carta → arquivo), e o script usa o escolhido antes de procurar no Shtooka.
Precisa de ffmpeg no PATH.
"""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sync_guard import exigir_atualizado  # noqa: E402
import json
import re
import shutil
import subprocess
import time
import urllib.parse
import urllib.request

exigir_atualizado()

API = "https://commons.wikimedia.org/w/api.php"
UA = "manman-flashcards/1.0 (leo@cloudarbitration.com)"

here = os.path.dirname(os.path.abspath(__file__))
root = os.path.abspath(os.path.join(here, ".."))
dest = os.path.join(root, "audio", "nativo")


def busca(url):
    """GET com espera progressiva — o Wikimedia devolve 429 se apertar o passo."""
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for tentativa in range(5):
        try:
            with urllib.request.urlopen(req) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code != 429 or tentativa == 4:
                raise
            espera = 2 ** tentativa * 3
            print(f"   429 — esperando {espera}s…")
            time.sleep(espera)


def api(params):
    params["format"] = "json"
    return json.loads(busca(API + "?" + urllib.parse.urlencode(params)))


def limpa(html):
    return " ".join(re.sub("<[^>]+>", "", html or "").split())


ESCOLHAS = os.path.join(here, "audio_lingualibre.json")
escolhidas = {}
if os.path.exists(ESCOLHAS):
    with open(ESCOLHAS, encoding="utf-8") as f:
        escolhidas = json.load(f)


def candidatos(card):
    py = card["pinyin"].replace(" ", "").lower()
    lista = [f"File:Zh-{py}.ogg", f"File:Zh-{py}.oga", f"File:Zh-{card['hanzi']}.ogg"]
    # a gravação escolhida da Lingua Libre vem na frente: é do caractere exato
    if card["id"] in escolhidas:
        lista.insert(0, escolhidas[card["id"]]["titulo"])
    return lista


def consulta_lote(cards):
    """Uma chamada à API por 50 títulos em vez de uma por carta — o Wikimedia
    devolve 429 se levar 34 requisições em rajada, e isso só piora com o deck maior.
    Devolve {titulo: (url, licenca, autor, caractere_gravado)}."""
    titulos = []
    for c in cards:
        for t in candidatos(c):
            if t not in titulos:
                titulos.append(t)
    achados = {}
    for i in range(0, len(titulos), 50):
        d = api({"action": "query", "titles": "|".join(titulos[i:i + 50]),
                 "prop": "imageinfo", "iiprop": "url|extmetadata"})
        # a API normaliza títulos (espaço/underscore) — segue o mapa pra não perder nada
        norm = {n["to"]: n["from"] for n in d["query"].get("normalized", [])}
        for p in d["query"]["pages"].values():
            if "missing" in p:
                continue
            ii = p["imageinfo"][0]
            m = ii["extmetadata"]
            desc = limpa(m.get("ImageDescription", {}).get("value", ""))
            real = re.search(r"\(([^)]+)\)", desc)
            # Lingua Libre: o nome do arquivo termina no que foi gravado (LL-…-中国.wav)
            ll = re.match(r"File:LL-.+-([^-]+)\.\w+$", p["title"])
            dados = (ii["url"].split("?")[0],
                     m.get("LicenseShortName", {}).get("value", "?"),
                     limpa(m.get("Artist", {}).get("value", "")) or "—",
                     ll.group(1) if ll else real.group(1) if real else "?")
            achados[p["title"]] = dados
            if p["title"] in norm:
                achados[norm[p["title"]]] = dados
        time.sleep(0.5)
    return achados


def main():
    if not shutil.which("ffmpeg"):
        sys.exit("ffmpeg não encontrado — brew install ffmpeg")
    force = "--force" in sys.argv
    with open(os.path.join(root, "seed", "seed_cards.json"), encoding="utf-8") as f:
        cards = json.load(f)
    # Frases ficam de fora: o Commons nomeia os arquivos por sílaba de PALAVRA, então
    # procurar "Zh-wo shi baxi ren.ogg" é consulta garantidamente vazia — e ainda
    # engordaria a lista de "sem gravação" com coisas que nunca vão ter uma. Elas caem
    # no TTS do aparelho, que é justamente onde ele é bom: o defeito conhecido é o 3º
    # tom ISOLADO, e numa frase inteira não existe sílaba isolada.
    frases = [c for c in cards if c.get("tipo") == "frase"]
    cards = [c for c in cards if c.get("tipo", "palavra") != "frase"]
    # carta tirada (deleted) não aparece no app: procurar gravação pra ela só engorda a
    # lista de "sem gravação" com o que ninguém vai ouvir
    cards = [c for c in cards if not c.get("deleted")]
    if frases:
        print(f"({len(frases)} frase(s) fora da busca — vão de TTS)")
    os.makedirs(dest, exist_ok=True)

    achados = consulta_lote(cards)

    # que arquivo cada carta usava na rodada anterior — é o que diz se a escolha mudou e o
    # MP3 precisa ser baixado de novo, sem --force (que rebaixaria o deck inteiro)
    anterior = {}
    cred = os.path.join(dest, "CREDITS.md")
    if os.path.exists(cred):
        with open(cred, encoding="utf-8") as f:
            for ln in f:
                m = re.match(r"\| (.+?) \| (.+?) \| \[(.+?)\]\(", ln)
                if m:
                    anterior[(m.group(1), m.group(2))] = "File:" + m.group(3)

    creditos, faltando, baixadas = [], [], 0
    for c in cards:
        out = os.path.join(dest, c["id"] + ".mp3")
        titulo = next((t for t in candidatos(c) if t in achados), None)
        if not titulo:
            faltando.append(f"{c['hanzi']} ({c['pinyin']})")
            continue
        url, lic, autor, real = achados[titulo]
        creditos.append((c["hanzi"], c["pinyin"], titulo, real, autor, lic))
        mudou = anterior.get((c["hanzi"], c["pinyin"])) not in (None, titulo)
        if os.path.exists(out) and not force and not mudou:
            continue
        tmp = out + ".orig"
        with open(tmp, "wb") as f:
            f.write(busca(url))
        filtro = []
        if titulo.startswith("File:LL-"):
            # a Lingua Libre grava com meio segundo de folga e o volume varia de voz pra
            # voz: corta o silêncio das pontas e iguala o volume ao resto do deck
            filtro = ["-af", "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,"
                             "areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.08,"
                             "areverse,loudnorm=I=-18:TP=-1.5", "-ac", "1", "-ar", "44100"]
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", tmp, *filtro,
                        "-codec:a", "libmp3lame", "-q:a", "4", out], check=True)
        os.remove(tmp)
        baixadas += 1
        marca = "" if real == c["hanzi"] else f"  ⚠️ gravação é de {real} (homófono)"
        print(f"🔊 {c['hanzi']} {c['pinyin']:<9} {os.path.getsize(out)//1024} KB{marca}")
        time.sleep(1.2)

    with open(os.path.join(dest, "CREDITS.md"), "w", encoding="utf-8") as f:
        f.write("# Créditos — áudio de falantes nativos\n\n")
        f.write("Gravações do [Wikimedia Commons](https://commons.wikimedia.org) "
                "(projetos Shtooka e Lingua Libre), convertidas pra .mp3 — o Safari do iPhone não toca ogg.\n\n")
        f.write("**Uso comercial:** permitido pelas duas licenças, exigindo atribuição — "
                "que o app faz na tela Créditos (aba Progresso). A conversão de formato não "
                "aciona o share-alike do CC BY-SA: a §3 da licença diz que *\"the above rights "
                "include the right to make such modifications as are technically necessary to "
                "exercise the rights in other media and formats\"*, ou seja, mudar de container "
                "não cria obra derivada.\n\n")
        f.write("Os arquivos do Shtooka (Zh-…) são nomeados por pinyin, não por caractere — quando a "
                "gravação é de um homófono, a coluna 'gravação de' mostra qual. Os da Lingua Libre "
                "(LL-…) são por caractere, escolhidos um a um em tools/audio_lingualibre.json.\n\n")
        f.write("**Modificação nos arquivos da Lingua Libre:** cortamos o silêncio do começo e do fim "
                "e igualamos o volume ao do resto do deck. Fica indicado aqui, como a licença pede; "
                "o MP3 resultante segue a licença do original (CC BY-SA 4.0 ou CC0).\n\n")
        f.write("| Carta | Pinyin | Arquivo | Gravação de | Autor | Licença |\n")
        f.write("|---|---|---|---|---|---|\n")
        for hz, py, tit, real, autor, lic in creditos:
            nome = tit.replace("File:", "")
            link = f"https://commons.wikimedia.org/wiki/{urllib.parse.quote(tit.replace(' ', '_'))}"
            f.write(f"| {hz} | {py} | [{nome}]({link}) | {real} | {autor} | {lic} |\n")

    print(f"\n{len(creditos)} cartas com gravação nativa ({baixadas} baixadas agora)")
    if faltando:
        print(f"sem gravação no Commons ({len(faltando)}): {', '.join(faltando)}")
        print("→ essas continuam no TTS do aparelho (o speak() cai pro TTS quando não há audio_url)")

    # aponta audio_url pro MP3 quando o arquivo existe, e limpa quando não existe
    # (carta sem audio_url cai pro TTS sozinha — é o fallback do speak())
    url_sb = os.environ.get("SUPABASE_URL", "").rstrip("/")
    skey = os.environ.get("SUPABASE_SERVICE_KEY", "")
    if not (url_sb and skey):
        print("\nSUPABASE_URL/SERVICE_KEY ausentes — banco não atualizado (só arquivos locais)")
        return
    ligadas = 0
    for c in cards:
        tem = os.path.exists(os.path.join(dest, c["id"] + ".mp3"))
        valor = f"./audio/nativo/{c['id']}.mp3" if tem else None
        req = urllib.request.Request(
            f"{url_sb}/rest/v1/cards?id=eq.{urllib.parse.quote(c['id'])}",
            data=json.dumps({"audio_url": valor}).encode(),
            headers={"apikey": skey, "Authorization": "Bearer " + skey,
                     "Content-Type": "application/json"},
            method="PATCH")
        urllib.request.urlopen(req).read()
        ligadas += 1 if tem else 0
    print(f"audio_url no Supabase: {ligadas} cartas com gravação, {len(cards) - ligadas} no TTS")


if __name__ == "__main__":
    main()
