# ADR-021 — Convenção de parâmetro Webview nas funções de workspace

**Estado:** Aceite
**Data:** 2026-04-04

---

## Contexto

As funções em `workspace.js` que enviam mensagens para o WebView (`pickWorkspaceFiles`,
`sendWorkspaceContext`) foram originalmente escritas a receber um `WebviewView` (o objecto de
nível superior) e chamavam `view.webview.postMessage()`.

Durante a modularização (ADR-011), o `provider.js` foi actualizado para passar
`this._view.webview` directamente a essas funções — ou seja, o `Webview` já desembrulhado.
A actualização foi feita a meio: `sendWorkspaceContext` foi corrigida para `view.postMessage()`,
mas `pickWorkspaceFiles` manteve `view.webview.postMessage()`. Adicionalmente, a função foi
renomeada de `pickFiles` para `pickWorkspaceFiles` em `workspace.js` mas o import em
`provider.js` não foi actualizado.

Resultado em v2.5.1: dois erros em runtime:
- `TypeError: Cannot read properties of undefined (reading 'postMessage')` em `sendWorkspaceContext`
- `TypeError: pickFiles is not a function` em `_handleMessage`

## Decisão

Todas as funções em `workspace.js` que enviam mensagens para o WebView **recebem um `Webview`**
(não um `WebviewView`) e chamam directamente `view.postMessage()`.

O `provider.js` passa sempre `this._view.webview` — nunca `this._view`.

```javascript
// provider.js — correcto
case 'pickFile':            await pickWorkspaceFiles(this._view.webview);  break;
case 'getWorkspaceContext': await sendWorkspaceContext(this._view.webview); break;

// workspace.js — correcto
async function pickWorkspaceFiles(view) {   // view: Webview
    // ...
    view.postMessage({ type: 'insertFiles', files });
}

async function sendWorkspaceContext(view) { // view: Webview
    // ...
    view.postMessage({ type: 'insertContext', context: tree, label });
}
```

## Alternativas rejeitadas

- **Passar `WebviewView` e usar `view.webview.postMessage`:** Obriga as funções de workspace
  a conhecerem a estrutura interna do provider — acoplamento desnecessário.
- **Passar `WebviewView` e desestruturar no workspace:** `const { webview } = view` funciona
  mas obscurece o contrato da função sem benefício.

## Consequências

- As funções de workspace têm assinatura mais simples — recebem exactamente o que precisam.
- O JSDoc das funções declara `@param {import('vscode').Webview} view` — IDEs validam correctamente.
- Qualquer nova função de workspace que envie mensagens deve seguir esta convenção.
- O erro de runtime desaparece — `view.postMessage` é sempre um método válido.
