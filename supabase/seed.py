#!/usr/bin/env python3
"""Semeia/atualiza a tabela cards com seed/seed_cards.json (upsert por id).

Uso:
  SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_KEY=eyJ... python3 supabase/seed.py
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'tools'))
from sync_guard import exigir_atualizado  # noqa: E402
import json
import urllib.request

exigir_atualizado()

URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
if not URL or not KEY:
    sys.exit("Defina SUPABASE_URL e SUPABASE_SERVICE_KEY no ambiente.")

here = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(here, "..", "seed", "seed_cards.json")) as f:
    cards = json.load(f)

# PostgREST exige as MESMAS chaves em todos os objetos do lote (PGRST102)
# data_aula: 'YYYY-MM-DD' do dia da aula. fonte: de onde veio quando não foi da aula
# ('duolingo', etc); ausente nos dois = palavra sem procedência registrada
# audio_url fica DE FORA de propósito: quem escreve nele é o build_audio_nativo.py, e
# mandá-lo daqui desligaria as gravações nativas a cada seed.
KEYS = ["id", "hanzi", "pinyin", "pt", "deck", "tags", "nota", "data_aula", "fonte", "created_by"]

# No JSON a frase se marca com "tipo":"frase", que é o que se quer escrever à mão. No
# banco ela vira a tag 'frase', porque coluna nova exigiria DDL e ninguém do time tem —
# ver o comentário no schema.sql. A tradução mora aqui, num lugar só, e o JSON não
# precisa saber dessa limitação.
def com_tags(c):
    tags = list(c.get("tags") or [])
    if c.get("tipo") == "frase" and "frase" not in tags:
        tags.append("frase")
    return tags

cards = [dict({k: c.get(k, "leo" if k == "created_by" else ([] if k == "tags" else None))
               for k in KEYS}, tags=com_tags(c)) for c in cards]

req = urllib.request.Request(
    URL + "/rest/v1/cards?on_conflict=id",
    data=json.dumps(cards).encode(),
    headers={
        "apikey": KEY,
        "Authorization": "Bearer " + KEY,
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    },
    method="POST",
)
with urllib.request.urlopen(req) as r:
    print(f"HTTP {r.status} — {len(cards)} cartas upsertadas")
