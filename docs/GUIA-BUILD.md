# Guia de Build — Tis Tess

## Visão geral do processo

O build tem duas fases antes do empacotamento:

1. **`copy-assets`** — copia `src/webview/webview.css` e `src/webview/webview-script.js` para `media/webview/`
2. **`esbuild`** — faz bundle de `extension.js` + dependências Node.js para `dist/extension.js`

Ambas são executadas automaticamente por `npm run build`.

---

## Scripts disponíveis

| Script        | Comando               | Descrição                                                  |
|---------------|-----------------------|------------------------------------------------------------|
| `copy-assets` | `npm run copy-assets` | Copia activos do WebView de `src/webview/` para `media/`   |
| `build`       | `npm run build`       | `copy-assets` + bundle esbuild → `dist/extension.js`       |
| `clean`       | `npm run clean`       | Apaga `dist/` e `media/` (garante estado limpo)            |
| `package`     | `npm run package`     | `build` + gera `.vsix`                                     |
| `install-ext` | `npm run install-ext` | `clean` + `package` + instala no VS Code local (`--force`) |

---

## Processo completo — publicação

```bash
# 1. Actualizar a versão (altera package.json automaticamente)
npm version 2.X.Y --no-git-tag-version

# 2. Gerar o .vsix (faz build + empacota)
npm run package
```

O ficheiro gerado segue o padrão `tis-tess-{version}.vsix`.

---

## Ciclos de desenvolvimento

### Iteração normal — F5

```
editar src/ → F5 → build automático (< 200ms) → testar no Extension Development Host
```

O `preLaunchTask: "build"` no `launch.json` garante que o bundle está sempre actualizado antes
de lançar. É o fluxo para o dia-a-dia.

### Validar como extensão instalada — `install-ext`

```bash
npm run install-ext
```

Faz `clean` + `build` + `package` + instala em `~/.vscode/extensions/` com `--force`.

Usar quando:
- O bug só ocorre na extensão instalada (não no Development Host)
- Queres validar o `.vsix` antes de publicar
- Queres testar no VS Code normal sem uma segunda janela

---

## Estrutura de ficheiros relevante

```
tis-tess/
├── extension.js              # Entry point (source)
├── src/
│   ├── webview/
│   │   ├── webview.css       # Source dos estilos do painel
│   │   └── webview-script.js # Source do script do chat
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

Depois reabra o VS Code e instale a versão pretendida via UI (`Ctrl+Shift+P` → Extensions: Install from VSIX).

---

## Desinstalar a extensão manualmente

O `code --uninstall-extension` nem sempre remove a extensão por completo — pode persistir
após `Reload Window` mesmo sem erros reportados. Para garantir uma desinstalação limpa:

### Passo a passo

1. **Fechar o VS Code completamente** (não basta fechar a janela — verificar que não há processo em background)

2. **Remover a pasta da extensão:**

   **Windows (PowerShell):**
   

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
npm run install-ext
```

### `.vsix` gerado com tamanho suspeito (< 50 KB)

**Causa:** `npm run package` não foi usado — `npx vsce package` directo não corre o build.

**Solução:** Usar sempre `npm run package` ou `npm run install-ext`.

### Alterações no source não reflectidas na extensão instalada

**Causa:** Foi feito apenas `npm run build` ou `npm run package` sem instalar.

**Solução:** `npm run install-ext` — é o único comando que actualiza a extensão instalada.

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
