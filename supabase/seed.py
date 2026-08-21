#!/usr/bin/env python3
"""Semeia/atualiza a tabela cards com seed/seed_cards.json (upsert por id).

Uso:
  SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_KEY=eyJ... python3 supabase/seed.py
"""
import json
import os
import sys
import urllib.request

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
KEYS = ["id", "hanzi", "pinyin", "pt", "deck", "tags", "nota", "data_aula", "fonte", "created_by"]
cards = [{k: c.get(k, "leo" if k == "created_by" else ([] if k == "tags" else None)) for k in KEYS} for c in cards]

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
