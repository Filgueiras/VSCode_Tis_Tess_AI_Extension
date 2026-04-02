# ADR-012 — WebView com ficheiros estáticos (CSS + JS externos)

**Estado:** Aceite (revisto em 2026-04-02)
**Data inicial:** 2026-04-01
**Revisão:** 2026-04-02 — migração de `src/webview/` para `media/webview/`
**Supersede (parcialmente):** ADR-002 — a consequência "HTML embutido em extension.js" deixa de ser válida

## Contexto

Após a decisão de usar `WebviewViewProvider` (ADR-002), o HTML do WebView estava inteiramente embutido numa template string dentro de `buildHtml()` em `extension.js`. CSS e JavaScript do chat (400+ linhas no total) ficavam inline, sem syntax highlighting, sem linting e sem separação de responsabilidades.

Numa segunda iteração, os ficheiros foram separados em `src/webview/`. Porém, o `.vscodeignore` exclui `src/**` na totalidade (decisão do ADR-016, para que o bundle `dist/extension.js` seja o único entry point incluído no `.vsix`). O `esbuild` faz bundle do código Node.js da extensão mas **não empacota ficheiros estáticos servidos via `asWebviewUri()`** — esses têm de existir como ficheiros no `.vsix`.

A solução foi mover os activos do WebView para `media/webview/`, pasta que não está excluída pelo `.vscodeignore`.

## Decisão

### Estrutura de ficheiros

```
src/webview/          ← source (editável, não vai no .vsix)
  webview.css
  webview-script.js

media/webview/        ← destino copiado pelo build (vai no .vsix)
  webview.css
  webview-script.js
```

O script `copy-assets` no `package.json` copia os ficheiros na fase de build:

```json
"copy-assets": "copyfiles -u 1 src/webview/webview.css src/webview/webview-script.js media"
```

> **Pitfall crítico — flag `-u` do copyfiles:**
> - `-u 1` remove um nível (`src/`) → ficheiros ficam em `media/webview/` ✓
> - `-u 2` remove dois níveis (`src/` + `webview/`) → ficheiros ficam em `media/` directamente ✗
>
> Com `-u 2` o WebView carrega silenciosamente sem CSS nem scripts (sem erros visíveis na extensão).

### Paths em `provider.js`

```javascript
webviewView.webview.options = {
    enableScripts: true,
    localResourceRoots: [
        this._context.extensionUri,
        vscode.Uri.joinPath(this._context.extensionUri, 'media', 'webview')
    ]
};

const cssUri = webviewView.webview.asWebviewUri(
    vscode.Uri.joinPath(this._context.extensionUri, 'media', 'webview', 'webview.css')
);
const scriptUri = webviewView.webview.asWebviewUri(
    vscode.Uri.joinPath(this._context.extensionUri, 'media', 'webview', 'webview-script.js')
);
```

### Módulo de HTML

`src/webview.js` expõe apenas `buildHtml(logoUri, cssUri, scriptUri, models, modelLimits)` — recebe os URIs calculados em `provider.js` e gera o HTML estrutural com o CSP correcto.

## Alternativas rejeitadas

- **Framework de frontend (React/Svelte/Vue):** Exigiria bundler dedicado para o webview e aumentaria a complexidade do setup.
- **Manter tudo inline:** Insustentável — sem syntax highlighting, sem linting.
- **Manter em `src/webview/` e excluir apenas `src/*.js`:** Tornaria o `.vscodeignore` frágil e inconsistente com a regra `src/**`.

## Consequências

- Syntax highlighting e linting funcionam nos ficheiros source em `src/webview/`.
- O `buildHtml()` recebe `models` e `MODEL_LIMITS` como parâmetros para gerar as `<option>` do selector e injectar os limites como `window.MODEL_LIMITS`.
- O CSP (Content Security Policy) é declarado no `<meta>` do HTML, restringindo scripts e estilos apenas aos ficheiros autorizados.
- **`media/` não deve ser adicionado ao `.vscodeignore`** — é o único lugar onde os activos estáticos do WebView residem no `.vsix`.
- O `copy-assets` é executado automaticamente pelo script `build` (`npm run build`), pelo que nunca é necessário correr separadamente.
