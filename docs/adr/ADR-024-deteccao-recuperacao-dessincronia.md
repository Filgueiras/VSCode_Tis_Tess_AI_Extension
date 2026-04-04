# ADR-024 — Detecção e recuperação automática de dessincronia em tool calls

**Estado:** Aceite  
**Data:** 2026-04-04

## Contexto

Após implementar o feedback visual e a ressincronização manual (ADR-023), identificaram-se quatro cenários em que o estado do webview ficava permanentemente bloqueado sem o utilizador conseguir recuperar:

**Cenário 1 — Stream termina enquanto tools estão a executar**  
Se a API devolve `endResponse` (timeout, erro de rede, reinicialização) enquanto `_pendingTools > 0`, `finalizeAssistant()` retorna silenciosamente porque `assistantBubble` já é `null` (foi limpo ao despachar as tools). O `waiting` fica `true` e a UI bloqueia para sempre.

**Cenário 2 — Erro de API com tools pendentes**  
O handler `case 'error'` chamava `setWaiting(false)` mas não limpava `_pendingTools` nem `_toolResults`. Na interacção seguinte, os resultados acumulavam-se incorrectamente no array, corrompendo o estado.

**Cenário 3 — WebView recriada durante um stream**  
Quando o utilizador oculta e volta a mostrar a barra lateral, o VS Code pode recriar o webview. O novo webview começa com estado limpo, mas o provider podia ter um stream activo a enviar chunks para um webview sem contexto.

**Cenário 4 — `toolResult` nunca chega (excepção no provider)**  
Se `_handleToolCall` em `provider.js` lançasse uma excepção não tratada, nenhum `toolResult` seria enviado. Com `_pendingTools > 0` e sem timeout, a UI ficava bloqueada indefinidamente.

## Decisão

### `_resetToolState()` — função única de limpeza

Introduzida como ponto único de reset do estado de ferramentas:

```javascript
function _resetToolState() {
    _pendingTools = 0;
    _toolResults  = [];
    if (_toolTimeout) { clearTimeout(_toolTimeout); _toolTimeout = null; }
}
```

Chamada em todos os pontos de saída que podem deixar tools pendentes: `toolResult` (sucesso), `endResponse` (dessinc), `error`, e watchdog.

### Watchdog de 45 segundos

Iniciado em `finalizeAssistant()` imediatamente após despachar todas as tool calls. Se passarem 45 segundos sem que todos os resultados cheguem, o watchdog:

1. Chama `_resetToolState()`
2. Remove o `assistantBubble` se existir
3. Chama `setWaiting(false)` para libertar a UI
4. Mostra mensagem de erro com instrução para usar "🔄 Log Ressinc"

O watchdog é cancelado por `_resetToolState()` sempre que o fluxo termina normalmente.

### Detecção de dessinc em `endResponse`/`cancelled`

O handler passa a verificar `_pendingTools > 0` antes de chamar `finalizeAssistant()`:

```
se _pendingTools > 0:
    _resetToolState()
    remove assistantBubble
    setWaiting(false)
    mostra ⚠️ com instrução para Log Ressinc
senão:
    finalizeAssistant()  // fluxo normal
```

### Limpeza de estado no handler `error`

`_resetToolState()` é chamado no início do handler `case 'error'`, antes de qualquer outra lógica. Garante que erros de API durante tool calls não corrompem o estado da conversa seguinte.

### `cancelStream()` em `_onWebviewReady`

Quando o webview envia `ready` (ao ser criado ou recriado), `_onWebviewReady()` começa com `cancelStream()`. Isto mata qualquer stream anterior que possa ter ficado activo após recriação do webview, antes de restaurar sessão e configuração.

### `try/catch` em `_handleToolCall`

`_handleToolCall` no provider envolve `executeTool()` em `try/catch`. Em caso de excepção, é enviado um `toolResult` de erro em vez de deixar a promise pendurada:

```javascript
try {
    result = await executeTool(msg.tool, msg.args, msg.content);
} catch (err) {
    result = `Erro ao executar ferramenta ${msg.tool}: ${err.message}`;
}
// sempre enviado — nunca bloqueia o webview
this._view.webview.postMessage({ type: 'toolResult', ... });
```

Este é o **contrato de garantia**: o provider comprometer-se a enviar sempre `toolResult`, sucesso ou falha.

## Consequências

- A UI nunca fica bloqueada por mais de 45 segundos após uma dessincronia
- Erros de provider não corrompem o estado da sessão seguinte
- Recriar o webview (ocultar/mostrar painel) é sempre seguro — streams órfãos são cancelados
- O utilizador recebe feedback claro quando ocorre dessincronia, com instrução de acção concreta
- O "🔄 Log Ressinc" é o mecanismo de recuperação primário em todos os casos de dessincronia

## Alternativas rejeitadas

**Auto-resync imediato ao detectar dessinc**  
Ao detectar `_pendingTools > 0` em `endResponse`, injetar o log automaticamente e reenviar para a API. Rejeitado: em muitos casos o utilizador pode não querer continuar a tarefa interrompida; a acção deve ser explícita. A mensagem de aviso é suficiente.

**Timeout mais curto (10-15s)**  
Timeout de 15 segundos para tool results. Rejeitado: `write_file` e `edit_file` esperam confirmação modal do utilizador — o utilizador pode demorar vários minutos a ler e confirmar. 45 segundos é conservador mas seguro.

**Retry automático de tool calls falhadas**  
Re-enviar `toolCall` se `toolResult` não chegar dentro de X segundos. Rejeitado: operações de escrita de ficheiros não são idempotentes; um retry poderia duplicar acções. O modelo correcto é reportar o erro e deixar o utilizador decidir.
