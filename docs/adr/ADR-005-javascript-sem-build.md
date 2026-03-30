# ADR-005 — JavaScript puro sem processo de build

**Estado:** Aceite
**Data:** 2026-03-30

---

## Contexto

Extensões VS Code podem ser desenvolvidas em TypeScript (com transpilação e bundling via `esbuild` ou `webpack`) ou em JavaScript simples sem qualquer processo de build.

## Decisão

Usar JavaScript puro (CommonJS, Node.js) sem TypeScript, sem bundler e sem processo de build.

## Razão

- O projecto é um único ficheiro de extensão (`extension.js`) com ~550 linhas — a overhead de configurar TypeScript e um bundler não justifica a escala
- A única dependência de runtime é `axios`, instalada via `npm install`; não há módulos internos a resolver ou a empacotar
- Elimina ferramentas de build do ciclo de desenvolvimento: sem `tsc`, sem `esbuild`, sem `webpack`, sem scripts `build` ou `watch`
- A iteração é mais rápida: editar → recarregar extensão (`Developer: Reload Window`) → testar, sem passo de compilação

## Consequências

- Sem verificação de tipos em tempo de desenvolvimento — erros de tipo só surgem em runtime
- O ficheiro `extension.js` concentra lógica de extensão e HTML do webview; se o projecto crescer significativamente, a separação em módulos e a adopção de TypeScript deve ser reavaliada
- O `.vscodeignore` exclui `node_modules` e ficheiros desnecessários do pacote publicado na Marketplace
- Para publicar na VS Code Marketplace (`vsce package`), o processo é directo sem scripts adicionais
