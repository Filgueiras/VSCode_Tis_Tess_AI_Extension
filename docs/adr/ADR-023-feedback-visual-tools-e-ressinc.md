# ADR-023 — Feedback visual de tool calls e ressincronização de sessão

**Estado:** Aceite  
**Data:** 2026-04-04  
**Actualizado:** 2026-04-04 (correcção de detalhes de implementação)

## Contexto

Durante o uso da extensão com o protocolo de tool calling (ADR-013), identificaram-se dois problemas relacionados:

**1. Ausência de feedback visual durante operações de ficheiros**  
O utilizador via apenas "Pensando..." durante toda a duração de uma operação de tool call — incluindo a execução local (escrever/editar ficheiro) e a chamada subsequente à API. Não havia forma de perceber o que o agente estava a fazer nem em que passo se encontrava.

A causa raiz era um bug: a função `appendToolNotice()` existia mas era chamada no handler `case 'toolCall'` do listener de mensagens do webview — que nunca era acionado, porque a extensão nunca envia mensagens do tipo `toolCall` de volta ao webview. O código estava na camada errada.

**2. Chamadas simultâneas à API por cada tool result**  
Quando o agente emitia múltiplas tags `[TOOL:...]` na mesma resposta, cada `toolResult` disparava um `send()` independente para a API. Com três tools, criavam-se três streams simultâneos — causando estados incoerentes e conversas que não chegavam ao fim.

**3. Perda de sincronia entre agente e estado local**  
Quando ocorre um erro de rede, timeout ou cancelamento durante uma sequência de tool calls, o agente perde o contexto do que foi executado. O utilizador ficava sem saber se as acções tinham completado, e o agente regressava a um estado em branco.

## Decisão

### Feedback visual de tool calls

Mover a chamada a `appendToolNotice()` para dentro de `finalizeAssistant()`, imediatamente antes de `vscode.postMessage({ type: 'toolCall' })`. A notificação aparece no chat no momento em que a operação começa, persiste no histórico visível, e tem etiquetas descritivas por tipo de ferramenta:

| Tool | Mensagem |
|------|----------|
| `get_tree` | 🌳 A ler estrutura do projecto |
| `get_file` | 📖 A ler ficheiro: `<caminho>` |
| `list_dir` | 📁 A listar directoria: `<caminho>` |
| `write_file` | ✏️ A escrever ficheiro: `<caminho>` |
| `edit_file` | ✏️ A editar ficheiro: `<caminho>` |
| outros | 🔧 A executar: `<tool>` |

As notificações **não desaparecem** — ficam como registo permanente das operações executadas durante a sessão.

### Serialização dos resultados de ferramentas (queue)

Em vez de cada `toolResult` disparar uma chamada à API independente, o webview acumula todos os resultados num array (`_toolResults`) e só envia **um único `send()`** quando todos os resultados do lote estiverem disponíveis:

```
_pendingTools = toolMatches.length  // número de tools despachadas
_toolResults  = []                   // resultados acumulados

ao receber toolResult:
  _toolResults.push(resultado)
  se _toolResults.length < _pendingTools → aguarda
  senão → combina todos e envia um único send()
```

Isto elimina os N streams paralelos e garante que o agente recebe todos os resultados numa única mensagem coerente.

### Log local de acções (`.tess-log.md`)

Cada execução de ferramenta em `executeTool()` (`src/tools.js`) escreve uma linha no ficheiro `.tess-log.md` na raiz do workspace:

```
# Tess — Log de Acções

✅ [2026-04-04 15:32:01] get_file: src/provider.js → lido com sucesso
✅ [2026-04-04 15:32:45] edit_file: src/provider.js → Ficheiro editado com sucesso: src/provider.js
❌ [2026-04-04 15:33:10] write_file: src/test.js → Operação cancelada pelo utilizador: src/test.js
```

O ícone ✅/❌ é determinado pelo prefixo do resultado: resultados que começam por `"Erro"` são marcados como ❌.

### Botão "🔄 Log Ressinc"

Adicionado aos `#actionButtons` da UI. Quando acionado:

1. A extensão lê `.tess-log.md` via `_handleResync()` em `provider.js`
2. Envia `{ type: 'resyncData', log }` ao webview
3. O webview injeta o log no histórico como mensagem `user` com o prefixo `[Log de acções anteriores para ressincronização]`
4. A mensagem é enviada à API com `isTool: true` (não repete contexto de workspace)
5. O agente analisa o log e retoma o trabalho a partir do ponto de interrupção

Se `.tess-log.md` não existir, é mostrado um erro inline informativo.

## Consequências

- O utilizador tem sempre visibilidade do que o agente está a fazer durante tool calls
- As notificações de ferramenta persistem no chat como histórico visual das operações
- Com a queue, elimina-se o problema de N streams paralelos — há sempre no máximo um stream activo
- Em caso de perda de sincronia, a retoma é feita em segundos sem necessidade de recomeçar
- O `.tess-log.md` serve de auditoria permanente das acções do agente no projecto
- O ficheiro `.tess-log.md` deve ser adicionado ao `.gitignore` se não se quiser versionar o log de sessão
- A detecção proactiva de dessincronia é tratada no ADR-024

## Alternativas rejeitadas

**Spinner ou indicador genérico no bubble "Pensando..."**  
Alterar o texto do bubble para "A executar ferramenta..." durante a execução. Rejeitado: não distingue entre diferentes tipos de operação nem indica qual ficheiro está a ser processado.

**Log em memória (sem persistência)**  
Manter o histórico de acções apenas em memória no webview. Rejeitado: a informação perde-se exactamente no momento em que é mais necessária — quando a sessão falha.

**Reenvio automático do log após qualquer erro**  
Injetar o log automaticamente sempre que ocorre um erro. Rejeitado: seria intrusivo em erros simples que não envolvem tool calls; o utilizador deve acionar o ressinc manualmente ou aguardar a detecção automática descrita no ADR-024.
