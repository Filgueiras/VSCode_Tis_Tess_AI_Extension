# ADR-030 — Edição cirúrgica: patch_file, open_file e protecção anti-trecho

**Estado:** Aceite  
**Data:** 2026-04-08

## Contexto

O mecanismo `edit_file` existente substituía o ficheiro inteiro pelo bloco de código que o agente escrevia imediatamente antes da tag. Isto criou um problema recorrente em produção:

**O problema do trecho**  
O agente escrevia apenas a função ou secção alterada no bloco de código — não o ficheiro completo — e depois emitia `[TOOL:edit_file:caminho]`. A extensão substituía o ficheiro inteiro por esse trecho. O resultado: ficheiros de 400 linhas reduzidos a 30 linhas sem aviso, com perda permanente de código.

Este comportamento tem duas causas:
1. O LLM tende a omitir partes "não alteradas" do ficheiro para poupar tokens
2. O mecanismo de extracção (`_extractLastCodeBlock`) não distingue conteúdo parcial de conteúdo total

Além disso, quando o utilizador pedia para "ver" um ficheiro sem editar, não existia ferramenta dedicada — o agente usava `get_file` (que enviava o conteúdo para o contexto da IA) em vez de abrir o editor.

## Decisão

### `patch_file` — substituição do `edit_file` para edições parciais

```
[TOOL:patch_file:caminho]
```

O bloco de código antes da tag usa um formato declarativo de search+replace:

```
SEARCH:
<texto exacto que existe no ficheiro, incluindo indentação>
REPLACE:
<novo texto de substituição>
```

Múltiplos patches no mesmo ficheiro separados por `---NEXT_PATCH---`.

A implementação em `_toolPatchFile`:
1. Lê o ficheiro original
2. Para cada bloco SEARCH/REPLACE, verifica se o texto SEARCH existe exactamente
3. Se não existir, reporta falha para esse patch específico (sem alterar o ficheiro)
4. Se existir, substitui apenas essa ocorrência
5. Depois de processar todos os patches, pede confirmação modal ao utilizador
6. Só então escreve o ficheiro resultante

Este design garante que, se o agente errar o texto SEARCH, o ficheiro não é alterado — apenas é reportado o erro, permitindo ao agente corrigir e tentar de novo.

### Protecção anti-trecho no `edit_file`

`edit_file` é mantido para reescritas totais intencionais, mas passa a incluir uma verificação de tamanho:

```
se novo_conteúdo < 60% do original E original > 500 bytes:
    mostrar aviso no diálogo de confirmação:
    "⚠️ O novo conteúdo (X bytes) é muito menor que o ficheiro original (Y bytes).
     Isso pode substituir o ficheiro inteiro por um trecho.
     Usa patch_file para edições cirúrgicas."
```

O utilizador ainda pode forçar a operação — o aviso é informativo, não bloqueante.

### `open_file` — abrir ficheiro no editor sem consumir contexto

```
[TOOL:open_file:caminho]
```

Abre o ficheiro no editor VS Code (tab activo) sem enviar o conteúdo para o historial da conversa. Indicado quando o utilizador quer ver um ficheiro, não quando o agente precisa de ler o conteúdo para processar.

### Actualização do system prompt

O system prompt passa a incluir:
- Hierarquia clara: `patch_file` para alterações parciais, `edit_file` só para reescritas totais, `write_file` para ficheiros novos
- Formato documentado do bloco SEARCH/REPLACE com exemplo
- Instrução explícita: nunca usar `edit_file` com conteúdo parcial
- Instrução: usar `get_file` com range para confirmar o texto exacto antes de patchear

## Consequências

- Edições parciais são cirúrgicas: apenas o que é alterado muda, o resto é preservado
- Se o SEARCH falha, o erro é visível e recuperável — o agente pode corrigir o texto
- O utilizador recebe aviso explícito quando `edit_file` parece estar a ser usado incorrectamente
- `open_file` não polui o contexto da IA com conteúdo não solicitado

## Alternativas rejeitadas

**Formato diff unificado (unified diff)**  
Usar o formato padrão `@@` de git diff. Rejeitado: LLMs produzem diffs com erros de offset frequentes; o formato SEARCH/REPLACE é mais robusto porque não depende de números de linha.

**Validação automática de conteúdo completo**  
Detectar automaticamente se o conteúdo do `edit_file` é completo (ex: verificar se começa e termina com os mesmos tokens que o original). Rejeitado: muito frágil para casos legítimos de reescrita total que mudam o início/fim do ficheiro.

**Bloqueio total do `edit_file`**  
Remover `edit_file` e forçar sempre `patch_file`. Rejeitado: há casos legítimos de reescrita total (migração de formato, regeneração de ficheiro de configuração) onde `edit_file` é a ferramenta certa.
