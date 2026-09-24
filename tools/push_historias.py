#!/usr/bin/env python3
"""Publica as histórias do modo 📖 no bucket público `historias` do Supabase.

    source ~/.config/manman.env && python3 tools/push_historias.py [--dry-run]

O que sobe: `seed/historias.json` e as faixas de `audio/historias/`. O app lê o
bucket primeiro, depois o que guardou da última vez, e só então o que veio
empacotado — então publicar é o que faz uma história nova chegar a quem já tem
o app instalado, SEM release. O mesmo desenho do bucket `imagens` do 🖼️.

Bucket, e não tabela: tabela nova exige DDL, e a service key não faz DDL.

O seed continua sendo a fonte de verdade que se edita à mão; o bucket é a
cópia publicada.

Travas, na ordem:
  1. o check_historias.py — vocabulário fora do escopo não é publicado
  2. toda linha precisa da faixa dela — história sem áudio completo para aqui
     (rode o build_audio_historias.py antes)
  3. só sobem as faixas que o bucket ainda não tem ou que mudaram
  4. a lista vai por ÚLTIMO: se algo falhar no meio, o app continua lendo a
     lista antiga, que só aponta para faixas que já estão lá

Cada linha da lista publicada ganha um campo `v` (o começo do md5 da faixa),
e a faixa sobe como `audio/<id>-NN-<v>.mp3`. A versão no NOME, e não só na
lista, porque o bucket público passa por CDN: regravar uma linha com o mesmo
nome deixaria o aparelho de alguém tocando a versão velha por até uma hora.
Com o nome novo não há o que ficar velho. A lista, que tem de mudar de
conteúdo sem mudar de nome, sobe com cache de um minuto.
"""
import hashlib
import json
import os
import sys
import urllib.error
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from check_historias import problemas  # noqa: E402

BUCKET = "historias"

here = os.path.dirname(os.path.abspath(__file__))
root = os.path.abspath(os.path.join(here, ".."))
pasta = os.path.join(root, "audio", "historias")

URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
seco = "--dry-run" in sys.argv


def chamar(metodo, caminho, dados=None, tipo=None, upsert=False, cache=None):
    req = urllib.request.Request(URL + caminho, data=dados, method=metodo)
    req.add_header("apikey", KEY)
    req.add_header("Authorization", "Bearer " + KEY)
    if tipo:
        req.add_header("Content-Type", tipo)
    if cache is not None:
        req.add_header("cache-control", f"max-age={cache}")
    if upsert:
        req.add_header("x-upsert", "true")  # sem isto o segundo envio volta 409
    with urllib.request.urlopen(req) as r:
        return r.status, r.read()


def faixa(hid, i):
    return f"{hid}-{i + 1:02d}"


def md5(caminho):
    with open(caminho, "rb") as f:
        return hashlib.md5(f.read()).hexdigest()[:8]


def main():
    # ── 1 e 2: o que subir, e se pode subir ──────────────────────────────
    historias, erros = problemas()
    if erros:
        for e in erros:
            print("✗", e)
        sys.exit("🛑 história com problema — nada foi publicado")

    sem_audio = [faixa(h["id"], i) for h in historias for i in range(len(h["linhas"]))
                 if not os.path.isfile(os.path.join(pasta, faixa(h["id"], i) + ".mp3"))]
    if sem_audio:
        sys.exit(f"🛑 sem áudio: {', '.join(sem_audio)}\n"
                 "   rode antes: python3 tools/build_audio_historias.py")

    versoes = {}
    for h in historias:
        for i, l in enumerate(h["linhas"]):
            nome = faixa(h["id"], i)
            l["v"] = versoes[nome] = md5(os.path.join(pasta, nome + ".mp3"))
    publicada = json.dumps(historias, ensure_ascii=False, indent=1).encode()

    if not seco and (not URL or not KEY):
        sys.exit("Defina SUPABASE_URL e SUPABASE_SERVICE_KEY no ambiente.\n"
                 "   source ~/.config/manman.env && python3 tools/push_historias.py")

    # ── o bucket ──────────────────────────────────────────────────────────
    # Público: texto de estudo e áudio sintético, e ler com a anon key evita
    # um segundo segredo dentro do app.
    anterior = {}
    if not seco:
        try:
            chamar("GET", f"/storage/v1/bucket/{BUCKET}")
        except urllib.error.HTTPError as e:
            # Bucket que não existe volta 400 com "NoSuchBucket" no corpo.
            corpo = e.read().decode(errors="replace")
            if "NoSuchBucket" not in corpo and e.code != 404:
                sys.exit(f"🛑 storage respondeu {e.code}: {corpo}")
            chamar("POST", "/storage/v1/bucket",
                   json.dumps({"id": BUCKET, "name": BUCKET, "public": True}).encode(),
                   "application/json")
            print(f"bucket '{BUCKET}' criado (público)")
        # A lista publicada diz quais faixas o bucket já tem, e em que versão.
        try:
            _, corpo = chamar("GET", f"/storage/v1/object/public/{BUCKET}/historias.json")
            for h in json.loads(corpo):
                for i, l in enumerate(h["linhas"]):
                    if l.get("v"):
                        anterior[faixa(h["id"], i)] = l["v"]
        except urllib.error.HTTPError:
            pass  # primeira publicação: sobe tudo

    # ── 3: só o que mudou ─────────────────────────────────────────────────
    subir = [n for n, v in versoes.items() if anterior.get(n) != v]
    print(f"{len(historias)} histórias, {len(versoes)} faixas — "
          f"{len(subir)} a enviar, {len(versoes) - len(subir)} já no bucket")
    if seco:
        for n in subir:
            print(f"  audio/{n}-{versoes[n]}.mp3")
        print("(--dry-run: nada foi enviado)")
        return

    for n in subir:
        with open(os.path.join(pasta, n + ".mp3"), "rb") as f:
            chamar("POST", f"/storage/v1/object/{BUCKET}/audio/{n}-{versoes[n]}.mp3",
                   f.read(), "audio/mpeg", upsert=True, cache=31536000)
        print(f"  ↑ audio/{n}-{versoes[n]}.mp3")

    # ── 4: a lista por último ─────────────────────────────────────────────
    chamar("POST", f"/storage/v1/object/{BUCKET}/historias.json",
           publicada, "application/json", upsert=True, cache=60)
    print("  ↑ historias.json")
    print(f"\npronto — {URL}/storage/v1/object/public/{BUCKET}/historias.json")
    print("Quem abrir o app com internet já recebe. Commite o seed e o áudio "
          "também (passo 6 do CLAUDE.md): o repo é a fonte, o bucket é a cópia.")


if __name__ == "__main__":
    main()
