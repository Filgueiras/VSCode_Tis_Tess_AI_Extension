# ADR-011 — Modularização do código fonte

**Estado:** Aceite
**Data:** 2026-04-01

## Contexto

O ficheiro `extension.js` original tinha 600+ linhas misturando responsabilidades sem separação clara: lógica de chamadas HTTP, HTML do WebView embutido, gestão de ficheiros do workspace, registo de comandos e gestão de estado — tudo num único ficheiro. A manutenção tornava-se progressivamente mais difícil e a leitura exigia percorrer centenas de linhas para encontrar uma função específica.

## Decisão

Separar o código em módulos CommonJS com responsabilidade única:

```
src/
├── provider.js       ← WebviewViewProvider e gestão de mensagens
├── api.js            ← HTTP, streaming SSE e retry
├── workspace.js      ← filesystem VS Code (ler/escrever ficheiros)
├── tools.js          ← protocolo de tool calling
├── models.js         ← lista de modelos e fetch da API
├── webview.js        ← buildHtml() — HTML estrutural
└── webview/
    ├── webview.css   ← todos os estilos
    └── webview-script.js ← lógica do chat (corre no browser)
```

O `extension.js` de entrada fica com apenas ~30 linhas: regista o provider e os comandos.

## Alternativas rejeitadas

- **Bundler (webpack/esbuild) para módulos:** Adiciona complexidade de build desnecessária para a fase de desenvolvimento activo. O `require()` nativo do Node.js é suficiente.
- **TypeScript:** Considerado, mas rejeitado para manter a barreira de entrada baixa e o ciclo de desenvolvimento simples (ver ADR-005).
- **Manter tudo em `extension.js`:** Insustentável a longo prazo — cada nova funcionalidade amplificava a dificuldade de leitura.

## Consequências

- Cada módulo tem ~50–150 linhas, fácil de ler e testar isoladamente.
- O `require()` nativo do Node.js resolve as dependências — sem bundler no ciclo de desenvolvimento.
- O `extension.js` de entrada tem apenas 30 linhas; o ponto de entrada da extensão é imediatamente legível.
- Para publicação na Marketplace, o bundling com `esbuild` continua a ser feito sobre o ponto de entrada `extension.js`, que arrasta todos os módulos — ver ADR-009.
