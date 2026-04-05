# ADR-025 — Suporte multi-provider: Tess e TisAI

**Estado:** Aceite
**Data:** 2026-04-05

---

## Contexto

A extensão foi construída originalmente para comunicar exclusivamente com a API da Tess (`api.tess.im`). A TIS disponibilizou entretanto a sua própria plataforma de IA — o **TisAI** (`ai.tisdev.cloud`) — com uma API de chat completions própria, diferente da Tess em três aspectos fundamentais:

| Aspecto | Tess | TisAI |
|---|---|---|
| Base URL | `https://api.tess.im` | `https://ai.tisdev.cloud/api/v1` |
| Autenticação | `Authorization: Bearer <key>` | `X-API-Key: <key>` |
| Identificador de agente | `agentId` no URL (`/agents/{id}/...`) | `assistant_id` opcional no body |
| Endpoint | `/agents/{id}/openai/chat/completions` | `/chat/completions` |
| Modelos disponíveis | Dinâmicos via `GET /agents/{id}` | Lista estática na extensão |
| Formato SSE | OpenAI (`choices[0].delta.content`) | OpenAI ou texto simples (ambos suportados) |

Além disso, a chave API do TisAI tem formato distinto (`tis_...`) e não é intercambiável com a chave Tess.

## Decisão

Implementar suporte a ambos os providers na mesma extensão, com selecção via dropdown na toolbar. A arquitectura adopta três princípios:

1. **Camadas HTTP separadas** — `api.js` continua exclusivo para Tess; `tisai.js` é o módulo paralelo para TisAI. Nenhum dos dois conhece o VS Code.
2. **Routing centralizado no provider** — `provider.js` é o único ponto que decide qual módulo HTTP invocar, com base em `msg.provider`.
3. **Credenciais isoladas por provider** — as chaves de cada serviço são configuradas e lidas de forma independente; não há sobreposição de namespaces.

## Mecanismo

### Selecção de provider na UI

O webview expõe um `<select id="providerSelect">` com as opções `tess` e `tisai`. Cada mensagem enviada inclui `provider: providerSelect.value`.

Ao mudar o provider, o webview envia `providerChanged` à extensão, que responde com a lista de modelos correcta:
- **Tess** → `syncAgentConfig()` (modelos dinâmicos do agente via API)
- **TisAI** → lista estática `TISAI_MODELS` de `models.js`

### Resolução de credenciais

```
_resolveCredentials(provider)
    ├─ 'tess'  → getConfiguration('tis').get('tessApiKey', 'tessAgentId')
    └─ 'tisai' → getConfiguration('tis').get('tisAiApiKey', 'tisAiAssistantId')
```

Se as credenciais necessárias não estiverem configuradas, a função devolve `{ ok: false, errorText }` e o envio é abortado com mensagem ao utilizador — sem chamada HTTP.

### Dispatch do stream

```
_dispatchStream(provider, creds, opts)
    ├─ 'tess'  → startStream({ apiKey, agentId, ...opts })       // api.js
    └─ 'tisai' → startTisAiStream({ apiKey, assistantId, ...opts }) // tisai.js
```

### Parser SSE do TisAI

O TisAI pode responder no formato OpenAI (`choices[0].delta.content`) ou como texto simples. O `parseChunk()` em `tisai.js` tenta JSON primeiro; em caso de falha de parse, trata o dado como texto puro. Isto garante compatibilidade com variações futuras do servidor.

### Cancel

O handler `cancel` no provider chama tanto `cancelStream()` como `cancelTisAiStream()`, garantindo que qualquer stream activo é interrompido independentemente do provider seleccionado.

## Consequências

- Cada provider tem o seu módulo HTTP independente, tornando fácil adicionar um terceiro provider no futuro sem tocar nos existentes
- Os modelos do TisAI são estáticos na extensão (não há endpoint de descoberta documentado); quando a API expuser esse endpoint, pode-se migrar para o mesmo padrão dinâmico do Tess (ADR-008)
- A CSP do webview foi alargada para incluir `https://ai.tisdev.cloud` em `connect-src`
- O estado de "provider seleccionado" é UI-only — não é persistido entre sessões; a extensão arranca sempre em "Tess"
- As configurações Tess foram renomeadas de `tess.*` para `tis.tess*` como parte do rebrand (ver ADR-026)
