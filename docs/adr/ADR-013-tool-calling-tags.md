# ADR-013 — Protocolo de Tool Calling via tags de texto

**Estado:** Aceite
**Data:** 2026-04-01

## Contexto

Para dar ao agente Tess acesso ao filesystem do projecto (ler ficheiros, listar estrutura, escrever ficheiros), é necessário um mecanismo de tool calling. A API Tess não suporta function calling formal no formato OpenAI (campo `tools` no body do pedido).

## Decisão

Protocolo baseado em tags de texto inseridas pelo agente na sua resposta:

```
[TOOL:get_tree]
[TOOL:get_file:src/extension.js]
[TOOL:list_dir:src]
[TOOL:write_file:caminho/ficheiro.js:conteudo completo]
```

**Fluxo de execução:**

1. O agente inclui uma tag `[TOOL:...]` na resposta
2. `finalizeAssistant()` no WebView detecta as tags com regex ao receber `endResponse`
3. As tags são removidas do texto visível; o WebView envia `{ type: 'toolCall', tool, args }` para a extensão
4. `provider.js` delega para `executeTool()` em `tools.js`
5. O resultado é enviado de volta ao WebView como `{ type: 'toolResult', tool, args, result }`
6. O WebView injeta o resultado no histórico como mensagem `user` e reenvia para a API para continuar a conversa

**Ferramentas disponíveis:**

| Tag | Descrição |
|-----|-----------|
| `[TOOL:get_tree]` | Estrutura completa do projecto |
| `[TOOL:get_file:caminho]` | Conteúdo de um ficheiro |
| `[TOOL:list_dir:caminho]` | Conteúdo de uma directoria |
| `[TOOL:write_file:caminho:conteudo]` | Escrever/editar ficheiro (pede confirmação) |

## Alternativas rejeitadas

- **Function calling OpenAI formal:** A API Tess não suporta o campo `tools` no body do pedido ao endpoint `/openai/chat/completions`.
- **Detecção no lado Node.js (api.js):** Criaria duplicação — o WebView já recebe o stream chunk a chunk e é o lugar natural para finalizar e interpretar a resposta completa. A detecção foi mantida exclusivamente em `finalizeAssistant()` no webview-script.
- **Endpoint separado de ferramentas:** Aumentaria a complexidade sem ganho funcional.

## Consequências

- O system prompt do agente Tess precisa de documentar o protocolo de tags para que o modelo o use correctamente — ver `getToolsSystemPrompt()` em `tools.js`.
- `write_file` requer confirmação explícita do utilizador via modal VS Code (`showWarningMessage`) antes de escrever qualquer ficheiro.
- Ficheiros acima de 50 000 caracteres são truncados com aviso para proteger o contexto.
- O utilizador vê uma notificação visual (`appendToolNotice`) enquanto a ferramenta executa.
- O protocolo é frágil se o modelo gerar as tags com formatação incorrecta — mitigado pelo system prompt detalhado.
