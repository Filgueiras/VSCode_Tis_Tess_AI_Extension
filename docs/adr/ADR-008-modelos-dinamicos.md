# ADR-008 — Modelos dinâmicos via GET /agents/{id}

**Estado:** Aceite
**Data:** 2026-03-30

---

## Contexto

A extensão apresentava uma lista estática de 9 modelos hardcoded. Dois problemas:

1. **Falsa promessa:** agentes configurados com um único modelo fixo mostravam um selector com 9 opções — apenas uma funcionaria
2. **Manutenção frágil:** novos modelos adicionados à plataforma Tess exigiriam actualização manual da extensão

A extensão deve ser agnóstica ao agente ligado — pode ser um agente de suporte, de code review, ou especializado num domínio — cada um com a sua configuração de modelos.

## Decisão

Chamar `GET /agents/{agentId}` ao abrir o painel e sempre que as definições `tess.*` mudam. Ler o array `questions` da resposta para descobrir os modelos disponíveis. Actualizar o dropdown dinamicamente — ou escondê-lo se o agente não expuser selector de modelo.

## Razão

- A API já devolve esta informação no objecto do agente; não é necessário endpoint dedicado
- O campo `model` dentro de `questions` é do tipo `select` e contém as opções válidas para aquele agente
- Esconder o selector quando não há opções elimina a confusão; mostrar só as opções reais evita erros silenciosos
- `onDidChangeConfiguration` garante que trocar de agente nas definições actualiza o dropdown sem recarregar a janela

## Mecanismo

```
resolveWebviewView / onDidChangeConfiguration
    └─ syncAgentConfig(view, apiKey, agentId)
        └─ fetchAgentModels(apiKey, agentId)
            GET /agents/{agentId}
            └─ parse questions[].name === 'model'
                ├─ modelos encontrados  → setModels: [...]   (actualiza dropdown)
                ├─ sem campo model      → setModels: null    (esconde dropdown)
                └─ erro de rede        → sem mensagem        (mantém lista actual)
```

O parse de `questions` tenta os campos `options`, `answers` e `choices` para cobrir variações do formato da API.

## Consequências

- Uma chamada HTTP leve (< 1 KB) é feita ao abrir o painel e ao mudar definições; timeout de 10 s
- Se o formato do campo `questions` mudar na API, o fallback mantém a lista estática em vez de falhar
- A lista `MODELS` em `extension.js` passa a ser fallback de documentação, não usada directamente na UI
