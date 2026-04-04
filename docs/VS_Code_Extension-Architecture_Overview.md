Electron, a base do VS Code, é essencialmente um Chromium (browser) embutido a correr Node.js.

┌─────────────────────────────────────────────────────────┐
│                    VS Code (Electron)                   │
│                                                         │
│  extension.js          ← ponto de entrada, regista      │
│       │                   comandos e o provider         │
│       ▼                                                 │
│  provider.js           ← controla o ciclo de vida       │
│       │    │              do webview e orquestra tudo   │
│       │    │                                            │
│       │    ▼                                            │
│       │  api.js         ← chamadas HTTP à Tess API      │
│       │  models.js      ← lista de modelos/config       │
│       │  chatHistory.js ← persistência das sessões      │
│       │  workspace.js   ← lê ficheiros e árvore         │
│       │  tools.js       ← executa tool calls            │
│       │                                                 │
│       ▼                                                 │
│  webview.js            ← gera o HTML inicial            │
│       │                                                 │
│       ▼                                                 │
│  ┌─────────────────────────────────────────────────┐    │
│  │  media/main.js   (contexto isolado do webview)  │    │
│  │  media/style.css                                │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘

O ponto crítico da arquitectura é a barreira de isolamento entre o provider.js e o media/main.js:

provider.js  ──postMessage()──▶  media/main.js
provider.js  ◀──postMessage()──  media/main.js

São dois mundos separados que só comunicam por mensagens. Não partilham memória, não partilham módulos, não podem chamar funções um do outro directamente.

--------------------------------------------------------------------------
| Camada                            | Tecnologia   | Equivalente web     |
|-----------------------------------|--------------|---------------------|
| extension.js, provider.js, api.js | Node.js puro | Backend (servidor)  |
|-----------------------------------|--------------|---------------------|
| media/main.js, media/style.css    | Browser DOM  | Frontend (cliente)  |
|-----------------------------------|--------------|---------------------|
| postMessage / onDidReceiveMessage | Barreira de  | HTTP / WebSocket    |           
|                                   | isolamento   |                     !
|-----------------------------------|--------------|---------------------|
| vscode.workspace, vscode.window   | VS Code API  | Não tem equivalente |
|------------------------------------------------------------------------|

No webview não tens acesso ao Node.js — é um browser puro, com CSP restritiva. É por isso que o api.js (que usa axios e AbortController nativos do Node) corre no lado do provider.js e não dentro do webview. O webview só envia { type: 'send', ... } e recebe { type: 'chunk', text } de volta — nunca faz chamadas HTTP directamente.

1. Utilizador escreve no textarea (media/main.js)
        │
        ▼
2. main.js → postMessage({ type: 'send', userText, model, history })
        │
        ▼
3. provider.js recebe em _handleMessage → chama _handleSend()
        │
        ├── injeta contexto (workspace.js)
        ├── cria/actualiza sessão (chatHistory.js)
        │
        ▼
4. api.js → startStream() → POST https://api.tess.im (SSE/stream)
        │
        ▼
5. Cada chunk recebido:
   api.js → onChunk(text) → provider.js → postMessage({ type: 'chunk', text })
        │
        ▼
6. main.js recebe chunk → renderiza no DOM em tempo real
        │
        ▼
7. Stream termina → onEnd() → provider persiste no chatHistory → postMessage({ type: 'endResponse' })

É exactamente o padrão Backend-for-Frontend (BFF) — o provider.js age como um servidor que protege o webview da complexidade da API externa.