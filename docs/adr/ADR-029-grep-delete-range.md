# ADR-029 — grep_file, delete_file e get_file com range

**Estado:** Aceite  
**Data:** 2026-04-05

## Contexto

Após a integração do protocolo de tool calling (ADR-013 e ADR-022), o agente tinha apenas `get_file` e `get_tree` para explorar o workspace. Três capacidades críticas estavam em falta:

**1. Pesquisa de texto no projecto**  
Para editar código, o agente precisava de ler ficheiros inteiros à procura de um símbolo. Em projectos com dezenas de ficheiros, isso esgotava o contexto sem garantir encontrar o que procurava.

**2. Apagar ficheiros**  
Sem `delete_file`, o agente não conseguia remover ficheiros obsoletos como parte de uma refactorização — tinha de pedir ao utilizador para o fazer manualmente.

**3. Leitura parcial de ficheiros grandes**  
`get_file` devolvia o ficheiro completo ou truncava a 200 linhas. Para ficheiros com 500-2000 linhas, nem uma coisa nem outra era útil: completo esgotava contexto, truncado perdia a zona de interesse.

## Decisão

### `grep_file` — pesquisa regex no workspace

```
[TOOL:grep_file:padrão]
[TOOL:grep_file:padrão:caminho]
```

Implementado em `workspace.js` com regex case-insensitive. Suporta pesquisa em todo o projecto ou num caminho específico (ficheiro ou pasta). Limite de 50 resultados para não inundar o contexto.

### `delete_file` — apagar com confirmação modal

```
[TOOL:delete_file:caminho]
```

Pede confirmação modal ao utilizador antes de apagar. Inclui protecção contra path traversal: rejeita caminhos com `..` ou absolutos.

### `get_file` com range de linhas

```
[TOOL:get_file:caminho:inicio:fim]
```

Extensão da ferramenta existente. Se forem passados dois inteiros no final do argumento, devolve apenas as linhas `inicio` a `fim` (1-based, inclusive), sem limite de tamanho. Permite leitura incremental de ficheiros grandes em blocos de 200-300 linhas.

A estratégia recomendada no system prompt:
1. `grep_file` para localizar a zona de interesse
2. `get_file` com range para ler apenas as linhas relevantes

## Consequências

- O agente consegue explorar projectos grandes sem esgotar o contexto
- Refactorizações completas (incluindo remoção de ficheiros) são possíveis sem intervenção manual
- Ficheiros de qualquer dimensão são legíveis de forma incremental
- O utilizador mantém controlo: `delete_file` exige confirmação explícita

## Alternativas rejeitadas

**Integração com ripgrep nativo**  
Usar `child_process.spawn('rg', ...)` para pesquisa mais rápida. Rejeitado: ripgrep pode não estar instalado na máquina do utilizador; a implementação em JavaScript puro (ADR-005) é suficiente para os casos de uso reais.

**Streaming de ficheiros grandes linha a linha**  
Enviar o ficheiro em chunks automáticos sem o agente pedir explicitamente. Rejeitado: o agente não saberia que mais conteúdo está a chegar; o protocolo de tools é síncrono (pede → recebe → continua).
