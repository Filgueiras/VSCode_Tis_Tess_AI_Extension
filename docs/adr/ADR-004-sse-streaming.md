# ADR-004 — Streaming SSE em vez de polling

**Estado:** Aceite
**Data:** 2026-03-30

---

## Contexto

A API da Tess oferece três modos de obter respostas de um agente:

1. **Streaming SSE** (`stream: true`) — respostas chegam em tempo real por Server-Sent Events
2. **Espera síncrona** (`wait_execution: true`) — bloqueia até 100 segundos e devolve a resposta completa
3. **Polling assíncrono** (`wait_execution: false`) — devolve imediatamente um ID de execução; o cliente consulta `GET /agent-responses/{id}` periodicamente

## Decisão

Usar streaming SSE com `stream: true` como modo principal de comunicação.

## Razão

- A experiência do utilizador é significativamente melhor: o texto aparece progressivamente à medida que é gerado, tal como no ChatGPT ou Claude.ai
- Evita timeouts em respostas longas — o modo síncrono tem um limite de 100 segundos
- Elimina a complexidade do polling: sem timers, sem gestão de estado de execuções pendentes, sem múltiplos pedidos HTTP
- O formato SSE é suportado nativamente por `axios` com `responseType: 'stream'` em Node.js, sem bibliotecas adicionais
- Permite cancelamento imediato via `AbortController` — o utilizador pode parar uma resposta a meio

## Consequências

- A lógica de parse de SSE tem de ser robusta para lidar com chunks parciais (buffer acumulado linha a linha)
- Requer `responseType: 'stream'` no axios, o que implica tratar a resposta como um Node.js Readable Stream
- Em caso de erro de rede a meio do stream, o utilizador vê a resposta incompleta — é necessário tratar o evento `error` no stream separadamente do catch do axios
