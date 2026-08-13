# Mànmàn 慢慢 — Flashcards de Mandarim

App de flashcards pra turma de mandarim do Enrico — Leo, Henrique e David.

**慢慢 (mànmàn)** = "devagar, com calma" — como em 慢慢来 (mànmàn lái, "vai com calma").
Um pouquinho todo dia é assim que se aprende mandarim.

🔗 **App:** https://leoborja.github.io/manman/

## Como usar

1. Abra o link no celular e adicione à tela inicial (funciona como app, inclusive offline)
2. Escolha seu nome no primeiro acesso — o progresso fica salvo no seu nome
3. Aba **学 Estudar**: escolha o modo, toque no cartão pra revelar, marque **Errei / Difícil / Acertei**
4. O app agenda a próxima revisão automaticamente (repetição espaçada, estilo Anki):
   - **Errei** → volta ainda nesta sessão
   - **Difícil** → intervalo cresce pouco
   - **Acertei** → 1 dia → 3 dias → e vai multiplicando
5. Todas as palavras do deck entram no jogo — as que você já domina vão espaçando sozinhas (1d → 3d → semanas)
6. Acabaram as revisões do dia? O app **emenda direto na prática livre** (deck inteiro, sem parar). Na prática, "Errei" ainda reagenda a carta; "Difícil/Acertei" não mexem no cronograma

### Modos de estudo

| Modo | Frente | Revela |
|---|---|---|
| 汉字 → pinyin + tradução | ideograma | tudo de uma vez |
| 汉字 → pinyin → tradução | ideograma | pinyin no 1º toque, tradução no 2º |
| tradução → 汉字 | português | ideograma + pinyin |
| pinyin → 汉字 + tradução | pinyin | ideograma + tradução |
| 🔀 aleatório | mistura os modos acima | |

## Cartas

A aba **卡 Cartas** é pra consulta: busca + filtro por categoria. As cartas vivem no
Supabase (tabela `cards`) — por enquanto quem adiciona/edita é o Leo.

## Estrutura

| Arquivo | O quê |
|---|---|
| `index.html` | interface (HTML + CSS) |
| `app.js` | lógica: SRS, modos, login, sync Supabase |
| `config.js` | URL + anon key do Supabase |
| `seed/seed_cards.json` | deck inicial (fallback offline) |
| `sw.js` + `manifest.webmanifest` | PWA |

Sem build, sem dependências. Pra rodar local:

```bash
python3 -m http.server 8080   # → http://localhost:8080/
```

Debug de datas (testar agendamento): abra com `?debug=1`.

## Roadmap (V2)

- [ ] Melhorar a aba Progresso
- [ ] Radical e decomposição no cartão ([makemeahanzi](https://github.com/skishore/makemeahanzi))
- [ ] Áudio / pronúncia
- [ ] Domínio próprio
