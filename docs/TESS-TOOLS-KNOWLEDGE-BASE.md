
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

### `write_file` — Criar um ficheiro novo

**Tag:** `[TOOL:write_file:caminho/para/ficheiro.js]`
**Argumentos:** caminho relativo ao root do workspace
**Comportamento:**
- Pede confirmação ao utilizador antes de escrever (modal no VS Code)
- Se o utilizador cancelar, retorna mensagem de cancelamento
- Após escrever, abre o ficheiro no editor automaticamente

**Protocolo obrigatório:**
1. Escreve o conteúdo completo num bloco de código
2. Coloca a tag imediatamente a seguir ao bloco de código

> O conteúdo do bloco de código deve ser sempre o ficheiro completo, nunca parcial.

---

### `edit_file` — Editar um ficheiro existente

**Tag:** `[TOOL:edit_file:caminho/para/ficheiro.js]`
**Argumentos:** caminho relativo ao root do workspace
**Comportamento:** Idêntico ao `write_file` — substitui o conteúdo completo do ficheiro

**Protocolo obrigatório:**
1. Usa `get_file` para ler o ficheiro actual
2. Prepara a versão completa e corrigida do ficheiro
3. Escreve o conteúdo num bloco de código
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

### Ler e editar um ficheiro

1. Ler o ficheiro com `get_file`
2. Analisar o código, identificar o problema
3. Preparar o ficheiro corrigido completo
4. Escrever o bloco de código com o conteúdo completo
5. Colocar a tag `edit_file` imediatamente a seguir
6. Após confirmação, responder ao utilizador com o que foi alterado

### Explorar e criar

1. Verificar o que já existe com `list_dir` ou `get_tree`
2. Preparar o conteúdo do novo ficheiro
3. Escrever o bloco de código com o conteúdo
4. Colocar a tag `write_file` imediatamente a seguir

### Pesquisar e navegar

1. Usar `grep_file` para encontrar onde algo é usado
2. Usar `get_file` com range para ler a secção relevante
3. Analisar e responder ao utilizador

---

## Erros comuns e como evitar

| Erro | Causa | Solução |
|------|-------|---------|
| Ferramenta não executa | Formato errado (XML, JSON, etc.) | Usar sempre o formato de tags correcto |
| `edit_file` falha sem conteúdo | Tag sem bloco de código antes | Bloco de código imediatamente antes da tag |
| Conteúdo parcial no ficheiro | Uso de "resto do código" ou "..." | Ficheiro sempre completo |
| Caminho errado | Usar caminho absoluto | Caminho relativo ao root do workspace |

---

## Respostas que o sistema devolve

Após executar uma ferramenta, o resultado é injectado na conversa:

- `get_tree` — árvore de texto com directorias e ficheiros
- `get_file` — bloco de código com o conteúdo e linguagem detectada
- `grep_file` — lista de resultados com ficheiro, linha e conteúdo
- `list_dir` — lista com ícones de pasta e ficheiro
- `write_file` / `edit_file` — mensagem de sucesso ou erro/cancelamento
- `delete_file` — mensagem de sucesso, cancelamento ou erro

Após receber o resultado, analisa-o e responde ao utilizador com o que foi feito ou descoberto.
