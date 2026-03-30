# ADR-007 — Medidor de contexto com estimativa de tokens

**Estado:** Aceite
**Data:** 2026-03-30

---

## Contexto

Modelos de linguagem têm limites de contexto (context window). Quando uma conversa ultrapassa esse limite, a API começa a truncar mensagens antigas ou a devolver erros. O utilizador não tinha forma de saber quando estava a aproximar-se do limite, levando a respostas degradadas ou erros inesperados.

## Decisão

Mostrar uma barra de progresso no painel com a percentagem do contexto utilizado, actualizando em tempo real. Usar tokens reais da API quando disponíveis, com estimativa por contagem de caracteres como fallback.

## Razão

- A experiência muda de "erro misterioso" para "aviso visual antecipado"
- Nenhuma chamada API adicional é necessária: o campo `usage` já existe nos chunks SSE do endpoint OpenAI-compatível e é capturado passivamente em `parseSSELines`
- A estimativa `chars / 4` é suficientemente precisa para dar indicação útil quando o `usage` não vem na resposta
- Limites por modelo são codificados localmente (não mudam frequentemente) e são conservadores quando desconhecidos

## Implementação

**Estimativa:** `Math.ceil(totalChars / 4)` sobre todos os `content` do histórico. Prefixado com `~` para indicar aproximação.

**Valor real:** quando um chunk SSE contém `usage.total_tokens`, substitui a estimativa e remove o prefixo `~`.

**Limites por modelo:**

| Modelo | Limite |
|---|---|
| Claude Opus / Sonnet / Haiku 4.5 | 200 000 tokens |
| GPT-4o, GPT-4.1, Tess 5, Auto | 128 000 tokens |
| Gemini 2.5 Pro, Gemini 2.0 Flash | 1 000 000 tokens |

**Cores da barra:** verde (< 60%) → amarelo (60–80%) → vermelho (> 80%), usando variáveis CSS do tema VS Code (`--vscode-charts-*`) para respeitar o tema do utilizador.

## Consequências

- O utilizador sabe quando iniciar uma nova conversa antes de atingir o limite
- A barra actualiza ao mudar de modelo, após cada resposta e ao restaurar sessão
- Se a Tess não incluir `usage` nos chunks SSE, a estimativa por caracteres é usada indefinidamente — aceitável, pois é conservadora