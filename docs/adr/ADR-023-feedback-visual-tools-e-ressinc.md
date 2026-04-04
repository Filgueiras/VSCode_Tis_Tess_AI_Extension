# ADR-023 — Feedback visual de tool calls e ressincronização de sessão

**Estado:** Aceite
**Data:** 2026-04-04

## Contexto

Durante o uso da extensão com o protocolo de tool calling (ADR-013), identificaram-se dois problemas relacionados:

**1. Ausência de feedback visual durante operações de ficheiros**
O utilizador via apenas "Pensando..." durante toda a duração de uma operação de tool call — incluindo a execução local (escrever/editar ficheiro) e a chamada subsequente à API. Não havia forma de perceber o que o agente estava a fazer nem em que passo se encontrava.

A causa raiz era um bug: a função `appendToolNotice()` existia mas era chamada apenas no handler `case 'toolCall'` do listener de mensagens do webview — que nunca era acionado, porque a extensão nunca envia mensagens do tipo `toolCall` de volta ao webview. A chamada estava na camada errada (resposta da extensão) em vez de na camada de detecção (finalizeAssistant).

**2. Perda de sincronia entre agente e estado local**
Quando ocorre um erro de rede, timeout ou cancelamento durante uma sequência de tool calls, o agente perde o contexto do que foi executado. O utilizador ficava sem saber se as acções tinham completado, e o agente regressava a um estado em branco sem memória das operações realizadas.

## Decisão

### Feedback visual de tool calls

Mover a chamada a `appendToolNotice()` para dentro de `finalizeAssistant()`, imediatamente antes de `vscode.postMessage({ type: 'toolCall' })`. Desta forma, a notificação aparece no chat no momento em que a operação começa — antes da execução local e da chamada à API de seguimento.

As mensagens são descritivas por tipo de ferramenta:

| Tool | Mensagem |
|------|----------|
| `write_file` | 📄 Escrevendo ficheiro: `<caminho>` |
| `edit_file` | ✏️ Editando ficheiro: `<caminho>` |
| `get_file` | 👁️ Lendo ficheiro: `<caminho>` |
| `delete_file` | 🗑️ Apagando ficheiro: `<caminho>` |
| `list_dir` | 📂 Listando ficheiros: `<caminho>` |
| `run_command` | ⚡ Executando comando: `<args>` |
| outros | 🔧 A executar: `<tool>` |

### Log local de acções (`.tess-log.md`)

Cada execução de ferramenta em `executeTool()` (src/tools.js) escreve uma linha no ficheiro `.tess-log.md` na raiz do workspace:

```
# Tess — Log de Acções

✅ [2026-04-04 15:32:01] get_file: src/provider.js → lido com sucesso
✅ [2026-04-04 15:32:45] edit_file: src/provider.js → Ficheiro editado com sucesso: src/provider.js
❌ [2026-04-04 15:33:10] write_file: src/test.js → Operação cancelada pelo utilizador: src/test.js
```

O ícone ✅/❌ é determinado pelo prefixo do resultado: resultados que começam por "Erro" são marcados como ❌.

### Deteção automática de perda de sincronia

O webview mantém um contador `pendingToolCalls` (inteiro):
- Incrementa quando `vscode.postMessage({ type: 'toolCall' })` é enviado
- Decrementa quando `toolResult` é recebido

Se um evento `error` ou `cancelled` ocorrer com `pendingToolCalls > 0`, significa que há tool calls sem resultado confirmado. O webview mostra automaticamente um aviso inline:

> ⚠️ Perda de sincronia detectada — algumas acções podem não ter completado. [Ressincronizar agora?]

### Botão "🔄 Log Ressinc"

Adicionado aos `#actionButtons` da UI. Quando acionado (manualmente ou via link inline):
1. A extensão lê `.tess-log.md`
2. Injeta no chat como mensagem do utilizador: *"Perdi a sincronia contigo. Aqui está o log das acções já executadas... indica-me o que já foi feito e o que ainda falta concluir."*
3. O agente analisa o log e retoma o trabalho a partir do ponto de interrupção

## Consequências

- O utilizador tem sempre visibilidade do que o agente está a fazer durante tool calls
- Em caso de perda de sincronia, a retoma é feita em segundos sem necessidade de recomeçar
- O `.tess-log.md` serve de auditoria permanente das acções do agente no projecto
- O ficheiro `.tess-log.md` deve ser adicionado ao `.gitignore` se não se quiser versionar o log de sessão

## Alternativas rejeitadas

**Spinner ou indicador genérico no bubble "Pensando..."**
Alterar o texto do bubble de "Pensando..." para "A executar ferramenta..." durante a execução. Rejeitado: não distingue entre diferentes tipos de operação nem indica qual ficheiro está a ser processado.

**Log em memória (sem persistência)**
Manter o histórico de acções apenas em memória no webview. Rejeitado: a informação perde-se exactamente no momento em que é mais necessária — quando a sessão falha.

**Reenvio automático do log após erro**
Injetar o log automaticamente no chat sempre que ocorre um erro. Rejeitado: seria intrusivo em erros simples que não envolvem tool calls; a deteção por `pendingToolCalls > 0` já filtra os casos relevantes.
