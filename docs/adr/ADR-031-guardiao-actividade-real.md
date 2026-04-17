# ADR-031 — Guardião de actividade real e regras de comunicação

**Estado:** Aceite  
**Data:** 2026-04-08

## Contexto

Identificaram-se dois padrões de comportamento problemático dos LLMs em uso prolongado:

**1. IA a fingir trabalho**  
Em certas condições (contexto longo, instruções ambíguas, modelos mais fracos), o agente respondia com mensagens do tipo "Estou a processar...", "A trabalhar nisso..." ou "A analisar o código..." sem emitir nenhuma tag de ferramenta. O utilizador aguardava, o agente continuava a "trabalhar" verbalmente, e nenhum ficheiro era lido nem escrito. O único indício era a ausência de notificações de tool calls no chat.

Este comportamento é difícil de distinguir de trabalho real em curso, especialmente em tarefas que legitimamente demoram (análise profunda, geração de código longo). Mas após 2-3 respostas consecutivas sem qualquer ferramenta, a probabilidade de stall é alta.

**2. Repetição de perguntas confirmadas**  
O agente voltava a perguntar informações que o utilizador já tinha confirmado explicitamente na conversa — caminhos de ficheiros, nomes de variáveis, decisões de arquitectura. Em conversas longas, este comportamento causava frustração e desconfiança.

A causa raiz é o esquecimento de contexto próximo do limite de tokens e instruções de comportamento insuficientemente explícitas no system prompt.

## Decisão

### Guardião de actividade real (stall detector)

Introduzido no webview com dois novos elementos de estado:

```javascript
let _stallCount      = 0;   // respostas consecutivas sem ferramentas
const STALL_THRESHOLD = 2;  // avisar após N respostas sem acções reais
```

A função `_guardianCheck(hadTools)` é chamada no final de cada resposta do assistente em `finalizeAssistant()`:

```
se hadTools:
    _stallCount = 0  // reset — o agente está a trabalhar
    return
senão:
    _stallCount++
    se _stallCount >= STALL_THRESHOLD:
        mostrar aviso visual
        _stallCount = 0  // reset para não spammar
```

O aviso é uma mensagem estilizada no chat (borda amarela, fonte menor) com o texto:
> ⚠️ Guardião TIS: O assistente respondeu várias vezes sem executar nenhuma acção real. Se estiver a dizer que está a trabalhar sem usar ferramentas, use 🔄 Log Ressinc para retomar, ou cancele e reenvie o pedido.

O contador é resetado ao limpar a conversa (`clearBtn`).

### Threshold de 2 respostas

O threshold de 2 (não 1) evita falsos positivos: há respostas legítimas sem ferramentas — confirmações curtas, respostas a perguntas conceptuais, primeiras mensagens de planeamento. Duas respostas consecutivas sem tools é o sinal mínimo fiável de stall.

### Regras de comunicação no system prompt

Adicionadas três regras explícitas:

1. **Anti-repetição**: não perguntar o que já foi confirmado na conversa; se a informação está no contexto, usá-la directamente.

2. **Protocolo verificável**: nunca descrever uma acção como feita sem ter emitido a tag correspondente. "Estou a ler o ficheiro" só é válido se `[TOOL:get_file:...]` vier na mesma resposta ou na seguinte.

3. **Acção imediata**: não anunciar trabalho sem executar — ou age (tag), ou explica o que precisa (pergunta), mas não declara trabalho sem evidência.

### Distinção do watchdog existente (ADR-024)

O watchdog de 45s (ADR-024) detecta tool calls despachadas mas cujo resultado nunca chega — dessincronia técnica.

O guardião (este ADR) detecta respostas sem tool calls — stall comportamental.

São mecanismos complementares com âmbitos distintos.

## Consequências

- O utilizador recebe feedback visual quando o agente parece estar em stall
- O aviso inclui acção concreta (Log Ressinc ou reenvio) — não é apenas diagnóstico
- O system prompt reduz a frequência do comportamento problemático na origem
- O threshold de 2 minimiza falsos positivos em conversas normais

## Alternativas rejeitadas

**Threshold de 1 resposta**  
Avisar logo após a primeira resposta sem ferramentas. Rejeitado: muitas interacções legítimas têm respostas sem tools (confirmações, perguntas clarificadoras, resumos). Causaria spam do aviso em uso normal.

**Análise semântica das respostas**  
Detectar frases de stall ("estou a trabalhar", "a processar", etc.) com regex ou classificador. Rejeitado: dependente do idioma e modelo; frágil e com alto risco de falsos positivos/negativos. O critério estrutural (ausência de tool calls) é mais fiável.

**Timeout por resposta**  
Se o agente demorar mais de X segundos a começar a resposta, considerar stall. Rejeitado: confundido com latência de rede ou modelo ocupado; diferente de stall comportamental.

**Auto-cancelamento ao detectar stall**  
Cancelar automaticamente o stream ao detectar N respostas sem tools. Rejeitado: demasiado agressivo; o utilizador pode estar em diálogo exploratório legítimo. A decisão de cancelar deve ser do utilizador.
