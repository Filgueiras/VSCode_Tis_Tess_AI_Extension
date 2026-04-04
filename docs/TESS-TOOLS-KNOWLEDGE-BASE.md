# Tess Tools — Guia de Conhecimento do Agente

> **Nota de manutenção:** Este documento é derivado de `src/tools.js`.
> Sempre que esse ficheiro for alterado (novas ferramentas, novos argumentos, mudança de protocolo),
> este guia deve ser actualizado em conformidade.

---

## O que são as Tess Tools

São ferramentas integradas na extensão VS Code Tess que permitem ao agente ler, listar e escrever
ficheiros directamente no projecto aberto pelo utilizador, sem necessidade de MCP ou plugins externos.
A extensão intercepta as tags na resposta do agente e executa as operações correspondentes.

---

## Formato obrigatório das tags

```
[TOOL:nome_ferramenta]
[TOOL:nome_ferramenta:argumento]
```

- As tags são detectadas pela extensão na resposta do agente
- São removidas do texto visível — o utilizador não as vê
- Qualquer outro formato (`<file_read>`, `<tool_call>`, função JSON, etc.) é ignorado pelo sistema

---

## Ferramentas disponíveis

### `get_tree` — Ver estrutura do projecto

**Tag:** `[TOOL:get_tree]`
**Argumentos:** nenhum
**Retorna:** Árvore de directorias e ficheiros do workspace

**Quando usar:** Sempre que não conheces a estrutura do projecto ou precisas de saber que ficheiros existem antes de actuar.

**Exemplo:**
```
Vou ver a estrutura do projecto primeiro.
[TOOL:get_tree]
```

---

### `get_file` — Ler conteúdo de um ficheiro

**Tag:** `[TOOL:get_file:caminho/para/ficheiro.js]`
**Argumentos:** caminho relativo ao root do workspace
**Retorna:** Conteúdo do ficheiro num bloco de código com a linguagem detectada

**Quando usar:** Antes de editar qualquer ficheiro — nunca edites sem ler primeiro.

**Exemplo:**
```
Deixa-me ler o ficheiro antes de propor alterações.
[TOOL:get_file:src/api.js]
```

---

### `list_dir` — Listar conteúdo de uma directoria

**Tag:** `[TOOL:list_dir:caminho/pasta]`
**Argumentos:** caminho relativo ao root do workspace (omitir para a raiz)
**Retorna:** Lista de ficheiros e pastas com ícones (📁 pasta, 📄 ficheiro)

**Quando usar:** Para explorar uma pasta específica sem precisar da árvore completa.

**Exemplos:**
```
[TOOL:list_dir]              ← raiz do projecto
[TOOL:list_dir:src]          ← pasta src
[TOOL:list_dir:docs/adr]     ← sub-pasta
```

---

### `write_file` — Criar um ficheiro novo

**Tag:** `[TOOL:write_file:caminho/para/ficheiro.js]`
**Argumentos:** caminho relativo ao root do workspace
**Comportamento:**
- Pede confirmação ao utilizador antes de escrever (modal no VS Code)
- Se o utilizador cancelar, retorna mensagem de cancelamento
- Após escrever, abre o ficheiro no editor automaticamente

**Protocolo obrigatório:**
1. Escreve o conteúdo **completo** num bloco de código
2. Coloca a tag `[TOOL:write_file:caminho]` **imediatamente a seguir** ao bloco

**Exemplo:**
````
```javascript
// src/utils/helpers.js
function formatDate(date) {
    return date.toISOString().split('T')[0];
}

module.exports = { formatDate };
```
[TOOL:write_file:src/utils/helpers.js]
````

---

### `edit_file` — Editar um ficheiro existente

**Tag:** `[TOOL:edit_file:caminho/para/ficheiro.js]`
**Argumentos:** caminho relativo ao root do workspace
**Comportamento:** Idêntico ao `write_file` — substitui o conteúdo completo do ficheiro

**Protocolo obrigatório:**
1. Usa `get_file` para ler o ficheiro actual
2. Prepara a versão **completa e corrigida** do ficheiro
3. Escreve o conteúdo num bloco de código
4. Coloca a tag `[TOOL:edit_file:caminho]` **imediatamente a seguir** ao bloco

**Exemplo:**
````
Li o ficheiro. Vou aplicar as alterações:

```javascript
// src/api.js — versão completa corrigida
'use strict';
// ... conteúdo completo ...
```
[TOOL:edit_file:src/api.js]
````

> **Atenção:** O conteúdo do bloco de código deve ser sempre o ficheiro **completo**,
> nunca parcial ou com `// ... resto do código ...`.

---

## Ciclo de trabalho típico

### Ler e editar um ficheiro

```
Utilizador: "Corrige o bug na função parseResponse em src/api.js"

Agente:
1. [TOOL:get_file:src/api.js]         ← lê o ficheiro

[após receber o resultado]
2. Analisa o código, identifica o bug
3. Prepara o ficheiro corrigido completo
4. ```javascript
   // conteúdo completo corrigido
   ```
   [TOOL:edit_file:src/api.js]        ← escreve o ficheiro

[após confirmação do utilizador e resultado]
5. Responde ao utilizador com o que foi alterado
```

### Explorar e criar

```
Utilizador: "Cria um ficheiro de configuração em config/"

Agente:
1. [TOOL:list_dir:config]             ← verifica o que já existe
2. Prepara o conteúdo
3. ```json
   { ... }
   ```
   [TOOL:write_file:config/default.json]
```

---

## Erros comuns e como evitar

| Erro | Causa | Solução |
|------|-------|---------|
| Ferramenta não executa | Formato errado (`<file_read>`, JSON) | Usar sempre `[TOOL:nome:arg]` |
| `edit_file` falha sem conteúdo | Tag sem bloco de código antes | Bloco de código **antes** da tag |
| Conteúdo parcial no ficheiro | Uso de `// ... resto ...` | Ficheiro **sempre completo** |
| Caminho errado | Usar caminho absoluto | Caminho **relativo** ao root do workspace |

---

## Respostas que o sistema devolve

Após executar uma ferramenta, o resultado é injectado na conversa. Exemplos:

- `get_tree` → árvore de texto com directorias e ficheiros
- `get_file` → bloco de código com o conteúdo e linguagem detectada
- `list_dir` → lista com ícones 📁 📄
- `write_file` / `edit_file` → `"Ficheiro criado com sucesso: src/utils.js"` ou mensagem de erro/cancelamento

Após receber o resultado, analisa-o e responde ao utilizador com o que foi feito ou descoberto.
