# ADR-017 — Workflow de desenvolvimento: build automático no F5

**Estado:** Aceite
**Data:** 2026-04-02 · Revisado: 2026-04-03

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

## Estrutura de tarefas (`.vscode/tasks.json`)

| Tarefa | Comando | Usado em |
|--------|---------|----------|
| `copy-assets` | `npm run copy-assets` | interno ao build |
| `build` | `npm run build` | preLaunchTask (F5) + antes de publicar |

## Ciclo de desenvolvimento

```
editar src/ → F5 → build automático (copy-assets + esbuild < 200ms) → testar
```

## Publicação (Marketplace)

```bash
npm run package   # build + gera .vsix
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
