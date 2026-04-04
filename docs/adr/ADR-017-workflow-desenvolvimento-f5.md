# ADR-017 — Workflow de desenvolvimento: build automático no F5

**Estado:** Aceite
**Data:** 2026-04-02 · Revisado: 2026-04-04

---

## Contexto

Após a modularização (ADR-011) e adopção do bundling com esbuild (ADR-016), o `package.json` tem
`"main": "./dist/extension.js"` de forma permanente — tanto em desenvolvimento como em publicação.

O `launch.json` tinha `preLaunchTask: "copy-assets"`, que apenas copiava os activos do WebView
(`src/webview/` → `media/webview/`) mas **não reconstruía o bundle**. O resultado: ao pressionar F5,
o VS Code carregava `dist/extension.js` — que podia ser uma versão antiga do bundle, sem as
alterações recentes em `src/`.

## Decisão

Usar `preLaunchTask: "build"` no `launch.json`. O script `npm run build` já inclui o `copy-assets`
e depois corre o esbuild.

```json
// .vscode/launch.json
{
  "preLaunchTask": "build"
}
```

```json
// package.json — main permanente (não muda entre dev e prod)
{
  "main": "./dist/extension.js"
}
```

## Estrutura de scripts (`package.json`)

| Script | Comando | Usado em |
|--------|---------|----------|
| `copy-assets` | copia `src/webview/` → `media/` | interno ao build |
| `build` | `copy-assets` + esbuild | preLaunchTask (F5) |
| `clean` | apaga `dist/` e `media/` | antes de `install-ext` |
| `package` | `build` + `vsce package` | gera `.vsix` |
| `install-ext` | `clean` + `package` + `code --install-extension --force` | instala na extensão activa |

## Ciclo de desenvolvimento (iteração rápida — F5)

```
editar src/ → F5 → build automático (copy-assets + esbuild < 200ms) → testar no Extension Development Host
```

O F5 corre no **Extension Development Host** — uma instância separada do VS Code. Não afecta
a extensão instalada em `~/.vscode/extensions/`.

## Testar a extensão instalada

Para validar o comportamento da extensão **tal como o utilizador final a vê** (a partir do
`.vsix` instalado), usar:

```bash
npm run install-ext   # clean + build + package + instala em ~/.vscode/extensions/
```

Este é o único caminho que actualiza a extensão instalada. Fazer apenas `npm run build` ou
`npm run package` **não** actualiza a extensão em uso — o `.vsix` fica no disco mas não é
instalado.

## Publicação (Marketplace)

```bash
npm run package   # build + gera .vsix
npx vsce publish  # publica na Marketplace
```

O `"main"` não precisa de ser alterado manualmente em nenhum momento.

## Razão

- O esbuild é suficientemente rápido (< 200ms para este projecto) para correr em cada F5 sem
  impacto perceptível no ciclo de iteração
- Elimina a necessidade de trocar `"main"` manualmente antes/depois de publicar — fonte de erros
- `dist/extension.js` é sempre fresco em desenvolvimento — garante que o que se testa em F5 é
  exactamente o que vai no `.vsix`
- ADR-005 e ADR-011 estabelecem que o bundler não faz parte da iteração de código — este ADR
  revisa essa posição: o custo é negligenciável e o benefício (consistência dev/prod) justifica

## Consequências

- F5 reconstrói sempre o bundle antes de lançar — garante código actualizado
- `"main"` é `./dist/extension.js` permanentemente no `package.json`
- Alterações em qualquer ficheiro de `src/` são reflectidas no próximo F5 automaticamente
- Alterações em `src/webview/webview-script.js` ou `src/webview/webview.css` são copiadas
  para `media/webview/` pelo `copy-assets` (parte do build)
