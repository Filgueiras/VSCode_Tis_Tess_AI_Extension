# ADR-015 — Retry automático no erro 429 (Rate Limit)

**Estado:** Aceite
**Data:** 2026-04-01

## Contexto

A API Tess pode retornar `429 Too Many Requests` em uso intensivo (múltiplas mensagens em sequência rápida). O comportamento original era propagar o erro directamente ao utilizador e parar — obrigando-o a reenviar manualmente a mensagem, frequentemente sem perceber o que aconteceu.

## Decisão

Quando a API retorna 429, `postWithRetry()` em `api.js` faz automaticamente uma segunda tentativa:

```javascript
async function postWithRetry(url, body, headers, signal) {
    try {
        return await axios.post(url, body, { ... });
    } catch (error) {
        if (error.response?.status === 429) {
            const retryAfter = parseInt(error.response.headers['retry-after'] ?? '5', 10);
            await new Promise(res => setTimeout(res, retryAfter * 1000));
            return await axios.post(url, body, { ... }); // segunda tentativa
        }
        throw error;
    }
}
```

O tempo de espera é lido do header `retry-after` da resposta; se ausente, usa 5 segundos como defeito.

## Alternativas rejeitadas

- **Múltiplos retries com backoff exponencial:** Desnecessário para rate limiting simples; pode mascarar problemas reais de quota esgotada.
- **Notificar o utilizador e aguardar input:** Piora a experiência — o utilizador não tem acção a tomar além de esperar.
- **Ignorar o 429:** Resulta em erros silenciosos ou mensagens de erro confusas.

## Consequências

- Experiência mais fluida em uso intensivo — o utilizador não vê o erro na maioria dos casos.
- Máximo de 1 retry para não mascarar problemas reais (quota esgotada, bloqueio de conta).
- Se o segundo pedido também falhar com 429, o erro é mostrado normalmente ao utilizador.
- O utilizador não é notificado durante a espera — aceitável dado que o tempo típico é ≤ 5 segundos e a UI já mostra o estado "a aguardar resposta".
