# ADR-027 — Registry de providers e cliente OpenAI-compat genérico

**Estado:** Aceite
**Data:** 2026-04-05

---

## Contexto

Com a adição de TisAI (ADR-025), o código de routing de providers estava hardcoded em três locais de `provider.js`: `_resolveCredentials`, `_dispatchStream` e `_onProviderChanged`. Cada novo provider exigia alterações em `provider.js`, `models.js`, `webview.js`, `package.json` e um novo módulo HTTP quase idêntico ao anterior.

A análise identificou 25 pontos de congelamento distribuídos por 6 ficheiros. Com a necessidade de adicionar Ollama (local) e endpoint remoto genérico, o custo de manutenção tornou-se inaceitável.

Adicionalmente, `tisai.js` era funcionalmente quase idêntico a `api.js` — a diferença real era apenas URL e header de autenticação. Manter dois módulos HTTP paralelos para o mesmo protocolo violava o princípio de não duplicar.

## Decisão

**1. Cliente HTTP genérico `openai-compat.js`**

Um único módulo HTTP para todos os providers que seguem o formato OpenAI (`POST /chat/completions`, SSE com `choices[0].delta.content`). Recebe `{ baseUrl, headers, extraBody, providerLabel }` como parâmetros. A Tess mantém `api.js` separado — o seu path `/agents/{id}/openai/chat/completions` e autenticação Bearer são suficientemente distintos.

**2. Registry de providers em `src/providers/`**

Cada provider é um módulo com interface fixa:

```js
module.exports = {
    id, label,
    getCredentials(cfg)     → { ok, ...creds } | { ok: false, errorText }
    buildStreamConfig(creds) → { baseUrl, headers, extraBody, defaultModel? }
    fetchModels(creds)       → Promise<Array|null>
    staticModels,            // fallback se fetchModels falhar
    modelLimits,
}
```

`src/providers/index.js` expõe `getProvider(id)` e `listProviders()`. `provider.js` usa exclusivamente o registry — sem switches hardcoded.

**3. Providers implementados**

| Provider | Ficheiro | Auth | Fetch de modelos |
|---|---|---|---|
| TisAI | `providers/tisai.js` | `X-API-Key` | `GET /models` → `GET /assistants` → estático |
| Ollama | `providers/ollama.js` | nenhuma | `GET /api/tags` → `GET /v1/models` |
| Remoto | `providers/remote.js` | `Bearer` opcional | `GET /models` opcional |

## Mecanismo

```
_syncProviderModels(provider)
    ├─ 'tess'  → syncAgentConfig() (api.js, dinâmico via GET /agents/{id})
    └─ outros  → getProvider(id).fetchModels(creds) → staticModels (fallback)

_resolveCredentials(provider)
    ├─ 'tess'  → cfg.get('tessApiKey') + cfg.get('tessAgentId')
    └─ outros  → getProvider(id).getCredentials(cfg)

_dispatchStream(provider, creds, opts)
    ├─ 'tess'  → startStream() via api.js
    └─ outros  → startOpenAICompatStream({ ...getProvider(id).buildStreamConfig(creds), ...opts })
```

## Adicionar um novo provider

1. Criar `src/providers/novo.js` seguindo a interface acima
2. Registar em `src/providers/index.js`: `novo: require('./novo')`
3. Adicionar `<option value="novo">Nome</option>` em `src/webview.js`
4. Adicionar settings em `package.json` se necessário

Zero alterações em `provider.js`, `openai-compat.js`, `api.js` ou `models.js`.

## Consequências

- `tisai.js` foi removido e substituído por `providers/tisai.js` + `openai-compat.js`
- CSP do webview alargada para `http://localhost:*` e `http://127.0.0.1:*` (Ollama local)
- Mensagens de erro incluem o `providerLabel` em vez de nomes hardcoded
- O provider Ollama mostra placeholder informativo se o servidor não estiver a correr
- O provider Remoto pré-selecciona `tis.remote.model` se a listagem de modelos não estiver disponível
