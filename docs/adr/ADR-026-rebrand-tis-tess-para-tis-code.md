# ADR-026 — Rebrand: de tis-tess para tis-code

**Estado:** Aceite
**Data:** 2026-04-05

---

## Contexto

A extensão nasceu com o nome **tis-tess** — "TIS a usar a Tess". Com a integração do TisAI (ADR-025), a Tess passou a ser apenas uma das opções de ligação disponíveis. O nome e os identificadores internos deixaram de reflectir a realidade do produto: a extensão é um assistente de código TIS, com suporte a múltiplos providers de IA.

Manter `tis-tess` como nome passaria a mensagem errada — que a extensão é exclusivamente para a Tess — e criaria confusão sempre que um novo provider fosse adicionado.

## Decisão

Rebrandar a extensão para **tis-code** (nome de pacote) / **Tis.ai** (display name), e migrar todos os identificadores internos do prefixo `tess` para `tis`.

## Mapeamento de alterações

### Identidade do pacote

| Campo | Antes | Depois |
|---|---|---|
| `name` (package.json) | `tis-tess` | `tis-code` |
| `displayName` | `Tis.ai - Powered by Tess` | `Tis.ai` |
| `version` | `3.3.0` | `4.0.0` |
| Sidebar title | `Tis.ai - Tess` | `Tis.ai` |

### Identificadores VS Code

| Campo | Antes | Depois |
|---|---|---|
| View ID | `tess.chatView` | `tis.chatView` |
| `activationEvents` | `onView:tess.chatView` | `onView:tis.chatView` |
| Comando chat | `tess.openChatWithCode` | `tis.openChatWithCode` |
| Comando definições | `tess.openSettings` | `tis.openSettings` |
| Comando guardar | `tess.saveFile` | `tis.saveFile` |
| `workbench.action.openSettings` query | `'tess'` | `'tis'` |

### Configurações (settings)

| Antes | Depois |
|---|---|
| `tess.apiKey` | `tis.tessApiKey` |
| `tess.agentId` | `tis.tessAgentId` |
| `tess.tisAiApiKey` _(novo)_ | `tis.tisAiApiKey` |
| `tess.tisAiAssistantId` _(novo)_ | `tis.tisAiAssistantId` |

### Código interno

| Antes | Depois |
|---|---|
| Classe `TessViewProvider` | `TisViewProvider` |
| `static viewType = 'tess.chatView'` | `static viewType = 'tis.chatView'` |
| `getConfiguration('tess').get('apiKey')` | `getConfiguration('tis').get('tessApiKey')` |
| `e.affectsConfiguration('tess')` | `e.affectsConfiguration('tis')` |

### O que NÃO foi renomeado

- Ficheiros de workspace gerados (`.tess-log.md`, `.tess-tasks.md`) — renomear quebraria workspaces existentes
- Referências aos URLs `tess.im` nas descrições das settings — são endereços externos, não identificadores internos
- Módulo `api.js` e a função `startStream` — nome suficientemente genérico; a associação a Tess é clara pelo contexto

## Razão

- Identificadores VS Code (view IDs, comandos, settings) são visíveis ao utilizador e afectam a descoberta via `Ctrl+,`; devem reflectir a marca actual
- A versão major (4.0.0) sinaliza a quebra de compatibilidade nas configurações: utilizadores que migrarem precisam de reconfigurar as chaves com os novos nomes
- O prefixo `tis.` no namespace de settings agrupa todos os parâmetros da extensão de forma consistente, independentemente do provider a que se referem

## Consequências

- **Quebra de configuração para utilizadores existentes** — quem tinha `tess.apiKey` e `tess.agentId` configurados precisa de os reintroduzir como `tis.tessApiKey` e `tis.tessAgentId`
- Novos providers adicionados no futuro ficam naturalmente sob `tis.<provider>*`, sem conflito de namespace
- O `activationEvents` passou de `onView:tess.chatView` para `onView:tis.chatView` — este era um bug crítico: sem esta actualização a extensão nunca activava após o rebrand
