# Jìzhù 记住 — Flashcards de Mandarim

App de flashcards pra turma de mandarim do Enrico ([huawen.com.br](https://huawen.com.br)) — Leo, Henrique e David.

**记住 (jìzhù)** = "memorizar, gravar na memória". É exatamente o que flashcards fazem.

🔗 **App:** https://leoborja.github.io/jizhu/

## Como usar

1. Abra o link no celular e adicione à tela inicial (funciona como app, inclusive offline)
2. Aba **学 Estudar**: toque no cartão pra virar, depois marque **Errei / Difícil / Acertei**
3. O app agenda a próxima revisão automaticamente (repetição espaçada, estilo Anki):
   - **Errei** → volta ainda nesta sessão
   - **Difícil** → intervalo cresce pouco
   - **Acertei** → 1 dia → 3 dias → e vai multiplicando
4. Máximo de **10 cartas novas por dia** — o resto é revisão

O progresso é individual por aparelho. Cada um tem o seu.

## Como adicionar cartas

Aba **卡 Cartas** → **➕ Nova carta**. Preencha hanzi, pinyin e tradução.

💡 **Pinyin com números**: digite `ni3 hao3` e o app converte pra `nǐ hǎo` sozinho.
Tons: 1 = ā, 2 = á, 3 = ǎ, 4 = à, 5 = neutro. Pra ü use `v` (ex.: `nv3` → `nǚ`).

A carta é salva no banco (Supabase) e aparece pra todo mundo. Não precisa de GitHub pra isso.

## Estrutura

| Arquivo | O quê |
|---|---|
| `index.html` | interface (HTML + CSS) |
| `app.js` | lógica: SRS, conversor de tons, Supabase |
| `config.js` | URL + anon key do Supabase |
| `seed/seed_cards.json` | deck inicial (fallback offline) |
| `sw.js` + `manifest.webmanifest` | PWA |

Sem build, sem dependências. Pra rodar local:

```bash
python3 -m http.server 8080   # → http://localhost:8080/
```

Debug de datas (testar agendamento): abra com `?debug=1`.

## Roadmap (V2)

- [ ] Radical e decomposição no cartão ([makemeahanzi](https://github.com/skishore/makemeahanzi))
- [ ] Áudio / pronúncia
- [ ] Autocompletar pinyin/tradução via CC-CEDICT
- [ ] Progresso sincronizado entre aparelhos (Supabase Auth)
- [ ] Domínio próprio
