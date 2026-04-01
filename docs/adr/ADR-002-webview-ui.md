# ADR-002 — Interface via Webview em vez de Chat Participant nativo

**Estado:** Aceite
**Data:** 2026-03-30

---

## Contexto

O VS Code oferece duas formas de construir uma interface de chat numa extensão:

1. **Chat Participant API** (`vscode.chat.createChatParticipant`) — integração nativa no painel GitHub Copilot Chat, com o prefixo `@nome-do-agente`
2. **WebviewViewProvider** — painel lateral completamente personalizado com HTML/CSS/JS

## Decisão

Usar `WebviewViewProvider` com HTML/CSS/JS embebido para construir a interface de chat.

## Razão

- A Chat Participant API exige que o utilizador tenha o GitHub Copilot activo — uma dependência externa que pode não existir
- A Webview dá controlo total sobre o layout, estilos e comportamento da UI sem restrições do painel Copilot
- Permite incluir funcionalidades específicas da Tess: selector de modelo, botão de inserção de código do editor, histórico de conversa gerido localmente
- A curva de implementação é directa: HTML + mensagens `postMessage` entre webview e extensão
- O resultado visual é consistente com o tema VS Code através das variáveis CSS `--vscode-*`

## Consequências

- A extensão tem o seu próprio painel na Activity Bar, independente do Copilot
- Não beneficia de funcionalidades nativas do Chat Participant (slash commands do Copilot, referências `#file`, etc.)
- ~~O HTML do webview está embebido em `extension.js`~~ — **revisto em ADR-012**: CSS e JS foram separados em ficheiros estáticos em `src/webview/`, servidos via `asWebviewUri()`
- Actualizações à UI são feitas em `src/webview/webview.css` e `src/webview/webview-script.js`
