# ADR-016: Gestão de Dependências no Empacotamento da Extensão VS Code

## Status
Aceite

## Data
2026-04-01

## Contexto

Durante o processo de empacotamento e distribuição da extensão `tis-tess` (VS Code), foi identificado
um problema crítico de runtime: a extensão funcionava correctamente em modo de desenvolvimento (`F5`)
mas falhava após instalação via `.vsix` — incluindo em máquinas limpas sem histórico de desenvolvimento.

A investigação revelou que a causa raiz não era um conflito de IDs ou comandos duplicados, mas sim
uma **gestão incompleta de dependências transitivas** no ficheiro `.vscodeignore`.

## Problema Identificado

### Como o `.vsix` funciona

O formato `.vsix` é essencialmente um arquivo ZIP. O `vsce package` inclui os ficheiros **não excluídos**
pelo `.vscodeignore`. Quando se usa a estratégia de excluir `node_modules/**` e depois reincluir
selectivamente (`!node_modules/axios/**`), é responsabilidade do developer mapear **toda a árvore
de dependências transitivas** manualmente.

### O que estava em falta

O `axios@1.14.0` depende directamente de:

| Dependência directa | Dependências transitivas |
|---|---|
| `follow-redirects` | — |
| `form-data` | `asynckit`, `combined-stream`, `delayed-stream`, `mime-types`, `mime-db`, `hasown`, `function-bind`, `es-set-tostringtag`, `es-errors`, `es-define-property`, `es-object-atoms`, `has-tostringtag`, `has-symbols`, `get-intrinsic`, `call-bind-apply-helpers`, `dunder-proto`, `get-proto`, `gopd`, `math-intrinsics` |
| `proxy-from-env` | — |

O `.vscodeignore` original incluía as dependências directas mas **omitia ~16 dependências transitivas**
trazidas pelo `form-data`. O resultado era:

- Em **desenvolvimento**: o `node_modules/` completo está presente no disco — tudo funciona.
- Em **instalação via `.vsix`**: as dependências transitivas estavam ausentes do pacote — falha em runtime.

### Sintoma observado

A extensão instalava sem erros visíveis, mas falhava na activação ou em funcionalidades que dependiam
do `axios` (chamadas HTTP à API Tess.im), manifestando-se como "conflito" ou comportamento indefinido.

## Decisão

### Solução imediata (correcção do `.vscodeignore`)

Mapear explicitamente todas as dependências transitivas confirmadas via `package-lock.json`:

```ignore
node_modules/**

# axios — dependências directas
!node_modules/axios/**
!node_modules/follow-redirects/**
!node_modules/form-data/**
!node_modules/asynckit/**
!node_modules/combined-stream/**
!node_modules/delayed-stream/**
!node_modules/proxy-from-env/**

# axios — dependências transitivas do form-data
!node_modules/mime-types/**
!node_modules/mime-db/**
!node_modules/hasown/**
!node_modules/function-bind/**
!node_modules/es-set-tostringtag/**
!node_modules/es-errors/**
!node_modules/es-define-property/**
!node_modules/es-object-atoms/**
!node_modules/has-tostringtag/**
!node_modules/has-symbols/**
!node_modules/get-intrinsic/**
!node_modules/call-bind-apply-helpers/**
!node_modules/dunder-proto/**
!node_modules/get-proto/**
!node_modules/gopd/**
!node_modules/math-intrinsics/**
```

### Solução estrutural (adoptada como padrão)

Migrar para **bundling com `esbuild`**, eliminando a necessidade de gerir dependências transitivas
manualmente. O bundler resolve toda a árvore de dependências e gera um único ficheiro `dist/extension.js`
auto-contido.

```json
// package.json
"scripts": {
  "build": "esbuild extension.js --bundle --outfile=dist/extension.js --external:vscode --platform=node --target=node18",
  "package": "npm run build && npx vsce package",
  "install-ext": "npm run package && code --install-extension tis-tess-*.vsix --force"
},
"devDependencies": {
  "@vscode/vsce": "^2.22.0",
  "esbuild": "^0.27.4"
}
```

```json
// package.json — main aponta para o bundle
"main": "./dist/extension.js"
```

Com bundling activo, o `.vscodeignore` simplifica drasticamente:

```ignore
node_modules/**
src/**
docs/**
*.vsix
.vscode/**
.git/**
.gitignore
token.md
```

## Consequências

### Positivas
- Elimina a classe inteira de erros por dependências transitivas em falta.
- O `.vsix` gerado é mais pequeno e mais rápido a carregar.
- O processo de build torna-se determinístico e auditável.
- Actualizações do `axios` ou qualquer outra dependência não requerem actualização manual do `.vscodeignore`.

### A ter em conta
- O ficheiro `dist/extension.js` gerado pelo bundler deve ser incluído no `.vsix` (não excluído pelo `.vscodeignore`).
- O `esbuild` deve correr **antes** do `vsce package` — garantido pelo script `npm run package`.
- O `vscode` deve ser marcado como `--external` no comando esbuild, pois é fornecido pelo runtime do VS Code e não deve ser bundled.

## Alternativas Consideradas

| Alternativa | Razão de exclusão |
|---|---|
| Continuar com `.vscodeignore` manual | Frágil. Quebra a cada actualização de dependências. |
| Webpack | Mais pesado e complexo para este caso de uso. `esbuild` é suficiente e mais rápido. |
| Remover `axios` e usar `fetch` nativo | Válid