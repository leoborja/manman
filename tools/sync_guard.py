#!/usr/bin/env python3
"""Trava os scripts de conteúdo quando o repositório local está atrasado.

Duas pessoas mexendo no mesmo deck geram um estrago específico: quem roda o
pipeline sem ter puxado regenera fonts/hanzi.woff2 e strokes/strokes.json a
partir de um seed_cards.json velho. Os dois arquivos são binário / JSON de uma
linha só — o git não sabe mesclá-los, então o conflito é feio E o que for
publicado perde os caracteres que o outro acabou de adicionar.

Usar no topo dos scripts que leem ou escrevem conteúdo:

    from sync_guard import exigir_atualizado
    exigir_atualizado()

Pular (offline, por exemplo): MANMAN_SKIP_SYNC=1
"""
import os
import subprocess
import sys


def _git(*args):
    return subprocess.run(["git", *args], capture_output=True, text=True,
                          cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def exigir_atualizado():
    if os.environ.get("MANMAN_SKIP_SYNC"):
        return
    if _git("rev-parse", "--git-dir").returncode != 0:
        return  # não é repositório git — deixa passar

    if _git("fetch", "--quiet", "origin", "main").returncode != 0:
        print("⚠️  não consegui falar com o GitHub — seguindo sem checar se está atualizado")
        return

    atras = _git("rev-list", "--count", "HEAD..origin/main").stdout.strip()
    frente = _git("rev-list", "--count", "origin/main..HEAD").stdout.strip()

    if atras and atras != "0":
        commits = _git("log", "--oneline", "HEAD..origin/main").stdout.strip()
        sys.exit(
            f"\n🛑 Seu repositório está {atras} commit(s) atrás do main.\n\n"
            f"{commits}\n\n"
            "Rodar o pipeline agora regeraria a fonte e os traçados a partir de um\n"
            "seed_cards.json desatualizado — o que apaga os caracteres que a outra\n"
            "pessoa acabou de adicionar e ainda dá conflito binário no git.\n\n"
            "   git pull --rebase origin main\n"
        )

    sujo = _git("status", "--porcelain", "--", "seed/seed_cards.json").stdout.strip()
    if frente and frente != "0" and not sujo:
        print(f"ℹ️  você tem {frente} commit(s) ainda não publicados — lembre do push no fim.")


if __name__ == "__main__":
    exigir_atualizado()
    print("✅ em dia com o origin/main")
