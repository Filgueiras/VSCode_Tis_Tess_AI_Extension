# cria pasta na raiz e move os assets
mkdir media
copy src\webview\webview.css media\webview.css
copy src\webview\webview-script.js media\webview-script.js


Para testar:

F5 no VS Code com o projecto aberto — abre uma segunda janela Extension Development Host com a extensão carregada directamente da pasta de trabalho
Qualquer alteração que fizeres: fecha a janela de teste, faz as alterações, F5 novamente (ou Ctrl+Shift+F5 para recarregar)
A janela de desenvolvimento tem [Extension Development Host] no título

Para limpar o estado actual:

Desinstala a extensão instalada (Extensions → Tess Tis → Uninstall)
Reinicia o VS Code uma vez
A partir daí, usa apenas o F5 para testar
Nunca mais precisas de .vsix durante desenvolvimento — o .vsix é apenas para distribuição/publicação final. O Extension Development Host isola completamente a sessão de teste da tua instância principal do VS Code, eliminando toda a instabilidade.

*------------------------------------------------------------------------------------------------------
*-- REFCATORING
*------------------------------------------------------------------------------------------------------

VS_Code_Tess_Extension/
├── extension.js          ← entrada, só activate/deactivate                           ok
├── src/                                                                              ok
│   ├── provider.js       ← TessChatViewProvider (classe principal)                   ok
│   ├── api.js            ← handleSend, parseSSELines, readErrorBody                  ok
│   ├── workspace.js      ← getWorkspaceTree, pickWorkspaceFiles, readWorkspaceFile   ok
│   ├── tools.js          ← executeToolCalls, protocolo [TOOL:...]                    ok
│   ├── webview.js        ← buildHtml (todo o HTML/CSS/JS do webview)                 ok
│   └── models.js         ← MODELS, MODEL_LIMITS, fetchAgentModels, syncAgentConfig   ok
└── package.json                                                                      ----


| Função | Responsabilidade |
|---|---|
| `getWorkspaceTree()` | Árvore do projecto, exclui lixo |
| `readWorkspaceFile()` | Lê por caminho relativo, retorna objecto tipado |
| `pickWorkspaceFiles()` | Selector nativo, trunca ficheiros grandes |
| `getCurrentCode()` | Código do editor activo ou selecção |
| Função | Responsabilidade |
|---|---|
| `executeToolCalls()` | Detecta todas as tags `[TOOL:...]` no texto, executa e retorna texto limpo |
| `executeTool()` | Switch com cada ferramenta individual |
| `getToolsSystemPrompt()` | Bloco de texto pronto a colar no agente Tess |
| Função | Responsabilidade |
|---|---|
| `handleSend()` | Orquestra envio — contexto, histórico, stream |
| `parseSSELines()` | Processa chunks SSE em tempo real |
| `readErrorBody()` | Lê corpo do erro da API |
| `postWithRetry()` | Retry automático no erro 429 |

**Como importar no `provider.js`:**
```javascript
const { executeToolCalls } = require('./tools');
```

**Como importar no `api.js`:**
```javascript
const { executeToolCalls } = require('./tools');
```