# ADR-018 — Separação da camada HTTP da camada de orquestração

**Estado:** Aceite
**Data:** 2026-04-04

---

## Contexto

Após a modularização (ADR-011), o `api.js` ainda tinha responsabilidades mistas: ler configuração
do VS Code, obter contexto do workspace, construir o array de mensagens, injectar o system prompt,
fazer o stream HTTP e postar mensagens directamente para o WebView. Era uma função monolítica
(`handleSend`) com acoplamento forte ao ambiente VS Code.

## Decisão

Refactorizar `api.js` para ser uma camada HTTP pura, sem qualquer dependência do VS Code:

- `api.js` expõe `startStream({ apiKey, agentId, model, messages, onChunk, onUsage, onEnd, onError })`
  e `cancelStream()` — recebe dados já prontos via parâmetros, devolve resultados via callbacks.
- `provider.js` assume toda a orquestração: lê configuração, constrói o array de mensagens
  (system prompt, contexto, histórico), gere o histórico persistente e posta para o WebView.

```
Antes (2.4.x):
  api.js → lê VS Code config + constrói mensagens + stream + posta para WebView

Depois (2.5.x):
  provider.js → lê config + constrói mensagens + posta para WebView
  api.js      → apenas HTTP streaming (sem imports de vscode/workspace/tools)
```

O `AbortController` passa a ser gerido internamente em `api.js` (`cancelStream()` exposto para
o provider invocar quando recebe `type: 'cancel'` do WebView).

## Alternativas rejeitadas

- **Manter `handleSend` como estava:** Mistura de responsabilidades crescia com cada nova
  funcionalidade (histórico, modelos dinâmicos, edição de ficheiros).
- **Callbacks no `api.js` sem mover a construção de mensagens:** Tornaria o `api.js` mais limpo
  mas deixaria lógica de negócio misturada com HTTP.

## Consequências

- `api.js` não importa `vscode`, `workspace` nem `tools` — pode ser lido, testado e raciocínado
  sem conhecer o ambiente VS Code.
- Responsabilidade de construir o array `messages` fica exclusivamente em `provider.js`.
- **Risco:** dependências implícitas da função original (como o system prompt) podem não ser
  transportadas numa migração. Ver ADR-019.
