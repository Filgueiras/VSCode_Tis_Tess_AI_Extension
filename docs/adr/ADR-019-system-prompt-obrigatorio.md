# ADR-019 — System prompt obrigatório em todas as chamadas à API Tess

**Estado:** Aceite
**Data:** 2026-04-04

---

## Contexto

A versão 2.5.0 introduziu o refactoring descrito em ADR-018. Durante a migração, o `api.js` perdeu
a dependência de `tools.js` (intencional — camada HTTP pura). O `provider.js` assumiu a construção
do array de mensagens, mas o `getToolsSystemPrompt()` não foi transportado para o novo fluxo.

Resultado: as chamadas à API eram enviadas sem nenhuma mensagem `{ role: 'system', ... }`.

**Sintoma observado:** erro 524 (Cloudflare timeout) em todas as chamadas — tanto pela extensão
como por curl directo. O site tess.im funcionava normalmente porque usa um canal diferente
(não a API de completions `/agents/{id}/openai/chat/completions`).

**Diagnóstico:** o curl sem system message reproduzia o 524 de forma consistente.
Com system message: resposta imediata. Confirmado que o backend da Tess exige pelo menos
uma mensagem `system` para iniciar o processamento de streaming; sem ela, o servidor fica
suspenso → Cloudflare encerra a ligação ao fim de ~30s.

## Decisão

`getToolsSystemPrompt()` deve ser **sempre** a primeira mensagem do array `messages` em qualquer
chamada a `/agents/{id}/openai/chat/completions`:

```javascript
// provider.js — _handleSend()
messagesWithContext = [
    { role: 'system', content: getToolsSystemPrompt() },
    ...messagesWithContext,
    { role: 'user', content: msg.userText }
];
```

Esta invariante aplica-se a mensagens normais e a continuações de tool calls (`isTool: true`).

## Consequências

- Qualquer refactoring futuro que toque na construção do array `messages` deve verificar que
  `{ role: 'system' }` é a primeira entrada.
- O `provider.js` importa `getToolsSystemPrompt` de `tools.js` — esta dependência é intencional
  e deve ser mantida mesmo que `api.js` seja reestruturado novamente.
- O conteúdo do system prompt (instruções do protocolo `[TOOL:...]`) serve dois propósitos:
  satisfazer o requisito da API e instruir o modelo sobre o formato de tool calling.
- **Bug introduzido em:** v2.5.0 · **Corrigido em:** v2.5.1
