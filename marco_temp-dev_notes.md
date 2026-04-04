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


Códigos HTTP (requisições de rede)
Código	Significado	Ação
200	OK — sucesso	Nenhuma ação necessária
400	Bad Request — pedido mal formado	Verifique os parâmetros enviados
401	Unauthorized — API Key inválida/expirada	Renove o token em tess.im/dashboard/user/tokens
403	Forbidden — sem permissão para acessar	Verifique se o Agent ID existe e está acessível
404	Not Found — recurso não existe	Verifique se o Agent ID está correto
429	Too Many Requests — rate limit excedido	Aguarde antes de enviar novas requisições
500	Internal Server Error — erro no servidor	Tente novamente após alguns segundos
502	Bad Gateway — servidor intermediário com falha	Problema de infraestrutura, aguarde
503	Service Unavailable — serviço fora do ar	Verifique tess.im/status
504	Gateway Timeout — resposta demorou muito	Tente novamente com menos contexto
524	A Timeout Occurred (Cloudflare)	Timeout na resposta — tente novamente
Erros específicos da extensão Tess Tis
Erro	Causa	Solução
"API Key não configurada"	Campo tess.apiKey vazio	Ctrl+, → pesquise tess → preencha a chave
"Agent ID não configurado"	Campo tess.agentId vazio	Ctrl+, → pesquise tess → preencha o ID
"Contexto excedido"	Muitos tokens enviados	Clique Limpar para começar nova conversa
"Resposta parou a meio"	Timeout ou conexão perdida	Clique Cancelar e tente novamente
"Selector de modelo não aparece"	Agente com modelo fixo	É normal — agente não permite escolha

*------------------------------------------------------------------------------------------------------
*-- BUG FIXES / CHANGELOG
*------------------------------------------------------------------------------------------------------

## v2.5.1 (2026-04-04) — Hotfix: system prompt ausente → erro 524

**Bug:** A versão 2.5.0 não funcionava — todas as chamadas à API resultavam em erro 524 (Cloudflare timeout).

**Causa raiz:** Durante o refactoring da 2.5.0, o `api.js` foi correctamente simplificado para uma camada HTTP pura (sem dependências do VS Code). No processo, o `getToolsSystemPrompt()` foi removido do `api.js` mas nunca foi adicionado ao novo `provider.js`. Resultado: as mensagens enviadas à API não incluíam o `{ role: 'system', ... }`.

A API da Tess exige pelo menos uma mensagem `system` para processar pedidos de streaming. Sem ela, o backend fica suspenso indefinidamente → o Cloudflare corta com 524.

**Como foi diagnosticado:** O mesmo curl sem system message reproduzia o 524. Com system message: resposta imediata. O site da Tess funcionava porque usa um canal diferente (não a API de completions).

**Fix (src/provider.js):**
```javascript
// Antes (2.5.0) — system prompt ausente:
messagesWithContext = [
    ...messagesWithContext,
    { role: 'user', content: msg.userText }
];

// Depois (2.5.1) — system prompt restaurado:
messagesWithContext = [
    { role: 'system', content: getToolsSystemPrompt() },
    ...messagesWithContext,
    { role: 'user', content: msg.userText }
];
```

PS C:\Developer\VS_Code_Tess_Extension> $body = '{"messages":[{"role":"user","content":"ola"}],"stream":true}'
PS C:\Developer\VS_Code_Tess_Extension> $api_key=629507|Xrh5qjDlLOaXGc2oQGctDtqoPa2rOfewnGuWZjimfb9a3c20
Xrh5qjDlLOaXGc2oQGctDtqoPa2rOfewnGuWZjimfb9a3c20: The term 'Xrh5qjDlLOaXGc2oQGctDtqoPa2rOfewnGuWZjimfb9a3c20' is not recognized as a name of a cmdlet, function, script file, or executable program.
Check the spelling of the name, or if a path was included, verify that the path is correct and try again.
PS C:\Developer\VS_Code_Tess_Extension> $api_key='629507|Xrh5qjDlLOaXGc2oQGctDtqoPa2rOfewnGuWZjimfb9a3
c20'
PS C:\Developer\VS_Code_Tess_Extension> $link='https://api.tess.im/agents/42551/openai/chat/completions'  
PS C:\Developer\VS_Code_Tess_Extension> curl.exe -N -X POST $link `
>>   -H "Authorization: Bearer $api_key" `
>>   -H "Content-Type: application/json" `
>>   -d $body
error code: 524
PS C:\Developer\VS_Code_Tess_Extension> 