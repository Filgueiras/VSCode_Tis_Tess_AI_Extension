# ADR-012 — WebView com ficheiros estáticos (CSS + JS externos)

**Estado:** Aceite
**Data:** 2026-04-01
**Supersede (parcialmente):** ADR-002 — a consequência "HTML embutido em extension.js" deixa de ser válida

## Contexto

Após a decisão de usar `WebviewViewProvider` (ADR-002), o HTML do WebView estava inteiramente embutido numa template string dentro de `buildHtml()` em `extension.js`. CSS e JavaScript do chat (400+ linhas no total) ficavam inline, sem syntax highlighting, sem linting e sem separação de responsabilidades. Qualquer edição à UI exigia localizar a linha correcta dentro de uma string gigante.

## Decisão

Separar CSS e JavaScript em ficheiros estáticos servidos via `asWebviewUri()`:

- `src/webview/webview.css` — todos os estilos do painel
- `src/webview/webview-script.js` — toda a lógica do chat (estado, rendering, comunicação com a extensão)
- `src/webview.js` — apenas o HTML estrutural em `buildHtml(logoUri, cssUri, scriptUri, models, modelLimits)`

Os URIs são gerados em `provider.js`:

```javascript
const cssUri    = webviewView.webview.asWebviewUri(
    vscode.Uri.joinPath(this._context.extensionUri, 'src', 'webview', 'webview.css')
);
const scriptUri = webviewView.webview.asWebviewUri(
    vscode.Uri.joinPath(this._context.extensionUri, 'src', 'webview', 'webview-script.js')
);
```

O `localResourceRoots` é configurado para `src/webview/` para que o WebView tenha acesso a esses ficheiros.

## Alternativas rejeitadas

- **Framework de frontend (React/Svelte/Vue):** Exigiria bundler dedicado para o webview e aumentaria o tamanho do `.vsix` e a complexidade do setup.
- **Manter tudo inline:** Insustentável — sem syntax highlighting, sem linting, edições difíceis de localizar.

## Consequências

- Syntax highlighting e linting funcionam nos ficheiros estáticos — o editor trata `webview-script.js` como JavaScript normal.
- O `buildHtml()` recebe `models` e `MODEL_LIMITS` como parâmetros para gerar as `<option>` do selector e injectar os limites como `window.MODEL_LIMITS` — o script lê estes valores em runtime.
- O CSP (Content Security Policy) é declarado no `<meta>` do HTML em `webview.js`, restringindo scripts e estilos apenas aos ficheiros autorizados.
- O `localResourceRoots` em `provider.js` deve incluir `src/webview/` — sem isso o VS Code bloqueia o carregamento dos ficheiros.
