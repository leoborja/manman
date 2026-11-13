#!/bin/bash
# Traz do app iOS o conteúdo que nasceu lá e a web passou a usar.
#
# O caminho normal é o contrário: o deck, os diálogos e as histórias moram aqui e o
# Scripts/sync-assets.sh do iOS copia pra lá. Mas parte do conteúdo foi escrita à mão
# no repositório do iOS, junto com a tela que o usa, e a web só ganhou essa tela
# depois:
#
#   seed/literal.json      a frase palavra a palavra: 我是巴西人 → eu · ser · Brasil · pessoa
#   seed/ideogramas.json   de que é feito cada 汉字: 好 = 女 mulher + 子 filho
#   seed/teoria.json       as notas de teoria de cada capítulo
#   seed/sons.json         a tabela de sons do pinyin (iniciais × finais)
#   seed/exercicios.json   as folhas de exercício do professor, por capítulo (aba Curso)
#   audio/sons/            uma gravação por sílaba e tom, ~12 MB (audio-cmn, CC BY-SA)
#
# Pra corrigir uma dessas, edite no iOS (onde os scripts de checagem moram:
# check_literal.py, check_ideogramas.py, sons.py) e rode isto de novo. Editado aqui,
# o próximo sync-assets do iOS não traz de volta, e as duas cópias se separam.
#
#   tools/traz_do_ios.sh            (o iOS em ../../Apps/Manman, ou MANMAN_IOS=...)
set -euo pipefail

raiz="$(cd "$(dirname "$0")/.." && pwd)"
ios="${MANMAN_IOS:-$raiz/../../Apps/Manman}"
res="$ios/Manman/Resources"

[ -d "$res" ] || { echo "não achei o app iOS em $ios (defina MANMAN_IOS)"; exit 1; }

for f in literal ideogramas teoria sons exercicios; do
  python3 -c "import json,sys; json.load(open(sys.argv[1]))" "$res/$f.json" \
    || { echo "$f.json do iOS não é JSON válido — nada foi copiado"; exit 1; }
done
for f in literal ideogramas teoria sons exercicios; do
  cp "$res/$f.json" "$raiz/seed/$f.json"
done

# As gravações da tabela: só as do iOS, sem sobrar arquivo velho de sílaba que saiu.
mkdir -p "$raiz/audio/sons"
find "$raiz/audio/sons" -name '*.mp3' -delete
cp "$res"/Sons/*.mp3 "$raiz/audio/sons/"
# o texto do iOS diz onde o arquivo mora LÁ; aqui o caminho é outro
sed -e 's#`Sons/som-#`audio/sons/som-#' -e 's#(Estudar → Teoria#(aba Teoria#' \
  "$res/CREDITS-sons.md" > "$raiz/audio/sons/CREDITS.md"

echo "literal:    $(python3 -c "import json;print(len(json.load(open('$raiz/seed/literal.json'))))") frases"
echo "ideogramas: $(python3 -c "import json;print(len(json.load(open('$raiz/seed/ideogramas.json'))))") caracteres"
echo "teoria:     $(python3 -c "import json;print(len(json.load(open('$raiz/seed/teoria.json'))))") notas"
echo "exercícios: $(python3 -c "import json;print(len(json.load(open('$raiz/seed/exercicios.json'))))") folhas"
echo "sons:       $(ls "$raiz/audio/sons" | grep -c mp3) gravações, $(du -sh "$raiz/audio/sons" | cut -f1)"
