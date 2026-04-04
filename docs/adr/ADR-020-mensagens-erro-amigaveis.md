# ADR-020 — Mensagens de erro amigáveis para erros HTTP

**Estado:** Aceite
**Data:** 2026-04-04

---

## Contexto

Antes desta alteração, qualquer erro HTTP da API Tess era mostrado ao utilizador como texto
técnico directo do axios/servidor — por exemplo `Erro: Request failed with status code 401`
ou `Erro: Internal Server Error`. O utilizador não tinha indicação clara do que fazer.

O bug 524 da v2.5.0 (ADR-019) tornou evidente que erros de ligação são frequentes e que
a mensagem apresentada é a única informação que o utilizador recebe para decidir o próximo passo.

## Decisão

Adicionar `friendlyError(status, fallback)` em `api.js`, chamada no catch do `startStream`:

```javascript
function friendlyError(status, fallback) {
    switch (status) {
        case 401: return 'API Key inválida ou expirada. Verifique em Definições → tess.apiKey.';
        case 403: return 'Sem permissão para aceder a este agente. Verifique se o Agent ID está correcto.';
        case 404: return 'Agente não encontrado. Verifique se o Agent ID existe e está acessível.';
        case 500: return 'Erro interno do servidor Tess. Tente novamente em alguns segundos.';
        case 502: return 'Servidor Tess inacessível (bad gateway). Verifique tess.im/status.';
        case 503: return 'Serviço Tess temporariamente indisponível. Verifique tess.im/status.';
        case 504: return 'O servidor Tess não respondeu a tempo (504). Tente com menos contexto ou aguarde.';
        case 524: return 'Timeout do Cloudflare (524) — o servidor demorou demasiado. Tente com menos contexto ou aguarde.';
        default:  return fallback ? `Erro ${status}: ${fallback}` : `Erro de ligação (${status}).`;
    }
}
```

Quando não há status HTTP (falha de rede, DNS, etc.) a mensagem é:
`"Sem ligação ou serviço inacessível: <detalhe técnico>"`.

O 429 não passa por esta função — é interceptado antes em `postWithRetry()` (ADR-015).

## Alternativas rejeitadas

- **Mensagens genéricas sem acção:** "Ocorreu um erro" não ajuda o utilizador.
- **Mostrar o erro técnico raw:** Útil para debugging mas confuso para uso normal.
- **Tratar no provider em vez do api.js:** O status HTTP só está disponível no catch do
  `startStream` — tratá-lo ali evita passar o erro cru para cima.

## Consequências

- O utilizador recebe instruções concretas para os erros mais comuns (401, 403, 404).
- Erros de infraestrutura (500, 502, 503, 504, 524) indicam onde verificar o estado do serviço.
- Erros de rede sem status HTTP têm mensagem distinta dos erros com resposta do servidor.
- Erros desconhecidos mantêm o código HTTP visível via `default` — facilita o diagnóstico.
