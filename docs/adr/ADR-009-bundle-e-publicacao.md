# ADR-009 — Bundle com esbuild para publicação na Marketplace

**Estado:** Proposto
**Data:** 2026-03-31

---

## Contexto

Para publicar na VS Code Marketplace, o `vsce` exige um pacote eficiente. Sem bundling, o `.vsix` inclui todo o `node_modules` — mesmo excluindo devDependencies, o `axios` e as suas dependências transitivas acrescentam dezenas de ficheiros desnecessários ao pacote final.

O aviso do `vsce` ao empacotar sem bundle:

> *"This extension consists of 400 files, out of which 167 are JavaScript files. For performance reasons, you should bundle your extension."*

A solução é usar `esbuild` para empacotar `extension.js` e todas as suas dependências num único ficheiro compilado. O `esbuild` já está instalado como devDependency (`npm install --save-dev esbuild`).

## Decisão

Antes de publicar na Marketplace, adoptar o seguinte processo de build com `esbuild`.

## Processo de build para publicação

### 1. Garantir que o esbuild está instalado

```bash
npm install --save-dev esbuild
```

### 2. Fazer o bundle

```bash
npx esbuild extension.js \
  --bundle \
  --outfile=dist/extension.js \
  --external:vscode \
  --platform=node \
  --minify
```

- `--bundle` → inclui `axios` e todas as dependências directamente no ficheiro de saída
- `--external:vscode` → **obrigatório** — o módulo `vscode` é fornecido pelo VS Code em runtime, não pode ser bundled
- `--platform=node` → gera código compatível com Node.js (o runtime das extensões VS Code)
- `--minify` → reduz o tamanho do ficheiro final
- `--outfile=dist/extension.js` → ficheiro de saída separado do source

### 3. Actualizar temporariamente o package.json para apontar para o bundle

> ⚠️ Reverter para `"./extension.js"` após publicar — este valor é só para packaging.

```json
{
  "main": "./dist/extension.js"
}
```

### 4. Actualizar o .vscodeignore para excluir tudo excepto o bundle

```
node_modules/**
docs/**
extension.js
*.vsix
.vscode/**
.git/**
.gitignore
token.md
```

O `dist/extension.js` (o bundle) fica incluído automaticamente por não estar no `.vscodeignore`.

### 5. Empacotar e publicar

```bash
# Gerar o .vsix
npx vsce package

# Publicar directamente na Marketplace (requer Personal Access Token da Microsoft)
npx vsce publish
```

Para obter um Personal Access Token e configurar o publisher `tis-angola` na Marketplace:
→ https://code.visualstudio.com/api/working-with-extensions/publishing-extension

## Consequências

- O `.vsix` final terá apenas 2–3 ficheiros em vez de 400
- Tempo de arranque da extensão mais rápido (VS Code carrega um único ficheiro)
- O source original (`extension.js`) mantém-se editável — o bundle é sempre gerado antes de publicar
- Adicionar um script `"build"` ao `package.json` para simplificar:

```json
"scripts": {
  "build": "esbuild extension.js --bundle --outfile=dist/extension.js --external:vscode --platform=node --minify",
  "package": "npm run build && vsce package"
}
```

Com este script, o fluxo completo de publicação fica:

```bash
npm run package   # faz bundle + gera .vsix
npx vsce publish  # publica na Marketplace
```
