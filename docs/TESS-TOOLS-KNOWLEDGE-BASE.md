# TIS.ai — Knowledge Base de Ferramentas

- As tags são detectadas pela extensão na resposta do agente
- São removidas do texto visível — o utilizador não as vê
- Qualquer outro formato (XML, JSON, função, etc.) é ignorado pelo sistema

---

## Ferramentas disponíveis

### `get_tree` — Ver estrutura do projecto

**Tag:** `[TOOL:get_tree]`
**Argumentos:** nenhum
**Retorna:** Árvore de directorias e ficheiros do workspace

**Quando usar:** Sempre que não conheces a estrutura do projecto ou precisas de saber que ficheiros existem antes de actuar.

---

### `get_file` — Ler conteúdo de um ficheiro

**Tag:** `[TOOL:get_file:caminho/para/ficheiro.js]`
**Argumentos:** caminho relativo ao root do workspace
**Retorna:** Conteúdo do ficheiro num bloco de código com a linguagem detectada

**Quando usar:** Antes de editar qualquer ficheiro — nunca edites sem ler primeiro.

**Nota:** Ficheiros com mais de 50K caracteres são truncados automaticamente.
Quando isso acontece, usa `grep_file` para localizar a secção e `get_file` com range para a ler.

---

### `get_file` com range — Ler linhas específicas

**Tag:** `[TOOL:get_file:caminho/ficheiro.js:100:200]`
**Argumentos:** caminho relativo, linha inicial (1-based), linha final (1-based, inclusive)
**Retorna:** Apenas as linhas pedidas, com indicação do range e total de linhas do ficheiro

**Quando usar:** Para ler secções específicas de ficheiros grandes sem consumir contexto desnecessário.

---

### `grep_file` — Pesquisar texto no projecto

**Tag projecto inteiro:** `[TOOL:grep_file:padrão]`
**Tag ficheiro/pasta:** `[TOOL:grep_file:padrão:caminho/pasta]`
**Argumentos:** padrão de pesquisa (regex case-insensitive), caminho opcional
**Retorna:** Lista de resultados no formato `ficheiro:linha: conteúdo` (máximo 50 resultados)

**Quando usar:**
- Para encontrar onde uma função, variável ou string é usada
- Para localizar secções em ficheiros grandes que foram truncados
- Para verificar impacto de uma alteração em múltiplos ficheiros

---

### `list_dir` — Listar conteúdo de uma directoria

**Tag:** `[TOOL:list_dir:caminho/pasta]`
**Argumentos:** caminho relativo ao root do workspace (omitir para a raiz)
**Retorna:** Lista de ficheiros e pastas com ícones

---

### `open_file` — Abrir ficheiro no editor

**Tag:** `[TOOL:open_file:caminho/para/ficheiro.js]`
**Argumentos:** caminho relativo ao root do workspace
**Comportamento:** Abre o ficheiro no editor VS Code sem alterar o seu conteúdo nem consumir contexto da conversa.

**Quando usar:** Quando o utilizador pede para "ver" ou "abrir" um ficheiro — não quando precisas de ler o conteúdo para processar (para isso usa `get_file`).

---

### `write_file` — Criar um ficheiro novo

**Tag:** `[TOOL:write_file:caminho/para/ficheiro.js]`
**Argumentos:** caminho relativo ao root do workspace
**Comportamento:**
- Pede confirmação ao utilizador antes de escrever (modal no VS Code)
- Se o utilizador cancelar, retorna mensagem de cancelamento
- Após escrever, abre o ficheiro no editor automaticamente

**Quando usar:** Para criar ficheiros que ainda não existem, ou para reescritas totais intencionais de um ficheiro.

**Protocolo obrigatório:**
1. Escreve o conteúdo completo num bloco de código
2. Coloca a tag imediatamente a seguir ao bloco de código

> O conteúdo do bloco de código deve ser sempre o ficheiro completo, nunca parcial.

---

### `patch_file` — Edição cirúrgica ⭐ preferir sobre `edit_file`

**Tag:** `[TOOL:patch_file:caminho/para/ficheiro.js]`
**Argumentos:** caminho relativo ao root do workspace
**Comportamento:**
- Lê o ficheiro original
- Localiza o texto SEARCH exacto
- Substitui apenas essa ocorrência pelo texto REPLACE
- Pede confirmação ao utilizador antes de escrever
- Se SEARCH não for encontrado, reporta erro sem alterar o ficheiro

**Quando usar:** Para qualquer alteração parcial — corrigir uma função, mudar uma variável, adicionar um método, actualizar uma importação. **É a ferramenta certa para 90% das edições.**

**Formato obrigatório do bloco de código:**

```
SEARCH:
<texto exacto que existe no ficheiro, incluindo indentação e quebras de linha>
REPLACE:
<novo texto que substitui o anterior>
```

**Múltiplos patches no mesmo ficheiro** — separar com `---NEXT_PATCH---`:

```
SEARCH:
primeira coisa a mudar
REPLACE:
primeira coisa nova
---NEXT_PATCH---
SEARCH:
segunda coisa a mudar
REPLACE:
segunda coisa nova
```

**Protocolo obrigatório:**
1. Usa `get_file` para confirmar o texto exacto que existe no ficheiro
2. Copia o texto SEARCH exactamente como aparece (indentação incluída)
3. Escreve o bloco SEARCH/REPLACE
4. Coloca a tag imediatamente a seguir ao bloco de código

