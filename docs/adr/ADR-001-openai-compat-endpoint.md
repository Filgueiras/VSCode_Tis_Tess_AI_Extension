# ADR-001 — Endpoint OpenAI-compatível para streaming

**Estado:** Aceite
**Data:** 2026-03-30

---

## Contexto

A API da Tess oferece dois endpoints para executar agentes:

- `POST /agents/{id}/execute` — endpoint nativo Tess, resposta com campos `output` e `status`
- `POST /agents/{id}/openai/chat/completions` — endpoint compatível com o formato OpenAI

A extensão foi inicialmente desenvolvida usando o endpoint nativo `/execute`, mas o streaming não funcionava: as respostas chegavam mas o parse falhava silenciosamente porque o formato SSE esperado (`parsed.output`) não correspondia ao que a API devolvia.

## Decisão

Usar o endpoint `/agents/{id}/openai/chat/completions` para todas as comunicações com agentes Tess.

## Razão

- O endpoint `/execute` usa um formato SSE proprietário não documentado publicamente com suficiente detalhe para implementação fiável
- O endpoint OpenAI-compatível segue um contrato bem estabelecido: cada chunk SSE tem a forma `choices[0].delta.content`, terminando com `data: [DONE]`
- Qualquer SDK ou ferramenta construída para OpenAI funciona sem alterações — apenas mudando a `base_url`
- Reduz a dependência de documentação interna da Tess; o comportamento é previsível e testável com ferramentas standard

## Consequências

- O campo `tools: 'no-tools'` do endpoint nativo foi removido — não é um parâmetro válido no endpoint OpenAI-compatível
- O parse do SSE passou de `parsed.output` para `parsed.choices?.[0]?.delta?.content`
- Integração futura com SDKs OpenAI (Python, JS) é directa sem adaptadores
- Fica dependente de a Tess manter a compatibilidade com o formato OpenAI neste endpoint
