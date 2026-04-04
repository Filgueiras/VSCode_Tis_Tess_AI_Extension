# PROBLEMA PARA FAZER A MANIPULAÇÃO DOS FICHEIROS

O código já está pronto, mas o modelo (Claude) não consegue entender o que é para fazer...

Agora tenho o quadro completo. A tua intuição está certa — não precisas de MCP. O sistema já está construído e funciona. O problema é diferente.

##O que tens (e funciona bem)
A extensão tem um protocolo próprio em src/tools.js:

-Ferramentas: get_tree, get_file, list_dir, write_file, edit_file
-Formato: [TOOL:get_file:src/api.js]
-System prompt enviado ao modelo a explicar o protocolo (linha 138 do src/provider.js)

##O problema real
O agente está a usar <file_read>docs/GUIA-BUILD.md</file_read> — o formato errado. O modelo está a ignorar o system prompt e a usar um formato que aprendeu no treino (provavelmente Claude ou GPT-4 nativo).

**Causas prováveis:**

-**O agente Tess tem um system prompt próprio** que sobrepõe ou dilui o teu
-**O model está a "confabular"** o formato de tool use em vez de seguir as instruções
-**Falta de few-shot examples** — o system prompt descreve o formato mas não mostra um exemplo de conversa completa com tool use real

#O que podes melhorar no system prompt

Em src/tools.js:141, reforçar com linguagem mais directiva e exemplos de uso em contexto de conversa:

CRÍTICO: Nunca uses <file_read>, <tool_call> ou qualquer outro formato.
O ÚNICO formato válido é: [TOOL:nome:argumento]
Se usares outro formato, a ferramenta NÃO será executada.
E adicionar um exemplo de conversa completa no system prompt mostrando o ciclo tool → resultado → resposta.

Queres que eu atualize o system prompt em src/tools.js para ser mais robusto?