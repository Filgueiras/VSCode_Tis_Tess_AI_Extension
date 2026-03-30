# ADR-006 — Sessão persistente com workspaceState

**Estado:** Aceite
**Data:** 2026-03-30

---

## Contexto

O histórico de conversa era gerido exclusivamente no JavaScript do webview, perdendo-se sempre que o utilizador fechava o painel, reiniciava o VS Code ou recarregava a janela. Cada sessão começava do zero, obrigando o utilizador a repetir contexto já estabelecido.

## Decisão

Guardar o histórico de conversa e o modelo seleccionado em `vscode.ExtensionContext.workspaceState`, e restaurá-lo automaticamente quando o webview é recriado.

## Razão

- `workspaceState` persiste por projecto (workspace) — o granulo correcto: conversas sobre o projecto A não devem aparecer no projecto B
- A API é síncrona para leitura e assíncrona para escrita, sem dependências externas
- O modelo de dados já existia no webview (`history` array); basta serializar/deserializar via `postMessage`
- `globalState` seria demasiado abrangente; ficheiros locais adicionariam complexidade desnecessária

## Mecanismo

1. O webview envia `{ type: 'saveHistory', history, model }` após cada resposta completa do assistente e ao limpar
2. A extensão persiste com `context.workspaceState.update('tess.history', history)`
3. Em `resolveWebviewView`, a extensão lê o estado guardado e envia `{ type: 'restoreHistory' }` ao webview após 150 ms (garante que o webview está pronto)
4. O webview reconstrói os bubbles e restaura o modelo seleccionado

## Consequências

- O histórico persiste entre recarregamentos de janela, reinícios do VS Code e reabertura do painel lateral
- Conversas longas aumentam ligeiramente o tempo de arranque do painel; aceitável para o volume típico de uma sessão de trabalho
- O `workspaceState` não sincroniza entre máquinas — comportamento desejado, pois o código local é o contexto
- O botão "Limpar" apaga também o estado persistido