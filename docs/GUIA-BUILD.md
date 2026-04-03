# Guia de Build — Tess Tis

## Visão geral do processo

O build tem duas fases antes do empacotamento:

1. **`copy-assets`** — copia `src/webview/webview.css` e `src/webview/webview-script.js` para `media/webview/`
2. **`esbuild`** — faz bundle de `extension.js` + dependências Node.js para `dist/extension.js`

Ambas são executadas automaticamente por `npm run build`.

---

## Processo completo

```bash
# 1. Actualizar a versão (MAJOR.MINOR.PATCH — ver tabela abaixo)
# Isso já vai alterar a versão no package.json (não precisa alterar manualmente)
npm version 2.X.Y --no-git-tag-version

# 2. Gerar o .vsix (faz build + empacota)
npm run package
```

O ficheiro gerado segue o padrão `tis-tess-{version}.vsix`.

---

## Scripts disponíveis
______________________________________________________________________________________
| Script        | Comando               | Descrição                                  |
|---------------|-----------------------|--------------------------------------------|
| `build`       | `npm run build`       | Copia activos para `media/`                |
|               !                       |+ bundle esbuild → `dist/extension.js`      |
|------------------------------------------------------------------------------------|
| `package`     | `npm run package`     | Build completo + gera `.vsix`              |
|------------------------------------------------------------------------------------|
| `install-ext` | `npm run install-ext` | Build + package + instala no VS Code local |
|------------------------------------------------------------------------------------|

---

## Estrutura de ficheiros relevante

```
tis-tess/
├── extension.js              # Entry point (source)
├── src/
│   ├── webview/
│   │   ├── webview.css       # Source dos estilos do painel (não vai directamente no .vsix)
│   │   └── webview-script.js # Source do script do chat (não vai directamente no .vsix)
│   └── ...                   # Restantes módulos Node.js
├── media/
│   └── webview/
│       ├── webview.css       # Copiado pelo copy-assets — este é o que vai no .vsix
│       └── webview-script.js # Copiado pelo copy-assets — este é o que vai no .vsix
├── dist/
│   └── extension.js          # Bundle gerado pelo esbuild — vai no .vsix
└── package.json
```

> **Porquê `media/webview/` e não `src/webview/`?**
> O `.vscodeignore` exclui `src/**` na totalidade (o bundle `dist/extension.js` substitui o source).
> Os activos estáticos do WebView não são bundled pelo esbuild — têm de existir como ficheiros no `.vsix`.
> Por isso residem em `media/`, que não está excluída. Ver [ADR-012](adr/ADR-012-webview-ficheiros-estaticos.md).

---

## Anatomia do `.vscodeignore`

```ignore
node_modules/**          # bundle é auto-contido, node_modules não é necessário
src/**                   # substituído pelo bundle em dist/
docs/**
*.vsix
.vscode/**
.git/**
.gitignore
token.md
marco_temp-dev_notes.md  # notas pessoais de desenvolvimento
.claude/**               # configurações do Claude Code

# dist/ NÃO está excluído — é o entry point carregado pelo VS Code
# media/ NÃO está excluída — contém os activos estáticos do WebView
```

---

## Instalação recomendada (via UI do VS Code)

Este é o método correcto — evita estados "pendentes" que causam o ícone de reload persistente:

1. **`Ctrl+Shift+P` → Extensions: Install from VSIX** — selecciona o ficheiro `.vsix` gerado
2. **`Ctrl+Shift+P` → Developer: Reload Window**

> **Importante:** Evite usar `code --install-extension` no terminal enquanto o VS Code está aberto.
> O comando deixa a extensão num estado "pendente de reload" que persiste mesmo após recarregar.

---

## Limpar versões antigas (quando necessário)

O VS Code não substitui versões antigas automaticamente ao instalar via VSIX — adiciona uma nova pasta lado a lado. Se houver versões em conflito, remova manualmente **com o VS Code fechado**:

**Windows (PowerShell):**
```powershell
Remove-Item "$env:USERPROFILE\.vscode\extensions\tis-angola.tis-tess-*" -Recurse -Force
```

**macOS / Linux:**
```bash
rm -rf ~/.vscode/extensions/tis-angola.tis-tess-*
```

Depois reabra o VS Code e instale a versão pretendida via UI.

---

## Semantic Versioning — MAJOR.MINOR.PATCH

| Posição   | Nome           | Quando incrementar                                              |
|-----------|----------------|-----------------------------------------------------------------|
| 1 (Major) | Ruptura        | API ou comportamento muda de forma incompatível                 |
| 2 (Minor) | Funcionalidade | Adicionas algo novo que não quebra nada existente               |
| 3 (Patch) | Correcção      | Corrigiste um bug sem adicionar funcionalidade                  |

---

## Erros comuns e soluções

### Interface do WebView aparece sem estilos ou sem resposta

**Causa mais provável:** activos em `media/webview/` ausentes ou no local errado.

```bash
# Verificar se os ficheiros estão no sítio certo
ls media/webview/
# Deve mostrar: webview.css  webview-script.js

# Se estiverem directamente em media/ (sem subpasta webview/), foi um build antigo com -u 2
# Solução: correr o build novamente
npm run build
```

### Extensão instala mas não activa

**Causa 1 — `"main"` no `package.json` aponta para o ficheiro errado.**

O campo `"main"` deve ser `"./dist/extension.js"` (o bundle). Se apontar para `"./extension.js"` (o source raiz), o VS Code carrega esse ficheiro que faz `require('./src/...')` — mas `src/` está excluído do `.vsix` e a extensão falha silenciosamente.

**Causa 2 — `dist/extension.js` ausente ou desactualizado.**

```bash
npm run build
npm run package
```

### `.vsix` gerado com tamanho suspeito (< 50 KB)

**Causa:** `npm run package` não foi usado — `npx vsce package` directo não corre o build.

**Solução:** Usar sempre `npm run package`.

---

## Verificar conteúdo do `.vsix`

```bash
# macOS / Linux
unzip -l tis-tess-*.vsix | grep -E "(dist|media)"

# Windows (PowerShell)
Rename-Item tis-tess-*.vsix tis-tess.zip
Expand-Archive tis-tess.zip -DestinationPath ./vsix-inspect
```

Deve conter `extension/dist/extension.js` e `extension/media/webview/webview.css`.

---

## Localização das extensões instaladas

| Sistema | Pasta |
|---------|-------|
| Windows | `%USERPROFILE%\.vscode\extensions\` |
| macOS   | `~/.vscode/extensions/` |
| Linux   | `~/.vscode/extensions/` |

Cada extensão ocupa uma subpasta: `tis-angola.tis-tess-{version}`

---

## Avisos normais do vsce (podem ser ignorados)

```
WARNING  LICENSE.md, LICENSE.txt or LICENSE not found
```