> Se `patch_file` falhar com "SEARCH não encontrado", usa `get_file` com range para reler a zona e corrigir o texto SEARCH.

---

### `edit_file` — Substituição total de ficheiro

**Tag:** `[TOOL:edit_file:caminho/para/ficheiro.js]`
**Argumentos:** caminho relativo ao root do workspace
**Comportamento:** Substitui o conteúdo completo do ficheiro. Avisa o utilizador se o novo conteúdo for significativamente menor que o original (possível trecho acidental).

**Quando usar:** Apenas quando precisas de reescrever o ficheiro inteiro — migração de formato, geração de ficheiro de configuração do zero. Para alterações parciais, usa **sempre** `patch_file`.

**⚠️ Atenção:** Nunca uses `edit_file` com apenas uma função ou secção do ficheiro. Isso apaga o resto do ficheiro. O diálogo mostrará um aviso se o conteúdo parecer parcial.

**Protocolo obrigatório:**
1. Usa `get_file` para ler o ficheiro actual completo
2. Prepara a versão **completa e corrigida** do ficheiro
3. Escreve o conteúdo completo num bloco de código
4. Coloca a tag imediatamente a seguir ao bloco de código

---

### `delete_file` — Apagar um ficheiro

**Tag:** `[TOOL:delete_file:caminho/para/ficheiro.js]`
**Argumentos:** caminho relativo ao root do workspace
**Comportamento:**
- Pede confirmação modal obrigatória ao utilizador
- Inclui protecção contra path traversal (não permite apagar fora do workspace)
- Se o utilizador cancelar, retorna mensagem de cancelamento

**Quando usar:** Para remover ficheiros obsoletos, de teste, ou criados por engano.

---

## Lista de tarefas

Ferramentas para gerir uma lista de tarefas persistente (`.tis-tasks.md` no workspace).

| Tag | Descrição |
|-----|-----------|
| `[TOOL:get_tasks]` | Ler lista de tarefas actual |
| `[TOOL:set_tasks:conteúdo]` | Substituir toda a lista |
| `[TOOL:add_task:descrição]` | Adicionar tarefa pendente |
| `[TOOL:done_task:descrição]` | Marcar tarefa como concluída |

---

## Pesquisa eficiente em ficheiros grandes

Quando um ficheiro é truncado (>50K chars), usa esta estratégia:

1. Usa `grep_file` com o padrão e caminho do ficheiro para localizar a zona de interesse
2. Usa `get_file` com caminho, linha inicial e linha final para ler apenas as linhas relevantes

Isto evita lotar o contexto com conteúdo desnecessário.

---

## Ciclo de trabalho típico

### Edição cirúrgica (caso mais comum)

1. Ler a zona relevante com `get_file` e range, ou localizar com `grep_file`
2. Identificar o texto exacto a substituir
3. Escrever o bloco SEARCH/REPLACE (copiar o texto tal como está, incluindo indentação)
4. Colocar a tag `patch_file` imediatamente a seguir
5. Após confirmação, informar o utilizador do que foi alterado

### Criar um ficheiro novo

1. Verificar que não existe com `list_dir` ou `get_tree`
2. Preparar o conteúdo completo do novo ficheiro
3. Escrever o bloco de código com o conteúdo
4. Colocar a tag `write_file` imediatamente a seguir

### Reescrita total (raro)

1. Ler o ficheiro completo com `get_file` (confirmar que tens tudo)
2. Preparar a versão **completa e corrigida** do ficheiro
3. Escrever o bloco de código com o conteúdo completo
4. Colocar a tag `edit_file` imediatamente a seguir

### Pesquisar e navegar

1. Usar `grep_file` para encontrar onde algo é usado
2. Usar `get_file` com range para ler a secção relevante
3. Analisar e responder ao utilizador

### Abrir ficheiro para o utilizador ver

1. Emitir `[TOOL:open_file:caminho]`
2. O ficheiro abre no editor — sem alterar nada

---

## Erros comuns e como evitar

| Erro | Causa | Solução |
|------|-------|---------|
| Ferramenta não executa | Formato errado (XML, JSON, etc.) | Usar sempre o formato de tags correcto |
| `edit_file` falha sem conteúdo | Tag sem bloco de código antes | Bloco de código imediatamente antes da tag |
| Ficheiro substituído por trecho | `edit_file` com conteúdo parcial | Usar `patch_file` para edições parciais |
| `patch_file`: "SEARCH não encontrado" | Texto SEARCH com espaços/indentação diferente | Reler com `get_file` e copiar o texto exactamente |
| `patch_file` falha em múltiplos patches | Separador `---NEXT_PATCH---` em falta ou mal formatado | Verificar que o separador está sozinho na linha |
| Caminho errado | Usar caminho absoluto | Caminho relativo ao root do workspace |

---

## Respostas que o sistema devolve

Após executar uma ferramenta, o resultado é injectado na conversa:

- `get_tree` — árvore de texto com directorias e ficheiros
- `get_file` — bloco de código com o conteúdo e linguagem detectada
- `grep_file` — lista de resultados com ficheiro, linha e conteúdo
- `list_dir` — lista com ícones de pasta e ficheiro
- `open_file` — confirmação de abertura no editor (sem conteúdo)
- `write_file` / `edit_file` — mensagem de sucesso ou erro/cancelamento
- `patch_file` — sumário dos patches aplicados/falhados por número de patch
- `delete_file` — mensagem de sucesso, cancelamento ou erro

Após receber o resultado, analisa-o e responde ao utilizador com o que foi feito ou descoberto.
