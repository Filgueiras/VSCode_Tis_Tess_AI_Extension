# ADR-017 — Workflow de desenvolvimento: F5 sem bundle

**Estado:** Aceite
**Data:** 2026-04-02

---

## Contexto

Após a modularização (ADR-011), o `package.json` ficou temporariamente com `"main": "./dist/extension.js"` (o bundle gerado pelo esbuild), em vez do ponto de entrada de desenvolvimento `"./extension.js"`. Isso quebrou o F5 no VS Code: a janela de extensão carregava código antigo do `dist/` em vez do código editado em `src/`.

O `launch.json` não tinha `preLaunchTask`, por isso o bundle nunca era regenerado automaticamente.

## Decisão

Manter dois modos distintos e explícitos:

### Desenvolvimento (F5)

- `"main": "./extension.js"` — Node.js resolve os módulos de `src/` nativamente via `require()`
- `preLaunchTask: "copy-assets"` — copia `src/webview/webview-script.js` e `src/webview/webview.css` para `media/webview/` (necessário porque o WebView os serve a partir daí)
- Sem esbuild — sem delay de compilação
- Ciclo: editar → F5 → testar

### Publicação (Marketplace)

- Mudar temporariamente `"main"` para `"./dist/extension.js"`
- Correr `npm run build` (copy-assets + esbuild bundle)
- Correr `npm run package` para gerar o `.vsix`
- Reverter `"main"` para `"./extension.js"` após publicar

## Estrutura de tarefas (`.vscode/tasks.json`)

| Tarefa | Comando | Usado em |
|--------|---------|----------|
| `copy-assets` | `npm run copy-assets` | preLaunchTask (F5) |
| `build` | `npm run build` | manual, antes de publicar |

## Razão

- ADR-005 e ADR-011 já estabeleceram que o bundler não faz parte do ciclo de desenvolvimento
- O `copy-assets` é suficientemente rápido (milissegundos, copia 2 ficheiros) para correr em cada F5
- Manter `"main": "./dist/extension.js"` no source obriga a reconstruir em cada iteração, contrariando o princípio de velocidade de iteração do ADR-005

## Consequências

- F5 funciona directamente sem passo de compilação
- Alterações em qualquer ficheiro de `src/` são imediatamente visíveis após recarregar a extensão
- Alterações em `src/webview/webview-script.js` ou `src/webview/webview.css` também são copiadas automaticamente pelo `copy-assets` no F5
- Antes de publicar, é necessário lembrar de mudar `"main"` e correr `npm run build`
